import {
  ActiveTaskAllocationNotFoundError,
  DuplicateActiveTaskAllocationError,
  TaskAllocationService,
} from '../src/application/taskAllocationService';
import { TaskAllocationOverBudgetError, TaskAllocationReferenceNotFoundError } from '../src/domain/taskAllocation';
import { createProject } from '../src/domain/project';
import { createRelation } from '../src/domain/relation';
import { createResource } from '../src/domain/resource';
import { createTask } from '../src/domain/task';
import { ProjectBudgetService } from '../src/application/projectBudgetService';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { NodeSqliteDatabase } from '../src/persistence/sqlite/nodeSqliteDatabase';
import { migrate } from '../src/persistence/migrate';
import { createTestDatabase } from './helpers/testDatabase';
import { closeQuietly } from './helpers/testDatabase';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const CREATED = '2026-08-13T00:00:00.000Z';
const CHANGED = '2026-08-13T01:00:00.000Z';
const ENDED = '2026-08-13T02:00:00.000Z';

describe('TaskAllocationService', () => {
  let db: SqliteDatabase;
  let service: TaskAllocationService<SqliteDatabase>;
  let clockNow = CREATED;
  let id = 0;

  const command = {
    taskId: 'task-1', fundingProjectId: 'project-1', resourceId: 'resource-1',
    amount: '4', unit: 'hour', projectContext: 'delivery', overallocationPolicy: 'reject' as const,
    actor: 'planner',
  };

  beforeEach(async () => {
    db = await createTestDatabase();
    id = 0;
    clockNow = CREATED;
    const ports = {
      unitOfWork: sqliteUnitOfWork(db),
      tasks: (context: SqliteDatabase) => new SqliteTaskRepository(context),
      projects: (context: SqliteDatabase) => new SqliteProjectRepository(context),
      resources: (context: SqliteDatabase) => new SqliteResourceRepository(context),
      relations: (context: SqliteDatabase) => new SqliteRelationRepository(context),
      records: (context: SqliteDatabase) => new SqliteRecordRepository(context),
      clock: { now: () => clockNow },
      ids: { newId: () => `allocation-service-${++id}` },
    };
    service = new TaskAllocationService(ports);
    await ports.tasks(db).add({ ...createTask({ title: 'Implement allocation', targetDescription: 'Allocation service' }), id: 'task-1', createdAt: CREATED, updatedAt: CREATED });
    await ports.projects(db).add(createProject({ title: 'Release' }, { id: 'project-1', now: CREATED }));
    await ports.resources(db).add(createResource({ title: 'Engineering', resourceType: 'time', unit: 'hour', capacity: '40' }, { id: 'resource-1', now: CREATED }));
    await ports.resources(db).add(createResource({ title: 'Tokens', resourceType: 'token', unit: 'token', capacity: '1000' }, { id: 'resource-2', now: CREATED }));
    await ports.relations(db).add(createRelation({ sourceType: 'task', sourceId: 'task-1', relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' }, { id: 'membership-1', now: CREATED }));
    await new ProjectBudgetService(ports).createProjectBudget({
      projectId: 'project-1', resourceId: 'resource-1', amount: '10', unit: 'hour',
      projectContext: 'delivery', capacityPolicy: 'reject', actor: 'planner',
    });
  });

  afterEach(async () => db.closeAsync());

  async function allocations() {
    return new SqliteRelationRepository(db).listHistory({ relationType: 'allocated', limit: 100 });
  }

  async function audits() {
    return new SqliteRecordRepository(db).list({ status: 'all', recordType: PROVENANCE_RECORD_TYPE, limit: 100 });
  }

  it('creates explicit allocation plans, checks their aggregate, and appends committed provenance', async () => {
    const created = await service.createTaskAllocation(command);
    expect(created.relation).toMatchObject({ sourceId: 'task-1', targetId: 'resource-1', relationType: 'allocated', endedAt: null });
    expect(created.budget).toMatchObject({ status: 'below_budget', total: expect.objectContaining({}) });
    expect((await allocations()).map((relation) => relation.id)).toEqual([created.relation.id]);
    expect((await audits()).map((record) => (record.payload as { action: string }).action)).toEqual([
      'project_budget_created', 'task_allocation_created',
    ]);
  });

  it('rejects stale references, absent membership/budget, incompatible units, duplicate identity, and reject over-budget before a write', async () => {
    await expect(service.createTaskAllocation({ ...command, taskId: 'missing' })).rejects.toBeInstanceOf(TaskAllocationReferenceNotFoundError);
    await new SqliteRelationRepository(db).save({ ...(await new SqliteRelationRepository(db).getById('membership-1'))!, endedAt: CHANGED });
    await expect(service.createTaskAllocation(command)).rejects.toBeInstanceOf(TaskAllocationReferenceNotFoundError);
    await new SqliteRelationRepository(db).add(createRelation({ sourceType: 'task', sourceId: 'task-1', relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' }, { id: 'membership-2', now: CHANGED }));
    await expect(service.createTaskAllocation({ ...command, projectContext: 'contingency' })).rejects.toBeInstanceOf(TaskAllocationReferenceNotFoundError);
    await expect(service.createTaskAllocation({ ...command, unit: 'day' })).rejects.toThrow(/incompatible/);
    const created = await service.createTaskAllocation(command);
    await expect(service.createTaskAllocation(command)).rejects.toBeInstanceOf(DuplicateActiveTaskAllocationError);
    await expect(service.createTaskAllocation({ ...command, taskId: 'task-1', amount: '7', projectContext: 'delivery', overallocationPolicy: 'reject' }))
      .rejects.toBeInstanceOf(DuplicateActiveTaskAllocationError);
    expect((await allocations()).map((relation) => relation.id)).toEqual([created.relation.id]);
  });

  it('enforces reject-or-flag over-allocation across active tasks in the exact Project budget', async () => {
    const first = await service.createTaskAllocation(command);
    await new SqliteTaskRepository(db).add({ ...createTask({ title: 'Review', targetDescription: 'Review allocation' }), id: 'task-2', createdAt: CREATED, updatedAt: CREATED });
    await new SqliteRelationRepository(db).add(createRelation({ sourceType: 'task', sourceId: 'task-2', relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' }, { id: 'membership-task-2', now: CREATED }));
    await expect(service.createTaskAllocation({ ...command, taskId: 'task-2', amount: '7' })).rejects.toBeInstanceOf(TaskAllocationOverBudgetError);
    const flagged = await service.createTaskAllocation({ ...command, taskId: 'task-2', amount: '7', overallocationPolicy: 'flag' });
    expect(first.budget.status).toBe('below_budget');
    expect(flagged.budget).toMatchObject({ status: 'over_budget', policy: 'flag' });
    expect(await allocations()).toHaveLength(2);
  });

  it('supersedes atomically and ends without deleting historical allocations', async () => {
    const original = await service.createTaskAllocation(command);
    clockNow = CHANGED;
    const changed = await service.changeTaskAllocation({ ...command, amount: '6', cause: 're-estimate' });
    expect(changed.priorRelation).toEqual({ ...original.relation, endedAt: CHANGED });
    expect(changed.relation).toMatchObject({ createdAt: CHANGED, endedAt: null });
    clockNow = ENDED;
    const ended = await service.endTaskAllocation({ relationId: changed.relation.id, actor: 'planner' });
    expect(ended).toEqual({ ...changed.relation, endedAt: ENDED });
    await expect(service.supersedeTaskAllocation({ ...command, amount: '5' })).rejects.toBeInstanceOf(ActiveTaskAllocationNotFoundError);
    expect((await audits()).map((record) => (record.payload as { action: string }).action)).toEqual([
      'project_budget_created', 'task_allocation_created', 'task_allocation_superseded', 'task_allocation_ended',
    ]);
  });

  it('serializes competing aggregate checks so only one allocation can consume the remaining budget', async () => {
    const location = join(tmpdir(), `task-allocation-race-${process.pid}-${Date.now()}.sqlite`);
    const dbA = new NodeSqliteDatabase(location);
    let dbB: NodeSqliteDatabase | null = null;
    try {
      await migrate(dbA);
      const makeService = (database: SqliteDatabase, suffix: string) => new TaskAllocationService({
        unitOfWork: sqliteUnitOfWork(database),
        tasks: (context: SqliteDatabase) => new SqliteTaskRepository(context),
        projects: (context: SqliteDatabase) => new SqliteProjectRepository(context),
        resources: (context: SqliteDatabase) => new SqliteResourceRepository(context),
        relations: (context: SqliteDatabase) => new SqliteRelationRepository(context),
        records: (context: SqliteDatabase) => new SqliteRecordRepository(context),
        clock: { now: () => CREATED }, ids: { newId: () => `race-${suffix}-${Math.random()}` },
      });
      const tasks = new SqliteTaskRepository(dbA);
      const projects = new SqliteProjectRepository(dbA);
      const resources = new SqliteResourceRepository(dbA);
      const relations = new SqliteRelationRepository(dbA);
      await projects.add(createProject({ title: 'Release' }, { id: 'project-1', now: CREATED }));
      await resources.add(createResource({ title: 'Engineering', resourceType: 'time', unit: 'hour', capacity: '40' }, { id: 'resource-1', now: CREATED }));
      for (const taskId of ['task-1', 'task-2', 'task-3']) {
        await tasks.add({ ...createTask({ title: taskId, targetDescription: taskId }), id: taskId, createdAt: CREATED, updatedAt: CREATED });
        await relations.add(createRelation({ sourceType: 'task', sourceId: taskId, relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' }, { id: `membership-${taskId}`, now: CREATED }));
      }
      const setup = makeService(dbA, 'setup');
      await new ProjectBudgetService({
        unitOfWork: sqliteUnitOfWork(dbA), projects: (context) => new SqliteProjectRepository(context),
        resources: (context) => new SqliteResourceRepository(context), relations: (context) => new SqliteRelationRepository(context),
        records: (context) => new SqliteRecordRepository(context), clock: { now: () => CREATED }, ids: { newId: () => `budget-race-${Math.random()}` },
      }).createProjectBudget({ projectId: 'project-1', resourceId: 'resource-1', amount: '10', unit: 'hour', projectContext: 'delivery', capacityPolicy: 'reject', actor: 'planner' });
      await setup.createTaskAllocation({ ...command, taskId: 'task-1', amount: '4' });
      dbB = new NodeSqliteDatabase(location);
      const results = await Promise.allSettled([
        makeService(dbA, 'a').createTaskAllocation({ ...command, taskId: 'task-2', amount: '6' }),
        makeService(dbB, 'b').createTaskAllocation({ ...command, taskId: 'task-3', amount: '6' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await new SqliteRelationRepository(dbA).listCurrent({ relationType: 'allocated', limit: 100 })).toHaveLength(2);
    } finally {
      await closeQuietly(dbA);
      if (dbB !== null) await closeQuietly(dbB);
      rmSync(location, { force: true });
    }
  });
});
