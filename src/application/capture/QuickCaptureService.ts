import { Goal } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import { Idea } from '../../domain/idea/Idea';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Note } from '../../domain/note/Note';
import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation, type RelationEndType } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type {
  GoalId,
  IdeaId,
  NoteId,
  ProjectId,
  RecordId,
  RelationId,
  TaskId,
} from '../../domain/shared/ids';
import { Task } from '../../domain/task/Task';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { CAPTURE_RECORD_KIND, type CaptureRecordKind } from './captureRecordKinds';

interface CaptureCommandBase {
  content: string;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

export type QuickCaptureCommand =
  | (CaptureCommandBase & { intent: 'inbox' | 'idea'; entityId: IdeaId })
  | (CaptureCommandBase & { intent: 'goal'; entityId: GoalId })
  | (CaptureCommandBase & { intent: 'task'; entityId: TaskId; projectId: ProjectId })
  | (CaptureCommandBase & { intent: 'note'; entityId: NoteId });

export type QuickCaptureResult =
  | { intent: 'inbox' | 'idea'; entityType: 'idea'; entityId: IdeaId }
  | { intent: 'goal'; entityType: 'goal'; entityId: GoalId }
  | { intent: 'task'; entityType: 'task'; entityId: TaskId }
  | { intent: 'note'; entityType: 'note'; entityId: NoteId };

interface CaptureMapping {
  entityType: Exclude<RelationEndType, 'project' | 'resource' | 'record'>;
  recordKind: CaptureRecordKind;
  saveEntity(): Promise<void>;
}

/** Atomically writes a quick-captured entity and its initial activity. */
export class QuickCaptureService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly notes: NoteRepository,
    private readonly projects: ProjectRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async capture(command: QuickCaptureCommand): Promise<QuickCaptureResult> {
    const content = command.content.trim();
    if (content.length === 0) {
      throw new DomainError('Capture content must not be empty');
    }

    const mapping = await this.mapCommand(command, content);
    await this.transactionRunner.run(async () => {
      await mapping.saveEntity();
      await this.records.append(Record.create({
        id: command.recordId,
        kind: mapping.recordKind,
        detail: `Quick captured “${content}”`,
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.recordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: mapping.entityType,
        targetId: command.entityId,
        kind: 'logs',
        now: command.now,
      }));
    });

    switch (command.intent) {
      case 'inbox':
      case 'idea':
        return { intent: command.intent, entityType: 'idea', entityId: command.entityId };
      case 'goal':
        return { intent: command.intent, entityType: 'goal', entityId: command.entityId };
      case 'task':
        return { intent: command.intent, entityType: 'task', entityId: command.entityId };
      case 'note':
        return { intent: command.intent, entityType: 'note', entityId: command.entityId };
    }
  }

  private async mapCommand(
    command: QuickCaptureCommand,
    content: string,
  ): Promise<CaptureMapping> {
    switch (command.intent) {
      case 'inbox':
      case 'idea': {
        const idea = Idea.create({ id: command.entityId, content, now: command.now });
        return {
          entityType: 'idea',
          recordKind: CAPTURE_RECORD_KIND.quickCapturedIdea,
          saveEntity: () => this.ideas.save(idea),
        };
      }
      case 'goal': {
        const goal = Goal.create({ id: command.entityId, title: content, now: command.now });
        return {
          entityType: 'goal',
          recordKind: CAPTURE_RECORD_KIND.quickCapturedGoal,
          saveEntity: () => this.goals.save(goal),
        };
      }
      case 'task': {
        const project = await this.projects.findById(command.projectId);
        if (project === null) {
          throw new DomainError(`Unknown project: ${command.projectId}`);
        }
        if (project.archived) {
          throw new DomainError(`Cannot create a task in archived project: ${command.projectId}`);
        }
        const task = Task.create({
          id: command.entityId,
          title: content,
          projectId: command.projectId,
          now: command.now,
        });
        return {
          entityType: 'task',
          recordKind: CAPTURE_RECORD_KIND.quickCapturedTask,
          saveEntity: () => this.tasks.save(task),
        };
      }
      case 'note': {
        const note = Note.create({ id: command.entityId, content, now: command.now });
        return {
          entityType: 'note',
          recordKind: CAPTURE_RECORD_KIND.quickCapturedNote,
          saveEntity: () => this.notes.save(note),
        };
      }
    }
  }
}
