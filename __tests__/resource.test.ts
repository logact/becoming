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
