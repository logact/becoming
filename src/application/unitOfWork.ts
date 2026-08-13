/**
 * The application-level unit-of-work port: one atomic boundary for a set of
 * related writes.
 *
 * `run` executes `work` inside a single transaction: if `work` throws, every
 * write it performed is rolled back; otherwise the transaction commits. The
 * transaction context handed to `work` is chosen by the adapter — the SQLite
 * adapter (`sqliteUnitOfWork` in `src/persistence/transactions.ts`) uses the
 * `SqliteDatabase` port — so this interface assumes no database library, ORM,
 * or web framework.
 *
 * Not re-entrant: `work` must not start another unit of work over the same
 * underlying connection. Compose larger units of work by passing the context
 * to helpers instead.
 */
export interface UnitOfWork<TContext> {
  run<T>(work: (context: TContext) => Promise<T>): Promise<T>;
}
