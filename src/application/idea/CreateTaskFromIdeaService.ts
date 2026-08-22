import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type {
  GoalId,
  IdeaId,
  ProjectId,
  RecordId,
  RelationId,
  TaskId,
} from '../../domain/shared/ids';
import { Task } from '../../domain/task/Task';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { IDEA_RECORD_KIND } from './ideaRecordKinds';

export interface CreateTaskFromIdeaCommand {
  ideaId: IdeaId;
  taskId: TaskId;
  projectId: ProjectId;
  goalId?: GoalId;
  title: string;
  description?: string;
  startAt?: Date;
  due?: Date;
  derivedRelationId: RelationId;
  recordId: RecordId;
  ideaRecordRelationId: RelationId;
  taskRecordRelationId: RelationId;
  now: Date;
}

/** Atomically derives a Task in an existing Project from a non-archived Idea. */
export class CreateTaskFromIdeaService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly projects: ProjectRepository,
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  create(command: CreateTaskFromIdeaCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const idea = await this.ideas.findById(command.ideaId);
      if (idea === null) throw new DomainError(`Unknown idea: ${command.ideaId}`);
      if (idea.archived) throw new DomainError(`Cannot derive from archived idea: ${command.ideaId}`);

      const project = await this.projects.findById(command.projectId);
      if (project === null) throw new DomainError(`Unknown project: ${command.projectId}`);
      if (project.archived) {
        throw new DomainError(`Cannot create a task in archived project: ${command.projectId}`);
      }
      if (command.title.trim().length === 0) {
        throw new DomainError('Task title must not be empty');
      }

      if (command.goalId !== undefined) {
        const goal = await this.goals.findById(command.goalId);
        const inTree =
          goal !== null && (goal.id === project.goalId || goal.projectId === project.id);
        if (!inTree) {
          throw new DomainError(
            `Goal ${command.goalId} does not belong to the goal tree of project ${command.projectId}`,
          );
        }
      }

      const task = Task.create({
        id: command.taskId,
        title: command.title,
        description: command.description ?? idea.content,
        projectId: command.projectId,
        ...(command.startAt === undefined ? {} : { startAt: command.startAt }),
        ...(command.due === undefined ? {} : { due: command.due }),
        ...(command.goalId === undefined ? {} : { goalId: command.goalId }),
        now: command.now,
      });
      for (const labelId of idea.labelIds) task.addLabel(labelId);

      await this.tasks.save(task);
      await this.relations.save(Relation.derivedFromIdea({
        id: command.derivedRelationId,
        sourceType: 'task',
        sourceId: command.taskId,
        ideaId: command.ideaId,
        now: command.now,
      }));

      if (idea.status !== 'handled') {
        idea.handle(command.now);
        await this.ideas.save(idea);
      }

      await this.records.append(Record.create({
        id: command.recordId,
        kind: IDEA_RECORD_KIND.derivedTask,
        detail: `Created Task “${task.title}” from Idea`,
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.ideaRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'idea',
        targetId: command.ideaId,
        kind: 'logs',
        now: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.taskRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'task',
        targetId: command.taskId,
        kind: 'logs',
        now: command.now,
      }));
    });
  }
}
