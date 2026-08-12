import type { SqliteDatabase } from './database';

/**
 * Run `fn` inside a single SQLite transaction. If `fn` throws, every write it
 * performed is rolled back; otherwise the transaction commits. This is the
 * only sanctioned way to group a mutation with its provenance/history writes
 * so they commit atomically.
 *
 * Not re-entrant: `fn` must not start another `withTransaction` on the same
 * database. Compose larger units of work by passing the same `db` handle to
 * helpers instead.
 */
export async function withTransaction<T>(
  db: SqliteDatabase,
  fn: (db: SqliteDatabase) => Promise<T>,
): Promise<T> {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const result = await fn(db);
    await db.execAsync('COMMIT');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}
