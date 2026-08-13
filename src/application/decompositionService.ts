import {
  DECOMPOSITION_RELATION_TYPE,
  decompositionMetadata,
  readDecompositionMetadata,
  requireDecompositionWorkflowGuidance,
  validateProjectScopedDecomposition,
} from '../domain/decompositionPolicy';
import type {
  DecompositionEndpointType,
  DecompositionWorkflowGuidanceQuery,
  DecompositionWorkflowGuidanceResolver,
  ResolvedDecompositionWorkflowGuidance,
} from '../domain/decompositionPolicy';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { createRelation, endRelation } from '../domain/relation';
import type { Relation } from '../domain/relation';
import type { GoalRepository } from '../persistence/goalRepository';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { TaskRepository } from '../persistence/taskRepository';
import type { Clock, IdGenerator } from './recordService';
import { systemClock, uuidGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/** A graph was malformed or too large to validate safely; mutations fail closed. */
export class DecompositionGraphIntegrityError extends Error {
  constructor(reason: string) {
    super(`Decomposition hierarchy integrity cannot be established: ${reason}`);
    this.name = 'DecompositionGraphIntegrityError';
  }
}

/** The proposed active edge would make an endpoint its own ancestor. */
export class DecompositionCycleError extends Error {
  constructor(readonly parentType: DecompositionEndpointType, readonly parentId: EntityId, readonly childType: DecompositionEndpointType, readonly childId: EntityId) {
    super(`Decomposition ${parentType} ${parentId} -> ${childType} ${childId} would create a cycle`);
    this.name = 'DecompositionCycleError';
  }
}

export class DuplicateActiveDecompositionError extends Error {
  constructor(readonly existing: Relation) {
    super(`Active decomposition ${existing.id} already connects these endpoints in this Project`);
    this.name = 'DuplicateActiveDecompositionError';
  }
}

export class DecompositionNotFoundError extends Error {
  constructor(id: EntityId) { super(`Decomposition ${id} not found`); this.name = 'DecompositionNotFoundError'; }
}

export interface DecompositionMutationNotice {
  kind: 'created' | 'ended';
  relation: Relation;
  projectId: EntityId;
  actor: string;
  occurredAt: IsoTimestamp;
  workflow: ResolvedDecompositionWorkflowGuidance | null;
}

/** Required atomic audit seam. Ends retain the workflow context selected at creation. */
export interface DecompositionProvenancePort<TContext> {
  append(context: TContext, notice: DecompositionMutationNotice): Promise<void>;
}

export interface CreateDecompositionCommand {
  projectId: EntityId;
  parentType: DecompositionEndpointType;
  parentId: EntityId;
  childType: DecompositionEndpointType;
  childId: EntityId;
  /** Workflow applicability label used to guide this decomposition. */
  managementLabelId: EntityId;
  purpose?: string;
  workflowVersion?: number;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface EndDecompositionCommand {
  relationId: EntityId;
  actor: string;
  endedAt?: IsoTimestamp;
}

export interface DecompositionMutationResult {
  relation: Relation;
  workflow: ResolvedDecompositionWorkflowGuidance;
}

export interface DecompositionServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  projects: (context: TContext) => ProjectRepository;
  goals: (context: TContext) => GoalRepository;
  tasks: (context: TContext) => TaskRepository;
  relations: (context: TContext) => RelationRepository;
  workflowGuidance: DecompositionWorkflowGuidanceResolver;
  provenance: DecompositionProvenancePort<TContext>;
  /** Limits protect preflight from corrupt legacy graph data. */
  traversal?: { maxDepth?: number; maxNodes?: number };
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Owns Project-scoped hierarchy mutations.  All create checks are repeated
 * inside one write unit of work; SQLite's BEGIN IMMEDIATE implementation
 * serializes competing graph writes, preventing opposite-edge races.
 */
export class DecompositionService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly maxDepth: number;
  private readonly maxNodes: number;

  constructor(private readonly ports: DecompositionServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.maxDepth = ports.traversal?.maxDepth ?? 100;
    this.maxNodes = ports.traversal?.maxNodes ?? 1_000;
    if (!Number.isInteger(this.maxDepth) || this.maxDepth < 1 || !Number.isInteger(this.maxNodes) || this.maxNodes < 1) {
      throw new Error('Decomposition traversal bounds must be positive integers');
    }
  }

  async create(command: CreateDecompositionCommand): Promise<DecompositionMutationResult> {
    requireActor(command.actor);
    const occurredAt = command.occurredAt ?? this.clock.now();
    const guidanceQuery = toGuidanceQuery(command);
    // Resolve before opening the write lock for a quick failure, then resolve
    // again in the UoW because applicability can change between the checks.
    await requireDecompositionWorkflowGuidance(guidanceQuery, this.ports.workflowGuidance);
    return this.ports.unitOfWork.run(async (context) => {
      const guidance = await requireDecompositionWorkflowGuidance(guidanceQuery, this.ports.workflowGuidance);
      const relations = this.ports.relations(context);
      const lookup = this.lookup(context, relations);
      // Validate endpoints/context before walking. Parent-cardinality is
      // deliberately checked after traversal so corrupt stored graph data is
      // surfaced as integrity failure rather than hidden by a local rule.
      await validateProjectScopedDecomposition({
        relationType: DECOMPOSITION_RELATION_TYPE,
        parentType: command.parentType, parentId: command.parentId,
        childType: command.childType, childId: command.childId,
        metadata: decompositionMetadata(command.projectId),
      }, { ...lookup, hasActiveDecompositionParent: async () => false });
      await this.assertNoCycle(relations, command.projectId, command.parentType, command.parentId, command.childType, command.childId);
      if (await lookup.hasActiveDecompositionParent(command.projectId, command.childType, command.childId)) {
        // Calling the canonical validator keeps this failure's public domain
        // error and complete message centralized in the policy module.
        await validateProjectScopedDecomposition({
          relationType: DECOMPOSITION_RELATION_TYPE,
          parentType: command.parentType, parentId: command.parentId,
          childType: command.childType, childId: command.childId,
          metadata: decompositionMetadata(command.projectId),
        }, lookup);
      }
      const existing = await relations.findActiveByIdentity(command.parentType, command.parentId, DECOMPOSITION_RELATION_TYPE, command.childType, command.childId);
      if (existing !== null && isInProject(existing, command.projectId)) throw new DuplicateActiveDecompositionError(existing);
      const relation = createRelation({
        sourceType: command.parentType, sourceId: command.parentId,
        relationType: DECOMPOSITION_RELATION_TYPE,
        targetType: command.childType, targetId: command.childId,
        metadata: decompositionMetadata(command.projectId),
      }, { id: this.ids.newId(), now: occurredAt });
      await relations.add(relation);
      await this.ports.provenance.append(context, { kind: 'created', relation, projectId: command.projectId, actor: command.actor, occurredAt, workflow: guidance });
      return { relation, workflow: guidance };
    });
  }

  /** Repeated endings are idempotent and intentionally produce no new audit fact. */
  async end(command: EndDecompositionCommand): Promise<Relation> {
    requireActor(command.actor);
    return this.ports.unitOfWork.run(async (context) => {
      const relations = this.ports.relations(context);
      const current = await relations.getById(command.relationId);
      if (!isDecomposition(current)) throw new DecompositionNotFoundError(command.relationId);
      if (current.endedAt !== null) return current;
      const endedAt = command.endedAt ?? this.clock.now();
      const ended = endRelation(current, endedAt);
      await relations.save(ended);
      await this.ports.provenance.append(context, {
        kind: 'ended', relation: ended, projectId: readDecompositionMetadata(ended.metadata).project_id,
        actor: command.actor, occurredAt: endedAt, workflow: null,
      });
      return ended;
    });
  }

  private lookup(context: TContext, relations: RelationRepository) {
    return {
      getProject: async (id: EntityId) => this.ports.projects(context).getById(id),
      getGoal: async (id: EntityId) => this.ports.goals(context).getById(id),
      getTask: async (id: EntityId) => this.ports.tasks(context).getById(id),
      hasActiveGoalPursuit: async (projectId: EntityId, goalId: EntityId) =>
        (await relations.listCurrent({ source: { type: 'project', id: projectId }, target: { type: 'goal', id: goalId }, relationType: 'contributes_to', limit: 1 })).length > 0,
      hasActiveTaskProjectMembership: async (projectId: EntityId, taskId: EntityId) =>
        (await relations.listCurrent({ source: { type: 'task', id: taskId }, target: { type: 'project', id: projectId }, relationType: 'belongs_to', limit: 1 })).length > 0,
      hasActiveDecompositionParent: async (projectId: EntityId, childType: DecompositionEndpointType, childId: EntityId) =>
        (await relations.listCurrent({ target: { type: childType, id: childId }, relationType: DECOMPOSITION_RELATION_TYPE }))
          .some((relation) => isInProject(relation, projectId)),
    };
  }

  /** DFS from proposed child to proposed parent over only active same-Project edges. */
  private async assertNoCycle(relations: RelationRepository, projectId: EntityId, parentType: DecompositionEndpointType, parentId: EntityId, childType: DecompositionEndpointType, childId: EntityId): Promise<void> {
    type Endpoint = { type: DecompositionEndpointType; id: EntityId };
    const key = (endpoint: Endpoint) => `${endpoint.type}:${endpoint.id}`;
    const parent = { type: parentType, id: parentId };
    const activePath = new Set<string>();
    const visited = new Set<string>();
    let nodes = 0;
    const visit = async (current: Endpoint, depth: number): Promise<void> => {
      if (depth > this.maxDepth) throw new DecompositionGraphIntegrityError(`depth exceeds configured maximum ${this.maxDepth}`);
      const currentKey = key(current);
      if (currentKey === key(parent)) throw new DecompositionCycleError(parentType, parentId, childType, childId);
      if (activePath.has(currentKey)) throw new DecompositionGraphIntegrityError('existing active cycle detected');
      if (visited.has(currentKey)) return;
      if (++nodes > this.maxNodes) throw new DecompositionGraphIntegrityError(`node count exceeds configured maximum ${this.maxNodes}`);
      visited.add(currentKey); activePath.add(currentKey);
      const outgoing = await relations.listCurrent({ source: current, relationType: DECOMPOSITION_RELATION_TYPE });
      for (const edge of outgoing) {
        if (isInProject(edge, projectId)) await visit({ type: edge.targetType as DecompositionEndpointType, id: edge.targetId }, depth + 1);
      }
      activePath.delete(currentKey);
    };
    await visit({ type: childType, id: childId }, 0);
  }
}

function toGuidanceQuery(command: CreateDecompositionCommand): DecompositionWorkflowGuidanceQuery {
  return { projectId: command.projectId, purpose: command.purpose ?? 'decompose', parentType: command.parentType, childType: command.childType, managementLabelId: command.managementLabelId, version: command.workflowVersion };
}
function isDecomposition(relation: Relation | null): relation is Relation {
  return relation !== null && relation.relationType === DECOMPOSITION_RELATION_TYPE &&
    relation.sourceType !== 'project' && relation.sourceType !== 'workflow' &&
    relation.targetType !== 'project' && relation.targetType !== 'workflow';
}
function isInProject(relation: Relation, projectId: EntityId): boolean {
  try { return readDecompositionMetadata(relation.metadata).project_id === projectId; } catch { return false; }
}
function requireActor(actor: string): void {
  if (actor.trim().length === 0) throw new Error('Decomposition actor must not be blank');
}
