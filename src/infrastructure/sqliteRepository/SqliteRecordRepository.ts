import { Record, type RecordTargetType } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface RecordRow {
  id: string;
  kind: string;
  detail: string | null;
  occurred_at: number;
}

/**
 * RecordRepository persisted in SQLite. Records are append-only and immutable:
 * `append` is a plain INSERT, so a duplicate id fails on the PK constraint.
 * Record-to-model links live in the relations table, with the record as either
 * end of the relation.
 */
export class SqliteRecordRepository implements RecordRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async append(record: Record): Promise<void> {
    await this.db.run(
      'INSERT INTO records (id, kind, detail, occurred_at) VALUES (?, ?, ?, ?)',
      [record.id, record.kind, record.detail ?? null, record.occurredAt.getTime()],
    );
  }

  /** Records about a target, reached through relations in either direction; newest first. */
  async listByTarget(targetType: RecordTargetType, limit: number, targetId?: string): Promise<Record[]> {
    const sourceBranch = [
      "relations.source_type = 'record'",
      "relations.source_id = records.id",
      "relations.target_type = ?",
    ];
    const targetBranch = [
      "relations.target_type = 'record'",
      "relations.target_id = records.id",
      "relations.source_type = ?",
    ];
    if (targetId) {
      sourceBranch.push("relations.target_id = ?");
      targetBranch.push("relations.source_id = ?");
    }
    const params: SqlValue[] = targetId
      ? [targetType, targetId, targetType, targetId]
      : [targetType, targetType];

    const rows = await this.db.all<RecordRow>(
      `SELECT DISTINCT records.* FROM records
       JOIN relations
         ON ((${sourceBranch.join(" AND ")})
             OR (${targetBranch.join(" AND ")}))
       ORDER BY records.occurred_at DESC, records.id DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row) => this.hydrate(row));
  }

  /** The newest records first, capped at `limit`. */
  async listRecent(limit: number): Promise<Record[]> {
    const rows = await this.db.all<RecordRow>(
      'SELECT * FROM records ORDER BY occurred_at DESC, id DESC LIMIT ?',
      [limit],
    );
    return rows.map((row) => this.hydrate(row));
  }

  private hydrate(row: RecordRow): Record {
    return Record.restore({
      id: row.id,
      kind: row.kind,
      detail: row.detail ?? undefined,
      occurredAt: new Date(row.occurred_at),
    });
  }
}
