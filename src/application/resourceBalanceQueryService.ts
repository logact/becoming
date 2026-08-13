import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  calculateProjectResourceBalances,
  calculateTaskResourceBalances,
} from '../domain/resourceBalance';
import type {
  ProjectResourceBalance,
  ResourceUsageBalanceContributor,
  TaskResourceBalance,
} from '../domain/resourceBalance';
import type { ProjectBudgetQueryService } from './projectBudgetQueryService';
import type { ResourceUsageHistoryItem, ResourceUsageQueryService } from './resourceUsageQueryService';
import type { TaskAllocationQueryService } from './taskAllocationQueryService';
import type { RecordTimeRange } from '../persistence/recordRepository';
import type { Clock } from './recordService';
import { systemClock } from './recordService';

/**
 * The bounded query ports required to derive a current resource balance.
 * They intentionally stay read-only: calculating a balance cannot repair,
 * end, or otherwise alter its planned or actual contributors.
 */
export interface ResourceBalanceQueryServicePorts {
  projectBudgets: Pick<ProjectBudgetQueryService, 'listActiveBudgetsForProject'>;
  taskAllocations: Pick<TaskAllocationQueryService, 'listActiveAllocationsForProject' | 'listActiveAllocationsForTask'>;
  resourceUsage: Pick<ResourceUsageQueryService, 'listHistory'>;
  /** One clock snapshot is shared by every source query when asOf is omitted. */
  clock?: Clock;
}

/**
 * Historical balance selection is evaluated in UTC instant time (ISO 8601
 * timestamps). Relation intervals are [validFrom, validUntil); occurrence
 * bounds are inclusive. An occurrence window applies independently to each
 * original usage Record and correction Record, and its end never reaches past
 * asOf. Resource filtering only removes complete resource rows; it never
 * changes the arithmetic for a retained row.
 */
export interface ResourceBalanceReadOptions {
  asOf?: IsoTimestamp;
  resourceId?: EntityId;
  occurredAt?: RecordTimeRange;
}

/**
 * Exact current and historical balance projections. Each returned row's
 * budgetRelationIds, allocationRelationIds, and usageRecordIds are its
 * deterministic reconciliation trace back to immutable source facts.
 */
export class ResourceBalanceQueryService {
  private readonly clock: Clock;

  constructor(private readonly ports: ResourceBalanceQueryServicePorts) {
    this.clock = ports.clock ?? systemClock;
  }

  /**
   * One row per Resource that has a current budget, allocation, or retained
   * usage occurrence for the Project. Task-attributed usage is included once,
   * alongside Project-only usage.
   */
  async listCurrentProjectBalances(projectId: EntityId): Promise<ProjectResourceBalance[]> {
    return this.listProjectBalances(projectId, { asOf: this.clock.now() });
  }

  /**
   * Project balances as of one instant, including ended/superseded planning
   * history when it was valid at that instant and archived usage facts.
   */
  async listProjectBalances(
    projectId: EntityId,
    options: ResourceBalanceReadOptions = {},
  ): Promise<ProjectResourceBalance[]> {
    assertId('projectId', projectId);
    const { asOf, occurredAt } = this.selection(options);
    const [budgets, allocations, usage] = await Promise.all([
      this.ports.projectBudgets.listActiveBudgetsForProject(projectId, { asOf }),
      this.ports.taskAllocations.listActiveAllocationsForProject(projectId, { asOf }),
      this.listAllUsage({ projectId }),
    ]);
    return calculateProjectResourceBalances({
      budgets: budgets.map((budget) => ({
        relationId: budget.relationId, projectId: budget.projectId,
        resourceId: budget.resourceId, amount: budget.amount,
      })),
      allocations: allocations.map((allocation) => ({
        relationId: allocation.relationId, taskId: allocation.taskId,
        fundingProjectId: allocation.fundingProjectId, resourceId: allocation.resourceId,
        amount: allocation.amount,
      })),
      usage: usage.flatMap((item) => toUsageContributors(item, asOf, occurredAt)),
    }).filter((balance) => options.resourceId === undefined || balance.resourceId === options.resourceId);
  }

  /**
   * One row per currently allocated Resource for the Task. Actual consumption
   * is counted only when it is explicitly attributed to that Task; unallocated
   * task usage remains visible in the Project balance but gets no Task row.
   */
  async listCurrentTaskBalances(taskId: EntityId): Promise<TaskResourceBalance[]> {
    return this.listTaskBalances(taskId, { asOf: this.clock.now() });
  }

  /**
   * A Task/Project partition used by resource-exception history.  A Task can
   * be funded by more than one Project, so its exception view must never add
   * allocations or usage from another funding context.
   */
  async listTaskBalancesForProject(
    projectId: EntityId,
    taskId: EntityId,
    options: ResourceBalanceReadOptions = {},
  ): Promise<TaskResourceBalance[]> {
    assertId('projectId', projectId);
    assertId('taskId', taskId);
    const { asOf, occurredAt } = this.selection(options);
    const [allocations, usage] = await Promise.all([
      this.ports.taskAllocations.listActiveAllocationsForTask(taskId, { asOf }),
      this.listAllUsage({ projectId, taskId }),
    ]);
    return calculateTaskResourceBalances({
      allocations: allocations.filter((allocation) => allocation.fundingProjectId === projectId).map((allocation) => ({
        relationId: allocation.relationId, taskId: allocation.taskId,
        fundingProjectId: allocation.fundingProjectId, resourceId: allocation.resourceId,
        amount: allocation.amount,
      })),
      usage: usage.flatMap((item) => toUsageContributors(item, asOf, occurredAt)),
    }).filter((balance) => options.resourceId === undefined || balance.resourceId === options.resourceId);
  }

  /** Historical Task balance with the same temporal rules as Project balances. */
  async listTaskBalances(
    taskId: EntityId,
    options: ResourceBalanceReadOptions = {},
  ): Promise<TaskResourceBalance[]> {
    assertId('taskId', taskId);
    const { asOf, occurredAt } = this.selection(options);
    const [allocations, usage] = await Promise.all([
      this.ports.taskAllocations.listActiveAllocationsForTask(taskId, { asOf }),
      this.listAllUsage({ taskId }),
    ]);
    return calculateTaskResourceBalances({
      allocations: allocations.map((allocation) => ({
        relationId: allocation.relationId, taskId: allocation.taskId,
        fundingProjectId: allocation.fundingProjectId, resourceId: allocation.resourceId,
        amount: allocation.amount,
      })),
      usage: usage.flatMap((item) => toUsageContributors(item, asOf, occurredAt)),
    }).filter((balance) => options.resourceId === undefined || balance.resourceId === options.resourceId);
  }

  private selection(options: ResourceBalanceReadOptions): { asOf: IsoTimestamp; occurredAt: RecordTimeRange | undefined } {
    const asOf = options.asOf ?? this.clock.now();
    assertTimestamp('asOf', asOf);
    if (options.resourceId !== undefined) assertId('resourceId', options.resourceId);
    const range = options.occurredAt;
    if (range !== undefined) {
      if (range.start !== undefined) assertTimestamp('occurredAt.start', range.start);
      if (range.end !== undefined) assertTimestamp('occurredAt.end', range.end);
      if (range.start !== undefined && range.end !== undefined && Date.parse(range.start) > Date.parse(range.end)) {
        throw new Error('Resource balance query occurredAt.start must not be after occurredAt.end');
      }
    }
    return { asOf, occurredAt: range };
  }

  /** Resource usage history is paged, so a balance never silently omits facts. */
  private async listAllUsage(query: { projectId?: EntityId; taskId?: EntityId }): Promise<ResourceUsageHistoryItem[]> {
    const all: ResourceUsageHistoryItem[] = [];
    const limit = 100;
    for (let offset = 0;; offset += limit) {
      const page = await this.ports.resourceUsage.listHistory({ ...query, limit, offset });
      all.push(...page);
      if (page.length < limit) return all;
    }
  }
}

/**
 * Expand a usage history item into occurrence-time-selected immutable facts.
 * Corrections are selected by their own occurrence time, rather than being
 * inherited from the original's time window; this preserves a faithful event
 * fold even when a reversal is recorded in a later reporting window.
 */
function toUsageContributors(
  item: ResourceUsageHistoryItem,
  asOf: IsoTimestamp,
  occurredAt: RecordTimeRange | undefined,
): ResourceUsageBalanceContributor[] {
  const original = item.original;
  const contributors: ResourceUsageBalanceContributor[] = [];
  if (isIncluded(original.record.occurredAt, asOf, occurredAt)) {
    contributors.push({
      recordId: original.recordId, projectId: original.projectId,
      resourceId: original.resourceId, taskId: original.taskId,
      amount: original.amount, aggregationEffect: 1,
    });
  }
  for (const correction of item.corrections) {
    if (!isIncluded(correction.record.occurredAt, asOf, occurredAt)) continue;
    contributors.push({
      recordId: correction.recordId, projectId: correction.projectId,
      resourceId: correction.resourceId, taskId: correction.taskId,
      amount: correction.amount, aggregationEffect: -1 as const,
    });
  }
  return contributors;
}

function assertId(name: string, value: EntityId): void {
  if (value.trim().length === 0) throw new Error(`Resource balance query ${name} must not be blank`);
}

function assertTimestamp(name: string, value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(`Resource balance query ${name} must be a valid ISO 8601 timestamp`);
  }
}

function isIncluded(occurredAt: IsoTimestamp, asOf: IsoTimestamp, range: RecordTimeRange | undefined): boolean {
  const occurred = Date.parse(occurredAt);
  return occurred <= Date.parse(asOf) &&
    (range?.start === undefined || occurred >= Date.parse(range.start)) &&
    (range?.end === undefined || occurred <= Date.parse(range.end));
}
