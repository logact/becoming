import { Goal } from '../../../domain/goal/Goal';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteGoalRepository } from '../SqliteGoalRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const t2 = new Date('2026-02-03T00:00:00Z');
const t3 = new Date('2026-02-04T00:00:00Z');
const due = new Date('2026-03-01T00:00:00Z');

async function makeRepo(): Promise<{ repo: SqliteGoalRepository; db: NodeSqliteDatabase }> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return { repo: new SqliteGoalRepository(db), db };
}

function makeGoal(): Goal {
  const goal = Goal.create({
    id: 'g1',
    title: 'Ship the app',
    description: 'Get v1 into the store',
    due,
    milestoneId: 'm1',
    now: t0,
  });
  goal.addLabel('l1');
  goal.addLabel('l2');
  goal.start(t1);
  goal.archive(t2);
  return goal;
}

const ids = (goals: Goal[]): string[] => goals.map((goal) => goal.id).sort();

describe('SqliteGoalRepository', () => {
  it('migrate is idempotent', async () => {
    const { db } = await makeRepo();

    await migrate(db);

    await db.run('INSERT INTO goals (id, title, status, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
      'g9',
      'x',
      'todo',
      0,
      1,
      1,
    ]);
    const row = await db.first<{ id: string }>('SELECT id FROM goals WHERE id = ?', ['g9']);
    expect(row?.id).toBe('g9');
  });

  it('save then findById round-trips every field', async () => {
    const { repo } = await makeRepo();

    await repo.save(makeGoal());
    const loaded = await repo.findById('g1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('g1');
    expect(loaded!.title).toBe('Ship the app');
    expect(loaded!.description).toBe('Get v1 into the store');
    expect(loaded!.due).toEqual(due);
    expect(loaded!.status).toBe('doing');
    expect(loaded!.archived).toBe(true);
    expect(loaded!.labelIds).toEqual(['l1', 'l2']);
    expect(loaded!.milestoneId).toBe('m1');
    expect(loaded!.createdAt).toEqual(t0);
    expect(loaded!.updatedAt).toEqual(t2);
  });

  it('findById returns null for an unknown id', async () => {
    const { repo } = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts: fields and labels are replaced', async () => {
    const { repo } = await makeRepo();
    const goal = makeGoal();
    await repo.save(goal);

    goal.complete(t3);
    goal.removeLabel('l1');
    await repo.save(goal);

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('g1');
    expect(loaded!.status).toBe('done');
    expect(loaded!.labelIds).toEqual(['l2']);
    expect(loaded!.updatedAt).toEqual(t3);
  });

  it('list without filter returns all goals', async () => {
    const { repo } = await makeRepo();
    await repo.save(makeGoal());
    await repo.save(Goal.create({ id: 'g2', title: 'B', now: t0 }));

    expect(ids(await repo.list())).toEqual(['g1', 'g2']);
  });

  it('list filters by status, archived, and labelId', async () => {
    const { repo } = await makeRepo();
    const g1 = Goal.create({ id: 'g1', title: 'A', now: t0 });
    g1.addLabel('l1');
    const g2 = Goal.create({ id: 'g2', title: 'B', now: t0 });
    g2.start(t1);
    const g3 = Goal.create({ id: 'g3', title: 'C', now: t0 });
    g3.archive(t1);
    await repo.save(g1);
    await repo.save(g2);
    await repo.save(g3);

    expect(ids(await repo.list({ status: 'doing' }))).toEqual(['g2']);
    expect(ids(await repo.list({ archived: true }))).toEqual(['g3']);
    expect(ids(await repo.list({ archived: false }))).toEqual(['g1', 'g2']);
    expect(ids(await repo.list({ labelId: 'l1' }))).toEqual(['g1']);
    expect(ids(await repo.list({ status: 'todo', archived: false }))).toEqual(['g1']);
  });

  it('round-trips and filters sub-goal project and parent links', async () => {
    const { repo } = await makeRepo();
    await repo.save(Goal.create({ id: 'g1', title: 'Top level', now: t0 }));
    await repo.save(
      Goal.create({ id: 'g2', title: 'Sub A', projectId: 'p1', parentGoalId: 'g1', now: t0 }),
    );
    await repo.save(
      Goal.create({ id: 'g3', title: 'Sub B', projectId: 'p2', parentGoalId: 'g1', now: t0 }),
    );

    const loaded = await repo.findById('g2');
    expect(loaded!.projectId).toBe('p1');
    expect(loaded!.parentGoalId).toBe('g1');
    expect(ids(await repo.list({ projectId: 'p1' }))).toEqual(['g2']);
    expect(ids(await repo.list({ parentGoalId: 'g1' }))).toEqual(['g2', 'g3']);
  });

  it('delete removes the goal and its label rows', async () => {
    const { repo, db } = await makeRepo();
    await repo.save(makeGoal());

    await repo.delete('g1');

    expect(await repo.findById('g1')).toBeNull();
    const labelRows = await db.all(
      "SELECT * FROM entity_labels WHERE entity_type = 'goal' AND entity_id = 'g1'",
    );
    expect(labelRows).toHaveLength(0);
  });

  it('a goal without optionals round-trips them as undefined', async () => {
    const { repo } = await makeRepo();
    await repo.save(Goal.create({ id: 'g1', title: 'Plain', now: t0 }));

    const loaded = await repo.findById('g1');

    expect(loaded!.description).toBeUndefined();
    expect(loaded!.due).toBeUndefined();
    expect(loaded!.milestoneId).toBeUndefined();
    expect(loaded!.labelIds).toEqual([]);
  });
});
