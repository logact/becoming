import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { SqliteTransactionRunner } from '../SqliteTransactionRunner';

interface TestRow {
  value: string;
}

async function makeRunner(): Promise<{
  db: NodeSqliteDatabase;
  runner: SqliteTransactionRunner;
}> {
  const db = new NodeSqliteDatabase(':memory:');
  await db.exec('CREATE TABLE transaction_test (value TEXT NOT NULL)');
  return { db, runner: new SqliteTransactionRunner(db) };
}

describe('SqliteTransactionRunner', () => {
  it('commits all work and returns its result', async () => {
    const { db, runner } = await makeRunner();

    const result = await runner.run(async () => {
      await db.run('INSERT INTO transaction_test (value) VALUES (?)', ['first']);
      await db.run('INSERT INTO transaction_test (value) VALUES (?)', ['second']);
      return 'committed';
    });

    expect(result).toBe('committed');
    expect(await db.all<TestRow>('SELECT value FROM transaction_test ORDER BY rowid'))
      .toEqual([{ value: 'first' }, { value: 'second' }]);
  });

  it('rolls back every write and rethrows the original error', async () => {
    const { db, runner } = await makeRunner();
    const failure = new Error('stop in the middle');

    const transaction = runner.run(async () => {
      await db.run('INSERT INTO transaction_test (value) VALUES (?)', ['partial']);
      throw failure;
    });

    await expect(transaction).rejects.toBe(failure);
    expect(await db.all<TestRow>('SELECT value FROM transaction_test')).toEqual([]);
  });
});
