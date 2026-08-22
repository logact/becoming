import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { NoteId, RecordId, RelationId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { NOTE_RECORD_KIND } from './noteRecordKinds';

export interface ArchiveNoteCommand {
  noteId: NoteId;
  archived: boolean;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

/** Atomically archives or restores a Note and records the transition. */
export class ArchiveNoteService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  setArchived(command: ArchiveNoteCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const note = await this.notes.findById(command.noteId);
      if (note === null) throw new DomainError(`Unknown note: ${command.noteId}`);
      if (note.archived === command.archived) return;

      if (command.archived) note.archive(command.now);
      else note.unarchive(command.now);
      await this.notes.save(note);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: command.archived ? NOTE_RECORD_KIND.archived : NOTE_RECORD_KIND.unarchived,
        detail: command.archived ? 'Archived note' : 'Unarchived note',
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
