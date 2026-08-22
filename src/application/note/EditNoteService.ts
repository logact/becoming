import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { NoteId, RecordId, RelationId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { NOTE_RECORD_KIND } from './noteRecordKinds';

export interface EditNoteCommand {
  noteId: NoteId;
  content: string;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

/** Atomically changes Note content and records the edit. */
export class EditNoteService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  edit(command: EditNoteCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const note = await this.notes.findById(command.noteId);
      if (note === null) throw new DomainError(`Unknown note: ${command.noteId}`);

      if (command.content.trim() === note.content) return;
      note.edit(command.content, command.now);
      await this.notes.save(note);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: NOTE_RECORD_KIND.edited,
        detail: `Edited note to “${note.content}”`,
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
