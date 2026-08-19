import { Milestone } from '../../../domain/milestone/Milestone';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteMilestoneRepository } from '../SqliteMilestoneRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const date = new Date('2026-03-01T00:00:00Z');
const newDate = new Date('2026-03-15T00:00:00Z');

async function makeRepo(): Promise<{ repo: SqliteMilestoneRepository; db: NodeSqliteDatabase }> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return { repo: new SqliteMilestoneRepository(db), db };
}

const ids = (milestones: Milestone[]): string[] =>
  milestones.map((milestone) => milestone.id).sort();

describe('SqliteMilestoneRepository', () => {
  it('save then findById round-trips every field', async () => {
    const { repo } = await makeRepo();

    await repo.save(
      Milestone.create({ id: 'm1', title: 'Beta launch', date, projectId: 'p1', now: t0 }),
    );
    const loaded = await repo.findById('m1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('m1');
    expect(loaded!.projectId).toBe('p1');
    expect(loaded!.title).toBe('Beta launch');
    expect(loaded!.date).toEqual(date);
    expect(loaded!.createdAt).toEqual(t0);
    expect(loaded!.updatedAt).toEqual(t0);
  });

  it('findById returns null for an unknown id', async () => {
    const { repo } = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts: rename and reschedule are persisted', async () => {
    const { repo } = await makeRepo();
    const milestone = Milestone.create({
      id: 'm1',
      title: 'Beta launch',
      date,
      projectId: 'p1',
      now: t0,
    });
    await repo.save(milestone);

    milestone.rename('Public launch', t1);
    milestone.reschedule(newDate, t1);
    await repo.save(milestone);

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('m1');
    expect(loaded!.title).toBe('Public launch');
    expect(loaded!.date).toEqual(newDate);
    expect(loaded!.createdAt).toEqual(t0);
    expect(loaded!.updatedAt).toEqual(t1);
  });

  it('list filters by projectId', async () => {
    const { repo } = await makeRepo();
    await repo.save(Milestone.create({ id: 'm1', title: 'A', date, projectId: 'p1', now: t0 }));
    await repo.save(Milestone.create({ id: 'm2', title: 'B', date, projectId: 'p2', now: t0 }));
    await repo.save(Milestone.create({ id: 'm3', title: 'C', date, projectId: 'p1', now: t0 }));

    expect(ids(await repo.list())).toEqual(['m1', 'm2', 'm3']);
    expect(ids(await repo.list({ projectId: 'p1' }))).toEqual(['m1', 'm3']);
    expect(ids(await repo.list({ projectId: 'p2' }))).toEqual(['m2']);
  });

  it('delete removes the milestone', async () => {
    const { repo } = await makeRepo();
    await repo.save(Milestone.create({ id: 'm1', title: 'A', date, projectId: 'p1', now: t0 }));

    await repo.delete('m1');

    expect(await repo.findById('m1')).toBeNull();
    expect(await repo.list()).toEqual([]);
  });
});
