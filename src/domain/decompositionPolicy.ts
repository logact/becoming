import type { CoreEntityType } from './entityTypes';
import type { EntityId } from './ids';
import type { JsonValue } from './json';
import type { RelationPolicy } from './relationPolicy';

/**
 * The one canonical directed relation used to express managed work
 * decomposition.  Its project context belongs to relation metadata, never to
 * an intrinsic Goal or Task column.
 */
export const DECOMPOSITION_RELATION_TYPE = 'decomposes' as const;

export const DECOMPOSITION_METADATA_SCHEMA_VERSION = 1;

export const DECOMPOSITION_ENDPOINT_TYPES = ['goal', 'task'] as const;
export type DecompositionEndpointType = (typeof DECOMPOSITION_ENDPOINT_TYPES)[number];

/** Versioned relation-owned context for a decomposition edge. */
export interface DecompositionMetadataV1 {
  [key: string]: JsonValue;
  schema_version: 1;
  project_id: EntityId;
}

/**
 * The complete hierarchy direction matrix.  In particular, Tasks cannot
 * contain Goals and a Goal/Task relation cannot be reversed.
 */
export const DECOMPOSITION_ENDPOINT_MATRIX: Readonly<Record<DecompositionEndpointType, readonly DecompositionEndpointType[]>> =
  Object.freeze({
    goal: Object.freeze(['goal', 'task'] as DecompositionEndpointType[]),
    task: Object.freeze(['task'] as DecompositionEndpointType[]),
  });

export function isDecompositionEndpointType(value: string): value is DecompositionEndpointType {
  return (DECOMPOSITION_ENDPOINT_TYPES as readonly string[]).includes(value);
}

export function allowsDecompositionDirection(
  parentType: CoreEntityType,
  childType: CoreEntityType,
): boolean {
  return isDecompositionEndpointType(parentType)
    && isDecompositionEndpointType(childType)
    && DECOMPOSITION_ENDPOINT_MATRIX[parentType].includes(childType);
}

/** Raised when relation-owned decomposition context is malformed. */
export class DecompositionMetadataPolicyError extends Error {
  constructor(reason: string) {
    super(`Decomposition metadata rejected: ${reason}`);
    this.name = 'DecompositionMetadataPolicyError';
  }
}

/** Construct the only metadata shape accepted for a decomposition relation. */
export function decompositionMetadata(projectId: EntityId): DecompositionMetadataV1 {
  if (projectId.trim().length === 0) {
    throw new DecompositionMetadataPolicyError('project_id must be a non-blank string');
  }
  return { schema_version: DECOMPOSITION_METADATA_SCHEMA_VERSION, project_id: projectId };
}

/** Validate and read the versioned Project context carried by a Relation. */
export function readDecompositionMetadata(metadata: JsonValue | null): DecompositionMetadataV1 {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new DecompositionMetadataPolicyError('metadata must be an object');
  }
  const value = metadata as Record<string, unknown>;
  const fields = Object.keys(value);
  if (fields.some((field) => field !== 'schema_version' && field !== 'project_id')) {
    throw new DecompositionMetadataPolicyError('metadata contains unsupported fields');
  }
  if (value.schema_version !== DECOMPOSITION_METADATA_SCHEMA_VERSION) {
    throw new DecompositionMetadataPolicyError(
      `schema_version must be ${DECOMPOSITION_METADATA_SCHEMA_VERSION}`,
    );
  }
  return decompositionMetadata(value.project_id as EntityId);
}

/** Policy suitable for the general Relation service's direction/metadata hook. */
export const DECOMPOSITION_RELATION_POLICY: RelationPolicy = Object.freeze({
  relationType: DECOMPOSITION_RELATION_TYPE,
  allowsMultipleActive: false,
  allowsDirection: allowsDecompositionDirection,
  validateMetadata: (metadata) => { readDecompositionMetadata(metadata); },
});

/** A prospective hierarchy edge; creating or ending Relations is out of scope. */
export interface ProjectScopedDecomposition {
  relationType: string;
  parentType: DecompositionEndpointType;
  parentId: EntityId;
  childType: DecompositionEndpointType;
  childId: EntityId;
  metadata: JsonValue | null;
}

/** Minimal active/archive state needed for logical reference validation. */
export interface DecompositionReference {
  id: EntityId;
  archivedAt: string | null;
}

/**
 * Logical reference boundary for a planned decomposition mutation.  Projects,
 * Goals, and Tasks stay in separate aggregate stores; context is proven by
 * the active Project->Goal pursuit and Task->Project membership relations.
 */
export interface ProjectScopedDecompositionLookup {
  getProject(id: EntityId): Promise<DecompositionReference | null>;
  getGoal(id: EntityId): Promise<DecompositionReference | null>;
  getTask(id: EntityId): Promise<DecompositionReference | null>;
  hasActiveGoalPursuit(projectId: EntityId, goalId: EntityId): Promise<boolean>;
  hasActiveTaskProjectMembership(projectId: EntityId, taskId: EntityId): Promise<boolean>;
  /** A child has at most one active direct parent within one Project context. */
  hasActiveDecompositionParent(
    projectId: EntityId,
    childType: DecompositionEndpointType,
    childId: EntityId,
  ): Promise<boolean>;
}

export class DecompositionRelationTypeError extends Error {
  constructor(value: string) { super(`Expected decomposition relation type ${DECOMPOSITION_RELATION_TYPE}, got ${value}`); this.name = 'DecompositionRelationTypeError'; }
}
export class DecompositionDirectionError extends Error {
  constructor(parentType: CoreEntityType, childType: CoreEntityType) { super(`Decomposition direction ${parentType} -> ${childType} is not permitted`); this.name = 'DecompositionDirectionError'; }
}
export class DecompositionProjectNotFoundError extends Error {
  constructor(id: EntityId) { super(`Project ${id} was not found for decomposition`); this.name = 'DecompositionProjectNotFoundError'; }
}
export class DecompositionProjectArchivedError extends Error {
  constructor(id: EntityId) { super(`Project ${id} is archived and cannot decompose work`); this.name = 'DecompositionProjectArchivedError'; }
}
export class DecompositionEndpointNotFoundError extends Error {
  constructor(readonly role: 'parent' | 'child', readonly entityType: DecompositionEndpointType, readonly id: EntityId) { super(`Decomposition ${role} ${entityType} ${id} was not found`); this.name = 'DecompositionEndpointNotFoundError'; }
}
export class DecompositionEndpointArchivedError extends Error {
  constructor(readonly role: 'parent' | 'child', readonly entityType: DecompositionEndpointType, readonly id: EntityId) { super(`Decomposition ${role} ${entityType} ${id} is archived`); this.name = 'DecompositionEndpointArchivedError'; }
}
export class DecompositionSelfLinkError extends Error {
  constructor(entityType: DecompositionEndpointType, id: EntityId) { super(`A ${entityType} cannot decompose itself (${id})`); this.name = 'DecompositionSelfLinkError'; }
}
export class DecompositionProjectContextError extends Error {
  constructor(readonly role: 'parent' | 'child', readonly entityType: DecompositionEndpointType, readonly id: EntityId, readonly projectId: EntityId) { super(`Decomposition ${role} ${entityType} ${id} has no active context in Project ${projectId}`); this.name = 'DecompositionProjectContextError'; }
}
export class DecompositionParentCardinalityError extends Error {
  constructor(projectId: EntityId, childType: DecompositionEndpointType, childId: EntityId) { super(`Decomposition child ${childType} ${childId} already has an active parent in Project ${projectId}`); this.name = 'DecompositionParentCardinalityError'; }
}

/**
 * Validate all non-graph logical rules before a caller creates an edge.  This
 * deliberately does not inspect traversal/cycles or persist a Relation.
 */
export async function validateProjectScopedDecomposition(
  proposal: ProjectScopedDecomposition,
  lookup: ProjectScopedDecompositionLookup,
): Promise<DecompositionMetadataV1> {
  if (proposal.relationType !== DECOMPOSITION_RELATION_TYPE) {
    throw new DecompositionRelationTypeError(proposal.relationType);
  }
  const context = readDecompositionMetadata(proposal.metadata);
  if (!allowsDecompositionDirection(proposal.parentType, proposal.childType)) {
    throw new DecompositionDirectionError(proposal.parentType, proposal.childType);
  }
  if (proposal.parentType === proposal.childType && proposal.parentId === proposal.childId) {
    throw new DecompositionSelfLinkError(proposal.parentType, proposal.parentId);
  }
  const project = await lookup.getProject(context.project_id);
  if (project === null) throw new DecompositionProjectNotFoundError(context.project_id);
  if (project.archivedAt !== null) throw new DecompositionProjectArchivedError(context.project_id);
  await requireActiveEndpoint('parent', proposal.parentType, proposal.parentId, context.project_id, lookup);
  await requireActiveEndpoint('child', proposal.childType, proposal.childId, context.project_id, lookup);
  if (await lookup.hasActiveDecompositionParent(context.project_id, proposal.childType, proposal.childId)) {
    throw new DecompositionParentCardinalityError(context.project_id, proposal.childType, proposal.childId);
  }
  return context;
}

async function requireActiveEndpoint(
  role: 'parent' | 'child',
  entityType: DecompositionEndpointType,
  id: EntityId,
  projectId: EntityId,
  lookup: ProjectScopedDecompositionLookup,
): Promise<void> {
  const endpoint = entityType === 'goal' ? await lookup.getGoal(id) : await lookup.getTask(id);
  if (endpoint === null) throw new DecompositionEndpointNotFoundError(role, entityType, id);
  if (endpoint.archivedAt !== null) throw new DecompositionEndpointArchivedError(role, entityType, id);
  const hasContext = entityType === 'goal'
    ? await lookup.hasActiveGoalPursuit(projectId, id)
    : await lookup.hasActiveTaskProjectMembership(projectId, id);
  if (!hasContext) throw new DecompositionProjectContextError(role, entityType, id, projectId);
}

/** The operation context used to select applicable workflow guidance. */
export interface DecompositionWorkflowGuidanceQuery {
  projectId: EntityId;
  purpose: string;
  parentType: DecompositionEndpointType;
  childType: DecompositionEndpointType;
  managementLabelId: EntityId;
  version?: number;
}

export interface ResolvedDecompositionWorkflowGuidance {
  status: 'resolved';
  /** Returned for immediate use only; it is never stored on Goal or Task. */
  workflowId: EntityId;
  version: number;
}
export type DecompositionWorkflowGuidanceResolution =
  | ResolvedDecompositionWorkflowGuidance
  | { status: 'missing' }
  | { status: 'archived' }
  | { status: 'ambiguous' }
  | { status: 'incompatible'; reason: string };

/** Framework-neutral workflow discovery boundary; it owns no persistence details. */
export interface DecompositionWorkflowGuidanceResolver {
  resolve(query: DecompositionWorkflowGuidanceQuery): Promise<DecompositionWorkflowGuidanceResolution>;
}

export class DecompositionWorkflowGuidanceMissingError extends Error {
  constructor() { super('No decomposition workflow guidance applies'); this.name = 'DecompositionWorkflowGuidanceMissingError'; }
}
export class DecompositionWorkflowGuidanceArchivedError extends Error {
  constructor() { super('Applicable decomposition workflow guidance is archived'); this.name = 'DecompositionWorkflowGuidanceArchivedError'; }
}
export class DecompositionWorkflowGuidanceAmbiguousError extends Error {
  constructor() { super('Several decomposition workflow guidance definitions apply'); this.name = 'DecompositionWorkflowGuidanceAmbiguousError'; }
}
export class DecompositionWorkflowGuidanceIncompatibleError extends Error {
  constructor(reason: string) { super(`Decomposition workflow guidance is incompatible: ${reason}`); this.name = 'DecompositionWorkflowGuidanceIncompatibleError'; }
}

/** Resolve guidance and surface non-selection outcomes as distinct domain errors. */
export async function requireDecompositionWorkflowGuidance(
  query: DecompositionWorkflowGuidanceQuery,
  resolver: DecompositionWorkflowGuidanceResolver,
): Promise<ResolvedDecompositionWorkflowGuidance> {
  validateGuidanceQuery(query);
  const result = await resolver.resolve(query);
  switch (result.status) {
    case 'resolved':
      if (result.workflowId.trim().length === 0 || !Number.isInteger(result.version) || result.version < 1 ||
          (query.version !== undefined && result.version !== query.version)) {
        throw new DecompositionWorkflowGuidanceIncompatibleError('resolver returned an invalid or different workflow version');
      }
      return result;
    case 'missing': throw new DecompositionWorkflowGuidanceMissingError();
    case 'archived': throw new DecompositionWorkflowGuidanceArchivedError();
    case 'ambiguous': throw new DecompositionWorkflowGuidanceAmbiguousError();
    case 'incompatible': throw new DecompositionWorkflowGuidanceIncompatibleError(result.reason);
  }
}

function validateGuidanceQuery(query: DecompositionWorkflowGuidanceQuery): void {
  if (query.projectId.trim().length === 0) throw new Error('Decomposition workflow guidance projectId must not be blank');
  if (query.purpose.trim().length === 0) throw new Error('Decomposition workflow guidance purpose must not be blank');
  if (query.managementLabelId.trim().length === 0) throw new Error('Decomposition workflow guidance managementLabelId must not be blank');
  if (!allowsDecompositionDirection(query.parentType, query.childType)) {
    throw new DecompositionDirectionError(query.parentType, query.childType);
  }
  if (query.version !== undefined && (!Number.isInteger(query.version) || query.version < 1)) {
    throw new Error('Decomposition workflow guidance version must be a positive integer');
  }
}
