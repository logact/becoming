/**
 * Persistence port for the V1 domain.
 *
 * The domain and application layers depend only on this interface, never on
 * expo-sqlite or Node directly. The production adapter wraps expo-sqlite
 * (on-device SQLite); the test adapter wraps node:sqlite. Both expose the
 * same async surface, which mirrors a subset of the expo-sqlite async API.
 *
 * Column encoding rules shared by every adapter and migration:
 * - UUID ids        -> TEXT
 * - DATETIME        -> TEXT, ISO 8601 UTC (e.g. 2026-08-12T11:39:02.314Z)
 * - DECIMAL         -> TEXT, canonical Decimal string (exact, no float)
 * - JSON            -> TEXT, JSON.stringify output
 * - BOOLEAN         -> INTEGER 0/1 with CHECK constraints
 * - No database foreign keys and no `entities` table, ever.
 */
/**
 * Bindable parameter values. Exact quantities are always bound as canonical
 * Decimal strings, never as numbers, so `number` here is only for genuine
 * integers (versions, priorities, sort orders, booleans).
 */
export type SqliteValue = string | number | null;

export interface SqliteRunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqliteDatabase {
  /** Execute one or more semicolon-separated statements without parameters. */
  execAsync(sql: string): Promise<void>;

  /** Execute a single parameterized statement (INSERT/UPDATE/DELETE). */
  runAsync(sql: string, params?: SqliteValue[]): Promise<SqliteRunResult>;

  /** Execute a query and return all rows. */
  getAllAsync<Row>(sql: string, params?: SqliteValue[]): Promise<Row[]>;

  /** Execute a query and return the first row, or null. */
  getFirstAsync<Row>(
    sql: string,
    params?: SqliteValue[],
  ): Promise<Row | null>;

  closeAsync(): Promise<void>;
}
