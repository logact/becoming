import type { EntityId, IsoTimestamp } from './ids';
import { Quantity } from './quantity';

/**
 * Framework-neutral balance rules shared by later read models.  Callers first
 * select effective planned Relations and occurrence-time usage Records, then
 * pass those immutable contributors here.  No input is mutated or persisted.
 *
 * A Project balance groups only one Resource id and its one canonical unit:
 *   unallocated = budgeted - allocated
 *   remaining   = budgeted - consumed
 * A Task balance groups only one Resource id and its one canonical unit:
 *   remaining   = allocated - attributedConsumed
 *
 * Negative derived amounts are retained: they describe a real exception and
 * are never clamped or silently repaired.  Planned Relations and actual
 * occurrence Records remain separate contributor sets.
 */

export interface BalanceRelationContributor {
  relationId: EntityId;
  resourceId: EntityId;
  amount: Quantity;
}

export interface ProjectBudgetBalanceContributor extends BalanceRelationContributor {
  projectId: EntityId;
}

export interface TaskAllocationBalanceContributor extends BalanceRelationContributor {
  taskId: EntityId;
  fundingProjectId: EntityId;
}

/** A correction is represented by aggregationEffect -1; a usage is +1. */
export interface ResourceUsageBalanceContributor {
  recordId: EntityId;
  projectId: EntityId;
  resourceId: EntityId;
  taskId: EntityId | null;
  amount: Quantity;
  aggregationEffect: 1 | -1;
}

export interface BalanceTemporalRelation {
  validFrom: IsoTimestamp;
  /** Half-open: validUntil is excluded. */
  validUntil: IsoTimestamp | null;
}

/** A relation is effective at its start and not effective at its end. */
export function isBalanceRelationEffectiveAt(
  relation: BalanceTemporalRelation,
  asOf: IsoTimestamp,
): boolean {
  assertTimestamp('relation validFrom', relation.validFrom);
  if (relation.validUntil !== null) assertTimestamp('relation validUntil', relation.validUntil);
  assertTimestamp('balance asOf', asOf);
  return Date.parse(relation.validFrom) <= Date.parse(asOf) &&
    (relation.validUntil === null || Date.parse(asOf) < Date.parse(relation.validUntil));
}

/** Occurrences (including appended corrections) are included at their timestamp. */
export function isBalanceUsageIncludedAt(occurredAt: IsoTimestamp, asOf: IsoTimestamp): boolean {
  assertTimestamp('usage occurredAt', occurredAt);
  assertTimestamp('balance asOf', asOf);
  return Date.parse(occurredAt) <= Date.parse(asOf);
}

export interface ProjectResourceBalance {
  projectId: EntityId;
  resourceId: EntityId;
  unit: string;
  budgeted: Quantity;
  allocated: Quantity;
  unallocated: Quantity;
  consumed: Quantity;
  remaining: Quantity;
  budgetRelationIds: EntityId[];
  allocationRelationIds: EntityId[];
  usageRecordIds: EntityId[];
}

export interface TaskResourceBalance {
  taskId: EntityId;
  resourceId: EntityId;
  unit: string;
  allocated: Quantity;
  attributedConsumed: Quantity;
  remaining: Quantity;
  allocationRelationIds: EntityId[];
  usageRecordIds: EntityId[];
}

export class ResourceBalanceUnitMismatchError extends Error {
  constructor(
    readonly scope: string,
    readonly resourceId: EntityId,
    readonly expectedUnit: string,
    readonly contributorIds: readonly EntityId[],
  ) {
    super(`Resource balance unit mismatch for ${scope}/${resourceId}: expected ${JSON.stringify(expectedUnit)}; contributors ${contributorIds.join(', ')}`);
    this.name = 'ResourceBalanceUnitMismatchError';
  }
}

/**
 * Derive all Project resource summaries from selected current or as-of facts.
 * Empty resources deliberately have no row; callers that need a zero row must
 * supply an explicit canonical Resource/unit outside this aggregate.
 */
export function calculateProjectResourceBalances(input: {
  budgets: readonly ProjectBudgetBalanceContributor[];
  allocations: readonly TaskAllocationBalanceContributor[];
  usage: readonly ResourceUsageBalanceContributor[];
}): ProjectResourceBalance[] {
  const keys = new Set<string>();
  for (const item of input.budgets) keys.add(projectResourceKey(item.projectId, item.resourceId));
  for (const item of input.allocations) keys.add(projectResourceKey(item.fundingProjectId, item.resourceId));
  for (const item of input.usage) keys.add(projectResourceKey(item.projectId, item.resourceId));
  return [...keys].sort().map((key) => {
    const [projectId, resourceId] = splitKey(key);
    const budgets = input.budgets.filter((item) => item.projectId === projectId && item.resourceId === resourceId);
    const allocations = input.allocations.filter((item) => item.fundingProjectId === projectId && item.resourceId === resourceId);
    const usage = input.usage.filter((item) => item.projectId === projectId && item.resourceId === resourceId);
    const unit = requireUnit(`Project ${projectId}`, resourceId, [
      ...budgets.map(relationContribution), ...allocations.map(relationContribution), ...usage.map(usageContribution),
    ]);
    const budgeted = sumPositive(unit, budgets.map((item) => item.amount));
    const allocated = sumPositive(unit, allocations.map((item) => item.amount));
    const consumed = sumSigned(unit, usage);
    return {
      projectId, resourceId, unit, budgeted, allocated,
      unallocated: budgeted.subtract(allocated), consumed,
      remaining: budgeted.subtract(consumed),
      budgetRelationIds: sortedIds(budgets.map((item) => item.relationId)),
      allocationRelationIds: sortedIds(allocations.map((item) => item.relationId)),
      usageRecordIds: sortedIds(usage.map((item) => item.recordId)),
    };
  });
}

/** Derive Task summaries; only usage explicitly attributed to the Task counts. */
export function calculateTaskResourceBalances(input: {
  allocations: readonly TaskAllocationBalanceContributor[];
  usage: readonly ResourceUsageBalanceContributor[];
}): TaskResourceBalance[] {
  const keys = new Set<string>();
  for (const item of input.allocations) keys.add(projectResourceKey(item.taskId, item.resourceId));
  for (const item of input.usage) if (item.taskId !== null) keys.add(projectResourceKey(item.taskId, item.resourceId));
  return [...keys].sort().map((key) => {
    const [taskId, resourceId] = splitKey(key);
    const allocations = input.allocations.filter((item) => item.taskId === taskId && item.resourceId === resourceId);
    const usage = input.usage.filter((item) => item.taskId === taskId && item.resourceId === resourceId);
    const unit = requireUnit(`Task ${taskId}`, resourceId, [
      ...allocations.map(relationContribution), ...usage.map(usageContribution),
    ]);
    const allocated = sumPositive(unit, allocations.map((item) => item.amount));
    const attributedConsumed = sumSigned(unit, usage);
    return {
      taskId, resourceId, unit, allocated, attributedConsumed,
      remaining: allocated.subtract(attributedConsumed),
      allocationRelationIds: sortedIds(allocations.map((item) => item.relationId)),
      usageRecordIds: sortedIds(usage.map((item) => item.recordId)),
    };
  });
}

interface QuantityContribution { id: EntityId; amount: Quantity }
function relationContribution(item: BalanceRelationContributor): QuantityContribution { return { id: item.relationId, amount: item.amount }; }
function usageContribution(item: ResourceUsageBalanceContributor): QuantityContribution { return { id: item.recordId, amount: item.amount }; }
function projectResourceKey(entityId: EntityId, resourceId: EntityId): string { return `${entityId}\u0000${resourceId}`; }
function splitKey(key: string): [EntityId, EntityId] { return key.split('\u0000') as [EntityId, EntityId]; }
function sortedIds(ids: EntityId[]): EntityId[] { return [...ids].sort(); }
function sumPositive(unit: string, amounts: readonly Quantity[]): Quantity { return amounts.reduce((sum, amount) => sum.add(amount), Quantity.zero(unit)); }
function sumSigned(unit: string, usage: readonly ResourceUsageBalanceContributor[]): Quantity { return usage.reduce((sum, item) => sum.add(item.aggregationEffect === 1 ? item.amount : Quantity.zero(unit).subtract(item.amount)), Quantity.zero(unit)); }

function requireUnit(scope: string, resourceId: EntityId, contributors: readonly QuantityContribution[]): string {
  if (contributors.length === 0) throw new Error(`Resource balance ${scope}/${resourceId} has no contributors`);
  const expectedUnit = contributors[0].amount.unit;
  const mismatched = contributors.filter((item) => item.amount.unit !== expectedUnit).map((item) => item.id).sort();
  if (mismatched.length > 0) throw new ResourceBalanceUnitMismatchError(scope, resourceId, expectedUnit, mismatched);
  return expectedUnit;
}

function assertTimestamp(label: string, value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid ISO 8601 timestamp`);
}
