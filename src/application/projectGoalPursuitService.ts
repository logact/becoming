import type { EntityId, IsoTimestamp } from '../domain/ids';
import { createRelation, endRelation } from '../domain/relation';
import type { Relation } from '../domain/relation';
import {
  PROJECT_GOAL_PURSUIT_POLICY,
  PROJECT_GOAL_PURSUIT_RELATION_TYPE,
} from '../domain/relationPolicy';
import type { JsonValue } from '../domain/json';
import type { GoalRepository } from '../persistence/goalRepository';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { RelationProvenancePort } from './relationService';
import { RecordRelationProvenancePort } from './relationProvenanceService';
import type { RelationMetadataSelectionPolicy } from '../domain/relationProvenance';
import type { UnitOfWork } from './unitOfWork';

/** Raised when a named Project or Goal does not exist. */
export class ProjectGoalPursuitEndpointNotFoundError extends Error {
  constructor(readonly endpoint: 'project' | 'goal', readonly id: EntityId) {
    super(`Goal pursuit ${endpoint} ${id} not found`);
    this.name = 'ProjectGoalPursuitEndpointNotFoundError';
  }
}

/** Raised when an archived endpoint is used to start new current work. */
export class ProjectGoalPursuitEndpointArchivedError extends Error {
  constructor(readonly endpoint: 'project' | 'goal', readonly id: EntityId) {
    super(`Archived ${endpoint} ${id} cannot start a goal pursuit`);
    this.name = 'ProjectGoalPursuitEndpointArchivedError';
  }
}

/** Raised when a Project already actively pursues the same Goal. */
export class DuplicateActiveGoalPursuitError extends Error {
  constructor(readonly existing: Relation) {
    super(
      `Project ${existing.sourceId} already actively pursues Goal ${existing.targetId} (${existing.id})`,
    );
    this.name = 'DuplicateActiveGoalPursuitError';
  }
}

/** Raised when the supplied relation is absent or is not a pursuit relation. */
export class GoalPursuitNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Goal pursuit ${id} not found`);
    this.name = 'GoalPursuitNotFoundError';
  }
}

export interface StartGoalPursuitCommand {
  projectId: EntityId;
  goalId: EntityId;
  metadata?: JsonValue;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface EndGoalPursuitCommand {
  relationId: EntityId;
  actor: string;
  endedAt?: IsoTimestamp;
}

export interface ProjectGoalPursuitServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  projects: (context: TContext) => ProjectRepository;
  goals: (context: TContext) => GoalRepository;
  relations: (context: TContext) => RelationRepository;
  provenance: RelationProvenancePort<TContext>;
  clock?: Clock;
  ids?: IdGenerator;
}

/** Pursuit metadata is relationship context and is retained in its audit event. */
export const PROJECT_GOAL_PURSUIT_PROVENANCE_METADATA_POLICY: RelationMetadataSelectionPolicy =
  Object.freeze({ allowlist: ['rationale', 'purpose', 'reason', 'role', 'semantic'], redacted: [] });

/**
 * Creates the concrete Record-backed provenance adapter with pursuit's
 * metadata policy. Callers that need custom storage can still supply the
 * service port directly.
 */
export function projectGoalPursuitProvenancePort<TContext>(ports: {
  records: ConstructorParameters<typeof RecordRelationProvenancePort<TContext>>[0]['records'];
  clock?: Clock;
  ids?: IdGenerator;
}): RelationProvenancePort<TContext> {
  return new RecordRelationProvenancePort({
    ...ports,
    metadataPolicy: PROJECT_GOAL_PURSUIT_PROVENANCE_METADATA_POLICY,
  });
}

/**
 * Owns the typed Project -> Goal `contributes_to` use case.  Pursuit has no
 * membership columns: it is a directed, temporal Relation.  Starts require
 * both current endpoint aggregates, while ends deliberately do not re-check
 * endpoint eligibility so archived historical facts remain endable and
 * inspectable.  Both relation writes and their structured provenance record
 * share this service's unit of work.
 */
export class ProjectGoalPursuitService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: ProjectGoalPursuitServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async startPursuit(command: StartGoalPursuitCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    const createdAt = command.occurredAt ?? this.clock.now();
    return this.ports.unitOfWork.run(async (context) => {
      await this.requireActiveEndpoints(context, command.projectId, command.goalId);
      const relation = createRelation({
        sourceType: 'project', sourceId: command.projectId,
        relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE,
        targetType: 'goal', targetId: command.goalId, metadata: command.metadata,
      }, { id: this.ids.newId(), now: createdAt });
      PROJECT_GOAL_PURSUIT_POLICY.validateMetadata(relation.metadata);
      const relations = this.ports.relations(context);
      const existing = await relations.findActiveByIdentity(
        'project', command.projectId, PROJECT_GOAL_PURSUIT_RELATION_TYPE,
        'goal', command.goalId,
      );
      if (existing !== null) throw new DuplicateActiveGoalPursuitError(existing);
      await relations.add(relation);
      await this.append(context, 'created', relation, actor);
      return relation;
    });
  }

  /** Idempotent: repeated ends retain the original ended_at and audit trail. */
  async endPursuit(command: EndGoalPursuitCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    return this.ports.unitOfWork.run(async (context) => {
      const relations = this.ports.relations(context);
      const current = await relations.getById(command.relationId);
      if (!isGoalPursuit(current)) throw new GoalPursuitNotFoundError(command.relationId);
      if (current.endedAt !== null) return current;
      const ended = endRelation(current, command.endedAt ?? this.clock.now());
      await relations.save(ended);
      await this.append(context, 'ended', ended, actor);
      return ended;
    });
  }

  private async requireActiveEndpoints(
    context: TContext, projectId: EntityId, goalId: EntityId,
  ): Promise<void> {
    const project = await this.ports.projects(context).getById(projectId);
    if (project === null) throw new ProjectGoalPursuitEndpointNotFoundError('project', projectId);
    if (project.archivedAt !== null) throw new ProjectGoalPursuitEndpointArchivedError('project', projectId);
    const goal = await this.ports.goals(context).getById(goalId);
    if (goal === null) throw new ProjectGoalPursuitEndpointNotFoundError('goal', goalId);
    if (goal.archivedAt !== null) throw new ProjectGoalPursuitEndpointArchivedError('goal', goalId);
  }

  private async append(
    context: TContext, kind: 'created' | 'ended', relation: Relation, actor: string,
  ): Promise<void> {
    await this.ports.provenance.append(context, {
      kind, relation, actor,
      occurredAt: kind === 'created' ? relation.createdAt : relation.endedAt as IsoTimestamp,
    });
  }
}

function isGoalPursuit(relation: Relation | null): relation is Relation {
  return relation !== null &&
    relation.sourceType === 'project' &&
    relation.targetType === 'goal' &&
    relation.relationType === PROJECT_GOAL_PURSUIT_RELATION_TYPE;
}

function requireActor(actor: string): string {
  if (actor.trim().length === 0) throw new Error('Goal pursuit actor must not be blank');
  return actor;
}
