import { DatabaseSync } from 'node:sqlite';

import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

/**
 * Test-only adapter: wraps node's synchronous sqlite behind the async
 * SqliteDatabase interface so repositories can run in plain jest tests.
 * Never imported from app composition.
 */
export class NodeSqliteDatabase implements SqliteDatabase {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as unknown as T[];
  }

  async first<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...params);
    return row === undefined ? null : (row as unknown as T);
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await work();
      this.db.exec('COMMIT');
      return result;
    } catch (cause: unknown) {
      this.db.exec('ROLLBACK');
      throw cause;
    }
  }
}
