import { Decimal } from './decimal';
import type { EntityId, IsoTimestamp } from './ids';
import type { JsonValue } from './json';
import { Quantity } from './quantity';
import { createRelation } from './relation';
import type { Relation, RelationFactoryDeps } from './relation';
import type { Resource } from './resource';

/**
 * The semantic relation used to fund a Project from a Resource.  A budget is
 * deliberately not an account, balance, allocation, or usage record: it is
 * a temporal statement of intended funding only.
 */
export const PROJECT_BUDGET_RELATION_TYPE = 'budgeted_by';

/** Metadata schema version for project-budget relations. */
export const PROJECT_BUDGET_METADATA_VERSION = 1;

/** What to do when an individual proposed budget exceeds known capacity. */
export type ProjectBudgetCapacityPolicy = 'reject' | 'surface';

/**
 * JSON-safe metadata persisted on a `project -> budgeted_by -> resource`
 * relation. `projectContext` is part of the active-budget identity so a
 * Project may hold independent budgets for the same Resource when explicitly
 * scoped (for example, `operating` and `contingency`).
 */
export interface ProjectBudgetMetadata {
  metadataVersion: typeof PROJECT_BUDGET_METADATA_VERSION;
  amount: string;
  unit: string;
  projectContext: string;
  capacityPolicy: ProjectBudgetCapacityPolicy;
  /** Optional business-effective interval; timestamps are half-open. */
  effectiveFrom?: IsoTimestamp;
  effectiveUntil?: IsoTimestamp;
  /** Optional JSON-safe explanation of the funding policy in effect. */
  policyContext?: JsonValue;
}

/** Input used to build the canonical Relation and its metadata. */
export interface NewProjectBudgetRelation {
  projectId: EntityId;
  resourceId: EntityId;
  amount: Decimal | string;
  unit: string;
  projectContext: string;
  capacityPolicy: ProjectBudgetCapacityPolicy;
  effectiveFrom?: IsoTimestamp;
  effectiveUntil?: IsoTimestamp;
  policyContext?: JsonValue;
}

/** A deliberately small logical-reference port; no database foreign keys. */
export interface ActiveProjectBudgetReferenceLookup {
  isProjectActive(id: EntityId): Promise<boolean>;
  isResourceActive(id: EntityId): Promise<boolean>;
}

export class ProjectBudgetReferenceNotFoundError extends Error {
  constructor(kind: 'project' | 'resource', id: EntityId) {
    super(`Active Project budget ${kind} ${id} not found`);
    this.name = 'ProjectBudgetReferenceNotFoundError';
  }
}

export class ProjectBudgetCapacityExceededError extends Error {
  constructor(amount: Quantity, capacity: Quantity) {
    super(
      `Project budget ${amount.toString()} exceeds Resource capacity ${capacity.toString()}`,
    );
    this.name = 'ProjectBudgetCapacityExceededError';
  }
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Project budget ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `Project budget ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requirePolicy(value: string): ProjectBudgetCapacityPolicy {
  if (value !== 'reject' && value !== 'surface') {
    throw new Error(
      `Project budget capacityPolicy must be "reject" or "surface", got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function canonicalQuantity(amount: Decimal | string, unit: string): Quantity {
  const quantity = Quantity.of(amount, requireNonBlank('unit', unit));
  if (quantity.amount.compare(Decimal.zero()) <= 0) {
    throw new Error('Project budget amount must be strictly positive');
  }
  return Quantity.of(quantity.amount.toString(), quantity.unit);
}

/** Parse and validate the canonical metadata shape on a budget Relation. */
export function projectBudgetMetadata(
  metadata: Relation['metadata'],
): ProjectBudgetMetadata {
  if (metadata === null || Array.isArray(metadata) || typeof metadata !== 'object') {
    throw new Error('Project budget metadata must be an object');
  }
  const candidate = metadata as Record<string, JsonValue>;
  if (candidate.metadataVersion !== PROJECT_BUDGET_METADATA_VERSION) {
    throw new Error(
      `Unsupported Project budget metadataVersion ${JSON.stringify(candidate.metadataVersion)}`,
    );
  }
  if (typeof candidate.amount !== 'string' || typeof candidate.unit !== 'string') {
    throw new Error('Project budget metadata requires string amount and unit');
  }
  const quantity = canonicalQuantity(candidate.amount, candidate.unit);
  if (typeof candidate.projectContext !== 'string') {
    throw new Error('Project budget metadata requires projectContext');
  }
  const projectContext = requireNonBlank('projectContext', candidate.projectContext);
  if (typeof candidate.capacityPolicy !== 'string') {
    throw new Error('Project budget metadata requires capacityPolicy');
  }
  const capacityPolicy = requirePolicy(candidate.capacityPolicy);
  const rawEffectiveFrom = candidate.effectiveFrom;
  const rawEffectiveUntil = candidate.effectiveUntil;
  if (rawEffectiveFrom !== undefined && typeof rawEffectiveFrom !== 'string') {
    throw new Error('Project budget effectiveFrom must be an ISO timestamp');
  }
  if (rawEffectiveUntil !== undefined && typeof rawEffectiveUntil !== 'string') {
    throw new Error('Project budget effectiveUntil must be an ISO timestamp');
  }
  const effectiveFrom = rawEffectiveFrom as string | undefined;
  const effectiveUntil = rawEffectiveUntil as string | undefined;
  if (effectiveFrom !== undefined) requireTimestamp('effectiveFrom', effectiveFrom);
  if (effectiveUntil !== undefined) requireTimestamp('effectiveUntil', effectiveUntil);
  if (
    effectiveFrom !== undefined &&
    effectiveUntil !== undefined &&
    Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)
  ) {
    throw new Error('Project budget effective interval must not be zero-length or reversed');
  }
  return {
    metadataVersion: PROJECT_BUDGET_METADATA_VERSION,
    amount: quantity.amount.toString(),
    unit: quantity.unit,
    projectContext,
    capacityPolicy,
    ...(effectiveFrom === undefined ? {} : { effectiveFrom }),
    ...(effectiveUntil === undefined ? {} : { effectiveUntil }),
    ...(candidate.policyContext === undefined
      ? {}
      : { policyContext: candidate.policyContext }),
  };
}

/** Return the exact positive quantity carried by a validated budget relation. */
export function projectBudgetQuantity(relation: Relation): Quantity {
  const metadata = projectBudgetMetadata(relation.metadata);
  return Quantity.of(metadata.amount, metadata.unit);
}

/**
 * Create a Project-to-Resource budget relation with canonical JSON metadata.
 * Resource compatibility and logical-reference validation require their own
 * inputs/ports and are intentionally not hidden in this pure factory.
 */
export function createProjectBudgetRelation(
  input: NewProjectBudgetRelation,
  deps: RelationFactoryDeps = {},
): Relation {
  const quantity = canonicalQuantity(input.amount, input.unit);
  const metadata: ProjectBudgetMetadata = {
    metadataVersion: PROJECT_BUDGET_METADATA_VERSION,
    amount: quantity.amount.toString(),
    unit: quantity.unit,
    projectContext: requireNonBlank('projectContext', input.projectContext),
    capacityPolicy: requirePolicy(input.capacityPolicy),
    ...(input.effectiveFrom === undefined
      ? {}
      : { effectiveFrom: requireTimestamp('effectiveFrom', input.effectiveFrom) }),
    ...(input.effectiveUntil === undefined
      ? {}
      : { effectiveUntil: requireTimestamp('effectiveUntil', input.effectiveUntil) }),
    ...(input.policyContext === undefined
      ? {}
      : { policyContext: input.policyContext }),
  };
  // Check the interval before delegating to Relation's JSON validation.
  projectBudgetMetadata(metadata as unknown as JsonValue);
  return createRelation(
    {
      sourceType: 'project',
      sourceId: input.projectId,
      relationType: PROJECT_BUDGET_RELATION_TYPE,
      targetType: 'resource',
      targetId: input.resourceId,
      metadata: metadata as unknown as JsonValue,
    },
    deps,
  );
}

/** Validate direction, metadata, interval containment, and Resource unit. */
export function validateProjectBudgetRelation(
  relation: Relation,
  resource: Pick<Resource, 'id' | 'unit' | 'capacity'>,
): void {
  if (
    relation.sourceType !== 'project' ||
    relation.targetType !== 'resource' ||
    relation.relationType !== PROJECT_BUDGET_RELATION_TYPE
  ) {
    throw new Error('Project budget must be project -> budgeted_by -> resource');
  }
  if (relation.targetId !== resource.id) {
    throw new Error('Project budget target Resource must match the supplied Resource');
  }
  const metadata = projectBudgetMetadata(relation.metadata);
  const quantity = Quantity.of(metadata.amount, metadata.unit);
  if (resource.unit === null || resource.unit !== quantity.unit) {
    throw new Error(
      `Project budget unit ${JSON.stringify(quantity.unit)} is incompatible with Resource unit ${JSON.stringify(resource.unit)}`,
    );
  }
  const start = metadata.effectiveFrom ?? relation.createdAt;
  const requestedEnd = metadata.effectiveUntil;
  if (Date.parse(start) < Date.parse(relation.createdAt)) {
    throw new Error('Project budget effectiveFrom must not precede relation createdAt');
  }
  if (relation.endedAt !== null) {
    if (Date.parse(relation.endedAt) <= Date.parse(relation.createdAt)) {
      throw new Error('Ended Project budget relation must not be zero-length');
    }
    if (requestedEnd !== undefined && Date.parse(requestedEnd) > Date.parse(relation.endedAt)) {
      throw new Error('Project budget effectiveUntil must not outlive relation endedAt');
    }
  }
}

/** Logical references are checked by a caller over aggregate repositories. */
export async function validateActiveProjectBudgetReferences(
  relation: Relation,
  lookup: ActiveProjectBudgetReferenceLookup,
): Promise<void> {
  if (!(await lookup.isProjectActive(relation.sourceId))) {
    throw new ProjectBudgetReferenceNotFoundError('project', relation.sourceId);
  }
  if (!(await lookup.isResourceActive(relation.targetId))) {
    throw new ProjectBudgetReferenceNotFoundError('resource', relation.targetId);
  }
}

/** Identity that permits one active budget per Project/Resource/context. */
export function projectBudgetActiveIdentity(relation: Relation): string {
  const metadata = projectBudgetMetadata(relation.metadata);
  return `${relation.sourceId}\u0000${relation.targetId}\u0000${metadata.projectContext}`;
}

function interval(relation: Relation): { start: number; end: number | null } {
  const metadata = projectBudgetMetadata(relation.metadata);
  return {
    start: Date.parse(metadata.effectiveFrom ?? relation.createdAt),
    end: metadata.effectiveUntil === undefined
      ? relation.endedAt === null ? null : Date.parse(relation.endedAt)
      : Date.parse(metadata.effectiveUntil),
  };
}

/**
 * Validate the complete history for one budget identity. Intervals are
 * half-open, so a successor beginning exactly when its predecessor ends is
 * valid; two active rows or any overlap is not.
 */
export function validateProjectBudgetHistory(
  relations: readonly Relation[],
  resource: Pick<Resource, 'id' | 'unit' | 'capacity'>,
): void {
  const identity = relations.length === 0 ? null : projectBudgetActiveIdentity(relations[0]);
  if (relations.some((relation) => projectBudgetActiveIdentity(relation) !== identity)) {
    throw new Error('Project budget history must contain one Project/Resource/context identity');
  }
  const sorted = [...relations].sort((left, right) => {
    const a = interval(left).start;
    const b = interval(right).start;
    return a === b ? left.id.localeCompare(right.id) : a - b;
  });
  let priorEnd: number | null = null;
  let activeIdentity: string | null = null;
  for (const relation of sorted) {
    validateProjectBudgetRelation(relation, resource);
    const current = interval(relation);
    if (current.end !== null && current.end <= current.start) {
      throw new Error('Project budget history contains a zero-length or reversed interval');
    }
    if (priorEnd === null && activeIdentity !== null) {
      throw new Error('Project budget history contains more than one active budget');
    }
    if (priorEnd !== null && current.start < priorEnd) {
      throw new Error('Project budget history contains overlapping budget intervals');
    }
    if (current.end === null) activeIdentity = projectBudgetActiveIdentity(relation);
    priorEnd = current.end;
  }
}

export type ProjectBudgetCapacityAssessment =
  | { status: 'within_capacity'; policy: ProjectBudgetCapacityPolicy; amount: Quantity; capacity: Quantity }
  | { status: 'exceeds_capacity'; policy: ProjectBudgetCapacityPolicy; amount: Quantity; capacity: Quantity }
  | { status: 'capacity_unspecified'; policy: ProjectBudgetCapacityPolicy; amount: Quantity };

/** Assess one proposed budget against a Resource's known capacity, if any. */
export function assessProjectBudgetCapacity(
  relation: Relation,
  resource: Pick<Resource, 'id' | 'unit' | 'capacity'>,
): ProjectBudgetCapacityAssessment {
  validateProjectBudgetRelation(relation, resource);
  const metadata = projectBudgetMetadata(relation.metadata);
  const amount = projectBudgetQuantity(relation);
  if (resource.capacity === null) {
    return { status: 'capacity_unspecified', policy: metadata.capacityPolicy, amount };
  }
  const capacity = Quantity.of(resource.capacity, resource.unit!);
  const assessment: ProjectBudgetCapacityAssessment = amount.compare(capacity) > 0
    ? { status: 'exceeds_capacity', policy: metadata.capacityPolicy, amount, capacity }
    : { status: 'within_capacity', policy: metadata.capacityPolicy, amount, capacity };
  if (assessment.status === 'exceeds_capacity' && assessment.policy === 'reject') {
    throw new ProjectBudgetCapacityExceededError(amount, capacity);
  }
  return assessment;
}
