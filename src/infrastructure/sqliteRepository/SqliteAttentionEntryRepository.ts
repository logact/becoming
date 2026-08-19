import {
  AttentionEntry,
  type AttentionEntryKind,
  type AttentionTargetType,
} from '../../domain/attention/AttentionEntry';
import type {
  AttentionEntryFilter,
  AttentionEntryRepository,
} from '../../domain/attention/repository/AttentionEntryRepository';
import type { AttentionEntryId } from '../../domain/shared/ids';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface AttentionEntryRow {
  id: string;
  target_type: AttentionTargetType;
  target_id: string;
  kind: AttentionEntryKind;
  created_at: number;
}

/** AttentionEntryRepository persisted in SQLite. */
export class SqliteAttentionEntryRepository implements AttentionEntryRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(entry: AttentionEntry): Promise<void> {
    await this.db.run(
      `INSERT INTO attention_entries (id, target_type, target_id, kind, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         target_type = excluded.target_type,
         target_id = excluded.target_id,
         kind = excluded.kind,
         created_at = excluded.created_at`,
      [entry.id, entry.targetType, entry.targetId, entry.kind, entry.createdAt.getTime()],
    );
  }

  async findById(id: AttentionEntryId): Promise<AttentionEntry | null> {
    const row = await this.db.first<AttentionEntryRow>(
      'SELECT * FROM attention_entries WHERE id = ?',
      [id],
    );
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: AttentionEntryFilter): Promise<AttentionEntry[]> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];
    if (filter?.kind !== undefined) {
      conditions.push('kind = ?');
      params.push(filter.kind);
    }
    if (filter?.targetType !== undefined) {
      conditions.push('target_type = ?');
      params.push(filter.targetType);
    }
    if (filter?.targetId !== undefined) {
      conditions.push('target_id = ?');
      params.push(filter.targetId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<AttentionEntryRow>(
      `SELECT * FROM attention_entries${where}`,
      params,
    );
    return rows.map((row) => this.hydrate(row));
  }

  async delete(id: AttentionEntryId): Promise<void> {
    await this.db.run('DELETE FROM attention_entries WHERE id = ?', [id]);
  }

  private hydrate(row: AttentionEntryRow): AttentionEntry {
    return AttentionEntry.restore({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      kind: row.kind,
      createdAt: new Date(row.created_at),
    });
  }
}
