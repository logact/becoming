import { Project } from '../../../domain/project/Project';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteProjectRepository } from '../SqliteProjectRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const t2 = new Date('2026-02-03T00:00:00Z');
const due = new Date('2026-03-01T00:00:00Z');

async function makeRepo(): Promise<{ repo: SqliteProjectRepository; db: NodeSqliteDatabase }> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return { repo: new SqliteProjectRepository(db), db };
}

function makeProject(): Project {
  const project = Project.create({ id: 'p1', name: 'MVP', goalId: 'g1', due, now: t0 });
  project.addLabel('l1');
  project.activate(t1);
  project.archive(t2);
  return project;
}

const ids = (projects: Project[]): string[] => projects.map((project) => project.id).sort();

describe('SqliteProjectRepository', () => {
  it('save then findById round-trips every field', async () => {
    const { repo } = await makeRepo();

    await repo.save(makeProject());
    const loaded = await repo.findById('p1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('p1');
    expect(loaded!.name).toBe('MVP');
    expect(loaded!.goalId).toBe('g1');
    expect(loaded!.due).toEqual(due);
    expect(loaded!.status).toBe('active');
    expect(loaded!.archived).toBe(true);
    expect(loaded!.labelIds).toEqual(['l1']);
    expect(loaded!.createdAt).toEqual(t0);
    expect(loaded!.updatedAt).toEqual(t2);
  });

  it('findById returns null for an unknown id', async () => {
    const { repo } = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts: fields and labels are replaced', async () => {
    const { repo } = await makeRepo();
    const project = makeProject();
    await repo.save(project);

    project.pause(t2);
    project.removeLabel('l1');
    await repo.save(project);

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('p1');
    expect(loaded!.status).toBe('paused');
    expect(loaded!.labelIds).toEqual([]);
  });

  it('list filters by status, archived, labelId, and goalId', async () => {
    const { repo } = await makeRepo();
    const p1 = Project.create({ id: 'p1', name: 'A', goalId: 'g1', now: t0 });
    p1.addLabel('l1');
    const p2 = Project.create({ id: 'p2', name: 'B', goalId: 'g1', now: t0 });
    p2.activate(t1);
    const p3 = Project.create({ id: 'p3', name: 'C', goalId: 'g2', now: t0 });
    p3.archive(t1);
    await repo.save(p1);
    await repo.save(p2);
    await repo.save(p3);

    expect(ids(await repo.list())).toEqual(['p1', 'p2', 'p3']);
    expect(ids(await repo.list({ status: 'active' }))).toEqual(['p2']);
    expect(ids(await repo.list({ archived: true }))).toEqual(['p3']);
    expect(ids(await repo.list({ labelId: 'l1' }))).toEqual(['p1']);
    expect(ids(await repo.list({ goalId: 'g1' }))).toEqual(['p1', 'p2']);
    expect(ids(await repo.list({ goalId: 'g2' }))).toEqual(['p3']);
  });

  it('delete removes the project and its label rows', async () => {
    const { repo, db } = await makeRepo();
    await repo.save(makeProject());

    await repo.delete('p1');

    expect(await repo.findById('p1')).toBeNull();
    const labelRows = await db.all(
      "SELECT * FROM entity_labels WHERE entity_type = 'project' AND entity_id = 'p1'",
    );
    expect(labelRows).toHaveLength(0);
  });

  it('a project without due round-trips it as undefined', async () => {
    const { repo } = await makeRepo();
    await repo.save(Project.create({ id: 'p1', name: 'No due', goalId: 'g1', now: t0 }));

    const loaded = await repo.findById('p1');

    expect(loaded!.due).toBeUndefined();
    expect(loaded!.labelIds).toEqual([]);
  });
});
