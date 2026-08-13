import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { JsonValue } from '../domain/json';
import {
  TASK_ALLOCATION_RELATION_TYPE,
  assessTaskAllocationBudget,
  createTaskAllocationRelation,
  taskAllocationActiveIdentity,
  taskAllocationMetadata,
  TaskAllocationReferenceNotFoundError,
  validateTaskAllocationHistory,
  validateTaskAllocationRelation,
} from '../domain/taskAllocation';
import { PROJECT_BUDGET_RELATION_TYPE, projectBudgetMetadata } from '../domain/projectBudget';
import type {
  NewTaskAllocationRelation,
  TaskAllocationBudgetAssessment,
} from '../domain/taskAllocation';
import { endRelation } from '../domain/relation';
import type { Relation } from '../domain/relation';
import { PROVENANCE_RECORD_TYPE } from '../domain/mutationProvenance';
import { createRecord } from '../domain/record';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RecordRepository } from '../persistence/recordRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { RelationListQuery } from '../persistence/relationRepository';
import type { ResourceRepository } from '../persistence/resourceRepository';
import type { TaskRepository } from '../persistence/taskRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/** The canonical active membership relation consumed by allocation commands. */
export const TASK_PROJECT_MEMBERSHIP_RELATION_TYPE = 'belongs_to';

export class ActiveTaskAllocationNotFoundError extends Error {
  constructor(taskId: EntityId, projectId: EntityId, resourceId: EntityId, projectContext: string) {
    super(`No active Task allocation exists for Task ${taskId}, Project ${projectId}, Resource ${resourceId}, context ${JSON.stringify(projectContext)}`);
    this.name = 'ActiveTaskAllocationNotFoundError';
  }
}

export class DuplicateActiveTaskAllocationError extends Error {
  constructor(existing: Relation) {
    super(`An active Task allocation already exists for this Task/Project/Resource/context (${existing.id})`);
    this.name = 'DuplicateActiveTaskAllocationError';
  }
}

export class TaskAllocationNotActiveError extends Error {
  constructor(relationId: EntityId) {
    super(`Task allocation ${relationId} is not active`);
    this.name = 'TaskAllocationNotActiveError';
  }
}

export class TaskAllocationRelationNotFoundError extends Error {
  constructor(relationId: EntityId) {
    super(`Task allocation relation ${relationId} not found`);
    this.name = 'TaskAllocationRelationNotFoundError';
  }
}

export interface CreateTaskAllocationCommand extends NewTaskAllocationRelation {
  actor: string;
  occurredAt?: IsoTimestamp;
  cause?: JsonValue;
}

export interface SupersedeTaskAllocationCommand extends NewTaskAllocationRelation {
  actor: string;
  occurredAt?: IsoTimestamp;
  cause?: JsonValue;
  priorRelationId?: EntityId;
}

export type ChangeTaskAllocationCommand = SupersedeTaskAllocationCommand;

export interface EndTaskAllocationCommand {
  relationId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
  cause?: JsonValue;
}

export interface TaskAllocationMutationResult {
  relation: Relation;
  budget: TaskAllocationBudgetAssessment;
}

export interface TaskAllocationSupersessionResult extends TaskAllocationMutationResult {
  priorRelation: Relation;
}

export interface TaskAllocationServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  tasks: (context: TContext) => TaskRepository;
  projects: (context: TContext) => ProjectRepository;
  resources: (context: TContext) => ResourceRepository;
  relations: (context: TContext) => RelationRepository;
  records: (context: TContext) => RecordRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Atomic mutation boundary for project-funded Task Resource allocations.
 *
 * The transaction serializes the exact active funding context: reference
 * validation, aggregate assessment, temporal history validation, relation
 * writes, and provenance either commit together or all roll back.  This is a
 * command-only service: allocation projections and consumption stay out of it.
 */
export class TaskAllocationService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: TaskAllocationServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async createTaskAllocation(command: CreateTaskAllocationCommand): Promise<TaskAllocationMutationResult> {
    const actor = requireActor(command.actor);
    const at = command.occurredAt ?? this.clock.now();
    const relation = createTaskAllocationRelation(command, { id: this.ids.newId(), now: at });
    return this.ports.unitOfWork.run(async (context) => {
      const existing = await this.findActive(context, relation);
      if (existing !== null) throw new DuplicateActiveTaskAllocationError(existing);
      const result = await this.validateNewAllocation(context, relation);
      await this.ports.relations(context).add(relation);
      await this.appendProvenance(context, { action: 'task_allocation_created', relation, actor, occurredAt: at, cause: command.cause });
      return result;
    });
  }

  async supersedeTaskAllocation(command: SupersedeTaskAllocationCommand): Promise<TaskAllocationSupersessionResult> {
    const actor = requireActor(command.actor);
    const at = command.occurredAt ?? this.clock.now();
    const successor = createTaskAllocationRelation(command, { id: this.ids.newId(), now: at });
    return this.ports.unitOfWork.run(async (context) => {
      const prior = command.priorRelationId === undefined
        ? await this.findActive(context, successor)
        : await this.requireActiveAllocation(context, command.priorRelationId);
      if (prior === null) {
        const metadata = taskAllocationMetadata(successor.metadata);
        throw new ActiveTaskAllocationNotFoundError(successor.sourceId, metadata.fundingProjectId, successor.targetId, metadata.projectContext);
      }
      this.requireSameIdentity(prior, successor);
      const { resource, budget } = await this.validateNewAllocation(context, successor, prior.id);
      const ended = endRelation(prior, at);
      const history = await this.ports.relations(context).listHistory({
        source: { type: 'task', id: successor.sourceId }, target: { type: 'resource', id: successor.targetId },
        relationType: TASK_ALLOCATION_RELATION_TYPE,
      });
      validateTaskAllocationHistory(
        history.filter((entry) => taskAllocationActiveIdentity(entry) === taskAllocationActiveIdentity(successor))
          .map((entry) => entry.id === ended.id ? ended : entry).concat(successor),
        resource,
      );
      await this.ports.relations(context).save(ended);
      await this.ports.relations(context).add(successor);
      await this.appendProvenance(context, { action: 'task_allocation_superseded', relation: successor, priorRelation: ended, actor, occurredAt: at, cause: command.cause });
      return { relation: successor, priorRelation: ended, budget };
    });
  }

  async changeTaskAllocation(command: ChangeTaskAllocationCommand): Promise<TaskAllocationSupersessionResult> {
    return this.supersedeTaskAllocation(command);
  }

  async endTaskAllocation(command: EndTaskAllocationCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    const at = command.occurredAt ?? this.clock.now();
    return this.ports.unitOfWork.run(async (context) => {
      const prior = await this.requireActiveAllocation(context, command.relationId);
      const ended = endRelation(prior, at);
      const resource = await this.ports.resources(context).getById(prior.targetId);
      if (resource === null || resource.archivedAt !== null) {
        throw new TaskAllocationReferenceNotFoundError('resource', prior.targetId);
      }
      validateTaskAllocationRelation(ended, resource);
      await this.ports.relations(context).save(ended);
      await this.appendProvenance(context, { action: 'task_allocation_ended', relation: ended, priorRelation: ended, actor, occurredAt: at, cause: command.cause });
      return ended;
    });
  }

  private async validateNewAllocation(
    context: TContext,
    relation: Relation,
    excludedActiveRelationId?: EntityId,
  ): Promise<TaskAllocationMutationResult & { resource: NonNullable<Awaited<ReturnType<ResourceRepository['getById']>>> }> {
    const metadata = taskAllocationMetadata(relation.metadata);
    const task = await this.ports.tasks(context).getById(relation.sourceId);
    if (task === null || task.archivedAt !== null) throw new TaskAllocationReferenceNotFoundError('task', relation.sourceId);
    const project = await this.ports.projects(context).getById(metadata.fundingProjectId);
    if (project === null || project.archivedAt !== null) throw new TaskAllocationReferenceNotFoundError('project', metadata.fundingProjectId);
    const resource = await this.ports.resources(context).getById(relation.targetId);
    if (resource === null || resource.archivedAt !== null) throw new TaskAllocationReferenceNotFoundError('resource', relation.targetId);
    validateTaskAllocationRelation(relation, resource);
    const membership = await this.ports.relations(context).findActiveByIdentity(
      'task', relation.sourceId, TASK_PROJECT_MEMBERSHIP_RELATION_TYPE, 'project', metadata.fundingProjectId,
    );
    if (membership === null) {
      throw new TaskAllocationReferenceNotFoundError('membership', `${relation.sourceId}/${metadata.fundingProjectId}`);
    }
    const budget = await this.findActiveBudget(context, metadata.fundingProjectId, relation.targetId, metadata.projectContext);
    if (budget === null) {
      throw new TaskAllocationReferenceNotFoundError('budget', `${metadata.fundingProjectId}/${relation.targetId}/${metadata.projectContext}`);
    }
    const activeAllocations = await this.listAllCurrent(context, {
      target: { type: 'resource', id: relation.targetId }, relationType: TASK_ALLOCATION_RELATION_TYPE,
    });
    const assessment = assessTaskAllocationBudget(
      relation,
      activeAllocations.filter((allocation) => allocation.id !== excludedActiveRelationId),
      budget,
      resource,
    );
    return { relation, budget: assessment, resource };
  }

  private async findActive(context: TContext, relation: Relation): Promise<Relation | null> {
    const metadata = taskAllocationMetadata(relation.metadata);
    const candidates = await this.listAllCurrent(context, {
      source: { type: 'task', id: relation.sourceId }, target: { type: 'resource', id: relation.targetId },
      relationType: TASK_ALLOCATION_RELATION_TYPE,
    });
    return candidates.find((candidate) => taskAllocationActiveIdentity(candidate) === `${relation.sourceId}\u0000${metadata.fundingProjectId}\u0000${relation.targetId}\u0000${metadata.projectContext}`) ?? null;
  }

  private async findActiveBudget(context: TContext, projectId: EntityId, resourceId: EntityId, projectContext: string): Promise<Relation | null> {
    const candidates = await this.listAllCurrent(context, {
      source: { type: 'project', id: projectId }, target: { type: 'resource', id: resourceId }, relationType: PROJECT_BUDGET_RELATION_TYPE,
    });
    return candidates.find((candidate) => {
      try { return projectBudgetMetadata(candidate.metadata).projectContext === projectContext; } catch { return false; }
    }) ?? null;
  }

  private async requireActiveAllocation(context: TContext, relationId: EntityId): Promise<Relation> {
    const relation = await this.ports.relations(context).getById(relationId);
    if (relation === null || relation.relationType !== TASK_ALLOCATION_RELATION_TYPE || relation.sourceType !== 'task' || relation.targetType !== 'resource') {
      throw new TaskAllocationRelationNotFoundError(relationId);
    }
    taskAllocationMetadata(relation.metadata);
    if (relation.endedAt !== null) throw new TaskAllocationNotActiveError(relationId);
    return relation;
  }

  private async listAllCurrent(context: TContext, query: RelationListQuery): Promise<Relation[]> {
    const relations = this.ports.relations(context);
    const pageSize = 100;
    const result: Relation[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await relations.listCurrent({ ...query, limit: pageSize, offset });
      result.push(...page);
      if (page.length < pageSize) return result;
    }
  }

  private requireSameIdentity(prior: Relation, successor: Relation): void {
    if (taskAllocationActiveIdentity(prior) !== taskAllocationActiveIdentity(successor)) {
      throw new Error('Task allocation supersession must retain its Task, Project, Resource, and projectContext identity');
    }
  }

  private async appendProvenance(context: TContext, notice: { action: 'task_allocation_created' | 'task_allocation_superseded' | 'task_allocation_ended'; relation: Relation; priorRelation?: Relation; actor: string; occurredAt: IsoTimestamp; cause?: JsonValue }): Promise<void> {
    const payload: JsonValue = { action: notice.action, relationId: notice.relation.id, priorRelationId: notice.priorRelation?.id ?? null, newRelationId: notice.action === 'task_allocation_ended' ? null : notice.relation.id, actor: notice.actor, occurredAt: notice.occurredAt, cause: notice.cause ?? null };
    await this.ports.records(context).add(createRecord({ description: `${notice.action} ${notice.relation.id}`, recordType: PROVENANCE_RECORD_TYPE, occurredAt: notice.occurredAt, recordedAt: this.clock.now(), actor: notice.actor, payload }, { id: this.ids.newId(), now: this.clock.now() }));
  }
}

function requireActor(actor: string): string {
  if (actor.trim().length === 0) throw new Error('Task allocation command actor must not be blank');
  return actor;
}
