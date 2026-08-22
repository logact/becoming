import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type {
  GoalId,
  ProjectId,
  RecordId,
  RelationId,
} from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';

export const PROJECT_CREATED_RECORD_KIND = 'projectCreated';

export interface CreateGoalProjectCommand {
  projectId: ProjectId;
  goalId: GoalId;
  name: string;
  due?: Date;
  recordId: RecordId;
  goalRecordRelationId: RelationId;
  projectRecordRelationId: RelationId;
  now: Date;
}

export interface CreateGoalProjectResult {
  projectId: ProjectId;
}

/** Atomically creates a planning Project that permanently serves a Goal. */
export class CreateGoalProjectService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly projects: ProjectRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  create(command: CreateGoalProjectCommand): Promise<CreateGoalProjectResult> {
    return this.transactionRunner.run(async () => {
      const goal = await this.goals.findById(command.goalId);
      if (goal === null) throw new DomainError(`Unknown goal: ${command.goalId}`);
      if (goal.archived) {
        throw new DomainError(`Cannot create a project for archived goal: ${command.goalId}`);
      }

      const project = Project.create({
        id: command.projectId,
        name: command.name,
        goalId: command.goalId,
        ...(command.due === undefined ? {} : { due: command.due }),
        ...(goal.due === undefined ? {} : { goalDue: goal.due }),
        now: command.now,
      });

      await this.projects.save(project);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: PROJECT_CREATED_RECORD_KIND,
        detail: `Created Project “${project.name}”`,
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.goalRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'goal',
        targetId: command.goalId,
        kind: 'logs',
        now: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.projectRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'project',
        targetId: command.projectId,
        kind: 'logs',
        now: command.now,
      }));

      return { projectId: project.id };
    });
  }
}
