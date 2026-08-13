import type { EntityId, IsoTimestamp } from './ids';
import { Quantity } from './quantity';

/**
 * A derived, informational signal that planned and actual resource facts have
 * crossed a defined boundary.  Exceptions are not persisted aggregates: an
 * identical input snapshot always derives the identical identity and status.
 *
 * The resource planning commands still own their reject-or-flag policies.
 * V1 detection never changes a budget, allocation, usage record, or balance.
 */
export type ResourceExceptionType =
  | 'project_over_allocation'
  | 'project_exhausted'
  | 'task_over_consumption';

/** Active means the threshold holds at `asOf`; otherwise that identity is resolved. */
export type ResourceExceptionStatus = 'active' | 'resolved';

/** Stable, deterministic source trace retained with every derived exception. */
export interface ResourceExceptionContributorIds {
  budgetRelationIds: readonly EntityId[];
  allocationRelationIds: readonly EntityId[];
  usageRecordIds: readonly EntityId[];
}

/**
 * Transport-neutral exception value. `comparison - planned` is always the
 * signed `variance`; a positive variance is the amount beyond a strict-over
 * boundary, while zero is the exhausted boundary for Projects.
 */
export interface ResourceException {
  /** Stable across current and historical evaluations; it excludes amounts and timestamps. */
  identity: string;
  type: ResourceExceptionType;
  status: ResourceExceptionStatus;
  resourceId: EntityId;
  unit: string;
  projectId: EntityId;
  /** Present only for task_over_consumption. */
  taskId: EntityId | null;
  planned: Quantity;
  comparison: Quantity;
  variance: Quantity;
  /** Instant whose selected balance facts were evaluated. */
  asOf: IsoTimestamp;
  contributorIds: ResourceExceptionContributorIds;
}

export interface NewResourceException {
  type: ResourceExceptionType;
  resourceId: EntityId;
  projectId: EntityId;
  taskId?: EntityId | null;
  planned: Quantity;
  comparison: Quantity;
  asOf: IsoTimestamp;
  contributorIds: ResourceExceptionContributorIds;
}

/** Raised before comparison when a caller mixes units in one exception. */
export class ResourceExceptionUnitMismatchError extends Error {
  constructor(
    readonly expectedUnit: string,
    readonly actualUnit: string,
  ) {
    super(`Resource exception units must match: expected ${JSON.stringify(expectedUnit)}, got ${JSON.stringify(actualUnit)}`);
    this.name = 'ResourceExceptionUnitMismatchError';
  }
}

/**
 * Thresholds are deliberately small pure predicates so command policies and
 * read models can share the exact same equality behavior:
 *
 * - Project over-allocation: allocated > budgeted.
 * - Project exhaustion: consumed >= budgeted (including zero remaining).
 * - Task over-consumption: attributed consumed > allocated.
 *
 * Project budgets and task allocations created by the current domain are
 * strictly positive. The zero-budget rule remains explicit here so imported
 * or historical zero plans have deterministic behavior: zero consumed against
 * zero budget is exhausted; it is never an over-allocation or task-overuse.
 */
export function isResourceExceptionActive(
  type: ResourceExceptionType,
  planned: Quantity,
  comparison: Quantity,
): boolean {
  requireSameUnit(planned, comparison);
  const order = comparison.compare(planned);
  return type === 'project_exhausted' ? order >= 0 : order > 0;
}

/** Derive the status at an evaluation instant without storing mutable state. */
export function resourceExceptionStatus(
  type: ResourceExceptionType,
  planned: Quantity,
  comparison: Quantity,
): ResourceExceptionStatus {
  return isResourceExceptionActive(type, planned, comparison) ? 'active' : 'resolved';
}

/**
 * The identity names the affected planning scope, not a transient amount or
 * contributor set. Thus an exception stays identifiable through corrections,
 * superseded plans, and current-versus-as-of queries.
 */
export function resourceExceptionIdentity(input: Pick<NewResourceException, 'type' | 'projectId' | 'resourceId' | 'taskId'>): string {
  const suppliedTaskId = input.taskId;
  const taskId = input.type === 'task_over_consumption' ? suppliedTaskId : null;
  if (input.type === 'task_over_consumption' && (taskId === undefined || taskId === null || taskId.trim().length === 0)) {
    throw new Error('Task over-consumption exception requires a taskId');
  }
  if (input.type !== 'task_over_consumption' && suppliedTaskId !== null && suppliedTaskId !== undefined) {
    throw new Error('Project resource exception must not include a taskId');
  }
  requireId('projectId', input.projectId);
  requireId('resourceId', input.resourceId);
  return `${input.type}\u0000${input.projectId}\u0000${input.resourceId}\u0000${taskId ?? ''}`;
}

/**
 * Create a value for either an active exception or the resolved state of a
 * previously observed identity. The status is calculated, never supplied by
 * a transport layer. Contributor ids are sorted and deduplicated so traces
 * stay deterministic without mutating the caller's arrays.
 */
export function createResourceException(input: NewResourceException): ResourceException {
  const taskId = input.taskId ?? null;
  const identity = resourceExceptionIdentity({ ...input, taskId });
  requireTimestamp(input.asOf);
  requireSameUnit(input.planned, input.comparison);
  return {
    identity,
    type: input.type,
    status: resourceExceptionStatus(input.type, input.planned, input.comparison),
    resourceId: input.resourceId,
    unit: input.planned.unit,
    projectId: input.projectId,
    taskId,
    planned: input.planned,
    comparison: input.comparison,
    variance: input.comparison.subtract(input.planned),
    asOf: input.asOf,
    contributorIds: {
      budgetRelationIds: normalizedIds(input.contributorIds.budgetRelationIds),
      allocationRelationIds: normalizedIds(input.contributorIds.allocationRelationIds),
      usageRecordIds: normalizedIds(input.contributorIds.usageRecordIds),
    },
  };
}

function requireSameUnit(planned: Quantity, comparison: Quantity): void {
  if (planned.unit !== comparison.unit) {
    throw new ResourceExceptionUnitMismatchError(planned.unit, comparison.unit);
  }
}

function requireId(name: string, value: EntityId): void {
  if (value.trim().length === 0) throw new Error(`Resource exception ${name} must not be blank`);
}

function requireTimestamp(value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error('Resource exception asOf must be a valid ISO 8601 timestamp');
  }
}

function normalizedIds(ids: readonly EntityId[]): EntityId[] {
  for (const id of ids) requireId('contributor id', id);
  return [...new Set(ids)].sort();
}
