import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { JsonValue } from '../domain/json';
import {
  PROJECT_BUDGET_RELATION_TYPE,
  assessProjectBudgetCapacity,
  createProjectBudgetRelation,
  projectBudgetActiveIdentity,
  projectBudgetMetadata,
  ProjectBudgetReferenceNotFoundError,
  validateProjectBudgetHistory,
  validateProjectBudgetRelation,
} from '../domain/projectBudget';
import type {
  NewProjectBudgetRelation,
  ProjectBudgetCapacityAssessment,
} from '../domain/projectBudget';
import { endRelation } from '../domain/relation';
import type { Relation } from '../domain/relation';
import { PROVENANCE_RECORD_TYPE } from '../domain/mutationProvenance';
import { createRecord } from '../domain/record';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RecordRepository } from '../persistence/recordRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { ResourceRepository } from '../persistence/resourceRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/** A requested budget context has no current temporal relation. */
export class ActiveProjectBudgetNotFoundError extends Error {
  constructor(projectId: EntityId, resourceId: EntityId, projectContext: string) {
    super(`No active Project budget exists for Project ${projectId}, Resource ${resourceId}, context ${JSON.stringify(projectContext)}`);
    this.name = 'ActiveProjectBudgetNotFoundError';
  }
}

/** A create must not silently create a second active budget for one context. */
export class DuplicateActiveProjectBudgetError extends Error {
  constructor(existing: Relation) {
    super(`An active Project budget already exists for this Project/Resource/context (${existing.id})`);
    this.name = 'DuplicateActiveProjectBudgetError';
  }
}

/** A supplied historical id cannot be superseded or ended as an active budget. */
export class ProjectBudgetNotActiveError extends Error {
  constructor(relationId: EntityId) {
    super(`Project budget ${relationId} is not active`);
    this.name = 'ProjectBudgetNotActiveError';
  }
}

/** An id belongs to another kind of relation and is not a Project budget. */
export class ProjectBudgetRelationNotFoundError extends Error {
  constructor(relationId: EntityId) {
    super(`Project budget relation ${relationId} not found`);
    this.name = 'ProjectBudgetRelationNotFoundError';
  }
}

export interface CreateProjectBudgetCommand extends NewProjectBudgetRelation {
  actor: string;
  occurredAt?: IsoTimestamp;
  /** Optional human or automation reason retained in the append-only audit. */
  cause?: JsonValue;
}

/**
 * Supersession appends a new relation while ending the previous current
 * relation.  When `priorRelationId` is omitted, the active relation for the
 * command's Project/Resource/context is selected.  When supplied, it must
 * name that same active identity.
 */
export interface SupersedeProjectBudgetCommand extends NewProjectBudgetRelation {
  actor: string;
  occurredAt?: IsoTimestamp;
  cause?: JsonValue;
  priorRelationId?: EntityId;
}

/** `changeProjectBudget` is the application-friendly synonym for supersede. */
export type ChangeProjectBudgetCommand = SupersedeProjectBudgetCommand;

export interface EndProjectBudgetCommand {
  relationId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
  cause?: JsonValue;
}

export interface ProjectBudgetMutationResult {
  relation: Relation;
  capacity: ProjectBudgetCapacityAssessment;
}

export interface ProjectBudgetSupersessionResult extends ProjectBudgetMutationResult {
  priorRelation: Relation;
}

export interface ProjectBudgetServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  projects: (context: TContext) => ProjectRepository;
  resources: (context: TContext) => ResourceRepository;
  relations: (context: TContext) => RelationRepository;
  records: (context: TContext) => RecordRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Atomic command boundary for temporal Project Resource budgets.
 *
 * Budget rows are regular `project -> budgeted_by -> resource` Relations,
 * but their amount/context/capacity semantics come from #61.  This service
 * deliberately owns only mutations: it does not expose budget history or
 * allocation/accounting read models.
 */
export class ProjectBudgetService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: ProjectBudgetServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async createProjectBudget(command: CreateProjectBudgetCommand): Promise<ProjectBudgetMutationResult> {
    const actor = requireActor(command.actor);
    const at = command.occurredAt ?? this.clock.now();
    const relation = createProjectBudgetRelation(command, { id: this.ids.newId(), now: at });
    return this.ports.unitOfWork.run(async (context) => {
      const { capacity } = await this.validateNewBudget(context, relation);
      const existing = await this.findActive(context, relation);
      if (existing !== null) throw new DuplicateActiveProjectBudgetError(existing);
      await this.ports.relations(context).add(relation);
      await this.appendProvenance(context, {
        action: 'project_budget_created', relation, actor, occurredAt: at, cause: command.cause,
      });
      return { relation, capacity };
    });
  }

  async supersedeProjectBudget(
    command: SupersedeProjectBudgetCommand,
  ): Promise<ProjectBudgetSupersessionResult> {
    const actor = requireActor(command.actor);
    const at = command.occurredAt ?? this.clock.now();
    const successor = createProjectBudgetRelation(command, { id: this.ids.newId(), now: at });
    return this.ports.unitOfWork.run(async (context) => {
      const { resource, capacity } = await this.validateNewBudget(context, successor);
      const prior = command.priorRelationId === undefined
        ? await this.findActive(context, successor)
        : await this.requireActiveBudget(context, command.priorRelationId);
      if (prior === null) {
        const metadata = projectBudgetMetadata(successor.metadata);
        throw new ActiveProjectBudgetNotFoundError(
          successor.sourceId, successor.targetId, metadata.projectContext,
        );
      }
      this.requireSameIdentity(prior, successor);
      const ended = endRelation(prior, at);
      const history = await this.ports.relations(context).listHistory({
        source: { type: 'project', id: successor.sourceId },
        target: { type: 'resource', id: successor.targetId },
        relationType: PROJECT_BUDGET_RELATION_TYPE,
      });
      validateProjectBudgetHistory(
        history
          .filter((entry) => projectBudgetActiveIdentity(entry) === projectBudgetActiveIdentity(successor))
          .map((entry) => entry.id === ended.id ? ended : entry)
          .concat(successor),
        resource,
      );
      await this.ports.relations(context).save(ended);
      await this.ports.relations(context).add(successor);
      await this.appendProvenance(context, {
        action: 'project_budget_superseded', relation: successor, priorRelation: ended,
        actor, occurredAt: at, cause: command.cause,
      });
      return { relation: successor, priorRelation: ended, capacity };
    });
  }

  async changeProjectBudget(
    command: ChangeProjectBudgetCommand,
  ): Promise<ProjectBudgetSupersessionResult> {
    return this.supersedeProjectBudget(command);
  }

  async endProjectBudget(command: EndProjectBudgetCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    const at = command.occurredAt ?? this.clock.now();
    return this.ports.unitOfWork.run(async (context) => {
      const prior = await this.requireActiveBudget(context, command.relationId);
      const ended = endRelation(prior, at);
      const resource = await this.ports.resources(context).getById(prior.targetId);
      if (resource === null || resource.archivedAt !== null) {
        throw new ProjectBudgetReferenceNotFoundError('resource', prior.targetId);
      }
      validateProjectBudgetRelation(ended, resource);
      await this.ports.relations(context).save(ended);
      await this.appendProvenance(context, {
        action: 'project_budget_ended', relation: ended, priorRelation: ended,
        actor, occurredAt: at, cause: command.cause,
      });
      return ended;
    });
  }

  private async validateNewBudget(
    context: TContext,
    relation: Relation,
  ): Promise<{ resource: NonNullable<Awaited<ReturnType<ResourceRepository['getById']>>>; capacity: ProjectBudgetCapacityAssessment }> {
    const project = await this.ports.projects(context).getById(relation.sourceId);
    if (project === null || project.archivedAt !== null) {
      throw new ProjectBudgetReferenceNotFoundError('project', relation.sourceId);
    }
    const resource = await this.ports.resources(context).getById(relation.targetId);
    if (resource === null || resource.archivedAt !== null) {
      throw new ProjectBudgetReferenceNotFoundError('resource', relation.targetId);
    }
    validateProjectBudgetRelation(relation, resource);
    return { resource, capacity: assessProjectBudgetCapacity(relation, resource) };
  }

  private async findActive(context: TContext, relation: Relation): Promise<Relation | null> {
    const candidates = await this.ports.relations(context).listCurrent({
      source: { type: 'project', id: relation.sourceId },
      target: { type: 'resource', id: relation.targetId },
      relationType: PROJECT_BUDGET_RELATION_TYPE,
    });
    const identity = projectBudgetActiveIdentity(relation);
    return candidates.find((candidate) => projectBudgetActiveIdentity(candidate) === identity) ?? null;
  }

  private async requireActiveBudget(context: TContext, relationId: EntityId): Promise<Relation> {
    const relation = await this.ports.relations(context).getById(relationId);
    if (relation === null || relation.relationType !== PROJECT_BUDGET_RELATION_TYPE ||
      relation.sourceType !== 'project' || relation.targetType !== 'resource') {
      throw new ProjectBudgetRelationNotFoundError(relationId);
    }
    // Parse metadata before reporting active state so a corrupt arbitrary
    // budget-shaped relation never becomes a writable historical fact.
    projectBudgetMetadata(relation.metadata);
    if (relation.endedAt !== null) throw new ProjectBudgetNotActiveError(relationId);
    return relation;
  }

  private requireSameIdentity(prior: Relation, successor: Relation): void {
    if (projectBudgetActiveIdentity(prior) !== projectBudgetActiveIdentity(successor)) {
      throw new Error('Project budget supersession must retain its Project, Resource, and projectContext identity');
    }
  }

  private async appendProvenance(
    context: TContext,
    notice: {
      action: 'project_budget_created' | 'project_budget_superseded' | 'project_budget_ended';
      relation: Relation;
      priorRelation?: Relation;
      actor: string;
      occurredAt: IsoTimestamp;
      cause?: JsonValue;
    },
  ): Promise<void> {
    const payload: JsonValue = {
      action: notice.action,
      relationId: notice.relation.id,
      priorRelationId: notice.priorRelation?.id ?? null,
      newRelationId: notice.action === 'project_budget_ended' ? null : notice.relation.id,
      actor: notice.actor,
      occurredAt: notice.occurredAt,
      cause: notice.cause ?? null,
    };
    await this.ports.records(context).add(createRecord({
      description: `${notice.action} ${notice.relation.id}`,
      recordType: PROVENANCE_RECORD_TYPE,
      occurredAt: notice.occurredAt,
      recordedAt: this.clock.now(),
      actor: notice.actor,
      payload,
    }, { id: this.ids.newId(), now: this.clock.now() }));
  }
}

function requireActor(actor: string): string {
  if (actor.trim().length === 0) throw new Error('Project budget command actor must not be blank');
  return actor;
}
