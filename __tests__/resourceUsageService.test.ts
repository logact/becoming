import {
  ResourceUsageIdempotencyConflictError,
  ResourceUsageService,
} from '../src/application/resourceUsageService';
import { createProject } from '../src/domain/project';
import { createResource } from '../src/domain/resource';
import { createTask } from '../src/domain/task';
import { createRelation } from '../src/domain/relation';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-13T00:00:00.000Z';

describe('ResourceUsageService', () => {
  let db: SqliteDatabase;
  let service: ResourceUsageService<SqliteDatabase>;
  let nextId = 0;

  beforeEach(async () => {
    db = await createTestDatabase();
    nextId = 0;
    service = new ResourceUsageService({
      unitOfWork: sqliteUnitOfWork(db), projects: (context) => new SqliteProjectRepository(context),
      resources: (context) => new SqliteResourceRepository(context), tasks: (context) => new SqliteTaskRepository(context),
      records: (context) => new SqliteRecordRepository(context), relations: (context) => new SqliteRelationRepository(context),
      clock: { now: () => NOW }, ids: { newId: () => `usage-${++nextId}` },
    });
    await new SqliteProjectRepository(db).add(createProject({ title: 'Release' }, { id: 'project-1', now: NOW }));
    await new SqliteResourceRepository(db).add(createResource({ title: 'Time', resourceType: 'time', unit: 'hour' }, { id: 'resource-1', now: NOW }));
    const task = createTask({ title: 'Implement', targetDescription: 'Done' });
    await new SqliteTaskRepository(db).add({ ...task, id: 'task-1', createdAt: NOW, updatedAt: NOW });
    await new SqliteRelationRepository(db).add(createRelation({ sourceType: 'task', sourceId: 'task-1', relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' }, { id: 'membership-1', now: NOW }));
  });

  afterEach(async () => db.closeAsync());

  const command = {
    description: 'Worked on release', actor: 'agent', projectId: 'project-1', resourceId: 'resource-1',
    taskId: 'task-1', amount: '1.50', unit: 'hour', occurredAt: NOW, idempotencyKey: 'run-1',
  };

  it('atomically records Project/Resource/Task provenance and retries without double counting', async () => {
    const first = await service.record(command);
    const retry = await service.record(command);
    expect(first).toMatchObject({ taskRelationId: expect.any(String), correctionRelationId: null, idempotent: false });
    expect(retry).toEqual({ ...first, idempotent: true });
    expect(await new SqliteRecordRepository(db).list({ status: 'all' })).toHaveLength(1);
    expect(await new SqliteRelationRepository(db).listHistory({ source: { type: 'record', id: first.recordId } })).toHaveLength(3);
    await expect(service.record({ ...command, amount: '2', idempotencyKey: 'run-1' }))
      .rejects.toBeInstanceOf(ResourceUsageIdempotencyConflictError);
  });

  it('rejects missing membership, invalid amount and unit before writes', async () => {
    const relations = new SqliteRelationRepository(db);
    await relations.save({ ...(await relations.getById('membership-1'))!, endedAt: NOW });
    await expect(service.record(command)).rejects.toThrow(/membership/);
    await expect(service.record({ ...command, taskId: undefined, amount: '0', idempotencyKey: 'bad-amount' })).rejects.toThrow(/positive/);
    await expect(service.record({ ...command, taskId: undefined, unit: 'day', idempotencyKey: 'bad-unit' })).rejects.toThrow(/incompatible/);
    expect(await new SqliteRecordRepository(db).list({ status: 'all' })).toEqual([]);
  });

  it('appends full and partial reversal data without writing planned relations', async () => {
    const original = await service.record(command);
    const partial = await service.correct({ targetRecordId: original.recordId, description: 'Correct half', actor: 'agent', occurredAt: NOW, amount: '0.5', idempotencyKey: 'correction-1' });
    expect(partial).toMatchObject({ correctionRelationId: expect.any(String), idempotent: false });
    const records = await new SqliteRecordRepository(db).list({ status: 'all' });
    expect(records).toHaveLength(2);
    expect(records[0].recordType).toBe('resource_usage');
    expect(records[1].payload).toMatchObject({ amount: '0.5', aggregationEffect: -1, correctsRecordId: original.recordId });
    expect(await new SqliteRelationRepository(db).listHistory({ relationType: 'budgeted_by' })).toEqual([]);
    expect(await new SqliteRelationRepository(db).listHistory({ relationType: 'allocated' })).toEqual([]);
    await expect(service.correct({ targetRecordId: original.recordId, description: 'Again', actor: 'agent', occurredAt: NOW, idempotencyKey: 'correction-2' })).rejects.toThrow(/already has a correction/);
  });

  it('rolls back the Record when a required relation fails', async () => {
    const broken = new ResourceUsageService({
      unitOfWork: sqliteUnitOfWork(db), projects: (context) => new SqliteProjectRepository(context), resources: (context) => new SqliteResourceRepository(context), tasks: (context) => new SqliteTaskRepository(context), records: (context) => new SqliteRecordRepository(context),
      relations: (context) => {
        const repository = new SqliteRelationRepository(context);
        return Object.assign(Object.create(Object.getPrototypeOf(repository)), repository, { add: async (relation: Parameters<typeof repository.add>[0]) => {
          if (relation.targetType === 'resource') throw new Error('resource link failed');
          return repository.add(relation);
        } });
      },
      clock: { now: () => NOW }, ids: { newId: () => `broken-${++nextId}` },
    });
    await expect(broken.record({ ...command, idempotencyKey: 'rollback' })).rejects.toThrow('resource link failed');
    expect(await new SqliteRecordRepository(db).list({ status: 'all' })).toEqual([]);
    expect(await new SqliteRelationRepository(db).listHistory({ source: { type: 'record', id: 'broken-1' } })).toEqual([]);
  });
});
