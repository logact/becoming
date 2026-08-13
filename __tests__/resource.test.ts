import { Decimal } from '../src/domain/decimal';
import {
  archiveResource,
  createResource,
  validateResource,
} from '../src/domain/resource';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

describe('resource domain model', () => {
  it('creates a Resource with fresh id, timestamps, and null optionals', () => {
    const resource = createResource({
      title: 'Development Time',
      resourceType: 'time',
    });

    expect(resource.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(resource.createdAt).toBe(resource.updatedAt);
    expect(resource.archivedAt).toBeNull();
    expect(resource.description).toBeNull();
    expect(resource.unit).toBeNull();
    expect(resource.behavior).toBeNull();
    expect(resource.capacity).toBeNull();
    expect(() => validateResource(resource)).not.toThrow();
  });

  it('keeps explicit optional fields and an exact capacity', () => {
    const resource = createResource({
      title: 'API Tokens',
      resourceType: 'token',
      description: 'Monthly AI token allowance',
      unit: 'token',
      behavior: 'renewable',
      capacity: '1000000',
    });

    expect(resource.description).toBe('Monthly AI token allowance');
    expect(resource.unit).toBe('token');
    expect(resource.behavior).toBe('renewable');
    expect(resource.capacity?.toString()).toBe('1000000');
  });

  it('rejects a blank title or resource type', () => {
    expect(() =>
      createResource({ title: '  ', resourceType: 'time' }),
    ).toThrow(/title/);
    expect(() =>
      createResource({ title: 'Development Time', resourceType: '' }),
    ).toThrow(/resourceType/);
  });

  it('rejects a blank unit when one is present', () => {
    const resource = createResource({
      title: 'Development Time',
      resourceType: 'time',
    });

    expect(() => validateResource({ ...resource, unit: ' ' })).toThrow(
      /unit/,
    );
  });

  it('rejects a capacity without a unit', () => {
    expect(() =>
      createResource({
        title: 'Development Time',
        resourceType: 'time',
        capacity: '40',
      }),
    ).toThrow(/unit/);
  });

  it('rejects a negative capacity', () => {
    expect(() =>
      createResource({
        title: 'Development Time',
        resourceType: 'time',
        unit: 'hour',
        capacity: '-1',
      }),
    ).toThrow(/negative/);
  });

  it('keeps capacity exact and never touches binary floating point', () => {
    const resource = createResource({
      title: 'GPU Compute',
      resourceType: 'compute',
      unit: 'GPU-hour',
      capacity: '0.1',
    });

    expect(resource.capacity).toBeInstanceOf(Decimal);
    expect(resource.capacity?.toString()).toBe('0.1');
  });

  it('archives without mutating the original and bumps updatedAt', () => {
    const resource = createResource({
      title: 'Development Time',
      resourceType: 'time',
    });
    const archived = archiveResource(resource, '2026-08-12T12:00:00.000Z');

    expect(resource.archivedAt).toBeNull();
    expect(archived.id).toBe(resource.id);
    expect(archived.archivedAt).toBe('2026-08-12T12:00:00.000Z');
    expect(archived.updatedAt).toBe('2026-08-12T12:00:00.000Z');
  });

  it('rejects archiving an already archived Resource', () => {
    const archived = archiveResource(
      createResource({ title: 'Development Time', resourceType: 'time' }),
    );
    expect(() => archiveResource(archived)).toThrow(/already archived/);
  });
});

describe('ResourceRepository contract', () => {
  it('round-trips a Resource with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const resource = createResource({
      title: 'Operating Budget',
      resourceType: 'money',
      description: 'Project operating funds',
      unit: 'JPY',
      behavior: 'storable',
      capacity: '12500.50',
    });

    await repository.add(resource);
    const loaded = await repository.getById(resource.id);

    expect(loaded).toEqual(resource);
    await closeQuietly(db);
  });

  it('round-trips capacity exactly, including awkward decimals', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const resource = createResource({
      title: 'GPU Compute',
      resourceType: 'compute',
      unit: 'GPU-hour',
      capacity: '0.000001',
    });

    await repository.add(resource);
    const loaded = await repository.getById(resource.id);

    expect(loaded?.capacity).toBeInstanceOf(Decimal);
    expect(loaded?.capacity?.toString()).toBe('0.000001');
    await closeQuietly(db);
  });

  it('round-trips omitted optional fields as null', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const resource = createResource({
      title: 'Attention',
      resourceType: 'attention',
    });

    await repository.add(resource);
    const loaded = await repository.getById(resource.id);

    expect(loaded).toEqual(resource);
    expect(loaded?.unit).toBeNull();
    expect(loaded?.capacity).toBeNull();
    expect(loaded?.archivedAt).toBeNull();
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);

    expect(await repository.getById('no-such-resource')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const resource = createResource({
      title: 'Development Time',
      resourceType: 'time',
    });

    await repository.add(resource);
    await expect(repository.add(resource)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const invalid = {
      ...createResource({
        title: 'Development Time',
        resourceType: 'time',
        unit: 'hour',
      }),
      capacity: Decimal.parse('-5'),
    };

    await expect(repository.add(invalid)).rejects.toThrow(/negative/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('persists archival through save and keeps it resolvable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const resource = createResource({
      title: 'Development Time',
      resourceType: 'time',
      unit: 'hour',
    });
    await repository.add(resource);

    const archived = archiveResource(resource, '2026-08-12T12:00:00.000Z');
    await repository.save(archived);

    expect(await repository.getById(resource.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('rejects saving an unknown Resource', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const resource = createResource({
      title: 'Development Time',
      resourceType: 'time',
    });

    await expect(repository.save(resource)).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });
});

describe('ResourceRepository catalog queries', () => {
  /** Create a Resource with explicit timestamps so ordering is testable. */
  function catalogEntry(
    input: Parameters<typeof createResource>[0],
    createdAt: string,
  ) {
    return { ...createResource(input), createdAt, updatedAt: createdAt };
  }

  /** A mixed catalog: four active entries across types, one archived. */
  async function seedCatalog(repository: SqliteResourceRepository) {
    const devTime = catalogEntry(
      {
        title: 'Development Time',
        resourceType: 'time',
        unit: 'hour',
        behavior: 'perishable',
        capacity: '40',
      },
      '2026-08-01T00:00:00.000Z',
    );
    const budget = catalogEntry(
      {
        title: 'Operating Budget',
        resourceType: 'money',
        unit: 'JPY',
        behavior: 'storable',
        capacity: '12500.50',
      },
      '2026-08-02T00:00:00.000Z',
    );
    const tokens = catalogEntry(
      {
        title: 'API Tokens',
        resourceType: 'token',
        unit: 'token',
        behavior: 'renewable',
        capacity: '1000000',
      },
      '2026-08-03T00:00:00.000Z',
    );
    const gpu = catalogEntry(
      {
        title: 'GPU Compute',
        resourceType: 'compute',
        unit: 'GPU-hour',
        capacity: '0.000001',
      },
      '2026-08-04T00:00:00.000Z',
    );
    const archivedTime = archiveResource(
      catalogEntry(
        { title: 'Legacy Time', resourceType: 'time', unit: 'hour' },
        '2026-08-05T00:00:00.000Z',
      ),
      '2026-08-10T00:00:00.000Z',
    );
    for (const resource of [gpu, archivedTime, devTime, tokens, budget]) {
      await repository.add(resource);
    }
    return { devTime, budget, tokens, gpu, archivedTime };
  }

  it('lists the whole catalog ordered by createdAt regardless of insert order', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const seeded = await seedCatalog(repository);

    const listed = await repository.list();

    expect(listed.map((resource) => resource.id)).toEqual([
      seeded.devTime.id,
      seeded.budget.id,
      seeded.tokens.id,
      seeded.gpu.id,
      seeded.archivedTime.id,
    ]);
    expect(listed).toEqual([
      seeded.devTime,
      seeded.budget,
      seeded.tokens,
      seeded.gpu,
      seeded.archivedTime,
    ]);
    await closeQuietly(db);
  });

  it('breaks createdAt ties by id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const sameMoment = '2026-08-01T00:00:00.000Z';
    const first = catalogEntry(
      { title: 'Development Time', resourceType: 'time' },
      sameMoment,
    );
    const second = catalogEntry(
      { title: 'Focus', resourceType: 'attention' },
      sameMoment,
    );
    await repository.add(first);
    await repository.add(second);

    const listed = await repository.list();

    const expected = [first, second].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    expect(listed.map((resource) => resource.id)).toEqual(
      expected.map((resource) => resource.id),
    );
    await closeQuietly(db);
  });

  it('filters by resourceType', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const seeded = await seedCatalog(repository);

    const timeEntries = await repository.list({ resourceType: 'time' });

    expect(timeEntries).toEqual([seeded.devTime, seeded.archivedTime]);
    await closeQuietly(db);
  });

  it('active status excludes archived entries but keeps them readable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const seeded = await seedCatalog(repository);

    const active = await repository.list({ status: 'active' });

    expect(active).toEqual([
      seeded.devTime,
      seeded.budget,
      seeded.tokens,
      seeded.gpu,
    ]);
    expect(await repository.getById(seeded.archivedTime.id)).toEqual(
      seeded.archivedTime,
    );
    await closeQuietly(db);
  });

  it('archived status returns only archived entries', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const seeded = await seedCatalog(repository);

    expect(await repository.list({ status: 'archived' })).toEqual([
      seeded.archivedTime,
    ]);
    await closeQuietly(db);
  });

  it('all status matches the unfiltered catalog', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    await seedCatalog(repository);

    expect(await repository.list({ status: 'all' })).toEqual(
      await repository.list(),
    );
    await closeQuietly(db);
  });

  it('combines resourceType and status filters', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    const seeded = await seedCatalog(repository);

    expect(
      await repository.list({ resourceType: 'time', status: 'active' }),
    ).toEqual([seeded.devTime]);
    expect(
      await repository.list({ resourceType: 'time', status: 'archived' }),
    ).toEqual([seeded.archivedTime]);
    await closeQuietly(db);
  });

  it('keeps fractional capacities and units exact through list queries', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    await seedCatalog(repository);

    const listed = await repository.list({ status: 'active' });
    const byType = new Map(
      listed.map((resource) => [resource.resourceType, resource]),
    );

    expect(byType.get('money')?.capacity?.toString()).toBe('12500.5');
    expect(byType.get('money')?.unit).toBe('JPY');
    expect(byType.get('compute')?.capacity?.toString()).toBe('0.000001');
    expect(byType.get('compute')?.unit).toBe('GPU-hour');
    expect(byType.get('token')?.capacity?.toString()).toBe('1000000');
    for (const resource of listed) {
      if (resource.capacity !== null) {
        expect(resource.capacity).toBeInstanceOf(Decimal);
      }
    }
    await closeQuietly(db);
  });

  it('returns empty results when nothing matches', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);
    await seedCatalog(repository);

    expect(await repository.list({ resourceType: 'equipment' })).toEqual([]);
    expect(
      await repository.list({ resourceType: 'money', status: 'archived' }),
    ).toEqual([]);
    await closeQuietly(db);
  });

  it('returns empty results from an empty catalog', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteResourceRepository(db);

    expect(await repository.list()).toEqual([]);
    expect(await repository.list({ status: 'archived' })).toEqual([]);
    await closeQuietly(db);
  });
});
