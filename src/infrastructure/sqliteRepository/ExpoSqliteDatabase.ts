import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

/** SqliteDatabase backed by expo-sqlite; used by the app on device. */
export class ExpoSqliteDatabase implements SqliteDatabase {
  constructor(private readonly db: SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    await this.db.runAsync(sql, params);
  }

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params);
  }

  async first<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, params);
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    let result!: T;
    await this.db.withTransactionAsync(async () => {
      result = await work();
    });
    return result;
  }
}

/**
 * Opens (creating when missing) the named database in the app's private
 * documents directory.
 */
export async function openExpoDatabase(name: string): Promise<ExpoSqliteDatabase> {
  return new ExpoSqliteDatabase(await openDatabaseAsync(name));
}
