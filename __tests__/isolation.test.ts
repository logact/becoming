import { createTestDatabase } from './helpers/testDatabase';

describe('test database isolation', () => {
  it('gives every test database its own empty schema and data', async () => {
    const first = await createTestDatabase();
    const second = await createTestDatabase();

    await first.runAsync(
      `INSERT INTO goals (id, title, target_state, created_at, updated_at)
       VALUES ('g-1', 'Ship V1', 'V1 shipped',
               '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z')`,
    );

    const inFirst = await first.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM goals',
    );
    const inSecond = await second.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM goals',
    );

    expect(inFirst?.n).toBe(1);
    expect(inSecond?.n).toBe(0);

    await first.closeAsync();
    await second.closeAsync();
  });
});
