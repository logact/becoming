import { archiveLabel, createLabel, validateLabel } from '../src/domain/label';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import {
  closeQuietly,
  createTestDatabase,
} from './helpers/testDatabase';

describe('label domain model', () => {
  it('creates a Label with fresh id, timestamps, and null description by default', () => {
    const label = createLabel({ name: 'Feature' });

    expect(label.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(label.name).toBe('Feature');
    expect(label.description).toBeNull();
    expect(label.createdAt).toBe(label.updatedAt);
    expect(label.archivedAt).toBeNull();
    expect(() => validateLabel(label)).not.toThrow();
  });

  it('keeps an explicit description', () => {
    const label = createLabel({
      name: 'Strategic',
      description: 'Long-term strategic work',
    });

    expect(label.description).toBe('Long-term strategic work');
  });

  it('rejects a blank name', () => {
    expect(() => createLabel({ name: '   ' })).toThrow(/name/);
  });

  it('archives without mutating the original and bumps updatedAt', () => {
    const label = createLabel({ name: 'Experimental' });
    const archived = archiveLabel(label, '2026-08-12T12:00:00.000Z');

    expect(label.archivedAt).toBeNull();
    expect(archived.id).toBe(label.id);
    expect(archived.archivedAt).toBe('2026-08-12T12:00:00.000Z');
    expect(archived.updatedAt).toBe('2026-08-12T12:00:00.000Z');
  });

  it('rejects archiving an already archived Label', () => {
    const archived = archiveLabel(createLabel({ name: 'P0' }));
    expect(() => archiveLabel(archived)).toThrow(/already archived/);
  });
});

describe('LabelRepository contract', () => {
  it('round-trips a Label with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);
    const label = createLabel({
      name: 'Feature',
      description: 'Product feature work',
    });

    await repository.add(label);
    const loaded = await repository.getById(label.id);

    expect(loaded).toEqual(label);
    await closeQuietly(db);
  });

  it('round-trips an omitted description as null', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Research' });

    await repository.add(label);
    const loaded = await repository.getById(label.id);

    expect(loaded).toEqual(label);
    expect(loaded?.description).toBeNull();
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);

    expect(await repository.getById('no-such-label')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Feature' });

    await repository.add(label);
    await expect(repository.add(label)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects a blank-name aggregate on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);
    const invalid = { ...createLabel({ name: 'Feature' }), name: '  ' };

    await expect(repository.add(invalid)).rejects.toThrow(/name/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('finds an active Label by exact name', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Backend' });
    await repository.add(label);

    expect(await repository.findActiveByName('Backend')).toEqual(label);
    expect(await repository.findActiveByName('backend')).toBeNull();
    expect(await repository.findActiveByName('Missing')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate active name on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);
    await repository.add(createLabel({ name: 'Feature' }));

    await expect(
      repository.add(createLabel({ name: 'Feature' })),
    ).rejects.toThrow(/already exists/);
    await closeQuietly(db);
  });

  it('persists archival through save and keeps the Label resolvable by id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Limited' });
    await repository.add(label);

    const archived = archiveLabel(label, '2026-08-12T12:00:00.000Z');
    await repository.save(archived);

    expect(await repository.getById(label.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('rejects saving an unknown Label', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteLabelRepository(db);

    await expect(
      repository.save(createLabel({ name: 'Feature' })),
    ).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });

  describe('archive-safe lookup', () => {
    it('excludes archived Labels from findActiveByName', async () => {
      const db = await createTestDatabase();
      const repository = new SqliteLabelRepository(db);
      const label = createLabel({ name: 'Feature' });
      await repository.add(label);
      await repository.save(archiveLabel(label));

      expect(await repository.findActiveByName('Feature')).toBeNull();
      expect(await repository.getById(label.id)).toEqual({
        ...label,
        archivedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      await closeQuietly(db);
    });

    it('allows reusing a name after the previous Label was archived', async () => {
      const db = await createTestDatabase();
      const repository = new SqliteLabelRepository(db);
      const first = createLabel({ name: 'Experimental' });
      await repository.add(first);
      const archivedFirst = archiveLabel(first);
      await repository.save(archivedFirst);

      const second = createLabel({ name: 'Experimental' });
      await repository.add(second);

      expect(second.id).not.toBe(first.id);
      expect(await repository.findActiveByName('Experimental')).toEqual(
        second,
      );
      // Historical references to the archived Label stay resolvable by id.
      expect(await repository.getById(first.id)).toEqual(archivedFirst);
      await closeQuietly(db);
    });

    it('rejects renaming an active Label onto another active name via save', async () => {
      const db = await createTestDatabase();
      const repository = new SqliteLabelRepository(db);
      const feature = createLabel({ name: 'Feature' });
      const bug = createLabel({ name: 'Bug' });
      await repository.add(feature);
      await repository.add(bug);

      await expect(
        repository.save({ ...bug, name: 'Feature' }),
      ).rejects.toThrow(/already exists/);
      expect(await repository.getById(bug.id)).toEqual(bug);
      await closeQuietly(db);
    });

    it('allows saving a Label that keeps its own name', async () => {
      const db = await createTestDatabase();
      const repository = new SqliteLabelRepository(db);
      const label = createLabel({ name: 'Feature' });
      await repository.add(label);

      const updated = {
        ...label,
        description: 'Updated meaning',
        updatedAt: '2026-08-12T12:00:00.000Z',
      };
      await repository.save(updated);

      expect(await repository.getById(label.id)).toEqual(updated);
      await closeQuietly(db);
    });
  });
});
