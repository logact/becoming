import { Note } from '../../domain/note/Note';
import type {
  NoteFilter,
  NoteRepository,
} from '../../domain/note/repository/NoteRepository';
import type { NoteId } from '../../domain/shared/ids';
import { deleteLabelIds, loadLabelIds, replaceLabelIds } from './entityLabels';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface NoteRow {
  id: string;
  content: string;
  archived: number;
  pinned_at: number | null;
  created_at: number;
  updated_at: number;
}

/** NoteRepository persisted in SQLite; labels live in entity_labels. */
export class SqliteNoteRepository implements NoteRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(note: Note): Promise<void> {
    await this.db.run(
      `INSERT INTO notes (id, content, archived, pinned_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content = excluded.content,
         archived = excluded.archived,
         pinned_at = excluded.pinned_at,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      [
        note.id,
        note.content,
        note.archived ? 1 : 0,
        note.pinnedAt?.getTime() ?? null,
        note.createdAt.getTime(),
        note.updatedAt.getTime(),
      ],
    );
    await replaceLabelIds(this.db, 'note', note.id, note.labelIds);
  }

  async findById(id: NoteId): Promise<Note | null> {
    const row = await this.db.first<NoteRow>('SELECT * FROM notes WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: NoteFilter): Promise<Note[]> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];
    if (filter?.archived !== undefined) {
      conditions.push('archived = ?');
      params.push(filter.archived ? 1 : 0);
    }
    if (filter?.labelId !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM entity_labels
         WHERE entity_type = 'note' AND entity_id = notes.id AND label_id = ?)`,
      );
      params.push(filter.labelId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<NoteRow>(`SELECT * FROM notes${where}`, params);
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async delete(id: NoteId): Promise<void> {
    await this.db.run('DELETE FROM notes WHERE id = ?', [id]);
    await deleteLabelIds(this.db, 'note', id);
  }

  private async hydrate(row: NoteRow): Promise<Note> {
    return Note.restore({
      id: row.id,
      content: row.content,
      archived: row.archived === 1,
      pinnedAt: row.pinned_at === null ? null : new Date(row.pinned_at),
      labelIds: await loadLabelIds(this.db, 'note', row.id),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
