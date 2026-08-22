/** A value that can be bound to a SQL parameter: text, number, or NULL. */
export type SqlValue = string | number | null;

/**
 * Minimal async SQLite driver used by the repositories. Two implementations
 * exist: ExpoSqliteDatabase (expo-sqlite, used by the app) and
 * NodeSqliteDatabase (node:sqlite, used by tests).
 */
export interface SqliteDatabase {
  /** Executes one or more statements without parameters (DDL, PRAGMA). */
  exec(sql: string): Promise<void>;
  /** Runs a statement with bound parameters, ignoring any result rows. */
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** Runs a query and returns all rows. */
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Runs a query and returns the first row, or null when there is none. */
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Runs all work on this connection in one commit/rollback boundary. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
