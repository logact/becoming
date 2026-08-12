import { createTestDatabase, listTables } from './helpers/testDatabase';

/**
 * Wave-1 exit gate: the "no database foreign keys, no entities table" rule
 * must be executable, not just documented.
 */
describe('schema integrity rules', () => {
  it('has no shared entities table', async () => {
    const db = await createTestDatabase();
    expect(await listTables(db)).not.toContain('entities');
    await db.closeAsync();
  });

  it('declares no FOREIGN KEY or REFERENCES clause in any table DDL', async () => {
    const db = await createTestDatabase();
    const ddl = await db.getAllAsync<{ name: string; sql: string }>(
      `SELECT name, sql FROM sqlite_master WHERE type = 'table'`,
    );
    expect(ddl.length).toBeGreaterThan(0);
    for (const { name, sql } of ddl) {
      expect(sql.toUpperCase()).not.toMatch(/FOREIGN\s+KEY/);
      expect(sql.toUpperCase()).not.toMatch(/REFERENCES/);
      expect(name).not.toBe('entities');
    }
    await db.closeAsync();
  });

  it('has an empty foreign_key_list for every table', async () => {
    const db = await createTestDatabase();
    for (const table of await listTables(db)) {
      const fks = await db.getAllAsync(`PRAGMA foreign_key_list(${table})`);
      expect(fks).toEqual([]);
    }
    await db.closeAsync();
  });

  it('keeps the eight core concepts in independent tables', async () => {
    const db = await createTestDatabase();
    const tables = await listTables(db);
    for (const core of [
      'tasks',
      'goals',
      'projects',
      'ideas',
      'philosophies',
      'workflows',
      'resources',
      'records',
    ]) {
      expect(tables).toContain(core);
    }
    await db.closeAsync();
  });
});
