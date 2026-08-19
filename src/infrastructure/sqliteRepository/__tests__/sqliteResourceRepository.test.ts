import { Resource } from '../../../domain/resource/Resource';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteResourceRepository } from '../SqliteResourceRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const t2 = new Date('2026-02-03T00:00:00Z');
const spanStart = new Date('2026-02-10T09:30:00Z');
const spanEnd = new Date('2026-02-10T11:00:00Z');

async function makeRepo(): Promise<{ repo: SqliteResourceRepository; db: NodeSqliteDatabase }> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return { repo: new SqliteResourceRepository(db), db };
}

function makeTimeResource(): Resource {
  const resource = Resource.create({
    id: 'r1',
    typeId: 'focus-time',
    kind: 'time',
    name: 'weekly focus time',
    amount: 600,
    now: t0,
  });
  resource.allocate(
    { id: 'a1', projectId: 'p1', span: { startAt: spanStart, endAt: spanEnd } },
    t1,
  );
  resource.addLabel('l1');
  return resource;
}

function makeQuantityResource(): Resource {
  const resource = Resource.create({
    id: 'r2',
    typeId: 'budget',
    kind: 'quantity',
    name: 'monthly budget',
    amount: 1000,
    now: t0,
  });
  resource.allocate({ id: 'a2', projectId: 'p2', amount: 250 }, t1);
  return resource;
}

const ids = (resources: Resource[]): string[] =>
  resources.map((resource) => resource.id).sort();

describe('SqliteResourceRepository', () => {
  it('save then findById round-trips every field including a time-span allocation', async () => {
    const { repo } = await makeRepo();

    await repo.save(makeTimeResource());
    const loaded = await repo.findById('r1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('r1');
    expect(loaded!.typeId).toBe('focus-time');
    expect(loaded!.kind).toBe('time');
    expect(loaded!.name).toBe('weekly focus time');
    expect(loaded!.amount).toBe(600);
    expect(loaded!.archived).toBe(false);
    expect(loaded!.labelIds).toEqual(['l1']);
    expect(loaded!.createdAt).toEqual(t0);
    expect(loaded!.updatedAt).toEqual(t1);
    expect(loaded!.allocations).toHaveLength(1);
    const allocation = loaded!.allocations[0];
    expect(allocation.id).toBe('a1');
    expect(allocation.projectId).toBe('p1');
    expect(allocation.amount).toBe(90);
    expect(allocation.span).toEqual({ startAt: spanStart, endAt: spanEnd });
    expect(allocation.createdAt).toEqual(t1);
    expect(allocation.updatedAt).toEqual(t1);
  });

  it('a quantity allocation round-trips with an undefined span', async () => {
    const { repo } = await makeRepo();

    await repo.save(makeQuantityResource());
    const loaded = await repo.findById('r2');

    expect(loaded!.allocations).toHaveLength(1);
    const allocation = loaded!.allocations[0];
    expect(allocation.id).toBe('a2');
    expect(allocation.projectId).toBe('p2');
    expect(allocation.amount).toBe(250);
    expect(allocation.span).toBeUndefined();
  });

  it('findById returns null for an unknown id', async () => {
    const { repo } = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts: allocations and labels are replaced', async () => {
    const { repo, db } = await makeRepo();
    const resource = makeTimeResource();
    await repo.save(resource);

    resource.releaseAllocation('a1', t2);
    resource.removeLabel('l1');
    await repo.save(resource);

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('r1');
    expect(loaded!.allocations).toEqual([]);
    expect(loaded!.labelIds).toEqual([]);
    expect(loaded!.updatedAt).toEqual(t2);
    const allocationRows = await db.all(
      "SELECT * FROM resource_allocations WHERE resource_id = 'r1'",
    );
    expect(allocationRows).toHaveLength(0);
  });

  it('list filters by typeId, kind, archived, labelId, and projectId', async () => {
    const { repo } = await makeRepo();
    await repo.save(makeTimeResource());
    await repo.save(makeQuantityResource());
    const r3 = Resource.create({
      id: 'r3',
      typeId: 'focus-time',
      kind: 'time',
      name: 'archived time',
      amount: 100,
      now: t0,
    });
    r3.archive(t1);
    await repo.save(r3);

    expect(ids(await repo.list())).toEqual(['r1', 'r2', 'r3']);
    expect(ids(await repo.list({ typeId: 'focus-time' }))).toEqual(['r1', 'r3']);
    expect(ids(await repo.list({ kind: 'quantity' }))).toEqual(['r2']);
    expect(ids(await repo.list({ archived: true }))).toEqual(['r3']);
    expect(ids(await repo.list({ labelId: 'l1' }))).toEqual(['r1']);
    expect(ids(await repo.list({ projectId: 'p1' }))).toEqual(['r1']);
    expect(ids(await repo.list({ projectId: 'p2' }))).toEqual(['r2']);
  });

  it('delete removes the resource, its allocations, and its label rows', async () => {
    const { repo, db } = await makeRepo();
    await repo.save(makeTimeResource());

    await repo.delete('r1');

    expect(await repo.findById('r1')).toBeNull();
    const allocationRows = await db.all(
      "SELECT * FROM resource_allocations WHERE resource_id = 'r1'",
    );
    expect(allocationRows).toHaveLength(0);
    const labelRows = await db.all(
      "SELECT * FROM entity_labels WHERE entity_type = 'resource' AND entity_id = 'r1'",
    );
    expect(labelRows).toHaveLength(0);
  });
});
