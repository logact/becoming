import type { EntityId, IsoTimestamp } from '../domain/ids';
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

/** A closed or open timestamp interval used to filter one Record time axis. */
export interface RecordTimeRange {
  /** Inclusive lower bound. Omit to select from the beginning of history. */
  start?: IsoTimestamp;
  /** Inclusive upper bound. Omit to select through the end of history. */
  end?: IsoTimestamp;
}

/** Explicit archive visibility and independently composable Record filters. */
export interface RecordListOptions {
  /** Active Records are the operational default; history callers name `all`. */
  status?: 'active' | 'archived' | 'all';
  /** Filter by when the occurrence happened, independently of entry time. */
  occurredAt?: RecordTimeRange;
  /** Filter by when the occurrence was recorded, independently of event time. */
  recordedAt?: RecordTimeRange;
  recordType?: string;
  /** Exact-match actor filter. `null` deliberately selects unattributed Records. */
  actor?: string | null;
  /** Offset pagination over the stable recordedAt, occurredAt, id order. */
  limit?: number;
  offset?: number;
}

/** Extended Record boundary consumed by history and record-query features. */
export interface RecordHistoryRepository extends RecordRepository {
  /**
   * List Records in total, stable `recordedAt ASC, occurredAt ASC, id ASC`
   * order. Event and entry ranges are independently composable; `all` is
   * intended for authorized history readers while ordinary views use active.
   */
  list(options?: RecordListOptions): Promise<Record[]>;
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

  async list(options: RecordListOptions = {}): Promise<Record[]> {
    assertRecordListOptions(options);
    const status = options.status ?? 'active';
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];
    if (status === 'active') conditions.push('archived_at IS NULL');
    if (status === 'archived') conditions.push('archived_at IS NOT NULL');
    appendRange(conditions, params, 'occurred_at', options.occurredAt);
    appendRange(conditions, params, 'recorded_at', options.recordedAt);
    if (options.recordType !== undefined) {
      conditions.push('record_type = ?');
      params.push(options.recordType);
    }
    if (options.actor !== undefined) {
      if (options.actor === null) {
        conditions.push('actor IS NULL');
      } else {
        conditions.push('actor = ?');
        params.push(options.actor);
      }
    }
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const rows = await this.db.getAllAsync<RecordRow>(
      `SELECT id, title, description, record_type, occurred_at, recorded_at,
              actor, payload, created_at, updated_at, archived_at
       FROM records ${where}
       ORDER BY recorded_at ASC, occurred_at ASC, id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
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

function appendRange(
  conditions: string[],
  params: (string | number | null)[],
  column: 'occurred_at' | 'recorded_at',
  range: RecordTimeRange | undefined,
): void {
  if (range?.start !== undefined) {
    conditions.push(`${column} >= ?`);
    params.push(range.start);
  }
  if (range?.end !== undefined) {
    conditions.push(`${column} <= ?`);
    params.push(range.end);
  }
}

function assertRecordListOptions(options: RecordListOptions): void {
  if (options.status !== undefined && !['active', 'archived', 'all'].includes(options.status)) {
    throw new Error('Record list status must be active, archived, or all');
  }
  assertRange('occurredAt', options.occurredAt);
  assertRange('recordedAt', options.recordedAt);
  if (options.recordType !== undefined && options.recordType.trim().length === 0) {
    throw new Error('Record list recordType must not be blank');
  }
  if (typeof options.actor === 'string' && options.actor.trim().length === 0) {
    throw new Error('Record list actor must not be blank when specified');
  }
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Record list limit must be a positive integer');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Record list offset must be a non-negative integer');
  }
}

function assertRange(name: string, range: RecordTimeRange | undefined): void {
  if (range === undefined) return;
  if (range.start !== undefined) assertTimestamp(`${name}.start`, range.start);
  if (range.end !== undefined) assertTimestamp(`${name}.end`, range.end);
  if (range.start !== undefined && range.end !== undefined && Date.parse(range.start) > Date.parse(range.end)) {
    throw new Error(`Record list ${name} start must not be after end`);
  }
}

function assertTimestamp(name: string, value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(`Record list ${name} must be a valid ISO 8601 timestamp`);
  }
}
