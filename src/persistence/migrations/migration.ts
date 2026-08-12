import type { SqliteDatabase } from '../database';

/**
 * A single, ordered, append-only schema migration. Migrations are immutable
 * once shipped: a new change is always a new migration with the next version.
 */
export interface Migration {
  version: number;
  name: string;
  up(db: SqliteDatabase): Promise<void>;
}
