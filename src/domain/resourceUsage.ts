import { Decimal } from './decimal';
import type { EntityId, IsoTimestamp } from './ids';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';
import { Quantity } from './quantity';
import { createRecord } from './record';
import type { Record as OccurrenceRecord, RecordFactoryDeps } from './record';
import { createRelation } from './relation';
import type { Relation, RelationFactoryDeps } from './relation';
import type { Resource } from './resource';

/** Current version of the resource-usage payload embedded in a Record. */
export const RESOURCE_USAGE_METADATA_VERSION = 1;

/** Semantic links emitted with each usage occurrence. */
export const RESOURCE_USAGE_PROJECT_RELATION_TYPE = 'belongs_to';
export const RESOURCE_USAGE_RESOURCE_RELATION_TYPE = 'consumes';
export const RESOURCE_USAGE_TASK_RELATION_TYPE = 'belongs_to';
export const RESOURCE_USAGE_CORRECTION_RELATION_TYPE = 'related_to';

/**
 * Consumption always has a positive magnitude.  The immutable signed effect
 * says how that magnitude contributes to a later balance calculation: an
 * original usage increases consumption and a reversal decreases it.
 */
export type ResourceUsageAggregationEffect = 1 | -1;

export interface ResourceUsagePayload {
  metadataVersion: typeof RESOURCE_USAGE_METADATA_VERSION;
  amount: string;
  unit: string;
  projectId: EntityId;
  resourceId: EntityId;
  taskId?: EntityId;
  aggregationEffect: ResourceUsageAggregationEffect;
  /** Optional JSON-safe facts from the execution environment. */
  executionContext?: JsonValue;
  /** Optional names of planned contexts used as validation inputs only. */
  plannedContext?: {
    projectBudgetContext?: string;
    taskAllocationContext?: string;
  };
  /** Present only on an appended correction/reversal occurrence. */
  correctsRecordId?: EntityId;
}

export interface NewResourceUsageRecord {
  description: string;
  occurredAt: IsoTimestamp;
  recordedAt: IsoTimestamp;
  actor: string;
  projectId: EntityId;
  resourceId: EntityId;
  amount: Decimal | string;
  unit: string;
  taskId?: EntityId;
  title?: string;
  executionContext?: unknown;
  plannedContext?: {
    projectBudgetContext?: string;
    taskAllocationContext?: string;
  };
}

export interface NewResourceUsageCorrection extends Omit<NewResourceUsageRecord, 'taskId' | 'projectId' | 'resourceId' | 'amount' | 'unit' | 'plannedContext'> {
  /** The existing occurrence retained as the correction target. */
  corrects: ResourceUsageEntry;
}

export interface ResourceUsageEntry {
  record: OccurrenceRecord;
  projectRelation: Relation;
  resourceRelation: Relation;
  taskRelation: Relation | null;
  correctionRelation: Relation | null;
}

export interface ResourceUsageFactoryDeps {
  record?: RecordFactoryDeps;
  projectRelation?: RelationFactoryDeps;
  resourceRelation?: RelationFactoryDeps;
  taskRelation?: RelationFactoryDeps;
  correctionRelation?: RelationFactoryDeps;
}

/** Logical references; implementations may use repositories but never foreign keys. */
export interface ActiveResourceUsageReferenceLookup {
  isProjectActive(id: EntityId): Promise<boolean>;
  isResourceActive(id: EntityId): Promise<boolean>;
  isTaskActive(id: EntityId): Promise<boolean>;
  hasActiveTaskProjectMembership(taskId: EntityId, projectId: EntityId): Promise<boolean>;
  /** Optional planned inputs are validated if a usage explicitly names them. */
  hasActiveProjectBudget?(
    projectId: EntityId,
    resourceId: EntityId,
    projectBudgetContext: string,
  ): Promise<boolean>;
  hasActiveTaskAllocation?(
    taskId: EntityId,
    projectId: EntityId,
    resourceId: EntityId,
    taskAllocationContext: string,
  ): Promise<boolean>;
}

export class ResourceUsageReferenceNotFoundError extends Error {
  constructor(kind: 'project' | 'resource' | 'task' | 'membership' | 'budget' | 'allocation', id: string) {
    super(`Active resource usage ${kind} ${id} not found`);
    this.name = 'ResourceUsageReferenceNotFoundError';
  }
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) throw new Error(`Resource usage ${field} must not be blank`);
  return value;
}

function canonicalQuantity(amount: Decimal | string, unit: string): Quantity {
  const quantity = Quantity.of(amount, requireNonBlank('unit', unit));
  if (quantity.amount.compare(Decimal.zero()) <= 0) {
    throw new Error('Resource usage amount must be strictly positive');
  }
  return Quantity.of(quantity.amount.toString(), quantity.unit);
}

function validatePlannedContext(value: ResourceUsagePayload['plannedContext']): ResourceUsagePayload['plannedContext'] {
  if (value === undefined) return undefined;
  const projectBudgetContext = value.projectBudgetContext === undefined
    ? undefined : requireNonBlank('plannedContext.projectBudgetContext', value.projectBudgetContext);
  const taskAllocationContext = value.taskAllocationContext === undefined
    ? undefined : requireNonBlank('plannedContext.taskAllocationContext', value.taskAllocationContext);
  if (projectBudgetContext === undefined && taskAllocationContext === undefined) {
    throw new Error('Resource usage plannedContext must name a budget or allocation context');
  }
  return {
    ...(projectBudgetContext === undefined ? {} : { projectBudgetContext }),
    ...(taskAllocationContext === undefined ? {} : { taskAllocationContext }),
  };
}

function requireEffect(value: unknown): ResourceUsageAggregationEffect {
  if (value !== 1 && value !== -1) {
    throw new Error('Resource usage aggregationEffect must be 1 or -1');
  }
  return value;
}

/** Parse and canonicalize the structured payload of a resource-usage Record. */
export function resourceUsagePayload(payload: JsonValue | null): ResourceUsagePayload {
  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error('Resource usage payload must be an object');
  }
  const candidate = payload as Record<string, JsonValue>;
  if (candidate.metadataVersion !== RESOURCE_USAGE_METADATA_VERSION) {
    throw new Error(`Unsupported resource usage metadataVersion ${JSON.stringify(candidate.metadataVersion)}`);
  }
  if (typeof candidate.amount !== 'string' || typeof candidate.unit !== 'string') {
    throw new Error('Resource usage payload requires string amount and unit');
  }
  const quantity = canonicalQuantity(candidate.amount, candidate.unit);
  if (typeof candidate.projectId !== 'string' || typeof candidate.resourceId !== 'string') {
    throw new Error('Resource usage payload requires projectId and resourceId');
  }
  const projectId = requireNonBlank('projectId', candidate.projectId);
  const resourceId = requireNonBlank('resourceId', candidate.resourceId);
  if (candidate.taskId !== undefined && typeof candidate.taskId !== 'string') {
    throw new Error('Resource usage taskId must be a string when present');
  }
  if (candidate.correctsRecordId !== undefined && typeof candidate.correctsRecordId !== 'string') {
    throw new Error('Resource usage correctsRecordId must be a string when present');
  }
  const taskId = candidate.taskId === undefined ? undefined : requireNonBlank('taskId', candidate.taskId as string);
  const correctsRecordId = candidate.correctsRecordId === undefined ? undefined : requireNonBlank('correctsRecordId', candidate.correctsRecordId as string);
  const executionContext = candidate.executionContext === undefined
    ? undefined : assertJsonValue(candidate.executionContext);
  if (candidate.plannedContext !== undefined && (Array.isArray(candidate.plannedContext) || typeof candidate.plannedContext !== 'object' || candidate.plannedContext === null)) {
    throw new Error('Resource usage plannedContext must be an object');
  }
  const plannedContext = validatePlannedContext(candidate.plannedContext as ResourceUsagePayload['plannedContext']);
  return {
    metadataVersion: RESOURCE_USAGE_METADATA_VERSION,
    amount: quantity.amount.toString(), unit: quantity.unit, projectId, resourceId,
    aggregationEffect: requireEffect(candidate.aggregationEffect),
    ...(taskId === undefined ? {} : { taskId }),
    ...(executionContext === undefined ? {} : { executionContext }),
    ...(plannedContext === undefined ? {} : { plannedContext }),
    ...(correctsRecordId === undefined ? {} : { correctsRecordId }),
  };
}

function linksFor(record: OccurrenceRecord, payload: ResourceUsagePayload, deps: ResourceUsageFactoryDeps): Pick<ResourceUsageEntry, 'projectRelation' | 'resourceRelation' | 'taskRelation' | 'correctionRelation'> {
  return {
    projectRelation: createRelation({ sourceType: 'record', sourceId: record.id, relationType: RESOURCE_USAGE_PROJECT_RELATION_TYPE, targetType: 'project', targetId: payload.projectId }, deps.projectRelation),
    resourceRelation: createRelation({ sourceType: 'record', sourceId: record.id, relationType: RESOURCE_USAGE_RESOURCE_RELATION_TYPE, targetType: 'resource', targetId: payload.resourceId }, deps.resourceRelation),
    taskRelation: payload.taskId === undefined ? null : createRelation({ sourceType: 'record', sourceId: record.id, relationType: RESOURCE_USAGE_TASK_RELATION_TYPE, targetType: 'task', targetId: payload.taskId }, deps.taskRelation),
    correctionRelation: payload.correctsRecordId === undefined ? null : createRelation({ sourceType: 'record', sourceId: record.id, relationType: RESOURCE_USAGE_CORRECTION_RELATION_TYPE, targetType: 'record', targetId: payload.correctsRecordId, metadata: { kind: 'resource_usage_correction' } }, deps.correctionRelation),
  };
}

/** Create an immutable positive consumption occurrence and all required semantic links. */
export function createResourceUsageRecord(input: NewResourceUsageRecord, deps: ResourceUsageFactoryDeps = {}): ResourceUsageEntry {
  const quantity = canonicalQuantity(input.amount, input.unit);
  const payload: ResourceUsagePayload = {
    metadataVersion: RESOURCE_USAGE_METADATA_VERSION, amount: quantity.amount.toString(), unit: quantity.unit,
    projectId: requireNonBlank('projectId', input.projectId), resourceId: requireNonBlank('resourceId', input.resourceId), aggregationEffect: 1,
    ...(input.taskId === undefined ? {} : { taskId: requireNonBlank('taskId', input.taskId) }),
    ...(input.executionContext === undefined ? {} : { executionContext: assertJsonValue(input.executionContext) }),
    ...(input.plannedContext === undefined ? {} : { plannedContext: validatePlannedContext(input.plannedContext) }),
  };
  const record = createRecord({ description: input.description, title: input.title, occurredAt: input.occurredAt, recordedAt: input.recordedAt, actor: requireNonBlank('actor', input.actor), recordType: 'resource_usage', payload }, deps.record);
  return { record, ...linksFor(record, payload, deps) };
}

/**
 * Append a reversal for an existing usage.  The target occurrence remains
 * unchanged; a later replacement usage, if needed, is a separate entry.
 */
export function createResourceUsageReversal(input: NewResourceUsageCorrection, deps: ResourceUsageFactoryDeps = {}): ResourceUsageEntry {
  validateResourceUsageEntry(input.corrects);
  const target = resourceUsagePayload(input.corrects.record.payload);
  const payload: ResourceUsagePayload = {
    ...target, aggregationEffect: -1, correctsRecordId: input.corrects.record.id,
    ...(input.executionContext === undefined ? {} : { executionContext: assertJsonValue(input.executionContext) }),
  };
  const record = createRecord({ description: input.description, title: input.title, occurredAt: input.occurredAt, recordedAt: input.recordedAt, actor: requireNonBlank('actor', input.actor), recordType: 'correction', payload }, deps.record);
  return { record, ...linksFor(record, payload, deps) };
}

/** Validate a Record, its canonical payload, and its required semantic links. */
export function validateResourceUsageEntry(entry: ResourceUsageEntry, resource?: Pick<Resource, 'id' | 'unit'>): void {
  const payload = resourceUsagePayload(entry.record.payload);
  const isCorrection = payload.correctsRecordId !== undefined;
  if (entry.record.recordType !== (isCorrection ? 'correction' : 'resource_usage')) {
    throw new Error('Resource usage Record type must match whether it corrects an occurrence');
  }
  if (payload.aggregationEffect !== (isCorrection ? -1 : 1)) {
    throw new Error('Resource usage aggregation effect must be +1 for usage and -1 for reversal');
  }
  validateLink(entry.projectRelation, entry.record.id, RESOURCE_USAGE_PROJECT_RELATION_TYPE, 'project', payload.projectId, 'Project');
  validateLink(entry.resourceRelation, entry.record.id, RESOURCE_USAGE_RESOURCE_RELATION_TYPE, 'resource', payload.resourceId, 'Resource');
  if (payload.taskId === undefined) {
    if (entry.taskRelation !== null) throw new Error('Resource usage must not link a Task when taskId is absent');
  } else {
    if (entry.taskRelation === null) throw new Error('Resource usage requires its Task link');
    validateLink(entry.taskRelation, entry.record.id, RESOURCE_USAGE_TASK_RELATION_TYPE, 'task', payload.taskId, 'Task');
  }
  if (isCorrection) {
    if (entry.correctionRelation === null) throw new Error('Resource usage reversal requires its correction link');
    validateLink(entry.correctionRelation, entry.record.id, RESOURCE_USAGE_CORRECTION_RELATION_TYPE, 'record', payload.correctsRecordId!, 'correction');
  } else if (entry.correctionRelation !== null) {
    throw new Error('Resource usage must not link a correction target when correctsRecordId is absent');
  }
  if (resource !== undefined && (resource.id !== payload.resourceId || resource.unit === null || resource.unit !== payload.unit)) {
    throw new Error(`Resource usage unit ${JSON.stringify(payload.unit)} is incompatible with Resource unit ${JSON.stringify(resource.unit)}`);
  }
}

function validateLink(relation: Relation, recordId: EntityId, relationType: string, targetType: string, targetId: EntityId, label: string): void {
  if (relation.sourceType !== 'record' || relation.sourceId !== recordId || relation.relationType !== relationType || relation.targetType !== targetType || relation.targetId !== targetId || relation.endedAt !== null) {
    throw new Error(`Resource usage ${label} relation is invalid`);
  }
}

/** Validate active cross-aggregate references without database foreign keys. */
export async function validateActiveResourceUsageReferences(entry: ResourceUsageEntry, resource: Pick<Resource, 'id' | 'unit'>, lookup: ActiveResourceUsageReferenceLookup): Promise<void> {
  validateResourceUsageEntry(entry, resource);
  const payload = resourceUsagePayload(entry.record.payload);
  if (!(await lookup.isProjectActive(payload.projectId))) throw new ResourceUsageReferenceNotFoundError('project', payload.projectId);
  if (!(await lookup.isResourceActive(payload.resourceId))) throw new ResourceUsageReferenceNotFoundError('resource', payload.resourceId);
  if (payload.taskId !== undefined) {
    if (!(await lookup.isTaskActive(payload.taskId))) throw new ResourceUsageReferenceNotFoundError('task', payload.taskId);
    if (!(await lookup.hasActiveTaskProjectMembership(payload.taskId, payload.projectId))) throw new ResourceUsageReferenceNotFoundError('membership', `${payload.taskId}/${payload.projectId}`);
  }
  const context = payload.plannedContext;
  if (context?.projectBudgetContext !== undefined) {
    if (lookup.hasActiveProjectBudget === undefined || !(await lookup.hasActiveProjectBudget(payload.projectId, payload.resourceId, context.projectBudgetContext))) throw new ResourceUsageReferenceNotFoundError('budget', `${payload.projectId}/${payload.resourceId}/${context.projectBudgetContext}`);
  }
  if (context?.taskAllocationContext !== undefined) {
    if (payload.taskId === undefined || lookup.hasActiveTaskAllocation === undefined || !(await lookup.hasActiveTaskAllocation(payload.taskId, payload.projectId, payload.resourceId, context.taskAllocationContext))) throw new ResourceUsageReferenceNotFoundError('allocation', `${payload.taskId ?? ''}/${payload.projectId}/${payload.resourceId}/${context.taskAllocationContext}`);
  }
}

/**
 * Validate an append-only usage history.  Each correction has one target,
 * cannot target itself, cannot form a cycle, and an occurrence is reversed at
 * most once.  Planned budgets and allocations are intentionally not changed.
 */
export function validateResourceUsageHistory(entries: readonly ResourceUsageEntry[], resource?: Pick<Resource, 'id' | 'unit'>): void {
  const byId = new Map<EntityId, ResourceUsageEntry>();
  const corrected = new Set<EntityId>();
  for (const entry of entries) {
    validateResourceUsageEntry(entry, resource);
    if (byId.has(entry.record.id)) throw new Error(`Resource usage history contains duplicate Record ${entry.record.id}`);
    byId.set(entry.record.id, entry);
  }
  for (const entry of entries) {
    const payload = resourceUsagePayload(entry.record.payload);
    if (payload.correctsRecordId === undefined) continue;
    if (payload.correctsRecordId === entry.record.id) throw new Error('Resource usage correction cannot target itself');
    if (!byId.has(payload.correctsRecordId)) throw new Error(`Resource usage correction target ${payload.correctsRecordId} is absent from history`);
    if (corrected.has(payload.correctsRecordId)) throw new Error(`Resource usage correction target ${payload.correctsRecordId} has ambiguous double replacement`);
    corrected.add(payload.correctsRecordId);
  }
  for (const entry of entries) {
    const seen = new Set<EntityId>();
    let current: ResourceUsageEntry | undefined = entry;
    while (current !== undefined) {
      if (seen.has(current.record.id)) throw new Error('Resource usage correction history contains a cycle');
      seen.add(current.record.id);
      const target = resourceUsagePayload(current.record.payload).correctsRecordId;
      current = target === undefined ? undefined : byId.get(target);
    }
  }
}
