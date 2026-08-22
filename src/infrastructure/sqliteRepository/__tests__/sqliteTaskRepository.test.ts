import { Task } from '../../../domain/task/Task';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteTaskRepository } from '../SqliteTaskRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const t2 = new Date('2026-02-03T00:00:00Z');
const startAt = new Date('2026-02-15T00:00:00Z');
const due = new Date('2026-03-01T00:00:00Z');

async function makeRepo(): Promise<{ repo: SqliteTaskRepository; db: NodeSqliteDatabase }> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return { repo: new SqliteTaskRepository(db), db };
}

function makeTask(): Task {
  const task = Task.create({
    id: 't1',
    title: 'Write tests',
    description: 'Cover the repositories',
    startAt,
    due,
    projectId: 'p1',
    goalId: 'g1',
    milestoneId: 'm1',
    now: t0,
  });
  task.addLabel('l1');
  task.start(t1);
  task.archive(t2);
  return task;
}

const ids = (tasks: Task[]): string[] => tasks.map((task) => task.id).sort();

describe('SqliteTaskRepository', () => {
  it('save then findById round-trips every field', async () => {
    const { repo, db } = await makeRepo();

    await repo.save(makeTask());
    const loaded = await repo.findById('t1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('t1');
    expect(loaded!.title).toBe('Write tests');
    expect(loaded!.description).toBe('Cover the repositories');
    expect(loaded!.startAt).toEqual(startAt);
    expect(loaded!.due).toEqual(due);
    expect(loaded!.status).toBe('doing');
    expect(loaded!.archived).toBe(true);
    expect(loaded!.labelIds).toEqual(['l1']);
    expect(loaded!.projectId).toBe('p1');
    expect(loaded!.goalId).toBe('g1');
    expect(loaded!.milestoneId).toBe('m1');
    expect(loaded!.createdAt).toEqual(t0);
    expect(loaded!.updatedAt).toEqual(t2);
    expect(await db.first<{ start_at: number }>(
      'SELECT start_at FROM tasks WHERE id = ?',
      ['t1'],
    )).toEqual({ start_at: startAt.getTime() });
  });

  it('findById returns null for an unknown id', async () => {
    const { repo } = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts: fields and labels are replaced', async () => {
    const { repo } = await makeRepo();
    const task = makeTask();
    await repo.save(task);

    task.complete(t2);
    task.removeLabel('l1');
    await repo.save(task);

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('t1');
    expect(loaded!.status).toBe('done');
    expect(loaded!.labelIds).toEqual([]);
  });

  it('list filters by status, archived, labelId, projectId, and goalId', async () => {
    const { repo } = await makeRepo();
    const tA = Task.create({ id: 't1', title: 'A', projectId: 'p1', goalId: 'g1', now: t0 });
    tA.addLabel('l1');
    const tB = Task.create({ id: 't2', title: 'B', projectId: 'p3', now: t0 });
    tB.start(t1);
    const tC = Task.create({ id: 't3', title: 'C', projectId: 'p2', goalId: 'g2', now: t0 });
    tC.archive(t1);
    await repo.save(tA);
    await repo.save(tB);
    await repo.save(tC);

    expect(ids(await repo.list())).toEqual(['t1', 't2', 't3']);
    expect(ids(await repo.list({ status: 'doing' }))).toEqual(['t2']);
    expect(ids(await repo.list({ archived: true }))).toEqual(['t3']);
    expect(ids(await repo.list({ labelId: 'l1' }))).toEqual(['t1']);
    expect(ids(await repo.list({ projectId: 'p1' }))).toEqual(['t1']);
    expect(ids(await repo.list({ projectId: 'p2' }))).toEqual(['t3']);
    expect(ids(await repo.list({ goalId: 'g1' }))).toEqual(['t1']);
    expect(ids(await repo.list({ goalId: 'g2' }))).toEqual(['t3']);
  });

  it('delete removes the task and its label rows', async () => {
    const { repo, db } = await makeRepo();
    await repo.save(makeTask());

    await repo.delete('t1');

    expect(await repo.findById('t1')).toBeNull();
    const labelRows = await db.all(
      "SELECT * FROM entity_labels WHERE entity_type = 'task' AND entity_id = 't1'",
    );
    expect(labelRows).toHaveLength(0);
  });

  it('a task without optionals round-trips them as undefined', async () => {
    const { repo } = await makeRepo();
    await repo.save(Task.create({ id: 't1', title: 'Plain', projectId: 'p1', now: t0 }));

    const loaded = await repo.findById('t1');

    expect(loaded!.description).toBeUndefined();
    expect(loaded!.startAt).toBeUndefined();
    expect(loaded!.due).toBeUndefined();
    expect(loaded!.projectId).toBe('p1');
    expect(loaded!.goalId).toBeUndefined();
    expect(loaded!.milestoneId).toBeUndefined();
    expect(loaded!.labelIds).toEqual([]);
  });
});
