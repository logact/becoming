import type { EntityId } from '../domain/ids';
import type { JsonValue, Record } from '../domain/record';
import { validateRecord } from '../domain/record';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the Record aggregate (occurrence records).
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `records` table has no foreign keys; the repository validates the
 * aggregate's invariants on every write. References *to* a Record (semantic
 * relations, timelines) are validated by the services that own those tables,
 * against this boundary.
 *
 * `payload` is stored as canonical JSON TEXT produced by `JSON.stringify`
 * from a validated `JsonValue`; it never passes through an ORM serializer.
 * `occurred_at` and `recorded_at` are independent columns and round-trip
 * unchanged. `getById` resolves active and archived Records alike so history
 * that references a Record stays resolvable.
 */
export interface RecordRepository {
  /** Insert a new Record. Throws if the id already exists. */
  add(record: Record): Promise<void>;

  /** Return the Record with this id (active or archived), or null. */
  getById(id: EntityId): Promise<Record | null>;

}

/** Extended Record boundary consumed only by the correction/archive feature. */
export interface RecordHistoryRepository extends RecordRepository {
  /** `all` is intended for authorized history readers; ordinary views use active. */
  list(options?: { status?: 'active' | 'archived' | 'all' }): Promise<Record[]>;
  /** Persists archival only; occurrence facts are immutable and there is no delete. */
  save(record: Record): Promise<void>;
}

interface RecordRow {
  id: string;
  title: string | null;
  description: string;
  record_type: string;
  occurred_at: string;
  recorded_at: string;
  actor: string | null;
  payload: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toRow(record: Record): RecordRow {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    record_type: record.recordType,
    occurred_at: record.occurredAt,
    recorded_at: record.recordedAt,
    actor: record.actor,
    payload: record.payload === null ? null : JSON.stringify(record.payload),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    archived_at: record.archivedAt,
  };
}

function toDomain(row: RecordRow): Record {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    recordType: row.record_type,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    actor: row.actor,
    payload: row.payload === null ? null : (JSON.parse(row.payload) as JsonValue),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/** RecordRepository over the SqliteDatabase port. */
export class SqliteRecordRepository implements RecordHistoryRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(record: Record): Promise<void> {
    validateRecord(record);
    const row = toRow(record);
    await this.db.runAsync(
      `INSERT INTO records (
         id, title, description, record_type, occurred_at, recorded_at,
         actor, payload, created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.description,
        row.record_type,
        row.occurred_at,
        row.recorded_at,
        row.actor,
        row.payload,
        row.created_at,
        row.updated_at,
        row.archived_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Record | null> {
    const row = await this.db.getFirstAsync<RecordRow>(
      `SELECT id, title, description, record_type, occurred_at, recorded_at,
              actor, payload, created_at, updated_at, archived_at
       FROM records WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async list(
    options: { status?: 'active' | 'archived' | 'all' } = {},
  ): Promise<Record[]> {
    const status = options.status ?? 'active';
    const where =
      status === 'active'
        ? 'WHERE archived_at IS NULL'
        : status === 'archived'
          ? 'WHERE archived_at IS NOT NULL'
          : '';
    const rows = await this.db.getAllAsync<RecordRow>(
      `SELECT id, title, description, record_type, occurred_at, recorded_at,
              actor, payload, created_at, updated_at, archived_at
       FROM records ${where} ORDER BY recorded_at ASC, id ASC`,
    );
    return rows.map(toDomain);
  }

  async save(record: Record): Promise<void> {
    validateRecord(record);
    const stored = await this.getById(record.id);
    if (stored === null) {
      throw new Error(`Cannot save unknown Record ${record.id}`);
    }
    // A Record is an occurrence, so no application path may rewrite its
    // captured facts. The only permitted update is active -> archived; a
    // repeated save of the first archived value is harmless for idempotency.
    const occurrenceChanged =
      stored.title !== record.title ||
      stored.description !== record.description ||
      stored.recordType !== record.recordType ||
      stored.occurredAt !== record.occurredAt ||
      stored.recordedAt !== record.recordedAt ||
      stored.actor !== record.actor ||
      JSON.stringify(stored.payload) !== JSON.stringify(record.payload) ||
      stored.createdAt !== record.createdAt;
    if (occurrenceChanged) {
      throw new Error(`Record ${record.id} occurrence facts are immutable`);
    }
    if (stored.archivedAt !== null && record.archivedAt !== stored.archivedAt) {
      throw new Error(`Record ${record.id} archive timestamp is immutable`);
    }
    if (stored.archivedAt === null && record.archivedAt === null) {
      throw new Error(`Record ${record.id} may only be saved to archive it`);
    }
    const row = toRow(record);
    const result = await this.db.runAsync(
      'UPDATE records SET updated_at = ?, archived_at = ? WHERE id = ?',
      [row.updated_at, row.archived_at, row.id],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Record ${record.id}`);
    }
  }
}
