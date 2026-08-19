import { Idea } from '../../../domain/idea/Idea';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteIdeaRepository } from '../SqliteIdeaRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const t2 = new Date('2026-02-03T00:00:00Z');

async function makeRepo(): Promise<{ repo: SqliteIdeaRepository; db: NodeSqliteDatabase }> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return { repo: new SqliteIdeaRepository(db), db };
}

function makeIdea(): Idea {
  const idea = Idea.create({ id: 'i1', content: 'A widget that plans my week', now: t0 });
  idea.addLabel('l1');
  idea.explore(t1);
  idea.archive(t2);
  return idea;
}

const ids = (ideas: Idea[]): string[] => ideas.map((idea) => idea.id).sort();

describe('SqliteIdeaRepository', () => {
  it('save then findById round-trips every field', async () => {
    const { repo } = await makeRepo();

    await repo.save(makeIdea());
    const loaded = await repo.findById('i1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('i1');
    expect(loaded!.content).toBe('A widget that plans my week');
    expect(loaded!.status).toBe('exploring');
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
    const idea = makeIdea();
    await repo.save(idea);

    idea.pause(t2);
    idea.removeLabel('l1');
    await repo.save(idea);

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('i1');
    expect(loaded!.status).toBe('paused');
    expect(loaded!.labelIds).toEqual([]);
  });

  it('list filters by status, archived, and labelId', async () => {
    const { repo } = await makeRepo();
    const i1 = Idea.create({ id: 'i1', content: 'A', now: t0 });
    i1.addLabel('l1');
    const i2 = Idea.create({ id: 'i2', content: 'B', now: t0 });
    i2.explore(t1);
    const i3 = Idea.create({ id: 'i3', content: 'C', now: t0 });
    i3.archive(t1);
    await repo.save(i1);
    await repo.save(i2);
    await repo.save(i3);

    expect(ids(await repo.list())).toEqual(['i1', 'i2', 'i3']);
    expect(ids(await repo.list({ status: 'exploring' }))).toEqual(['i2']);
    expect(ids(await repo.list({ archived: true }))).toEqual(['i3']);
    expect(ids(await repo.list({ labelId: 'l1' }))).toEqual(['i1']);
  });

  it('delete removes the idea and its label rows', async () => {
    const { repo, db } = await makeRepo();
    await repo.save(makeIdea());

    await repo.delete('i1');

    expect(await repo.findById('i1')).toBeNull();
    const labelRows = await db.all(
      "SELECT * FROM entity_labels WHERE entity_type = 'idea' AND entity_id = 'i1'",
    );
    expect(labelRows).toHaveLength(0);
  });
});
