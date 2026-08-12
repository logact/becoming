import { DatabaseSync } from 'node:sqlite';

import type {
  SqliteDatabase,
  SqliteRunResult,
  SqliteValue,
} from '../database';

/**
 * Test/CI adapter: implements the SqliteDatabase port over Node's built-in
 * SQLite driver. It executes the exact same migrations, transactions, and SQL
 * as the production expo-sqlite adapter, so repository contract tests run the
 * real engine without a device or emulator.
 *
 * App code must never import this module; it exists for Jest (Node) only.
 */
export class NodeSqliteDatabase implements SqliteDatabase {
  private readonly db: DatabaseSync;

  constructor(location = ':memory:') {
    this.db = new DatabaseSync(location);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(
    sql: string,
    params: SqliteValue[] = [],
  ): Promise<SqliteRunResult> {
    const result = this.db.prepare(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getAllAsync<Row>(sql: string, params: SqliteValue[] = []): Promise<Row[]> {
    return this.db.prepare(sql).all(...params) as Row[];
  }

  async getFirstAsync<Row>(
    sql: string,
    params: SqliteValue[] = [],
  ): Promise<Row | null> {
    const row = this.db.prepare(sql).get(...params);
    return (row ?? null) as Row | null;
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}
