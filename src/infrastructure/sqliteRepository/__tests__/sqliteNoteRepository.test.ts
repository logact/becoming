import { Note } from '../../../domain/note/Note';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteNoteRepository } from '../SqliteNoteRepository';

const t0 = new Date('2026-02-01T00:00:00Z');
const t1 = new Date('2026-02-02T00:00:00Z');
const t2 = new Date('2026-02-03T00:00:00Z');

async function makeRepo(): Promise<{ repo: SqliteNoteRepository; db: NodeSqliteDatabase }> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return { repo: new SqliteNoteRepository(db), db };
}

function makeNote(): Note {
  const note = Note.create({ id: 'n1', content: 'A reusable weekly review', now: t0 });
  note.addLabel('l1');
  note.pin(t1);
  note.archive(t2);
  return note;
}

const ids = (notes: Note[]): string[] => notes.map((note) => note.id).sort();

describe('SqliteNoteRepository', () => {
  it('save then findById round-trips every field', async () => {
    const { repo } = await makeRepo();

    await repo.save(makeNote());
    const loaded = await repo.findById('n1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('n1');
    expect(loaded!.content).toBe('A reusable weekly review');
    expect(loaded!.archived).toBe(true);
    expect(loaded!.pinnedAt).toEqual(t1);
    expect(loaded!.labelIds).toEqual(['l1']);
    expect(loaded!.createdAt).toEqual(t0);
    expect(loaded!.updatedAt).toEqual(t2);
  });

  it('findById returns null for an unknown id', async () => {
    const { repo } = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts fields and replaces labels', async () => {
    const { repo } = await makeRepo();
    const note = makeNote();
    await repo.save(note);

    note.unarchive(t2);
    note.unpin(t2);
    note.removeLabel('l1');
    note.addLabel('l2');
    await repo.save(note);

    expect(await repo.list()).toHaveLength(1);
    const loaded = await repo.findById('n1');
    expect(loaded!.archived).toBe(false);
    expect(loaded!.pinnedAt).toBeNull();
    expect(loaded!.labelIds).toEqual(['l2']);
  });

  it('list filters by archived and labelId independently and together', async () => {
    const { repo } = await makeRepo();
    const n1 = Note.create({ id: 'n1', content: 'A', now: t0 });
    n1.addLabel('l1');
    const n2 = Note.create({ id: 'n2', content: 'B', now: t0 });
    n2.addLabel('l1');
    n2.archive(t1);
    const n3 = Note.create({ id: 'n3', content: 'C', now: t0 });
    n3.addLabel('l2');
    await repo.save(n1);
    await repo.save(n2);
    await repo.save(n3);

    expect(ids(await repo.list())).toEqual(['n1', 'n2', 'n3']);
    expect(ids(await repo.list({ archived: false }))).toEqual(['n1', 'n3']);
    expect(ids(await repo.list({ archived: true }))).toEqual(['n2']);
    expect(ids(await repo.list({ labelId: 'l1' }))).toEqual(['n1', 'n2']);
    expect(ids(await repo.list({ archived: true, labelId: 'l1' }))).toEqual(['n2']);
  });

  it('delete removes the note and its label rows', async () => {
    const { repo, db } = await makeRepo();
    await repo.save(makeNote());

    await repo.delete('n1');

    expect(await repo.findById('n1')).toBeNull();
    const labelRows = await db.all(
      "SELECT * FROM entity_labels WHERE entity_type = 'note' AND entity_id = 'n1'",
    );
    expect(labelRows).toHaveLength(0);
  });
});
