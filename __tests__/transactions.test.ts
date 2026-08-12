import { createTestDatabase } from './helpers/testDatabase';
import { withTransaction } from '../src/persistence/transactions';

const INSERT_PROJECT = `INSERT INTO projects (id, title, created_at, updated_at)
  VALUES (?, ?, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z')`;

async function projectCount(db: {
  getFirstAsync<R>(sql: string): Promise<R | null>;
}): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM projects',
  );
  return row?.n ?? -1;
}

describe('withTransaction', () => {
  it('commits all writes when the unit of work succeeds', async () => {
    const db = await createTestDatabase();

    await withTransaction(db, async (tx) => {
      await tx.runAsync(INSERT_PROJECT, ['p-1', 'One']);
      await tx.runAsync(INSERT_PROJECT, ['p-2', 'Two']);
    });

    expect(await projectCount(db)).toBe(2);
    await db.closeAsync();
  });

  it('rolls back every write when the unit of work fails', async () => {
    const db = await createTestDatabase();

    await expect(
      withTransaction(db, async (tx) => {
        await tx.runAsync(INSERT_PROJECT, ['p-1', 'One']);
        await tx.runAsync(INSERT_PROJECT, ['p-2', 'Two']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await projectCount(db)).toBe(0);
    await db.closeAsync();
  });

  it('rolls back on a constraint violation mid-transaction', async () => {
    const db = await createTestDatabase();

    await expect(
      withTransaction(db, async (tx) => {
        await tx.runAsync(INSERT_PROJECT, ['p-1', 'One']);
        // Duplicate primary key forces SQLite to abort the statement.
        await tx.runAsync(INSERT_PROJECT, ['p-1', 'Duplicate']);
      }),
    ).rejects.toThrow();

    expect(await projectCount(db)).toBe(0);
    await db.closeAsync();
  });

  it('leaves the database usable for the next transaction after a rollback', async () => {
    const db = await createTestDatabase();

    await expect(
      withTransaction(db, async () => {
        throw new Error('first attempt fails');
      }),
    ).rejects.toThrow('first attempt fails');

    await withTransaction(db, async (tx) => {
      await tx.runAsync(INSERT_PROJECT, ['p-9', 'Recovered']);
    });

    expect(await projectCount(db)).toBe(1);
    await db.closeAsync();
  });
});
