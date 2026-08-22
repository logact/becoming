import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { NoteId, RecordId, RelationId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { NOTE_RECORD_KIND } from './noteRecordKinds';

export interface SetNotePinCommand {
  noteId: NoteId;
  pinned: boolean;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

/** Atomically pins or unpins a Note and records the organizing action. */
export class SetNotePinService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  setPinned(command: SetNotePinCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const note = await this.notes.findById(command.noteId);
      if (note === null) throw new DomainError(`Unknown note: ${command.noteId}`);
      if (!command.pinned && note.pinnedAt === null) return;

      if (command.pinned) note.pin(command.now);
      else note.unpin(command.now);
      await this.notes.save(note);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: command.pinned ? NOTE_RECORD_KIND.pinned : NOTE_RECORD_KIND.unpinned,
        detail: command.pinned ? 'Pinned note' : 'Unpinned note',
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
