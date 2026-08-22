import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import { DomainError } from '../../domain/shared/errors';
import type { NoteId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';

/** Deletes a Note; dangling cross-entity relations are ignored by read models. */
export class DeleteNoteService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  delete(noteId: NoteId): Promise<void> {
    return this.transactionRunner.run(async () => {
      if (await this.notes.findById(noteId) === null) {
        throw new DomainError(`Unknown note: ${noteId}`);
      }
      await this.notes.delete(noteId);
    });
  }
}
