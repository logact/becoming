import { ResourceUsageQueryService, ResourceUsageHistoryIntegrityError } from '../src/application/resourceUsageQueryService';
import { ResourceUsageService } from '../src/application/resourceUsageService';
import { archiveProject, createProject } from '../src/domain/project';
import { archiveResource, createResource } from '../src/domain/resource';
import { archiveTask, createTask } from '../src/domain/task';
import { createRelation } from '../src/domain/relation';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { createTestDatabase } from './helpers/testDatabase';

const T1 = '2026-08-13T00:00:00.000Z';
const T2 = '2026-08-14T00:00:00.000Z';
const T3 = '2026-08-15T00:00:00.000Z';

describe('ResourceUsageQueryService (#80)', () => {
  let db: SqliteDatabase;
  let usage: ResourceUsageService<SqliteDatabase>;
  let query: ResourceUsageQueryService;
  let nextId = 0;

  beforeEach(async () => {
    db = await createTestDatabase();
    nextId = 0;
    const projects = new SqliteProjectRepository(db);
    const resources = new SqliteResourceRepository(db);
    const tasks = new SqliteTaskRepository(db);
    const relations = new SqliteRelationRepository(db);
    await projects.add(createProject({ title: 'Project one' }, { id: 'project-1', now: T1 }));
    await projects.add(createProject({ title: 'Project two' }, { id: 'project-2', now: T1 }));
    await resources.add(createResource({ title: 'Hours', resourceType: 'time', unit: 'hour' }, { id: 'hours', now: T1 }));
    await resources.add(createResource({ title: 'Tokens', resourceType: 'ai', unit: 'token' }, { id: 'tokens', now: T1 }));
    for (const [id, title] of [['task-1', 'Task one'], ['task-2', 'Task two']] as const) {
      const task = createTask({ title, targetDescription: 'Done' });
      await tasks.add({ ...task, id, createdAt: T1, updatedAt: T1 });
      await relations.add(createRelation({ sourceType: 'task', sourceId: id, relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' }, { id: `membership-${id}`, now: T1 }));
    }
    usage = new ResourceUsageService({
      unitOfWork: sqliteUnitOfWork(db), projects: (context) => new SqliteProjectRepository(context), resources: (context) => new SqliteResourceRepository(context), tasks: (context) => new SqliteTaskRepository(context), records: (context) => new SqliteRecordRepository(context), relations: (context) => new SqliteRelationRepository(context),
      clock: { now: () => T3 }, ids: { newId: () => `id-${++nextId}` },
    });
    query = new ResourceUsageQueryService({ records: new SqliteRecordRepository(db), relations, projects, resources, tasks });
  });

  afterEach(async () => db.closeAsync());

  async function record(overrides: Partial<Parameters<typeof usage.record>[0]> = {}) {
    return usage.record({ description: 'Work', actor: 'agent', projectId: 'project-1', resourceId: 'hours', amount: '1', unit: 'hour', occurredAt: T2, idempotencyKey: `key-${nextId + 1}`, ...overrides });
  }

  it('filters immutable original history while Project queries retain both unassigned and Task-attributed usage', async () => {
    const unassigned = await record({ occurredAt: T1 });
    const taskOne = await record({ taskId: 'task-1', occurredAt: T2 });
    const taskTwo = await record({ taskId: 'task-2', occurredAt: T3 });
    const tokens = await record({ resourceId: 'tokens', unit: 'token', occurredAt: T2 });
    expect((await query.listHistory({ projectId: 'project-1' })).map((value) => value.original.recordId)).toEqual([unassigned.recordId, tokens.recordId, taskOne.recordId, taskTwo.recordId]);
    expect((await query.listHistory({ taskId: 'task-1' })).map((value) => value.original.recordId)).toEqual([taskOne.recordId]);
    expect((await query.listHistory({ resourceId: 'tokens' })).map((value) => value.original.recordId)).toEqual([tokens.recordId]);
    expect((await query.listHistory({ occurredAt: { start: T2, end: T2 } })).map((value) => value.original.recordId)).toEqual([tokens.recordId, taskOne.recordId]);
    expect((await query.listHistory({ limit: 1, offset: 1 })).map((value) => value.original.recordId)).toEqual([tokens.recordId]);
  });

  it('retains original and correction trail with exact effective amount and all reconciliation ids', async () => {
    const original = await record({ amount: '1.5', taskId: 'task-1' });
    const correction = await usage.correct({ targetRecordId: original.recordId, description: 'Partial', actor: 'agent', occurredAt: T3, amount: '0.5', idempotencyKey: 'correct-1' });
    const [entry] = await query.listHistory();
    expect(entry.original.amount.toString()).toBe('1.5 hour');
    expect(entry.corrections.map((value) => value.recordId)).toEqual([correction.recordId]);
    expect(entry.effectiveAmount.toString()).toBe('1 hour');
    expect(entry.original).toMatchObject({ recordId: original.recordId, projectRelationId: original.projectRelationId, resourceRelationId: original.resourceRelationId, taskRelationId: original.taskRelationId });
    expect(entry.corrections[0]).toMatchObject({ correctionRelationId: correction.correctionRelationId });
  });

  it('resolves archived referenced catalog entities as historical facts', async () => {
    await record({ taskId: 'task-1' });
    const projects = new SqliteProjectRepository(db);
    const resources = new SqliteResourceRepository(db);
    const tasks = new SqliteTaskRepository(db);
    await projects.save(archiveProject((await projects.getById('project-1'))!, T3));
    await resources.save(archiveResource((await resources.getById('hours'))!, T3));
    await tasks.save(archiveTask((await tasks.getById('task-1'))!, T3));
    const [entry] = await query.listHistory();
    expect([entry.original.project.archivedAt, entry.original.resource.archivedAt, entry.original.task?.archivedAt]).toEqual([T3, T3, T3]);
  });

  it('surfaces malformed semantic links and incompatible historical units', async () => {
    const result = await record();
    const relations = new SqliteRelationRepository(db);
    const link = (await relations.getById(result.resourceRelationId))!;
    await relations.save({ ...link, endedAt: T3 });
    await expect(query.listHistory()).rejects.toBeInstanceOf(ResourceUsageHistoryIntegrityError);
    await relations.save({ ...link, endedAt: null });
    const resources = new SqliteResourceRepository(db);
    const resource = (await resources.getById('hours'))!;
    await resources.save({ ...resource, unit: 'day', updatedAt: T3 });
    await expect(query.listHistory()).rejects.toThrow(/incompatible/);
  });
});
