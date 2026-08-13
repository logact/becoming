import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import type { EntityId, IsoTimestamp } from './ids';
import type { JsonValue } from './json';
import { PROVENANCE_RECORD_TYPE } from './mutationProvenance';
import type { Record as OccurrenceRecord } from './record';
import { STATE_TRANSITION_RECORD_TYPE } from './stateTransitionAudit';

/**
 * The stable, read-only timeline representation of one append-oriented
 * Record. This is a projection contract only: timeline events are never
 * stored separately and never replace their source Records.
 */
export const TIMELINE_EVENT_SCHEMA_VERSION = 1;

export const TIMELINE_EVENT_CATEGORIES = [
  'mutation',
  'relation',
  'lineage',
  'lifecycle',
  'correction',
  'occurrence',
] as const;

export type TimelineEventCategory = (typeof TIMELINE_EVENT_CATEGORIES)[number];

/** A logical reference to one of the eight independent core aggregate tables. */
export interface TimelineEntityReference {
  type: CoreEntityType;
  id: EntityId;
}

/** Relation identity and immutable endpoint context kept by relation events. */
export interface TimelineRelationReference {
  id: EntityId;
  type: string;
  source: TimelineEntityReference;
  target: TimelineEntityReference;
}

/** Machine-definition references exposed by one lifecycle event. */
export interface TimelineStateReferences {
  projectId: EntityId;
  labelId: EntityId;
  fromProjectStateId: EntityId;
  toProjectStateId: EntityId;
  projectTransitionId: EntityId;
}

export interface TimelineMutationPayload {
  kind: 'mutation';
  action: string;
  before: JsonValue | null;
  after: JsonValue | null;
}

export interface TimelineRelationPayload {
  kind: 'relation' | 'lineage';
  action: 'relation_created' | 'relation_ended';
  metadata: JsonValue | null;
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
}

export interface TimelineLifecyclePayload {
  kind: 'lifecycle';
  schemaVersion: number;
  snapshot: JsonValue;
  evaluation: JsonValue;
}

export interface TimelineCorrectionPayload {
  kind: 'correction';
  changes: JsonValue;
}

/** Direct occurrences, unknown record types, and malformed known payloads. */
export interface TimelineOccurrencePayload {
  kind: 'occurrence';
  recordType: string;
  data: JsonValue | null;
  /** Why a reserved Record type could not be safely classified. */
  fallbackReason?: 'unknown_record_type' | 'malformed_payload';
}

export type TimelineCategoryPayload =
  | TimelineMutationPayload
  | TimelineRelationPayload
  | TimelineLifecyclePayload
  | TimelineCorrectionPayload
  | TimelineOccurrencePayload;

/**
 * Versioned, framework-neutral consumer contract. `affectedEntity` is the
 * primary identity asserted by structured audit data. `relatedEntities`
 * covers relation endpoints and supporting execution context; it is unique
 * by `(type, id)` and is suitable for timeline inclusion checks.
 */
export interface TimelineEvent {
  schemaVersion: typeof TIMELINE_EVENT_SCHEMA_VERSION;
  recordId: EntityId;
  recordType: string;
  occurredAt: IsoTimestamp;
  recordedAt: IsoTimestamp;
  actor: string | null;
  summary: string;
  archivedAt: IsoTimestamp | null;
  category: TimelineEventCategory;
  affectedEntity: TimelineEntityReference | null;
  relatedEntities: readonly TimelineEntityReference[];
  relation: TimelineRelationReference | null;
  states: TimelineStateReferences | null;
  payload: TimelineCategoryPayload;
}

type JsonObject = { readonly [key: string]: JsonValue };

/**
 * Adapt a source Record into the one public timeline shape. A malformed or
 * future category payload deliberately falls back to a direct occurrence;
 * history remains visible rather than being silently dropped.
 */
export function adaptRecordToTimelineEvent(record: OccurrenceRecord): TimelineEvent {
  const base = eventBase(record);
  const payload = objectPayload(record.payload);

  // Relation provenance intentionally uses the general mutation Record type;
  // inspect its discriminating relation identity before generic mutations.
  const relation = relationFrom(payload);
  if (relation !== null) {
    const lineage = relation.type === 'origin_of' || relation.type === 'transforms_into';
    const action = stringAt(payload, 'action') as 'relation_created' | 'relation_ended';
    const createdAt = timestampAt(payload, 'created_at');
    const endedAt = optionalTimestampAt(payload, 'ended_at');
    if ((action === 'relation_created' || action === 'relation_ended') && createdAt !== null && endedAt !== undefined) {
      return {
        ...base,
        category: lineage ? 'lineage' : 'relation',
        affectedEntity: null,
        relatedEntities: uniqueReferences([relation.source, relation.target]),
        relation,
        payload: {
          kind: lineage ? 'lineage' : 'relation', action, createdAt, endedAt: endedAt ?? null,
          metadata: valueAt(payload, 'metadata'),
        },
      };
    }
    return malformed(record, base);
  }

  if (record.recordType === PROVENANCE_RECORD_TYPE) {
    const entity = entityFrom(payload, 'entityType', 'entityId');
    const action = stringAt(payload, 'action');
    const actor = stringAt(payload, 'actor');
    const occurredAt = timestampAt(payload, 'occurredAt');
    if (entity !== null && action !== null && actor !== null && occurredAt !== null) {
      return {
        ...base,
        category: 'mutation',
        affectedEntity: entity,
        relatedEntities: [entity],
        payload: { kind: 'mutation', action, before: valueAt(payload, 'before'), after: valueAt(payload, 'after') },
      };
    }
    return malformed(record, base);
  }

  if (record.recordType === STATE_TRANSITION_RECORD_TYPE) {
    const entity = entityFrom(payload, 'entityType', 'entityId');
    const projectId = stringAt(payload, 'projectId');
    const labelId = stringAt(payload, 'labelId');
    const fromProjectStateId = stringAt(payload, 'fromProjectStateId');
    const toProjectStateId = stringAt(payload, 'toProjectStateId');
    const projectTransitionId = stringAt(payload, 'projectTransitionId');
    const schemaVersion = numberAt(payload, 'schemaVersion');
    const snapshot = valueAt(payload, 'snapshot');
    const evaluation = valueAt(payload, 'evaluation');
    if (entity !== null && projectId !== null && labelId !== null && fromProjectStateId !== null &&
      toProjectStateId !== null && projectTransitionId !== null && schemaVersion !== null &&
      snapshot !== null && evaluation !== null) {
      const project: TimelineEntityReference = { type: 'project', id: projectId };
      return {
        ...base,
        category: 'lifecycle',
        affectedEntity: entity,
        relatedEntities: uniqueReferences([entity, project]),
        states: { projectId, labelId, fromProjectStateId, toProjectStateId, projectTransitionId },
        payload: { kind: 'lifecycle', schemaVersion, snapshot, evaluation },
      };
    }
    return malformed(record, base);
  }

  if (record.recordType === 'correction') {
    const targetRecordId = stringAt(payload, 'targetRecordId');
    const changes = valueAt(payload, 'changes');
    if (targetRecordId !== null && changes !== null) {
      const target: TimelineEntityReference = { type: 'record', id: targetRecordId };
      return {
        ...base,
        category: 'correction',
        affectedEntity: target,
        relatedEntities: [target],
        payload: { kind: 'correction', changes },
      };
    }
    return malformed(record, base);
  }

  return occurrence(record, base, isKnownDirectOccurrenceType(record.recordType)
    ? undefined
    : 'unknown_record_type');
}

/** `occurredAt`, then `recordedAt`, then immutable Record ID is the total order. */
export function compareTimelineEvents(left: TimelineEvent, right: TimelineEvent): number {
  return left.occurredAt.localeCompare(right.occurredAt) ||
    left.recordedAt.localeCompare(right.recordedAt) ||
    left.recordId.localeCompare(right.recordId);
}

/** Deterministically order and retain only the first projection for each Record ID. */
export function deduplicateTimelineEvents(events: readonly TimelineEvent[]): TimelineEvent[] {
  const seen = new Set<EntityId>();
  return [...events].sort(compareTimelineEvents).filter((event) => {
    if (seen.has(event.recordId)) return false;
    seen.add(event.recordId);
    return true;
  });
}

/** Archive visibility is an explicit caller decision, never inferred from category. */
export function includeTimelineEvent(
  event: TimelineEvent,
  archiveVisibility: 'active' | 'archived' | 'all' = 'active',
): boolean {
  return archiveVisibility === 'all' ||
    (archiveVisibility === 'active' ? event.archivedAt === null : event.archivedAt !== null);
}

/**
 * A Record belongs in an entity's timeline if it is that direct Record, names
 * the entity as its structured affected identity, or names it through either
 * relation endpoint/execution context. Consumers apply this before the
 * Record-ID de-duplication above when collecting from multiple paths.
 */
export function timelineEventConcernsEntity(event: TimelineEvent, entity: TimelineEntityReference): boolean {
  return (entity.type === 'record' && entity.id === event.recordId) ||
    sameReference(event.affectedEntity, entity) ||
    event.relatedEntities.some((reference) => sameReference(reference, entity));
}

export function assertTimelineEntityReference(value: { type: string; id: string }): asserts value is TimelineEntityReference {
  if (!isCoreEntityType(value.type)) throw new Error(`Timeline entity type must be a core entity type, got ${JSON.stringify(value.type)}`);
  if (value.id.trim().length === 0) throw new Error('Timeline entity id must not be blank');
}

function eventBase(record: OccurrenceRecord): Omit<TimelineEvent, 'category' | 'affectedEntity' | 'relatedEntities' | 'payload'> {
  return {
    schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
    recordId: record.id,
    recordType: record.recordType,
    occurredAt: record.occurredAt,
    recordedAt: record.recordedAt,
    actor: record.actor,
    summary: record.title ?? record.description,
    archivedAt: record.archivedAt,
    relation: null,
    states: null,
  };
}

function occurrence(record: OccurrenceRecord, base: ReturnType<typeof eventBase>, fallbackReason?: TimelineOccurrencePayload['fallbackReason']): TimelineEvent {
  return {
    ...base, category: 'occurrence',
    affectedEntity: { type: 'record', id: record.id },
    relatedEntities: [{ type: 'record', id: record.id }],
    payload: { kind: 'occurrence', recordType: record.recordType, data: record.payload, ...(fallbackReason === undefined ? {} : { fallbackReason }) },
  };
}

function malformed(record: OccurrenceRecord, base: ReturnType<typeof eventBase>): TimelineEvent {
  return occurrence(record, base, 'malformed_payload');
}

function objectPayload(value: JsonValue | null): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function valueAt(value: JsonObject | null, key: string): JsonValue | null { return value?.[key] ?? null; }
function stringAt(value: JsonObject | null, key: string): string | null {
  const candidate = value?.[key]; return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
}
function numberAt(value: JsonObject | null, key: string): number | null { const candidate = value?.[key]; return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null; }
function timestampAt(value: JsonObject | null, key: string): IsoTimestamp | null {
  const candidate = stringAt(value, key); return candidate !== null && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}
function optionalTimestampAt(value: JsonObject | null, key: string): IsoTimestamp | null | undefined {
  if (value === null || !(key in value)) return null;
  const candidate = timestampAt(value, key); return candidate === null ? undefined : candidate;
}
function entityFrom(value: JsonObject | null, typeKey: string, idKey: string): TimelineEntityReference | null {
  const type = stringAt(value, typeKey); const id = stringAt(value, idKey);
  return type !== null && id !== null && isCoreEntityType(type) ? { type, id } : null;
}
function relationFrom(value: JsonObject | null): TimelineRelationReference | null {
  const id = stringAt(value, 'relationId'); const type = stringAt(value, 'relationType');
  const source = entityFrom(value, 'sourceType', 'sourceId'); const target = entityFrom(value, 'targetType', 'targetId');
  return id !== null && type !== null && source !== null && target !== null ? { id, type, source, target } : null;
}
function sameReference(left: TimelineEntityReference | null, right: TimelineEntityReference): boolean { return left?.type === right.type && left.id === right.id; }
function uniqueReferences(references: readonly TimelineEntityReference[]): TimelineEntityReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => { const key = `${reference.type}\u0000${reference.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

function isKnownDirectOccurrenceType(recordType: string): boolean {
  return ['action', 'observation', 'progress', 'failure', 'discovery', 'resource_usage', 'external_event'].includes(recordType);
}
