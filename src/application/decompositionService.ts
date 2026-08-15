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
import type { MilestoneGoalAssignmentRepository } from '../persistence/milestoneGoalAssignmentRepository';
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

/** An active Milestone Goal assignment that an edge removal would detach. */
export interface MilestoneOrphanedAssignment {
  assignmentId: EntityId;
  milestoneId: EntityId;
  pursuitRelationId: EntityId;
  goalId: EntityId;
}

/**
 * Ending the edge would move an actively assigned Goal outside its pursuit's
 * hierarchy. Roadmap membership stays explicit: remove or move the Milestone
 * Goal assignment first.
 */
export class DecompositionEndOrphansMilestoneGoalError extends Error {
  constructor(
    readonly relationId: EntityId,
    readonly orphans: readonly MilestoneOrphanedAssignment[],
  ) {
    super(
      `Ending decomposition ${relationId} would detach Goal(s) ${orphans.map((orphan) => orphan.goalId).join(', ')} ` +
      'from their pursued hierarchy; remove or move the Milestone Goal assignment(s) first',
    );
    this.name = 'DecompositionEndOrphansMilestoneGoalError';
  }
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
  /**
   * Optional Roadmap Milestone guard. When present, `end` rejects an edge
   * removal that would detach an actively assigned Goal from its pursuit
   * root; when absent, `end` keeps its pre-Roadmap behavior.
   */
  milestoneAssignments?: (
    context: TContext,
  ) => Pick<MilestoneGoalAssignmentRepository, 'listCurrentForPursuit'>;
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
      await this.assertNoMilestoneOrphans(context, relations, current);
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

  /**
   * Reject an edge removal that would detach an actively assigned Milestone
   * Goal from its pursuit root. Reachability is computed over the active
   * same-Project decomposition graph with and without the ending edge; an
   * assigned Goal reachable only through that edge is orphaned by it. The
   * bounded traversal fails closed on corrupt or oversized graphs.
   */
  private async assertNoMilestoneOrphans(
    context: TContext,
    relations: RelationRepository,
    edge: Relation,
  ): Promise<void> {
    const port = this.ports.milestoneAssignments;
    if (port === undefined) return;
    let projectId: EntityId;
    try {
      projectId = readDecompositionMetadata(edge.metadata).project_id;
    } catch {
      return; // a malformed Project context is the hierarchy read side's finding
    }
    const pursuits = (
      await relations.listCurrent({
        relationType: 'contributes_to',
        source: { type: 'project', id: projectId },
        limit: 100,
      })
    ).filter((relation) => relation.targetType === 'goal');
    if (pursuits.length === 0) return;
    const assignments = port(context);
    const byPursuit: Array<{ rootGoalId: EntityId; assigned: MilestoneOrphanedAssignment[] }> = [];
    for (const pursuit of pursuits) {
      const current = await assignments.listCurrentForPursuit(pursuit.id);
      byPursuit.push({
        rootGoalId: pursuit.targetId,
        assigned: current.map((assignment) => ({
          assignmentId: assignment.id,
          milestoneId: assignment.milestoneId,
          pursuitRelationId: assignment.pursuitRelationId,
          goalId: assignment.goalId,
        })),
      });
    }
    if (byPursuit.every(({ assigned }) => assigned.length === 0)) return;
    const active = await this.listActiveProjectEdges(relations, projectId);
    const remaining = active.filter((relation) => relation.id !== edge.id);
    for (const { rootGoalId, assigned } of byPursuit) {
      if (assigned.length === 0) continue;
      const before = this.reachableFrom(active, rootGoalId);
      const after = this.reachableFrom(remaining, rootGoalId);
      const orphans = assigned.filter(
        (orphan) => before.has(`goal:${orphan.goalId}`) && !after.has(`goal:${orphan.goalId}`),
      );
      if (orphans.length > 0) throw new DecompositionEndOrphansMilestoneGoalError(edge.id, orphans);
    }
  }

  /** Every active same-Project decomposition edge, paged deterministically. */
  private async listActiveProjectEdges(
    relations: RelationRepository,
    projectId: EntityId,
  ): Promise<Relation[]> {
    const edges: Relation[] = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const page = await relations.listCurrent({
        relationType: DECOMPOSITION_RELATION_TYPE,
        limit: pageSize,
        offset,
      });
      edges.push(...page.filter((relation) => isInProject(relation, projectId)));
      if (page.length < pageSize) return edges;
    }
  }

  /** Bounded BFS over active edges from the pursuit root; fails closed. */
  private reachableFrom(edges: readonly Relation[], rootGoalId: EntityId): Set<string> {
    const children = new Map<string, Array<{ type: string; id: EntityId }>>();
    for (const edge of edges) {
      const key = `${edge.sourceType}:${edge.sourceId}`;
      const entries = children.get(key) ?? [];
      entries.push({ type: edge.targetType, id: edge.targetId });
      children.set(key, entries);
    }
    const visited = new Set([`goal:${rootGoalId}`]);
    const queue: Array<{ key: string; depth: number }> = [{ key: `goal:${rootGoalId}`, depth: 0 }];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.depth > this.maxDepth) {
        throw new DecompositionGraphIntegrityError(`depth exceeds configured maximum ${this.maxDepth}`);
      }
      for (const next of children.get(current.key) ?? []) {
        const key = `${next.type}:${next.id}`;
        if (visited.has(key)) continue;
        if (visited.size >= this.maxNodes) {
          throw new DecompositionGraphIntegrityError(`node count exceeds configured maximum ${this.maxNodes}`);
        }
        visited.add(key);
        queue.push({ key, depth: current.depth + 1 });
      }
    }
    return visited;
  }

  private lookup(context: TContext, relations: RelationRepository) {
    return {
      getProject: async (id: EntityId) => this.ports.projects(context).getById(id),
      getGoal: async (id: EntityId) => this.ports.goals(context).getById(id),
      getTask: async (id: EntityId) => this.ports.tasks(context).getById(id),
      hasActiveGoalPursuit: async (projectId: EntityId, goalId: EntityId) =>
        (await relations.listCurrent({ source: { type: 'project', id: projectId }, target: { type: 'goal', id: goalId }, relationType: 'contributes_to', limit: 1 })).length > 0,
      getActiveGoalPursuitProjectId: async (goalId: EntityId) =>
        (await relations.listCurrent({ target: { type: 'goal', id: goalId }, relationType: 'contributes_to' }))
          .find((relation) => relation.sourceType === 'project')?.sourceId ?? null,
      isInProjectDecompositionTree: async (projectId: EntityId, goalId: EntityId) =>
        (await relations.listCurrent({ target: { type: 'goal', id: goalId }, relationType: DECOMPOSITION_RELATION_TYPE }))
          .some((relation) => isInProject(relation, projectId)),
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
