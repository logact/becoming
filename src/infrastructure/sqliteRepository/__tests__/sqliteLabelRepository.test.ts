import { Label } from '../../../domain/label/Label';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteLabelRepository } from '../SqliteLabelRepository';

async function makeRepo(): Promise<SqliteLabelRepository> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  return new SqliteLabelRepository(db);
}

describe('SqliteLabelRepository', () => {
  it('save then findById round-trips every field', async () => {
    const repo = await makeRepo();

    await repo.save(Label.create({ id: 'l1', name: 'Health', color: '#ff8800' }));
    const loaded = await repo.findById('l1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('l1');
    expect(loaded!.name).toBe('Health');
    expect(loaded!.color).toBe('#ff8800');
  });

  it('round-trips a label without a color', async () => {
    const repo = await makeRepo();

    await repo.save(Label.create({ id: 'l1', name: 'Health' }));

    expect((await repo.findById('l1'))!.color).toBeUndefined();
  });

  it('findById returns null for an unknown id', async () => {
    const repo = await makeRepo();

    expect(await repo.findById('missing')).toBeNull();
  });

  it('save upserts: a rename replaces the stored name', async () => {
    const repo = await makeRepo();
    const label = Label.create({ id: 'l1', name: 'Health' });
    await repo.save(label);

    label.rename('Fitness');
    await repo.save(label);

    expect(await repo.list()).toHaveLength(1);
    expect((await repo.findById('l1'))!.name).toBe('Fitness');
  });

  it('list returns every saved label ordered by name', async () => {
    const repo = await makeRepo();
    await repo.save(Label.create({ id: 'l2', name: 'Work' }));
    await repo.save(Label.create({ id: 'l1', name: 'Health' }));

    const labels = await repo.list();

    expect(labels.map((label) => label.id)).toEqual(['l1', 'l2']);
  });

  it('delete removes the label', async () => {
    const repo = await makeRepo();
    await repo.save(Label.create({ id: 'l1', name: 'Health' }));

    await repo.delete('l1');

    expect(await repo.findById('l1')).toBeNull();
    expect(await repo.list()).toEqual([]);
  });
});
