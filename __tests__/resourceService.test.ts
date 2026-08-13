import { ResourceService, ResourceSemanticsChangeBlockedError } from '../src/application/resourceService';
import { MutationPersistenceError } from '../src/application/mutationProvenanceService';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import type { Record } from '../src/domain/record';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-13T00:00:00.000Z';

describe('ResourceService', () => {
  let db: SqliteDatabase;
  let linked = false;
  let nextId = 0;
  let service: ResourceService<SqliteDatabase>;

  async function provenanceRecords(): Promise<Record[]> {
    const ids = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM records WHERE record_type = ?',
      [PROVENANCE_RECORD_TYPE],
    );
    const records = new SqliteRecordRepository(db);
    return Promise.all(ids.map(async ({ id }) => (await records.getById(id)) as Record));
  }

  beforeEach(async () => {
    db = await createTestDatabase();
    linked = false;
    nextId = 0;
    service = new ResourceService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      resources: (context) => new SqliteResourceRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      readResources: new SqliteResourceRepository(db),
      quantityReferences: () => ({ hasLinkedQuantities: async () => linked }),
      clock: { now: () => NOW },
      ids: { newId: () => `resource-service-${++nextId}` },
    });
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('creates, gets, updates, and filters catalog entries with provenance', async () => {
    const created = await service.createResource({
      actor: 'planner',
      title: 'Development Time',
      resourceType: 'time',
      unit: 'hour',
      behavior: 'perishable',
      capacity: '40.00',
    });
    const updated = await service.updateResource({
      id: created.id,
      actor: 'planner',
      changes: { title: 'Focused Development Time', description: 'This week' },
    });

    expect(await service.getResource(created.id)).toEqual(updated);
    expect(updated.capacity?.toString()).toBe('40');
    expect((await service.listResources({ status: 'active', resourceType: 'time' }))
      .map((resource) => resource.id)).toEqual([created.id]);
    expect(await service.listResources({ status: 'archived' })).toEqual([]);

    const provenance = await provenanceRecords();
    expect(provenance).toHaveLength(2);
    expect(provenance.map((record) => (record.payload as { action: string }).action))
      .toEqual(['create', 'update']);
    const updatePayload = provenance[1].payload as {
      before: { title?: string }; after: { title?: string; description?: string };
    };
    expect(updatePayload.before).toEqual({ title: 'Development Time', description: null });
    expect(updatePayload.after).toEqual({ title: 'Focused Development Time', description: 'This week' });
  });

  it('rejects invalid definitions before persisting or emitting provenance', async () => {
    await expect(service.createResource({
      actor: 'planner', title: 'Bad capacity', resourceType: 'time', capacity: '1',
    })).rejects.toThrow(/requires a unit/);

    expect(await service.listResources()).toEqual([]);
    expect(await provenanceRecords()).toEqual([]);
  });

  it('blocks unit, type, and behavior reinterpretation when quantities are linked', async () => {
    const resource = await service.createResource({
      actor: 'planner', title: 'Development Time', resourceType: 'time',
      unit: 'hour', behavior: 'perishable', capacity: '40',
    });
    linked = true;

    const blockedUpdate = service.updateResource({
      id: resource.id, actor: 'planner', changes: { unit: 'minute' },
    });
    await expect(blockedUpdate).rejects.toThrow(MutationPersistenceError);
    await expect(blockedUpdate).rejects.toMatchObject({
      cause: expect.any(ResourceSemanticsChangeBlockedError),
    });
    await expect(service.updateResource({
      id: resource.id, actor: 'planner', changes: { resourceType: 'attention' },
    })).rejects.toThrow(MutationPersistenceError);
    await expect(service.updateResource({
      id: resource.id, actor: 'planner', changes: { behavior: 'renewable' },
    })).rejects.toThrow(MutationPersistenceError);

    expect((await service.getResource(resource.id))?.unit).toBe('hour');
    expect(await provenanceRecords()).toHaveLength(1);
  });

  it('allows descriptive and capacity changes when linked quantities exist', async () => {
    const resource = await service.createResource({
      actor: 'planner', title: 'Development Time', resourceType: 'time', unit: 'hour',
    });
    linked = true;

    const updated = await service.updateResource({
      id: resource.id, actor: 'planner', changes: { description: 'Weekly capacity', capacity: '40.000' },
    });

    expect(updated.description).toBe('Weekly capacity');
    expect(updated.capacity?.toString()).toBe('40');
  });

  it('archives historically and makes repeat archive requests idempotent', async () => {
    const resource = await service.createResource({
      actor: 'planner', title: 'Legacy Tokens', resourceType: 'token', unit: 'token',
    });
    const archived = await service.archiveResource({ id: resource.id, actor: 'planner' });
    const repeated = await service.archiveResource({ id: resource.id, actor: 'another-actor' });

    expect(archived.archivedAt).toBe(NOW);
    expect(repeated).toEqual(archived);
    expect(await service.getResource(resource.id)).toEqual(archived);
    expect(await service.listResources({ status: 'active' })).toEqual([]);
    expect((await service.listResources({ status: 'archived' })).map((entry) => entry.id))
      .toEqual([resource.id]);
    expect(await provenanceRecords()).toHaveLength(2);
  });

  it('does not mutate archived resources or emit a provenance record', async () => {
    const resource = await service.createResource({
      actor: 'planner', title: 'Legacy Tokens', resourceType: 'token', unit: 'token',
    });
    await service.archiveResource({ id: resource.id, actor: 'planner' });
    const recordsBefore = await provenanceRecords();

    await expect(service.updateResource({
      id: resource.id, actor: 'planner', changes: { title: 'Rewritten history' },
    })).rejects.toThrow(/archived/);

    expect(await provenanceRecords()).toHaveLength(recordsBefore.length);
    expect((await service.getResource(resource.id))?.title).toBe('Legacy Tokens');
  });
});
