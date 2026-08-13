import { Decimal } from './decimal';
import type { EntityId, IsoTimestamp } from './ids';
import type { JsonValue } from './json';
import {
  projectBudgetMetadata,
  validateProjectBudgetRelation,
} from './projectBudget';
import { Quantity } from './quantity';
import { createRelation } from './relation';
import type { Relation, RelationFactoryDeps } from './relation';
import type { Resource } from './resource';

/** The semantic relation used to reserve part of a Project budget for a Task. */
export const TASK_ALLOCATION_RELATION_TYPE = 'allocated';

/** Metadata schema version for Task allocation relations. */
export const TASK_ALLOCATION_METADATA_VERSION = 1;

/** The declared outcome when active allocations exceed their funding budget. */
export type TaskAllocationOverAllocationPolicy = 'reject' | 'flag';

/**
 * JSON-safe metadata on a `task -> allocated -> resource` Relation.
 *
 * `fundingProjectId` and `projectContext` deliberately name the exact budget
 * context from which this plan draws.  There is no fallback to another
 * Project's budget, or to another context of the same Project.
 */
export interface TaskAllocationMetadata {
  metadataVersion: typeof TASK_ALLOCATION_METADATA_VERSION;
  fundingProjectId: EntityId;
  amount: string;
  unit: string;
  projectContext: string;
  overallocationPolicy: TaskAllocationOverAllocationPolicy;
  /** Optional business-effective interval; timestamps are half-open. */
  effectiveFrom?: IsoTimestamp;
  effectiveUntil?: IsoTimestamp;
  /** Optional JSON-safe explanation of this planned allocation. */
  policyContext?: JsonValue;
}

/** Input used to build the canonical allocation Relation and metadata. */
export interface NewTaskAllocationRelation {
  taskId: EntityId;
  fundingProjectId: EntityId;
  resourceId: EntityId;
  amount: Decimal | string;
  unit: string;
  /** Must name the active Project budget context explicitly. */
  projectContext: string;
  overallocationPolicy: TaskAllocationOverAllocationPolicy;
  effectiveFrom?: IsoTimestamp;
  effectiveUntil?: IsoTimestamp;
  policyContext?: JsonValue;
}

/** Logical references only: this contract never relies on database foreign keys. */
export interface ActiveTaskAllocationReferenceLookup {
  isTaskActive(id: EntityId): Promise<boolean>;
  isProjectActive(id: EntityId): Promise<boolean>;
  isResourceActive(id: EntityId): Promise<boolean>;
  /** The Task must currently belong to precisely the Project it names as funding. */
  hasActiveTaskProjectMembership(taskId: EntityId, projectId: EntityId): Promise<boolean>;
  /** Returns only the explicitly requested active Project/Resource/context budget. */
  findActiveProjectBudget(
    projectId: EntityId,
    resourceId: EntityId,
    projectContext: string,
  ): Promise<Relation | null>;
}

export class TaskAllocationReferenceNotFoundError extends Error {
  constructor(kind: 'task' | 'project' | 'resource' | 'membership' | 'budget', id: string) {
    super(`Active Task allocation ${kind} ${id} not found`);
    this.name = 'TaskAllocationReferenceNotFoundError';
  }
}

export class TaskAllocationOverBudgetError extends Error {
  constructor(total: Quantity, budget: Quantity) {
    super(`Task allocation total ${total.toString()} exceeds Project budget ${budget.toString()}`);
    this.name = 'TaskAllocationOverBudgetError';
  }
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) throw new Error(`Task allocation ${field} must not be blank`);
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(`Task allocation ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requirePolicy(value: string): TaskAllocationOverAllocationPolicy {
  if (value !== 'reject' && value !== 'flag') {
    throw new Error(`Task allocation overallocationPolicy must be "reject" or "flag", got ${JSON.stringify(value)}`);
  }
  return value;
}

function canonicalQuantity(amount: Decimal | string, unit: string): Quantity {
  const quantity = Quantity.of(amount, requireNonBlank('unit', unit));
  if (quantity.amount.compare(Decimal.zero()) <= 0) {
    throw new Error('Task allocation amount must be strictly positive');
  }
  return Quantity.of(quantity.amount.toString(), quantity.unit);
}

/** Parse and validate the versioned metadata shape on an allocation Relation. */
export function taskAllocationMetadata(metadata: Relation['metadata']): TaskAllocationMetadata {
  if (metadata === null || Array.isArray(metadata) || typeof metadata !== 'object') {
    throw new Error('Task allocation metadata must be an object');
  }
  const candidate = metadata as Record<string, JsonValue>;
  if (candidate.metadataVersion !== TASK_ALLOCATION_METADATA_VERSION) {
    throw new Error(`Unsupported Task allocation metadataVersion ${JSON.stringify(candidate.metadataVersion)}`);
  }
  if (typeof candidate.fundingProjectId !== 'string') {
    throw new Error('Task allocation metadata requires fundingProjectId');
  }
  const fundingProjectId = requireNonBlank('fundingProjectId', candidate.fundingProjectId);
  if (typeof candidate.amount !== 'string' || typeof candidate.unit !== 'string') {
    throw new Error('Task allocation metadata requires string amount and unit');
  }
  const quantity = canonicalQuantity(candidate.amount, candidate.unit);
  if (typeof candidate.projectContext !== 'string') {
    throw new Error('Task allocation metadata requires projectContext');
  }
  const projectContext = requireNonBlank('projectContext', candidate.projectContext);
  if (typeof candidate.overallocationPolicy !== 'string') {
    throw new Error('Task allocation metadata requires overallocationPolicy');
  }
  const overallocationPolicy = requirePolicy(candidate.overallocationPolicy);
  const rawEffectiveFrom = candidate.effectiveFrom;
  const rawEffectiveUntil = candidate.effectiveUntil;
  if (rawEffectiveFrom !== undefined && typeof rawEffectiveFrom !== 'string') {
    throw new Error('Task allocation effectiveFrom must be an ISO timestamp');
  }
  if (rawEffectiveUntil !== undefined && typeof rawEffectiveUntil !== 'string') {
    throw new Error('Task allocation effectiveUntil must be an ISO timestamp');
  }
  const effectiveFrom = rawEffectiveFrom as string | undefined;
  const effectiveUntil = rawEffectiveUntil as string | undefined;
  if (effectiveFrom !== undefined) requireTimestamp('effectiveFrom', effectiveFrom);
  if (effectiveUntil !== undefined) requireTimestamp('effectiveUntil', effectiveUntil);
  if (effectiveFrom !== undefined && effectiveUntil !== undefined && Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)) {
    throw new Error('Task allocation effective interval must not be zero-length or reversed');
  }
  return {
    metadataVersion: TASK_ALLOCATION_METADATA_VERSION,
    fundingProjectId,
    amount: quantity.amount.toString(),
    unit: quantity.unit,
    projectContext,
    overallocationPolicy,
    ...(effectiveFrom === undefined ? {} : { effectiveFrom }),
    ...(effectiveUntil === undefined ? {} : { effectiveUntil }),
    ...(candidate.policyContext === undefined ? {} : { policyContext: candidate.policyContext }),
  };
}

/** Return the exact, positive quantity carried by a validated allocation relation. */
export function taskAllocationQuantity(relation: Relation): Quantity {
  const metadata = taskAllocationMetadata(relation.metadata);
  return Quantity.of(metadata.amount, metadata.unit);
}

/** Create a canonical, active `task -> allocated -> resource` relation. */
export function createTaskAllocationRelation(
  input: NewTaskAllocationRelation,
  deps: RelationFactoryDeps = {},
): Relation {
  const quantity = canonicalQuantity(input.amount, input.unit);
  const metadata: TaskAllocationMetadata = {
    metadataVersion: TASK_ALLOCATION_METADATA_VERSION,
    fundingProjectId: requireNonBlank('fundingProjectId', input.fundingProjectId),
    amount: quantity.amount.toString(),
    unit: quantity.unit,
    projectContext: requireNonBlank('projectContext', input.projectContext),
    overallocationPolicy: requirePolicy(input.overallocationPolicy),
    ...(input.effectiveFrom === undefined ? {} : { effectiveFrom: requireTimestamp('effectiveFrom', input.effectiveFrom) }),
    ...(input.effectiveUntil === undefined ? {} : { effectiveUntil: requireTimestamp('effectiveUntil', input.effectiveUntil) }),
    ...(input.policyContext === undefined ? {} : { policyContext: input.policyContext }),
  };
  taskAllocationMetadata(metadata as unknown as JsonValue);
  return createRelation({
    sourceType: 'task', sourceId: input.taskId, relationType: TASK_ALLOCATION_RELATION_TYPE,
    targetType: 'resource', targetId: input.resourceId,
    metadata: metadata as unknown as JsonValue,
  }, deps);
}

/** Validate allocation direction, resource unit, and temporal bounds. */
export function validateTaskAllocationRelation(
  relation: Relation,
  resource: Pick<Resource, 'id' | 'unit'>,
): void {
  if (relation.sourceType !== 'task' || relation.relationType !== TASK_ALLOCATION_RELATION_TYPE || relation.targetType !== 'resource') {
    throw new Error('Task allocation must be task -> allocated -> resource');
  }
  if (relation.targetId !== resource.id) throw new Error('Task allocation target Resource must match the supplied Resource');
  const metadata = taskAllocationMetadata(relation.metadata);
  if (resource.unit === null || resource.unit !== metadata.unit) {
    throw new Error(`Task allocation unit ${JSON.stringify(metadata.unit)} is incompatible with Resource unit ${JSON.stringify(resource.unit)}`);
  }
  const start = metadata.effectiveFrom ?? relation.createdAt;
  if (Date.parse(start) < Date.parse(relation.createdAt)) {
    throw new Error('Task allocation effectiveFrom must not precede relation createdAt');
  }
  if (relation.endedAt !== null) {
    if (Date.parse(relation.endedAt) <= Date.parse(relation.createdAt)) {
      throw new Error('Ended Task allocation relation must not be zero-length');
    }
    if (metadata.effectiveUntil !== undefined && Date.parse(metadata.effectiveUntil) > Date.parse(relation.endedAt)) {
      throw new Error('Task allocation effectiveUntil must not outlive relation endedAt');
    }
  }
}

function interval(relation: Relation): { start: number; end: number | null } {
  const metadata = taskAllocationMetadata(relation.metadata);
  return {
    start: Date.parse(metadata.effectiveFrom ?? relation.createdAt),
    end: metadata.effectiveUntil === undefined
      ? relation.endedAt === null ? null : Date.parse(relation.endedAt)
      : Date.parse(metadata.effectiveUntil),
  };
}

/** Identity allowing exactly one active Task/Project/Resource/context plan. */
export function taskAllocationActiveIdentity(relation: Relation): string {
  const metadata = taskAllocationMetadata(relation.metadata);
  return `${relation.sourceId}\u0000${metadata.fundingProjectId}\u0000${relation.targetId}\u0000${metadata.projectContext}`;
}

/**
 * Validate all temporal versions for one allocation identity. End-and-append
 * supersession is valid at a shared boundary; overlaps and two active rows are not.
 */
export function validateTaskAllocationHistory(
  relations: readonly Relation[],
  resource: Pick<Resource, 'id' | 'unit'>,
): void {
  const identity = relations.length === 0 ? null : taskAllocationActiveIdentity(relations[0]);
  if (relations.some((relation) => taskAllocationActiveIdentity(relation) !== identity)) {
    throw new Error('Task allocation history must contain one Task/Project/Resource/context identity');
  }
  const sorted = [...relations].sort((left, right) => {
    const difference = interval(left).start - interval(right).start;
    return difference === 0 ? left.id.localeCompare(right.id) : difference;
  });
  let priorEnd: number | null = null;
  let active = false;
  for (const relation of sorted) {
    validateTaskAllocationRelation(relation, resource);
    const current = interval(relation);
    if (current.end !== null && current.end <= current.start) throw new Error('Task allocation history contains a zero-length or reversed interval');
    if (priorEnd === null && active) throw new Error('Task allocation history contains more than one active allocation');
    if (priorEnd !== null && current.start < priorEnd) throw new Error('Task allocation history contains overlapping allocation intervals');
    active ||= current.end === null;
    priorEnd = current.end;
  }
}

/**
 * Validate logical active references and the exact budget context named by
 * this allocation. The returned budget is useful to an application command
 * that will then assess totals before writing either relation.
 */
export async function validateActiveTaskAllocationReferences(
  relation: Relation,
  resource: Pick<Resource, 'id' | 'unit' | 'capacity'>,
  lookup: ActiveTaskAllocationReferenceLookup,
): Promise<Relation> {
  validateTaskAllocationRelation(relation, resource);
  const metadata = taskAllocationMetadata(relation.metadata);
  if (!(await lookup.isTaskActive(relation.sourceId))) throw new TaskAllocationReferenceNotFoundError('task', relation.sourceId);
  if (!(await lookup.isProjectActive(metadata.fundingProjectId))) throw new TaskAllocationReferenceNotFoundError('project', metadata.fundingProjectId);
  if (!(await lookup.isResourceActive(relation.targetId))) throw new TaskAllocationReferenceNotFoundError('resource', relation.targetId);
  if (!(await lookup.hasActiveTaskProjectMembership(relation.sourceId, metadata.fundingProjectId))) {
    throw new TaskAllocationReferenceNotFoundError('membership', `${relation.sourceId}/${metadata.fundingProjectId}`);
  }
  const budget = await lookup.findActiveProjectBudget(metadata.fundingProjectId, relation.targetId, metadata.projectContext);
  if (budget === null) throw new TaskAllocationReferenceNotFoundError('budget', `${metadata.fundingProjectId}/${relation.targetId}/${metadata.projectContext}`);
  validateProjectBudgetRelation(budget, resource);
  const budgetMetadata = projectBudgetMetadata(budget.metadata);
  if (budget.endedAt !== null || budget.sourceId !== metadata.fundingProjectId || budget.targetId !== relation.targetId || budgetMetadata.projectContext !== metadata.projectContext) {
    throw new TaskAllocationReferenceNotFoundError('budget', `${metadata.fundingProjectId}/${relation.targetId}/${metadata.projectContext}`);
  }
  return budget;
}

export type TaskAllocationBudgetAssessment =
  | { status: 'below_budget'; policy: TaskAllocationOverAllocationPolicy; total: Quantity; budget: Quantity }
  | { status: 'at_budget'; policy: TaskAllocationOverAllocationPolicy; total: Quantity; budget: Quantity }
  | { status: 'over_budget'; policy: TaskAllocationOverAllocationPolicy; total: Quantity; budget: Quantity };

/**
 * Assess a proposed allocation plus all currently active allocations in the
 * same explicitly named funding context. Callers pass existing rows only;
 * this function does not write or mutate anything.
 */
export function assessTaskAllocationBudget(
  proposed: Relation,
  activeAllocations: readonly Relation[],
  budget: Relation,
  resource: Pick<Resource, 'id' | 'unit' | 'capacity'>,
): TaskAllocationBudgetAssessment {
  validateTaskAllocationRelation(proposed, resource);
  validateProjectBudgetRelation(budget, resource);
  const metadata = taskAllocationMetadata(proposed.metadata);
  const budgetMetadata = projectBudgetMetadata(budget.metadata);
  if (budget.endedAt !== null || budget.sourceId !== metadata.fundingProjectId || budget.targetId !== proposed.targetId || budgetMetadata.projectContext !== metadata.projectContext) {
    throw new Error('Task allocation must assess against its explicitly named active compatible Project budget');
  }
  let total = taskAllocationQuantity(proposed);
  for (const allocation of activeAllocations) {
    if (allocation.endedAt !== null) continue;
    validateTaskAllocationRelation(allocation, resource);
    const allocationMetadata = taskAllocationMetadata(allocation.metadata);
    if (allocationMetadata.fundingProjectId === metadata.fundingProjectId && allocation.targetId === proposed.targetId && allocationMetadata.projectContext === metadata.projectContext) {
      total = total.add(taskAllocationQuantity(allocation));
    }
  }
  const budgetQuantity = Quantity.of(budgetMetadata.amount, budgetMetadata.unit);
  const comparison = total.compare(budgetQuantity);
  const assessment: TaskAllocationBudgetAssessment = comparison < 0
    ? { status: 'below_budget', policy: metadata.overallocationPolicy, total, budget: budgetQuantity }
    : comparison === 0
      ? { status: 'at_budget', policy: metadata.overallocationPolicy, total, budget: budgetQuantity }
      : { status: 'over_budget', policy: metadata.overallocationPolicy, total, budget: budgetQuantity };
  if (assessment.status === 'over_budget' && assessment.policy === 'reject') {
    throw new TaskAllocationOverBudgetError(total, budgetQuantity);
  }
  return assessment;
}
