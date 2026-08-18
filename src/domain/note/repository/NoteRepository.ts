import type { Note } from '../Note';
import type { LabelId, NoteId } from '../../shared/ids';

export interface NoteFilter {
  archived?: boolean;
  labelId?: LabelId;
}

export interface NoteRepository {
  /** Upserts the note. */
  save(note: Note): Promise<void>;
  findById(id: NoteId): Promise<Note | null>;
  list(filter?: NoteFilter): Promise<Note[]>;
  delete(id: NoteId): Promise<void>;
}
