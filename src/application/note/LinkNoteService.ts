import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type {
  GoalId,
  NoteId,
  ProjectId,
  RecordId,
  RelationId,
} from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { NOTE_RECORD_KIND } from './noteRecordKinds';

export type NoteLinkTarget =
  | { targetType: 'goal'; targetId: GoalId }
  | { targetType: 'project'; targetId: ProjectId };

export type LinkNoteCommand = NoteLinkTarget & {
  relationId: RelationId;
  noteId: NoteId;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
};

/** Atomically links an active Note to an active Goal or Project. */
export class LinkNoteService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly goals: GoalRepository,
    private readonly projects: ProjectRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  link(command: LinkNoteCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const note = await this.notes.findById(command.noteId);
      if (note === null) throw new DomainError(`Unknown note: ${command.noteId}`);
      if (note.archived) throw new DomainError(`Cannot link archived note: ${command.noteId}`);

      let targetLabel: string;
      if (command.targetType === 'goal') {
        const goal = await this.goals.findById(command.targetId);
        if (goal === null) throw new DomainError(`Unknown goal: ${command.targetId}`);
        if (goal.archived) throw new DomainError(`Cannot link archived goal: ${command.targetId}`);
        targetLabel = goal.title;
      } else {
        const project = await this.projects.findById(command.targetId);
        if (project === null) throw new DomainError(`Unknown project: ${command.targetId}`);
        if (project.archived) {
          throw new DomainError(`Cannot link archived project: ${command.targetId}`);
        }
        targetLabel = project.name;
      }

      const existing = await this.relations.list({
        sourceType: 'note',
        sourceId: command.noteId,
        targetType: command.targetType,
        targetId: command.targetId,
        kind: 'relatesTo',
      });
      if (existing.length > 0) return;

      await this.relations.save(Relation.create({
        id: command.relationId,
        sourceType: 'note',
        sourceId: command.noteId,
        targetType: command.targetType,
        targetId: command.targetId,
        kind: 'relatesTo',
        now: command.now,
      }));
      await this.records.append(Record.create({
        id: command.recordId,
        kind: NOTE_RECORD_KIND.linked,
        detail: `Linked note to ${command.targetType} “${targetLabel}”`,
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.recordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'note',
        targetId: command.noteId,
        kind: 'logs',
        now: command.now,
      }));
    });
  }
}
