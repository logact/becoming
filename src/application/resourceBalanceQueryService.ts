import type { EntityId } from '../domain/ids';
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

/**
 * The bounded query ports required to derive a current resource balance.
 * They intentionally stay read-only: calculating a balance cannot repair,
 * end, or otherwise alter its planned or actual contributors.
 */
export interface ResourceBalanceQueryServicePorts {
  projectBudgets: Pick<ProjectBudgetQueryService, 'listActiveBudgetsForProject'>;
  taskAllocations: Pick<TaskAllocationQueryService, 'listActiveAllocationsForProject' | 'listActiveAllocationsForTask'>;
  resourceUsage: Pick<ResourceUsageQueryService, 'listHistory'>;
}

/**
 * Current, exact balance projection for one Project or Task. Historical/as-of
 * views deliberately belong to a later feature; immutable usage history is
 * reconciled at its full retained effective value here.
 */
export class ResourceBalanceQueryService {
  constructor(private readonly ports: ResourceBalanceQueryServicePorts) {}

  /**
   * One row per Resource that has a current budget, allocation, or retained
   * usage occurrence for the Project. Task-attributed usage is included once,
   * alongside Project-only usage.
   */
  async listCurrentProjectBalances(projectId: EntityId): Promise<ProjectResourceBalance[]> {
    assertId('projectId', projectId);
    const [budgets, allocations, usage] = await Promise.all([
      this.ports.projectBudgets.listActiveBudgetsForProject(projectId),
      this.ports.taskAllocations.listActiveAllocationsForProject(projectId),
      this.ports.resourceUsage.listHistory({ projectId }),
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
      usage: usage.flatMap(toUsageContributors),
    });
  }

  /**
   * One row per currently allocated Resource for the Task. Actual consumption
   * is counted only when it is explicitly attributed to that Task; unallocated
   * task usage remains visible in the Project balance but gets no Task row.
   */
  async listCurrentTaskBalances(taskId: EntityId): Promise<TaskResourceBalance[]> {
    assertId('taskId', taskId);
    const [allocations, usage] = await Promise.all([
      this.ports.taskAllocations.listActiveAllocationsForTask(taskId),
      this.ports.resourceUsage.listHistory({ taskId }),
    ]);
    return calculateTaskResourceBalances({
      allocations: allocations.map((allocation) => ({
        relationId: allocation.relationId, taskId: allocation.taskId,
        fundingProjectId: allocation.fundingProjectId, resourceId: allocation.resourceId,
        amount: allocation.amount,
      })),
      usage: usage.flatMap(toUsageContributors),
    });
  }
}

/** Expand an effective usage history item into its immutable Record trail. */
function toUsageContributors(item: ResourceUsageHistoryItem): ResourceUsageBalanceContributor[] {
  const original = item.original;
  return [
    {
      recordId: original.recordId, projectId: original.projectId,
      resourceId: original.resourceId, taskId: original.taskId,
      amount: original.amount, aggregationEffect: 1,
    },
    ...item.corrections.map((correction) => ({
      recordId: correction.recordId, projectId: correction.projectId,
      resourceId: correction.resourceId, taskId: correction.taskId,
      amount: correction.amount, aggregationEffect: -1 as const,
    })),
  ];
}

function assertId(name: string, value: EntityId): void {
  if (value.trim().length === 0) throw new Error(`Resource balance query ${name} must not be blank`);
}
