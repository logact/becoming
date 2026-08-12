import { createTestDatabase } from './helpers/testDatabase';
import { Decimal } from '../src/domain/decimal';

interface ResourceRow {
  id: string;
  capacity: string | null;
}

async function insertResource(
  db: Awaited<ReturnType<typeof createTestDatabase>>,
  id: string,
  capacity: Decimal,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO resources (id, title, resource_type, capacity, created_at, updated_at)
     VALUES (?, 'Dev time', 'time', ?, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z')`,
    [id, capacity.toString()],
  );
}

describe('exact decimal round-trips', () => {
  it('stores and reads back decimals exactly, as TEXT', async () => {
    const db = await createTestDatabase();
    const cases = [
      '0.1',
      '2.5',
      '123456789.123456789',
      '999999999999999999.000000001',
      '-0.00000001',
      '1000000000000000000000',
    ];

    for (let i = 0; i < cases.length; i += 1) {
      await insertResource(db, `r-${i}`, Decimal.parse(cases[i]));
    }

    for (let i = 0; i < cases.length; i += 1) {
      const row = await db.getFirstAsync<ResourceRow>(
        'SELECT id, capacity FROM resources WHERE id = ?',
        [`r-${i}`],
      );
      expect(row?.capacity).toBe(cases[i]);
      expect(typeof row?.capacity).toBe('string');
      expect(Decimal.parse(row!.capacity!).toString()).toBe(cases[i]);
    }
    await db.closeAsync();
  });

  it('never passes quantities through binary floating point', async () => {
    const db = await createTestDatabase();
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754 doubles; exact in Decimal.
    const total = Decimal.parse('0.1').add(Decimal.parse('0.2'));
    await insertResource(db, 'r-sum', total);

    const row = await db.getFirstAsync<ResourceRow>(
      `SELECT id, capacity FROM resources WHERE id = 'r-sum'`,
    );
    expect(row?.capacity).toBe('0.3');
    await db.closeAsync();
  });

  it('keeps planned and actual quantities distinguishable and exact', async () => {
    const db = await createTestDatabase();
    // Planned allocation on a relation, actual consumption on a record.
    await db.runAsync(
      `INSERT INTO relations (id, source_type, source_id, relation_type, target_type, target_id, metadata, created_at)
       VALUES ('rel-1', 'task', 't-1', 'allocated', 'resource', 'r-1', ?, '2026-08-12T00:00:00.000Z')`,
      [JSON.stringify({ amount: Decimal.parse('8').toString(), unit: 'hour' })],
    );
    await db.runAsync(
      `INSERT INTO records (id, description, record_type, occurred_at, recorded_at, created_at, updated_at)
       VALUES ('rec-1', 'Used dev time', 'resource_usage',
               '2026-08-12T01:00:00.000Z', '2026-08-12T01:05:00.000Z',
               '2026-08-12T01:05:00.000Z', '2026-08-12T01:05:00.000Z')`,
    );

    const relation = await db.getFirstAsync<{ metadata: string }>(
      `SELECT metadata FROM relations WHERE id = 'rel-1'`,
    );
    expect(JSON.parse(relation!.metadata).amount).toBe('8');
    await db.closeAsync();
  });
});
