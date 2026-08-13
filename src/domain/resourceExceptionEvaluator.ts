import type { EntityId, IsoTimestamp } from './ids';
import type { ProjectResourceBalance, TaskResourceBalance } from './resourceBalance';
import {
  createResourceException,
  type ResourceException,
  type ResourceExceptionType,
  ResourceExceptionUnitMismatchError,
} from './resourceException';
import type { Quantity } from './quantity';

/**
 * A Task balance intentionally has no intrinsic Project: a Task may have
 * plans funded by different Projects over its history.  The caller therefore
 * supplies the Project whose allocation/usage snapshot it is evaluating.
 */
export interface TaskResourceExceptionBalance {
  projectId: EntityId;
  balance: TaskResourceBalance;
}

/**
 * Immutable inputs from the current or one as-of resource-balance snapshot.
 * This evaluator neither fetches nor stores facts, making it suitable for
 * query services and for command-boundary policy checks alike.
 */
export interface ResourceExceptionEvaluationInput {
  asOf: IsoTimestamp;
  projectBalances: readonly ProjectResourceBalance[];
  taskBalances: readonly TaskResourceExceptionBalance[];
  /** Invoked once per active, deduplicated exception after deterministic sorting. */
  policy?: ResourceExceptionPolicy;
}

/** Command services can throw from this hook to reject an operation. */
export type ResourceExceptionPolicy = (exception: ResourceException) => void;

/** V1 query detection is informational unless its caller opts into a policy. */
export const informationalResourceExceptionPolicy: ResourceExceptionPolicy = () => undefined;

/**
 * Derive active Project and Task resource exceptions from already-selected
 * balance summaries.  A Resource can independently be over-allocated and
 * exhausted; a Task can independently be over-consumed.  Safe balances do
 * not synthesize a "resolved" row because no mutable exception history exists
 * at this layer.
 */
export function evaluateResourceExceptions(input: ResourceExceptionEvaluationInput): ResourceException[] {
  assertTimestamp(input.asOf);
  const candidates: ResourceException[] = [];

  for (const balance of input.projectBalances) {
    assertProjectBalanceUnits(balance);
    if (isStrictlyGreater(balance.allocated, balance.budgeted)) {
      candidates.push(createResourceException({
        type: 'project_over_allocation', projectId: balance.projectId, resourceId: balance.resourceId,
        planned: balance.budgeted, comparison: balance.allocated, asOf: input.asOf,
        contributorIds: {
          budgetRelationIds: balance.budgetRelationIds,
          allocationRelationIds: balance.allocationRelationIds,
          usageRecordIds: [],
        },
      }));
    }
    if (isAtOrAbove(balance.consumed, balance.budgeted)) {
      candidates.push(createResourceException({
        type: 'project_exhausted', projectId: balance.projectId, resourceId: balance.resourceId,
        planned: balance.budgeted, comparison: balance.consumed, asOf: input.asOf,
        contributorIds: {
          budgetRelationIds: balance.budgetRelationIds,
          allocationRelationIds: [],
          usageRecordIds: balance.usageRecordIds,
        },
      }));
    }
  }

  for (const context of input.taskBalances) {
    assertId('task balance projectId', context.projectId);
    assertTaskBalanceUnits(context.balance);
    if (!isStrictlyGreater(context.balance.attributedConsumed, context.balance.allocated)) continue;
    candidates.push(createResourceException({
      type: 'task_over_consumption', projectId: context.projectId,
      resourceId: context.balance.resourceId, taskId: context.balance.taskId,
      planned: context.balance.allocated, comparison: context.balance.attributedConsumed,
      asOf: input.asOf,
      contributorIds: {
        budgetRelationIds: [],
        allocationRelationIds: context.balance.allocationRelationIds,
        usageRecordIds: context.balance.usageRecordIds,
      },
    }));
  }

  const exceptions = deduplicate(candidates.sort(compareExceptions));
  const policy = input.policy ?? informationalResourceExceptionPolicy;
  for (const exception of exceptions) policy(exception);
  return exceptions;
}

function assertProjectBalanceUnits(balance: ProjectResourceBalance): void {
  assertId('project balance projectId', balance.projectId);
  assertId('project balance resourceId', balance.resourceId);
  assertUnit(balance.unit);
  assertQuantitiesUseUnit(balance.unit, [balance.budgeted, balance.allocated, balance.unallocated, balance.consumed, balance.remaining]);
}

function assertTaskBalanceUnits(balance: TaskResourceBalance): void {
  assertId('task balance taskId', balance.taskId);
  assertId('task balance resourceId', balance.resourceId);
  assertUnit(balance.unit);
  assertQuantitiesUseUnit(balance.unit, [balance.allocated, balance.attributedConsumed, balance.remaining]);
}

function assertQuantitiesUseUnit(unit: string, quantities: readonly Quantity[]): void {
  for (const quantity of quantities) {
    if (quantity.unit !== unit) throw new ResourceExceptionUnitMismatchError(unit, quantity.unit);
  }
}

function isStrictlyGreater(comparison: Quantity, planned: Quantity): boolean {
  return comparison.compare(planned) > 0;
}

function isAtOrAbove(comparison: Quantity, planned: Quantity): boolean {
  return comparison.compare(planned) >= 0;
}

/** Critical first, then type, Resource, and Task. Identity breaks no ties. */
function compareExceptions(left: ResourceException, right: ResourceException): number {
  const severity = severityRank(left) - severityRank(right);
  if (severity !== 0) return severity;
  const type = left.type.localeCompare(right.type);
  if (type !== 0) return type;
  const resource = left.resourceId.localeCompare(right.resourceId);
  if (resource !== 0) return resource;
  const task = (left.taskId ?? '').localeCompare(right.taskId ?? '');
  if (task !== 0) return task;
  const project = left.projectId.localeCompare(right.projectId);
  if (project !== 0) return project;
  return exceptionSnapshotKey(left).localeCompare(exceptionSnapshotKey(right));
}

function severityRank(exception: ResourceException): number {
  return exception.severity === 'critical' ? 0 : 1;
}

/** Input corruption can duplicate rows; retain one deterministic representative per identity. */
function deduplicate(sorted: readonly ResourceException[]): ResourceException[] {
  const seen = new Set<string>();
  return sorted.filter((exception) => {
    if (seen.has(exception.identity)) return false;
    seen.add(exception.identity);
    return true;
  });
}

function exceptionSnapshotKey(exception: ResourceException): string {
  return [
    exception.planned.toString(), exception.comparison.toString(), exception.variance.toString(),
    exception.contributorIds.budgetRelationIds.join('\u0000'),
    exception.contributorIds.allocationRelationIds.join('\u0000'),
    exception.contributorIds.usageRecordIds.join('\u0000'),
  ].join('\u0001');
}

function assertId(name: string, id: EntityId): void {
  if (id.trim().length === 0) throw new Error(`Resource exception ${name} must not be blank`);
}

function assertUnit(unit: string): void {
  if (unit.trim().length === 0) throw new Error('Resource exception balance unit must not be blank');
}

function assertTimestamp(asOf: IsoTimestamp): void {
  if (asOf.trim().length === 0 || Number.isNaN(Date.parse(asOf))) {
    throw new Error('Resource exception evaluation asOf must be a valid ISO 8601 timestamp');
  }
}
