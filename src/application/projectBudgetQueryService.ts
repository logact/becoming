import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  PROJECT_BUDGET_RELATION_TYPE,
  projectBudgetMetadata,
  projectBudgetQuantity,
} from '../domain/projectBudget';
import type { ProjectBudgetCapacityPolicy } from '../domain/projectBudget';
import { Quantity } from '../domain/quantity';
import type { Relation } from '../domain/relation';
import type { RelationRepository } from '../persistence/relationRepository';
import type { ResourceRepository } from '../persistence/resourceRepository';
import type { Clock } from './recordService';
import { systemClock } from './recordService';

/** A read model for one immutable Project-to-Resource budget relation. */
export interface ProjectBudgetView {
  /** The durable Relation id used to reconcile this view with provenance. */
  relationId: EntityId;
  projectId: EntityId;
  resourceId: EntityId;
  amount: Quantity;
  projectContext: string;
  capacityPolicy: ProjectBudgetCapacityPolicy;
  /** Preserved policy detail; queries never apply or rewrite it. */
  policyContext: ReturnType<typeof projectBudgetMetadata>['policyContext'];
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
  /** Effective bounds are half-open and account for both relation and metadata time. */
  validFrom: IsoTimestamp;
  validUntil: IsoTimestamp | null;
  /** The unmodified relation makes all metadata and provenance reconciliation inspectable. */
  relation: Relation;
}

export interface ProjectBudgetReadOptions {
  /** Defaults to the injected clock.  Half-open boundaries include start, exclude end. */
  asOf?: IsoTimestamp;
}

export interface ProjectBudgetHistoryQuery extends ProjectBudgetReadOptions {
  projectId: EntityId;
  resourceId?: EntityId;
  projectContext?: string;
}

export interface ActiveProjectBudgetQuery extends ProjectBudgetReadOptions {
  projectId: EntityId;
  resourceId: EntityId;
  projectContext: string;
}

export class AmbiguousActiveProjectBudgetError extends Error {
  constructor(query: ActiveProjectBudgetQuery, relationIds: readonly EntityId[]) {
    super(`More than one active Project budget matches ${query.projectId}/${query.resourceId}/${JSON.stringify(query.projectContext)}: ${relationIds.join(', ')}`);
    this.name = 'AmbiguousActiveProjectBudgetError';
  }
}

export class ProjectBudgetResourceNotFoundError extends Error {
  constructor(resourceId: EntityId) {
    super(`Resource ${resourceId} not found for Project budget capacity query`);
    this.name = 'ProjectBudgetResourceNotFoundError';
  }
}

/**
 * Capacity diagnostics are deliberately descriptive: they surface an active
 * policy and do not reject, end, or rebalance a relation while being read.
 */
export type ProjectBudgetCapacityDiagnostics =
  | {
      status: 'capacity_unspecified';
      resourceId: EntityId;
      unit: string | null;
      committed: Quantity | null;
      capacity: null;
      remaining: null;
      variance: null;
      activeBudgets: ProjectBudgetView[];
      configuredPolicies: ProjectBudgetCapacityPolicy[];
    }
  | {
      status: 'unit_mismatch';
      resourceId: EntityId;
      unit: string | null;
      capacity: Quantity | null;
      committed: null;
      remaining: null;
      variance: null;
      activeBudgets: ProjectBudgetView[];
      mismatchedBudgetRelationIds: EntityId[];
      configuredPolicies: ProjectBudgetCapacityPolicy[];
    }
  | {
      status: 'within_capacity' | 'at_capacity' | 'over_capacity';
      resourceId: EntityId;
      unit: string;
      capacity: Quantity;
      committed: Quantity;
      remaining: Quantity;
      /** `committed - capacity`; positive means over capacity. */
      variance: Quantity;
      activeBudgets: ProjectBudgetView[];
      configuredPolicies: ProjectBudgetCapacityPolicy[];
    };

export interface ProjectBudgetQueryServicePorts {
  relations: RelationRepository;
  resources: ResourceRepository;
  clock?: Clock;
}

/**
 * Read-side boundary for temporal Project Resource budgets.  It deliberately
 * owns no mutation ports: querying history or a policy outcome can never
 * alter relation/provenance history.
 */
export class ProjectBudgetQueryService {
  private readonly clock: Clock;

  constructor(private readonly ports: ProjectBudgetQueryServicePorts) {
    this.clock = ports.clock ?? systemClock;
  }

  /** Return the one effective budget for an exact Project/Resource/context, or null. */
  async getActiveBudget(query: ActiveProjectBudgetQuery): Promise<ProjectBudgetView | null> {
    const budgets = (await this.listBudgetHistory(query))
      .filter((budget) => isEffectiveAt(budget, this.asOf(query)));
    if (budgets.length > 1) {
      throw new AmbiguousActiveProjectBudgetError(query, budgets.map((budget) => budget.relationId));
    }
    return budgets[0] ?? null;
  }

  /** All effective budgets for a Project, independently scoped by Resource/context. */
  async listActiveBudgetsForProject(
    projectId: EntityId,
    options: ProjectBudgetReadOptions = {},
  ): Promise<ProjectBudgetView[]> {
    const asOf = this.asOf(options);
    return (await this.listBudgetHistory({ projectId }))
      .filter((budget) => isEffectiveAt(budget, asOf));
  }

  /**
   * Complete immutable history, ordered by effective start then relation id.
   * Ended, superseded, future-effective, and expired relations all remain
   * visible along with their relation and business-validity bounds.
   */
  async listBudgetHistory(query: ProjectBudgetHistoryQuery): Promise<ProjectBudgetView[]> {
    const relations = await this.listAllRelations({
      source: { type: 'project', id: query.projectId },
      relationType: PROJECT_BUDGET_RELATION_TYPE,
      ...(query.resourceId === undefined
        ? {}
        : { target: { type: 'resource' as const, id: query.resourceId } }),
    });
    return relations
      .map(toBudgetView)
      .filter((budget) => query.projectContext === undefined || budget.projectContext === query.projectContext)
      .sort(compareBudgetViews);
  }

  /** Reconcile every effective Project budget against one Resource's finite capacity. */
  async getCapacityDiagnostics(
    resourceId: EntityId,
    options: ProjectBudgetReadOptions = {},
  ): Promise<ProjectBudgetCapacityDiagnostics> {
    const resource = await this.ports.resources.getById(resourceId);
    if (resource === null) throw new ProjectBudgetResourceNotFoundError(resourceId);
    const asOf = this.asOf(options);
    const activeBudgets = (await this.listAllRelations({
      target: { type: 'resource', id: resourceId }, relationType: PROJECT_BUDGET_RELATION_TYPE,
    }))
      .map(toBudgetView)
      .filter((budget) => isEffectiveAt(budget, asOf))
      .sort(compareBudgetViews);
    const configuredPolicies = [...new Set(activeBudgets.map((budget) => budget.capacityPolicy))].sort();
    const mismatched = resource.unit === null
      ? activeBudgets
      : activeBudgets.filter((budget) => budget.amount.unit !== resource.unit);
    if (mismatched.length > 0) {
      return {
        status: 'unit_mismatch', resourceId, unit: resource.unit,
        capacity: resource.capacity === null || resource.unit === null
          ? null : Quantity.of(resource.capacity, resource.unit),
        committed: null, remaining: null, variance: null, activeBudgets,
        mismatchedBudgetRelationIds: mismatched.map((budget) => budget.relationId), configuredPolicies,
      };
    }
    const unit = resource.unit;
    const committed = unit === null ? null : activeBudgets
      .reduce((total, budget) => total.add(budget.amount), Quantity.zero(unit));
    if (resource.capacity === null || unit === null) {
      return {
        status: 'capacity_unspecified', resourceId, unit, committed, capacity: null,
        remaining: null, variance: null, activeBudgets, configuredPolicies,
      };
    }
    const capacity = Quantity.of(resource.capacity, unit);
    const remaining = capacity.subtract(committed!);
    const variance = committed!.subtract(capacity);
    return {
      status: variance.amount.compare(Quantity.zero(unit).amount) < 0 ? 'within_capacity'
        : variance.amount.equals(Quantity.zero(unit).amount) ? 'at_capacity' : 'over_capacity',
      resourceId, unit, capacity, committed: committed!, remaining, variance,
      activeBudgets, configuredPolicies,
    };
  }

  private asOf(options: ProjectBudgetReadOptions): IsoTimestamp {
    const asOf = options.asOf ?? this.clock.now();
    if (asOf.trim().length === 0 || Number.isNaN(Date.parse(asOf))) {
      throw new Error(`Project budget query asOf must be a valid ISO 8601 timestamp, got ${JSON.stringify(asOf)}`);
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

function toBudgetView(relation: Relation): ProjectBudgetView {
  const metadata = projectBudgetMetadata(relation.metadata);
  const validFrom = metadata.effectiveFrom ?? relation.createdAt;
  const relationUntil = relation.endedAt;
  const validUntil = metadata.effectiveUntil === undefined
    ? relationUntil
    : relationUntil === null || Date.parse(metadata.effectiveUntil) < Date.parse(relationUntil)
      ? metadata.effectiveUntil : relationUntil;
  return {
    relationId: relation.id, projectId: relation.sourceId, resourceId: relation.targetId,
    amount: projectBudgetQuantity(relation), projectContext: metadata.projectContext,
    capacityPolicy: metadata.capacityPolicy, policyContext: metadata.policyContext,
    createdAt: relation.createdAt, endedAt: relation.endedAt, validFrom, validUntil, relation,
  };
}

function isEffectiveAt(budget: ProjectBudgetView, at: IsoTimestamp): boolean {
  return Date.parse(budget.validFrom) <= Date.parse(at) &&
    (budget.validUntil === null || Date.parse(at) < Date.parse(budget.validUntil));
}

function compareBudgetViews(left: ProjectBudgetView, right: ProjectBudgetView): number {
  const start = Date.parse(left.validFrom) - Date.parse(right.validFrom);
  return start === 0 ? left.relationId.localeCompare(right.relationId) : start;
}
