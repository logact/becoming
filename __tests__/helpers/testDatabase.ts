import { NodeSqliteDatabase } from '../../src/persistence/sqlite/nodeSqliteDatabase';
import { migrate } from '../../src/persistence/migrate';
import type { SqliteDatabase } from '../../src/persistence/database';

/**
 * Test harness shared by every persistence test in M1.
 *
 * `createTestDatabase` returns a fully migrated, empty, in-memory SQLite
 * database that is completely isolated from every other test. Wave-gate
 * rule: tests never share a database file and never depend on execution
 * order.
 */
export async function createTestDatabase(): Promise<SqliteDatabase> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return db;
}

/** Names of all user tables in the database, sorted. */
export async function listTables(db: SqliteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

export async function closeQuietly(db: SqliteDatabase): Promise<void> {
  try {
    await db.closeAsync();
  } catch {
    // already closed
  }
}
