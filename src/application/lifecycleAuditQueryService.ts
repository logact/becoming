import { isCoreEntityType } from '../domain/entityTypes';
import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Project } from '../domain/project';
import type { ProjectState } from '../domain/projectState';
import type { ProjectStateTransition } from '../domain/projectStateTransition';
import type { Label } from '../domain/label';
import type { Record } from '../domain/record';
import {
  STATE_TRANSITION_AUDIT_SCHEMA_VERSION,
  STATE_TRANSITION_RECORD_TYPE,
} from '../domain/stateTransitionAudit';
import type { StateTransitionAuditPayload } from '../domain/stateTransitionAudit';
import type { CoreEntityLookup } from './coreEntityLookup';
import type { RecordHistoryRepository, RecordTimeRange } from '../persistence/recordRepository';
import type { LabelRepository } from '../persistence/labelRepository';
import type { ProjectStateRepository } from '../persistence/projectStateRepository';
import type { ProjectStateTransitionRepository } from '../persistence/projectStateTransitionRepository';

/** Filters for durable state-transition audit Records. Every supplied field is ANDed. */
export interface LifecycleAuditHistoryQuery {
  projectId?: EntityId;
  entityType?: string;
  entityId?: EntityId;
  labelId?: EntityId;
  fromProjectStateId?: EntityId;
  toProjectStateId?: EntityId;
  projectTransitionId?: EntityId;
  actor?: string;
  /** Inclusive transition-time bounds. */
  occurredAt?: RecordTimeRange;
  /** Active Records are the default; history readers explicitly opt into all. */
  status?: 'active' | 'archived' | 'all';
  /** Resolve current definitions through the optional read ports. Defaults to true. */
  includeLiveReferences?: boolean;
}

export class LifecycleAuditQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleAuditQueryValidationError';
  }
}

/** A corrupt stored audit cannot be safely presented as a lifecycle fact. */
export class LifecycleAuditPayloadError extends Error {
  constructor(recordId: EntityId) {
    super(`State-transition audit Record ${recordId} has an invalid payload`);
    this.name = 'LifecycleAuditPayloadError';
  }
}

export type LifecycleAuditReferenceStatus = 'available' | 'archived' | 'changed' | 'missing';

export interface LifecycleAuditLiveReference<T> {
  status: LifecycleAuditReferenceStatus;
  value: T | null;
}

export interface LifecycleAuditLiveReferences {
  project?: LifecycleAuditLiveReference<Project>;
  entity?: LifecycleAuditLiveReference<{ id: EntityId; archivedAt?: IsoTimestamp | null }>;
  label?: LifecycleAuditLiveReference<Label>;
  fromState?: LifecycleAuditLiveReference<ProjectState>;
  toState?: LifecycleAuditLiveReference<ProjectState>;
  transition?: LifecycleAuditLiveReference<ProjectStateTransition>;
}

/** One chronology entry retains both its immutable Record and typed audit facts. */
export interface LifecycleAuditHistoryEntry {
  record: Record;
  payload: StateTransitionAuditPayload;
  /** Copied from the immutable payload so consumers do not need to inspect JSON. */
  actor: string;
  /** The transition time, independent of when the Record was entered. */
  occurredAt: IsoTimestamp;
  references?: LifecycleAuditLiveReferences;
}

/** Minimal archive-aware entity resolver; individual aggregate repositories may adapt to it. */
export interface LifecycleAuditEntityLookup extends CoreEntityLookup {
  getById?(
    entityType: CoreEntityType,
    id: EntityId,
  ): Promise<{ id: EntityId; archivedAt?: IsoTimestamp | null } | null>;
}

export interface LifecycleAuditProjectLookup {
  getById(id: EntityId): Promise<Project | null>;
}

export interface LifecycleAuditQueryServicePorts {
  records: RecordHistoryRepository;
  projects?: LifecycleAuditProjectLookup;
  entities?: LifecycleAuditEntityLookup;
  labels?: Pick<LabelRepository, 'getById'>;
  states?: Pick<ProjectStateRepository, 'getById'>;
  transitions?: Pick<ProjectStateTransitionRepository, 'getById'>;
}

/**
 * Read-side boundary for lifecycle audit history. It only interprets durable
 * `state_transition` Records; it neither executes rules nor aggregates other
 * provenance streams. Payload snapshots are always authoritative history,
 * while optional live references add present-day navigation context.
 */
export class LifecycleAuditQueryService {
  constructor(private readonly ports: LifecycleAuditQueryServicePorts) {}

  async listHistory(query: LifecycleAuditHistoryQuery = {}): Promise<LifecycleAuditHistoryEntry[]> {
    assertQuery(query);
    const records = await this.listAuditRecords(query.status ?? 'active');
    const entries = records
      .map((record) => ({ record, payload: readPayload(record) }))
      .filter(({ payload }) => matches(payload, query))
      .sort(compareEntries);

    if (query.includeLiveReferences === false) {
      return entries.map(({ record, payload }) => ({ record, payload, actor: payload.actor, occurredAt: payload.occurredAt }));
    }
    return Promise.all(entries.map(async ({ record, payload }) => ({
      record,
      payload,
      actor: payload.actor,
      occurredAt: payload.occurredAt,
      references: await this.resolveReferences(payload),
    })));
  }

  private async listAuditRecords(status: 'active' | 'archived' | 'all'): Promise<Record[]> {
    const result: Record[] = [];
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const page = await this.ports.records.list({ status, recordType: STATE_TRANSITION_RECORD_TYPE, limit, offset });
      result.push(...page);
      if (page.length < limit) return result;
    }
  }

  private async resolveReferences(payload: StateTransitionAuditPayload): Promise<LifecycleAuditLiveReferences> {
    const references: LifecycleAuditLiveReferences = {};
    if (this.ports.projects !== undefined) {
      references.project = toReference(await this.ports.projects.getById(payload.projectId));
    }
    if (this.ports.entities !== undefined) {
      const entity: { id: EntityId; archivedAt?: IsoTimestamp | null } | null = this.ports.entities.getById === undefined
        ? await this.ports.entities.exists(payload.entityType, payload.entityId).then((exists) => exists ? { id: payload.entityId } : null)
        : await this.ports.entities.getById(payload.entityType, payload.entityId);
      references.entity = toReference(entity);
    }
    if (this.ports.labels !== undefined) {
      references.label = toReference(await this.ports.labels.getById(payload.labelId), (label) => label.name !== payload.snapshot.label.name);
    }
    if (this.ports.states !== undefined) {
      references.fromState = toReference(await this.ports.states.getById(payload.fromProjectStateId), (state) => state.title !== payload.snapshot.fromState.title || state.category !== payload.snapshot.fromState.category);
      references.toState = toReference(await this.ports.states.getById(payload.toProjectStateId), (state) => state.title !== payload.snapshot.toState.title || state.category !== payload.snapshot.toState.category);
    }
    if (this.ports.transitions !== undefined) {
      references.transition = toReference(await this.ports.transitions.getById(payload.projectTransitionId), (transition) => transition.title !== payload.snapshot.transition.title);
    }
    return references;
  }
}

function toReference<T extends object>(value: T | null, changed?: (value: T) => boolean): LifecycleAuditLiveReference<T> {
  if (value === null) return { status: 'missing', value: null };
  const archivedAt = (value as { archivedAt?: IsoTimestamp | null }).archivedAt;
  if (archivedAt !== undefined && archivedAt !== null) return { status: 'archived', value };
  return { status: changed?.(value) ? 'changed' : 'available', value };
}

function matches(payload: StateTransitionAuditPayload, query: LifecycleAuditHistoryQuery): boolean {
  return (query.projectId === undefined || payload.projectId === query.projectId) &&
    (query.entityType === undefined || payload.entityType === query.entityType) &&
    (query.entityId === undefined || payload.entityId === query.entityId) &&
    (query.labelId === undefined || payload.labelId === query.labelId) &&
    (query.fromProjectStateId === undefined || payload.fromProjectStateId === query.fromProjectStateId) &&
    (query.toProjectStateId === undefined || payload.toProjectStateId === query.toProjectStateId) &&
    (query.projectTransitionId === undefined || payload.projectTransitionId === query.projectTransitionId) &&
    (query.actor === undefined || payload.actor === query.actor) &&
    inRange(payload.occurredAt, query.occurredAt);
}

function compareEntries(left: { record: Record; payload: StateTransitionAuditPayload }, right: { record: Record; payload: StateTransitionAuditPayload }): number {
  const transitionTime = left.payload.occurredAt.localeCompare(right.payload.occurredAt);
  if (transitionTime !== 0) return transitionTime;
  const recordedTime = left.record.recordedAt.localeCompare(right.record.recordedAt);
  return recordedTime === 0 ? left.record.id.localeCompare(right.record.id) : recordedTime;
}

function inRange(value: IsoTimestamp, range: RecordTimeRange | undefined): boolean {
  return (range?.start === undefined || value >= range.start) && (range?.end === undefined || value <= range.end);
}

function assertQuery(query: LifecycleAuditHistoryQuery): void {
  if (query.entityType !== undefined && !isCoreEntityType(query.entityType)) {
    throw new LifecycleAuditQueryValidationError(`Lifecycle audit entityType must be a core entity type, got ${JSON.stringify(query.entityType)}`);
  }
  if (query.entityId !== undefined && query.entityType === undefined) {
    throw new LifecycleAuditQueryValidationError('Lifecycle audit entityId requires entityType');
  }
  for (const [name, value] of Object.entries(query)) {
    if (['occurredAt', 'status', 'includeLiveReferences'].includes(name) || value === undefined) continue;
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new LifecycleAuditQueryValidationError(`Lifecycle audit ${name} must not be blank`);
    }
  }
  if (query.status !== undefined && !['active', 'archived', 'all'].includes(query.status)) {
    throw new LifecycleAuditQueryValidationError('Lifecycle audit status must be active, archived, or all');
  }
  assertRange(query.occurredAt);
}

function assertRange(range: RecordTimeRange | undefined): void {
  if (range === undefined) return;
  for (const [name, value] of Object.entries(range)) {
    if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
      throw new LifecycleAuditQueryValidationError(`Lifecycle audit occurredAt.${name} must be a valid ISO 8601 timestamp`);
    }
  }
  if (range.start !== undefined && range.end !== undefined && range.start > range.end) {
    throw new LifecycleAuditQueryValidationError('Lifecycle audit occurredAt.start must not be after end');
  }
}

function readPayload(record: Record): StateTransitionAuditPayload {
  const value = record.payload;
  if (record.recordType !== STATE_TRANSITION_RECORD_TYPE || value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LifecycleAuditPayloadError(record.id);
  }
  const payload = value as unknown as StateTransitionAuditPayload;
  if (payload.schemaVersion !== STATE_TRANSITION_AUDIT_SCHEMA_VERSION || !isCoreEntityType(payload.entityType) ||
    !nonBlank(payload.projectId) || !nonBlank(payload.entityId) || !nonBlank(payload.labelId) ||
    !nonBlank(payload.fromProjectStateId) || !nonBlank(payload.toProjectStateId) || !nonBlank(payload.projectTransitionId) ||
    !nonBlank(payload.actor) || !isTimestamp(payload.occurredAt) || !validSnapshots(payload) || !validEvaluation(payload)) {
    throw new LifecycleAuditPayloadError(record.id);
  }
  return payload;
}

function validSnapshots(payload: StateTransitionAuditPayload): boolean {
  const snapshot = payload.snapshot;
  return snapshot !== null && typeof snapshot === 'object' && nonBlank(snapshot.fromState?.title) &&
    (snapshot.fromState.category === null || typeof snapshot.fromState.category === 'string') &&
    nonBlank(snapshot.toState?.title) && (snapshot.toState.category === null || typeof snapshot.toState.category === 'string') &&
    (snapshot.transition?.title === null || typeof snapshot.transition?.title === 'string') && nonBlank(snapshot.label?.name);
}

function validEvaluation(payload: StateTransitionAuditPayload): boolean {
  const report = payload.evaluation;
  const valid = (items: unknown) => Array.isArray(items) && items.every((item) => typeof item === 'object' && item !== null && nonBlank((item as { ruleId?: unknown }).ruleId) && ['satisfied', 'not_satisfied', 'not_evaluated'].includes((item as { outcome?: unknown }).outcome as string) && nonBlank((item as { summary?: unknown }).summary));
  return report !== null && typeof report === 'object' && valid(report.conditions) && valid(report.exitCriteria);
}

function nonBlank(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function isTimestamp(value: unknown): value is IsoTimestamp { return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value)); }
