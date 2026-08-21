import { Record } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteRecordRepository } from '../SqliteRecordRepository';
import { SqliteRelationRepository } from '../SqliteRelationRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const t2 = new Date('2026-02-03T00:00:00Z');

async function makeRepos(): Promise<{
  records: SqliteRecordRepository;
  relations: SqliteRelationRepository;
}> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return {
    records: new SqliteRecordRepository(db),
    relations: new SqliteRelationRepository(db),
  };
}

const ids = (records: Record[]): string[] => records.map((record) => record.id);

describe('SqliteRecordRepository', () => {
  it('append then listRecent round-trips every field', async () => {
    const { records } = await makeRepos();
    await records.append(
      Record.create({ id: 'rec1', kind: 'goalCreated', detail: 'title: Ship', occurredAt: t0 }),
    );

    const loaded = await records.listRecent(10);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('rec1');
    expect(loaded[0].kind).toBe('goalCreated');
    expect(loaded[0].detail).toBe('title: Ship');
    expect(loaded[0].occurredAt).toEqual(t0);
  });

  it('a record without detail round-trips it as undefined', async () => {
    const { records } = await makeRepos();
    await records.append(Record.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }));

    const loaded = await records.listRecent(10);

    expect(loaded[0].detail).toBeUndefined();
  });

  it('append with a duplicate id fails on the primary key', async () => {
    const { records } = await makeRepos();
    await records.append(Record.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }));

    await expect(
      records.append(Record.create({ id: 'rec1', kind: 'goalRenamed', occurredAt: t1 })),
    ).rejects.toThrow();
  });

  it('listRecent returns newest first, breaking ties by id, capped at limit', async () => {
    const { records } = await makeRepos();
    await records.append(Record.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }));
    await records.append(Record.create({ id: 'rec2', kind: 'goalCreated', occurredAt: t1 }));
    await records.append(Record.create({ id: 'rec3', kind: 'goalCreated', occurredAt: t1 }));
    await records.append(Record.create({ id: 'rec4', kind: 'goalCreated', occurredAt: t2 }));

    expect(ids(await records.listRecent(10))).toEqual(['rec4', 'rec3', 'rec2', 'rec1']);
    expect(ids(await records.listRecent(2))).toEqual(['rec4', 'rec3']);
  });

  it('listByTarget returns records linked through relations, newest first', async () => {
    const { records, relations } = await makeRepos();
    await records.append(Record.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }));
    await records.append(Record.create({ id: 'rec2', kind: 'goalRenamed', occurredAt: t1 }));
    await records.append(Record.create({ id: 'rec3', kind: 'taskCreated', occurredAt: t2 }));
    await relations.save(
      Relation.create({
        id: 'rel1',
        sourceType: 'record',
        sourceId: 'rec1',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'about',
        now: t0,
      }),
    );
    await relations.save(
      Relation.create({
        id: 'rel2',
        sourceType: 'record',
        sourceId: 'rec2',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'about',
        now: t0,
      }),
    );
    await relations.save(
      Relation.create({
        id: 'rel3',
        sourceType: 'record',
        sourceId: 'rec3',
        targetType: 'task',
        targetId: 't1',
        kind: 'about',
        now: t0,
      }),
    );

    expect(ids(await records.listByTarget('goal', 10, 'g1'))).toEqual(['rec2', 'rec1']);
    expect(ids(await records.listByTarget('task', 10, 't1'))).toEqual(['rec3']);
    expect(await records.listByTarget('goal', 10, 'g2')).toEqual([]);
  });

  it('listByTarget returns a record linked as the relation target end', async () => {
    const { records, relations } = await makeRepos();
    await records.append(Record.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }));
    await relations.save(
      Relation.create({
        id: 'rel1',
        sourceType: 'goal',
        sourceId: 'g1',
        targetType: 'record',
        targetId: 'rec1',
        kind: 'about',
        now: t0,
      }),
    );

    expect(ids(await records.listByTarget('goal', 10, 'g1'))).toEqual(['rec1']);
  });

  it('listByTarget returns a record linked in both directions only once', async () => {
    const { records, relations } = await makeRepos();
    await records.append(Record.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }));
    await relations.save(
      Relation.create({
        id: 'rel1',
        sourceType: 'record',
        sourceId: 'rec1',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'about',
        now: t0,
      }),
    );
    await relations.save(
      Relation.create({
        id: 'rel2',
        sourceType: 'goal',
        sourceId: 'g1',
        targetType: 'record',
        targetId: 'rec1',
        kind: 'about',
        now: t0,
      }),
    );

    expect(ids(await records.listByTarget('goal', 10, 'g1'))).toEqual(['rec1']);
  });

  it('listByTarget does not return records linked to other entities', async () => {
    const { records, relations } = await makeRepos();
    await records.append(Record.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }));
    await records.append(Record.create({ id: 'rec2', kind: 'goalRenamed', occurredAt: t1 }));
    await relations.save(
      Relation.create({
        id: 'rel1',
        sourceType: 'goal',
        sourceId: 'g2',
        targetType: 'record',
        targetId: 'rec2',
        kind: 'about',
        now: t0,
      }),
    );
    await relations.save(
      Relation.create({
        id: 'rel2',
        sourceType: 'record',
        sourceId: 'rec1',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'about',
        now: t0,
      }),
    );

    expect(ids(await records.listByTarget('goal', 10, 'g1'))).toEqual(['rec1']);
  });
});
