import { Relation } from '../../../domain/relation/Relation';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteRelationRepository } from '../SqliteRelationRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');

async function makeRepo(): Promise<SqliteRelationRepository> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return new SqliteRelationRepository(db);
}

function makeRelation(): Relation {
  return Relation.create({
    id: 'rel1',
    sourceType: 'task',
    sourceId: 't1',
    targetType: 'idea',
    targetId: 'i1',
    kind: 'derivedFrom',
    detail: 'Captured during the weekly review',
    now: t0,
  });
}

const ids = (relations: Relation[]): string[] =>
  relations.map((relation) => relation.id).sort();

describe('SqliteRelationRepository', () => {
  it('save then findById round-trips every field', async () => {
    const repo = await makeRepo();

    await repo.save(makeRelation());
    const loaded = await repo.findById('rel1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('rel1');
    expect(loaded!.sourceType).toBe('task');
    expect(loaded!.sourceId).toBe('t1');
    expect(loaded!.targetType).toBe('idea');
    expect(loaded!.targetId).toBe('i1');
    expect(loaded!.kind).toBe('derivedFrom');
    expect(loaded!.detail).toBe('Captured during the weekly review');
    expect(loaded!.createdAt).toEqual(t0);
  });

  it('a relation without detail round-trips it as undefined', async () => {
    const repo = await makeRepo();
    await repo.save(
      Relation.create({
        id: 'rel1',
        sourceType: 'goal',
        sourceId: 'g1',
        targetType: 'goal',
        targetId: 'g2',
        kind: 'dependsOn',
        now: t0,
      }),
    );

    const loaded = await repo.findById('rel1');

    expect(loaded!.detail).toBeUndefined();
  });

  it('findById returns null for an unknown id', async () => {
    const repo = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts an existing relation', async () => {
    const repo = await makeRepo();
    await repo.save(makeRelation());
    await repo.save(
      Relation.restore({
        id: 'rel1',
        sourceType: 'task',
        sourceId: 't1',
        targetType: 'idea',
        targetId: 'i1',
        kind: 'relatesTo',
        createdAt: t1,
      }),
    );

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('rel1');
    expect(loaded!.kind).toBe('relatesTo');
    expect(loaded!.detail).toBeUndefined();
    expect(loaded!.createdAt).toEqual(t1);
  });

  it('list filters by sourceType, sourceId, targetType, targetId, and kind', async () => {
    const repo = await makeRepo();
    await repo.save(makeRelation());
    await repo.save(
      Relation.create({
        id: 'rel2',
        sourceType: 'task',
        sourceId: 't2',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'implements',
        now: t0,
      }),
    );

    expect(ids(await repo.list())).toEqual(['rel1', 'rel2']);
    expect(ids(await repo.list({ sourceType: 'task' }))).toEqual(['rel1', 'rel2']);
    expect(ids(await repo.list({ sourceId: 't1' }))).toEqual(['rel1']);
    expect(ids(await repo.list({ targetType: 'goal' }))).toEqual(['rel2']);
    expect(ids(await repo.list({ targetId: 'i1' }))).toEqual(['rel1']);
    expect(ids(await repo.list({ kind: 'implements' }))).toEqual(['rel2']);
    expect(ids(await repo.list({ sourceType: 'task', targetType: 'idea' }))).toEqual(['rel1']);
  });

  it('delete removes the relation', async () => {
    const repo = await makeRepo();
    await repo.save(makeRelation());

    await repo.delete('rel1');

    expect(await repo.findById('rel1')).toBeNull();
  });
});
