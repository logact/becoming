import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { JsonValue } from '../domain/json';
import { createRelation, endRelation } from '../domain/relation';
import type { Relation } from '../domain/relation';
import {
  TASK_PROJECT_MEMBERSHIP_POLICY,
  TASK_PROJECT_MEMBERSHIP_RELATION_TYPE,
} from '../domain/relationPolicy';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { TaskRepository } from '../persistence/taskRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { RelationProvenancePort } from './relationService';
import type { UnitOfWork } from './unitOfWork';

export { TASK_PROJECT_MEMBERSHIP_RELATION_TYPE } from '../domain/relationPolicy';

export class TaskProjectMembershipEndpointNotFoundError extends Error {
  constructor(readonly endpoint: 'task' | 'project', readonly id: EntityId) {
    super(`Task membership ${endpoint} ${id} not found`);
    this.name = 'TaskProjectMembershipEndpointNotFoundError';
  }
}

export class TaskProjectMembershipEndpointArchivedError extends Error {
  constructor(readonly endpoint: 'task' | 'project', readonly id: EntityId) {
    super(`Archived ${endpoint} ${id} cannot start a task membership`);
    this.name = 'TaskProjectMembershipEndpointArchivedError';
  }
}

export class DuplicateActiveTaskProjectMembershipError extends Error {
  constructor(readonly existing: Relation) {
    super(`Task ${existing.sourceId} already actively belongs to Project ${existing.targetId} (${existing.id})`);
    this.name = 'DuplicateActiveTaskProjectMembershipError';
  }
}

export class TaskProjectMembershipNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Task project membership ${id} not found`);
    this.name = 'TaskProjectMembershipNotFoundError';
  }
}

export interface StartTaskProjectMembershipCommand {
  taskId: EntityId;
  projectId: EntityId;
  metadata?: JsonValue;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface EndTaskProjectMembershipCommand {
  relationId: EntityId;
  actor: string;
  endedAt?: IsoTimestamp;
}

export interface TaskProjectMembershipServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  tasks: (context: TContext) => TaskRepository;
  projects: (context: TContext) => ProjectRepository;
  relations: (context: TContext) => RelationRepository;
  provenance: RelationProvenancePort<TContext>;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Typed Task -> Project membership commands.  This is intentionally separate
 * from intrinsic Task/Project aggregates: all current and historical context
 * lives in the relation graph.  Starts require active endpoints; ends are
 * idempotent historical operations and therefore remain valid after archival.
 */
export class TaskProjectMembershipService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: TaskProjectMembershipServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async startMembership(command: StartTaskProjectMembershipCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    const createdAt = command.occurredAt ?? this.clock.now();
    return this.ports.unitOfWork.run(async (context) => {
      await this.requireActiveEndpoints(context, command.taskId, command.projectId);
      const relation = createRelation({
        sourceType: 'task', sourceId: command.taskId,
        relationType: TASK_PROJECT_MEMBERSHIP_RELATION_TYPE,
        targetType: 'project', targetId: command.projectId, metadata: command.metadata,
      }, { id: this.ids.newId(), now: createdAt });
      TASK_PROJECT_MEMBERSHIP_POLICY.validateMetadata(relation.metadata);
      const relations = this.ports.relations(context);
      const existing = await relations.findActiveByIdentity(
        'task', command.taskId, TASK_PROJECT_MEMBERSHIP_RELATION_TYPE,
        'project', command.projectId,
      );
      if (existing !== null) throw new DuplicateActiveTaskProjectMembershipError(existing);
      await relations.add(relation);
      await this.append(context, 'created', relation, actor);
      return relation;
    });
  }

  /** Repeated ends preserve the first end time and do not append provenance. */
  async endMembership(command: EndTaskProjectMembershipCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    return this.ports.unitOfWork.run(async (context) => {
      const relations = this.ports.relations(context);
      const current = await relations.getById(command.relationId);
      if (!isTaskProjectMembership(current)) {
        throw new TaskProjectMembershipNotFoundError(command.relationId);
      }
      if (current.endedAt !== null) return current;
      const ended = endRelation(current, command.endedAt ?? this.clock.now());
      await relations.save(ended);
      await this.append(context, 'ended', ended, actor);
      return ended;
    });
  }

  private async requireActiveEndpoints(context: TContext, taskId: EntityId, projectId: EntityId): Promise<void> {
    const task = await this.ports.tasks(context).getById(taskId);
    if (task === null) throw new TaskProjectMembershipEndpointNotFoundError('task', taskId);
    if (task.archivedAt !== null) throw new TaskProjectMembershipEndpointArchivedError('task', taskId);
    const project = await this.ports.projects(context).getById(projectId);
    if (project === null) throw new TaskProjectMembershipEndpointNotFoundError('project', projectId);
    if (project.archivedAt !== null) throw new TaskProjectMembershipEndpointArchivedError('project', projectId);
  }

  private async append(context: TContext, kind: 'created' | 'ended', relation: Relation, actor: string): Promise<void> {
    await this.ports.provenance.append(context, {
      kind, relation, actor,
      occurredAt: kind === 'created' ? relation.createdAt : relation.endedAt as IsoTimestamp,
    });
  }
}

function isTaskProjectMembership(relation: Relation | null): relation is Relation {
  return relation !== null && relation.sourceType === 'task' &&
    relation.targetType === 'project' &&
    relation.relationType === TASK_PROJECT_MEMBERSHIP_RELATION_TYPE;
}

function requireActor(actor: string): string {
  if (actor.trim().length === 0) throw new Error('Task membership actor must not be blank');
  return actor;
}
