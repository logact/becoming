import { Note } from '../../domain/note/Note';
import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { NoteId, RecordId, RelationId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { NOTE_RECORD_KIND } from './noteRecordKinds';

export interface CaptureNoteCommand {
  noteId: NoteId;
  content: string;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

/** Atomically captures a Note and its first immutable activity record. */
export class CaptureNoteService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async capture(command: CaptureNoteCommand): Promise<void> {
    const note = Note.create({ id: command.noteId, content: command.content, now: command.now });
    await this.transactionRunner.run(async () => {
      await this.notes.save(note);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: NOTE_RECORD_KIND.captured,
        detail: `Captured “${note.content}”`,
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
