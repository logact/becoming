import * as SQLite from 'expo-sqlite';

import type { SqliteDatabase } from '../database';

/**
 * Production adapter: opens the on-device application database through
 * expo-sqlite. The returned object already satisfies the SqliteDatabase port,
 * so no wrapping is needed.
 *
 * This module is the only place the domain depends on expo-sqlite, and it is
 * only imported by app composition code — never by domain logic or tests.
 */
export async function openAppDatabase(
  name = 'becoming.db',
): Promise<SqliteDatabase> {
  return SQLite.openDatabaseAsync(name);
}
