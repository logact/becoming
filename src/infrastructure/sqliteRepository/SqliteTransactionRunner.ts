import type { TransactionRunner } from '../../application/shared/TransactionRunner';
import type { SqliteDatabase } from './SqliteDatabase';

/** TransactionRunner backed by the same SQLite connection as repositories. */
export class SqliteTransactionRunner implements TransactionRunner {
  constructor(private readonly db: SqliteDatabase) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
