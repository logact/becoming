import type { SqliteDatabase } from './database';
import { withTransaction } from './transactions';
import { MIGRATIONS } from './migrations';
import { nowIso } from '../domain/ids';

/**
 * Apply every pending migration in version order. Safe to run repeatedly:
 * already-applied versions are skipped. Each migration runs inside its own
 * transaction, so a failing migration rolls back cleanly and leaves the
 * database at the last good version.
 */
export async function migrate(db: SqliteDatabase): Promise<number[]> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations',
  );
  const applied = new Set(appliedRows.map((row) => row.version));

  const newlyApplied: number[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }
    await withTransaction(db, async (tx) => {
      await migration.up(tx);
      await tx.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, nowIso()],
      );
    });
    newlyApplied.push(migration.version);
  }
  return newlyApplied;
}
