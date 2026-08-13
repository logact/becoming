import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  TASK_ALLOCATION_RELATION_TYPE,
  taskAllocationMetadata,
  taskAllocationQuantity,
} from '../domain/taskAllocation';
import type { TaskAllocationOverAllocationPolicy } from '../domain/taskAllocation';
import {
  PROJECT_BUDGET_RELATION_TYPE,
  projectBudgetMetadata,
  projectBudgetQuantity,
} from '../domain/projectBudget';
import { Quantity } from '../domain/quantity';
import type { Relation } from '../domain/relation';
import type { RelationRepository } from '../persistence/relationRepository';
import type { Clock } from './recordService';
import { systemClock } from './recordService';

/** A reconciliable projection of one immutable Task allocation relation. */
export interface TaskAllocationView {
  relationId: EntityId;
  taskId: EntityId;
  fundingProjectId: EntityId;
  resourceId: EntityId;
  amount: Quantity;
  projectContext: string;
  overallocationPolicy: TaskAllocationOverAllocationPolicy;
  policyContext: ReturnType<typeof taskAllocationMetadata>['policyContext'];
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
  /** Half-open business-validity interval, constrained by the Relation interval. */
  validFrom: IsoTimestamp;
  validUntil: IsoTimestamp | null;
  relation: Relation;
}

export interface TaskAllocationReadOptions {
  asOf?: IsoTimestamp;
}

/** Filters complete allocation history; every supplied field narrows the result. */
export interface TaskAllocationHistoryQuery extends TaskAllocationReadOptions {
  taskId?: EntityId;
  fundingProjectId?: EntityId;
  resourceId?: EntityId;
  projectContext?: string;
}

export interface ProjectResourceAllocationQuery extends TaskAllocationReadOptions {
  projectId: EntityId;
  resourceId: EntityId;
  projectContext?: string;
}

/** Exact active sum and its contributing immutable relation ids. */
export interface TaskAllocationTotal {
  /** Null when the total intentionally spans every funding Project for a Resource. */
  projectId: EntityId | null;
  resourceId: EntityId;
  projectContext: string | null;
  unit: string | null;
  total: Quantity | null;
  allocations: TaskAllocationView[];
  contributingRelationIds: EntityId[];
}

export class TaskAllocationUnitMismatchError extends Error {
  constructor(
    readonly scope: string,
    readonly expectedUnit: string,
    readonly mismatchedRelationIds: readonly EntityId[],
  ) {
    super(`Task allocation query found incompatible units in ${scope}: expected ${JSON.stringify(expectedUnit)}; relations ${mismatchedRelationIds.join(', ')}`);
    this.name = 'TaskAllocationUnitMismatchError';
  }
}

export class AmbiguousActiveTaskAllocationBudgetError extends Error {
  constructor(query: Required<Pick<ProjectResourceAllocationQuery, 'projectId' | 'resourceId'>> & { projectContext: string }, relationIds: readonly EntityId[]) {
    super(`More than one active Project budget matches ${query.projectId}/${query.resourceId}/${JSON.stringify(query.projectContext)}: ${relationIds.join(', ')}`);
    this.name = 'AmbiguousActiveTaskAllocationBudgetError';
  }
}

/**
 * A read-only allocation-to-budget comparison.  `over_budget_*` states are
 * informational: querying never ends, rejects, or rewrites a plan.
 */
export type TaskAllocationBudgetDiagnostics =
  | {
      status: 'budget_missing';
      projectId: EntityId; resourceId: EntityId; projectContext: string;
      unit: string | null; budget: null; allocated: Quantity | null; variance: null;
      overallocationPolicies: TaskAllocationOverAllocationPolicy[];
      allocations: TaskAllocationView[]; contributingRelationIds: EntityId[];
    }
  | {
      status: 'below_budget' | 'at_budget' | 'over_budget_reject' | 'over_budget_flag';
      projectId: EntityId; resourceId: EntityId; projectContext: string;
      unit: string; budget: Quantity; allocated: Quantity; variance: Quantity;
      overallocationPolicies: TaskAllocationOverAllocationPolicy[];
      allocations: TaskAllocationView[]; contributingRelationIds: EntityId[];
      budgetRelationId: EntityId;
    };

export interface TaskAllocationQueryServicePorts {
  relations: RelationRepository;
  clock?: Clock;
}

/**
 * Read-side boundary for Task allocation plans.  It reads both ended and
 * active Relations, applies metadata validity bounds, and exposes exact sums
 * without introducing consumption or accounting semantics.
 */
export class TaskAllocationQueryService {
  private readonly clock: Clock;

  constructor(private readonly ports: TaskAllocationQueryServicePorts) {
    this.clock = ports.clock ?? systemClock;
  }

  /** Explicit Resource plans currently effective for a Task, with funding context. */
  async listActiveAllocationsForTask(taskId: EntityId, options: TaskAllocationReadOptions = {}): Promise<TaskAllocationView[]> {
    const asOf = this.asOf(options);
    return (await this.listAllocationHistory({ taskId }))
      .filter((allocation) => isEffectiveAt(allocation, asOf));
  }

  /** Every effective allocation funded by a Project, optionally one Resource/context. */
  async listActiveAllocationsForProject(projectId: EntityId, options: TaskAllocationReadOptions = {}): Promise<TaskAllocationView[]> {
    const asOf = this.asOf(options);
    return (await this.listAllocationHistory({ fundingProjectId: projectId }))
      .filter((allocation) => isEffectiveAt(allocation, asOf));
  }

  /** Every effective allocation of one Resource across its funding Projects. */
  async listActiveAllocationsForResource(resourceId: EntityId, options: TaskAllocationReadOptions = {}): Promise<TaskAllocationView[]> {
    const asOf = this.asOf(options);
    return (await this.listAllocationHistory({ resourceId }))
      .filter((allocation) => isEffectiveAt(allocation, asOf));
  }

  /** Complete immutable allocation history, chronologically then by relation id. */
  async listAllocationHistory(query: TaskAllocationHistoryQuery = {}): Promise<TaskAllocationView[]> {
    const relations = await this.listAllRelations({
      ...(query.taskId === undefined ? {} : { source: { type: 'task' as const, id: query.taskId } }),
      ...(query.resourceId === undefined ? {} : { target: { type: 'resource' as const, id: query.resourceId } }),
      relationType: TASK_ALLOCATION_RELATION_TYPE,
    });
    return relations.map(toAllocationView)
      .filter((allocation) => query.fundingProjectId === undefined || allocation.fundingProjectId === query.fundingProjectId)
      .filter((allocation) => query.projectContext === undefined || allocation.projectContext === query.projectContext)
      .sort(compareAllocationViews);
  }

  /** Exact active total for one funding Project/Resource, optionally a context. */
  async getActiveAllocationTotal(query: ProjectResourceAllocationQuery): Promise<TaskAllocationTotal> {
    const allocations = (await this.listAllocationHistory({
      fundingProjectId: query.projectId, resourceId: query.resourceId, projectContext: query.projectContext,
    })).filter((allocation) => isEffectiveAt(allocation, this.asOf(query)));
    return sumAllocations(query.projectId, query.resourceId, query.projectContext ?? null, allocations);
  }

  /** Exact active total for a Project/Resource funding pair. */
  async getActiveAllocationTotalForProject(
    projectId: EntityId,
    resourceId: EntityId,
    options: Omit<ProjectResourceAllocationQuery, 'projectId' | 'resourceId'> = {},
  ): Promise<TaskAllocationTotal> {
    return this.getActiveAllocationTotal({ projectId, resourceId, ...options });
  }

  /** Exact active total for a Resource across all funding Projects. */
  async getActiveAllocationTotalForResource(
    resourceId: EntityId,
    options: TaskAllocationReadOptions = {},
  ): Promise<TaskAllocationTotal> {
    const allocations = (await this.listAllocationHistory({ resourceId }))
      .filter((allocation) => isEffectiveAt(allocation, this.asOf(options)));
    return sumAllocations(null, resourceId, null, allocations);
  }

  /**
   * Compare a context's active allocations with its effective Project budget.
   * All returned relations remain directly reconcilable by id.
   */
  async getBudgetDiagnostics(query: Required<Pick<ProjectResourceAllocationQuery, 'projectId' | 'resourceId'>> & TaskAllocationReadOptions & { projectContext: string }): Promise<TaskAllocationBudgetDiagnostics> {
    const asOf = this.asOf(query);
    const total = await this.getActiveAllocationTotal({ ...query, asOf });
    const budgets = (await this.listAllRelations({
      source: { type: 'project', id: query.projectId }, target: { type: 'resource', id: query.resourceId },
      relationType: PROJECT_BUDGET_RELATION_TYPE,
    })).map(toBudgetView)
      .filter((budget) => budget.projectContext === query.projectContext && isEffectiveAt(budget, asOf))
      .sort(compareBudgetViews);
    if (budgets.length > 1) {
      throw new AmbiguousActiveTaskAllocationBudgetError(query, budgets.map((budget) => budget.relationId));
    }
    const overallocationPolicies = [...new Set(total.allocations.map((entry) => entry.overallocationPolicy))].sort() as TaskAllocationOverAllocationPolicy[];
    const budget = budgets[0];
    if (budget === undefined) {
      return { status: 'budget_missing', projectId: query.projectId, resourceId: query.resourceId,
        projectContext: query.projectContext, unit: total.unit, budget: null, allocated: total.total,
        variance: null, overallocationPolicies, allocations: total.allocations,
        contributingRelationIds: total.contributingRelationIds };
    }
    if (total.total !== null && total.total.unit !== budget.amount.unit) {
      throw new TaskAllocationUnitMismatchError(
        `Project ${query.projectId}/Resource ${query.resourceId}/context ${JSON.stringify(query.projectContext)}`,
        budget.amount.unit, total.contributingRelationIds,
      );
    }
    const allocated = total.total ?? Quantity.zero(budget.amount.unit);
    const variance = allocated.subtract(budget.amount);
    const comparison = allocated.compare(budget.amount);
    // A flag plan intentionally makes the derived outcome informational even
    // when earlier contributing plans used the stricter reject policy.
    const status = comparison < 0 ? 'below_budget' : comparison === 0 ? 'at_budget'
      : overallocationPolicies.includes('flag') ? 'over_budget_flag' : 'over_budget_reject';
    return { status, projectId: query.projectId, resourceId: query.resourceId,
      projectContext: query.projectContext, unit: budget.amount.unit, budget: budget.amount,
      allocated, variance, overallocationPolicies, allocations: total.allocations,
      contributingRelationIds: total.contributingRelationIds, budgetRelationId: budget.relationId };
  }

  private asOf(options: TaskAllocationReadOptions): IsoTimestamp {
    const asOf = options.asOf ?? this.clock.now();
    if (asOf.trim().length === 0 || Number.isNaN(Date.parse(asOf))) {
      throw new Error(`Task allocation query asOf must be a valid ISO 8601 timestamp, got ${JSON.stringify(asOf)}`);
    }
    return asOf;
  }

  private async listAllRelations(query: Parameters<RelationRepository['listHistory']>[0]): Promise<Relation[]> {
    const pageSize = 100;
    const all: Relation[] = [];
    for (let offset = 0;; offset += pageSize) {
      const page = await this.ports.relations.listHistory({ ...query, limit: pageSize, offset });
      all.push(...page);
      if (page.length < pageSize) return all;
    }
  }
}

interface ProjectBudgetView {
  relationId: EntityId;
  amount: Quantity;
  projectContext: string;
  validFrom: IsoTimestamp;
  validUntil: IsoTimestamp | null;
}

function toAllocationView(relation: Relation): TaskAllocationView {
  const metadata = taskAllocationMetadata(relation.metadata);
  const validFrom = metadata.effectiveFrom ?? relation.createdAt;
  const validUntil = earliestEnd(metadata.effectiveUntil, relation.endedAt);
  return { relationId: relation.id, taskId: relation.sourceId, fundingProjectId: metadata.fundingProjectId,
    resourceId: relation.targetId, amount: taskAllocationQuantity(relation), projectContext: metadata.projectContext,
    overallocationPolicy: metadata.overallocationPolicy, policyContext: metadata.policyContext,
    createdAt: relation.createdAt, endedAt: relation.endedAt, validFrom, validUntil, relation };
}

function toBudgetView(relation: Relation): ProjectBudgetView {
  const metadata = projectBudgetMetadata(relation.metadata);
  return { relationId: relation.id, amount: projectBudgetQuantity(relation), projectContext: metadata.projectContext,
    validFrom: metadata.effectiveFrom ?? relation.createdAt,
    validUntil: earliestEnd(metadata.effectiveUntil, relation.endedAt) };
}

function earliestEnd(metadataEnd: IsoTimestamp | undefined, relationEnd: IsoTimestamp | null): IsoTimestamp | null {
  if (metadataEnd === undefined) return relationEnd;
  return relationEnd === null || Date.parse(metadataEnd) < Date.parse(relationEnd) ? metadataEnd : relationEnd;
}

function isEffectiveAt(view: Pick<TaskAllocationView | ProjectBudgetView, 'validFrom' | 'validUntil'>, at: IsoTimestamp): boolean {
  return Date.parse(view.validFrom) <= Date.parse(at) &&
    (view.validUntil === null || Date.parse(at) < Date.parse(view.validUntil));
}

function compareAllocationViews(left: TaskAllocationView, right: TaskAllocationView): number {
  const start = Date.parse(left.validFrom) - Date.parse(right.validFrom);
  return start === 0 ? left.relationId.localeCompare(right.relationId) : start;
}

function compareBudgetViews(left: ProjectBudgetView, right: ProjectBudgetView): number {
  const start = Date.parse(left.validFrom) - Date.parse(right.validFrom);
  return start === 0 ? left.relationId.localeCompare(right.relationId) : start;
}

function sumAllocations(projectId: EntityId | null, resourceId: EntityId, projectContext: string | null, allocations: TaskAllocationView[]): TaskAllocationTotal {
  const contributingRelationIds = allocations.map((allocation) => allocation.relationId);
  const unit = allocations[0]?.amount.unit ?? null;
  if (unit === null) return { projectId, resourceId, projectContext, unit, total: null, allocations, contributingRelationIds };
  const mismatched = allocations.filter((allocation) => allocation.amount.unit !== unit).map((allocation) => allocation.relationId);
  if (mismatched.length > 0) {
    throw new TaskAllocationUnitMismatchError(
      `${projectId === null ? 'Resource' : `Project ${projectId}/Resource`} ${resourceId}${projectContext === null ? '' : `/context ${JSON.stringify(projectContext)}`}`,
      unit, mismatched,
    );
  }
  return { projectId, resourceId, projectContext, unit,
    total: allocations.reduce((sum, allocation) => sum.add(allocation.amount), Quantity.zero(unit)),
    allocations, contributingRelationIds };
}
