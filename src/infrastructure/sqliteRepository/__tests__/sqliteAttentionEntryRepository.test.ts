import { AttentionEntry } from '../../../domain/attention/AttentionEntry';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteAttentionEntryRepository } from '../SqliteAttentionEntryRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');

async function makeRepo(): Promise<SqliteAttentionEntryRepository> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return new SqliteAttentionEntryRepository(db);
}

function makeEntry(): AttentionEntry {
  return AttentionEntry.create({
    id: 'a1',
    targetType: 'goal',
    targetId: 'g1',
    kind: 'pin',
    now: t0,
  });
}

const ids = (entries: AttentionEntry[]): string[] =>
  entries.map((entry) => entry.id).sort();

describe('SqliteAttentionEntryRepository', () => {
  it('save then findById round-trips every field', async () => {
    const repo = await makeRepo();

    await repo.save(makeEntry());
    const loaded = await repo.findById('a1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('a1');
    expect(loaded!.targetType).toBe('goal');
    expect(loaded!.targetId).toBe('g1');
    expect(loaded!.kind).toBe('pin');
    expect(loaded!.createdAt).toEqual(t0);
  });

  it('findById returns null for an unknown id', async () => {
    const repo = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts an existing entry', async () => {
    const repo = await makeRepo();
    await repo.save(makeEntry());
    await repo.save(
      AttentionEntry.restore({
        id: 'a1',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'dismiss',
        createdAt: t1,
      }),
    );

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('a1');
    expect(loaded!.kind).toBe('dismiss');
    expect(loaded!.createdAt).toEqual(t1);
  });

  it('list filters by kind, targetType, and targetId', async () => {
    const repo = await makeRepo();
    await repo.save(makeEntry());
    await repo.save(
      AttentionEntry.create({ id: 'a2', targetType: 'task', targetId: 't1', kind: 'pin', now: t0 }),
    );
    await repo.save(
      AttentionEntry.create({
        id: 'a3',
        targetType: 'goal',
        targetId: 'g2',
        kind: 'dismiss',
        now: t0,
      }),
    );

    expect(ids(await repo.list())).toEqual(['a1', 'a2', 'a3']);
    expect(ids(await repo.list({ kind: 'pin' }))).toEqual(['a1', 'a2']);
    expect(ids(await repo.list({ targetType: 'goal' }))).toEqual(['a1', 'a3']);
    expect(ids(await repo.list({ targetId: 'g2' }))).toEqual(['a3']);
    expect(ids(await repo.list({ kind: 'pin', targetType: 'goal' }))).toEqual(['a1']);
  });

  it('delete removes the entry', async () => {
    const repo = await makeRepo();
    await repo.save(makeEntry());

    await repo.delete('a1');

    expect(await repo.findById('a1')).toBeNull();
  });
});
