import {
  TaskAllocationQueryService,
  TaskAllocationUnitMismatchError,
} from '../src/application/taskAllocationQueryService';
import { TaskAllocationService } from '../src/application/taskAllocationService';
import { ProjectBudgetService } from '../src/application/projectBudgetService';
import { createProject } from '../src/domain/project';
import { createRelation } from '../src/domain/relation';
import { createResource } from '../src/domain/resource';
import { createTask } from '../src/domain/task';
import type { SqliteDatabase } from '../src/persistence/database';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';

describe('TaskAllocationQueryService (#69)', () => {
  let db: SqliteDatabase;
  let now = T0;
  let id = 0;
  let allocations: TaskAllocationService<SqliteDatabase>;
  let budgets: ProjectBudgetService<SqliteDatabase>;
  let queries: TaskAllocationQueryService;

  beforeEach(async () => {
    db = await createTestDatabase();
    now = T0;
    id = 0;
    const ports = {
      unitOfWork: sqliteUnitOfWork(db),
      tasks: (context: SqliteDatabase) => new SqliteTaskRepository(context),
      projects: (context: SqliteDatabase) => new SqliteProjectRepository(context),
      resources: (context: SqliteDatabase) => new SqliteResourceRepository(context),
      relations: (context: SqliteDatabase) => new SqliteRelationRepository(context),
      records: (context: SqliteDatabase) => new SqliteRecordRepository(context),
      clock: { now: () => now }, ids: { newId: () => `relation-${++id}` },
    };
    allocations = new TaskAllocationService(ports);
    budgets = new ProjectBudgetService(ports);
    queries = new TaskAllocationQueryService({ relations: new SqliteRelationRepository(db), clock: { now: () => now } });
    for (const taskId of ['task-1', 'task-2', 'task-3']) {
      await ports.tasks(db).add({ ...createTask({ title: taskId, targetDescription: taskId }), id: taskId, createdAt: T0, updatedAt: T0 });
      await ports.relations(db).add(createRelation({ sourceType: 'task', sourceId: taskId, relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' }, { id: `membership-${taskId}`, now: T0 }));
    }
    await ports.projects(db).add(createProject({ title: 'One' }, { id: 'project-1', now: T0 }));
    await ports.projects(db).add(createProject({ title: 'Two' }, { id: 'project-2', now: T0 }));
    await ports.resources(db).add(createResource({ title: 'Hours', resourceType: 'time', unit: 'hour' }, { id: 'resource-1', now: T0 }));
    await ports.resources(db).add(createResource({ title: 'Tokens', resourceType: 'token', unit: 'token' }, { id: 'resource-2', now: T0 }));
    await budgets.createProjectBudget({ projectId: 'project-1', resourceId: 'resource-1', amount: '10', unit: 'hour', projectContext: 'delivery', capacityPolicy: 'surface', actor: 'planner' });
    await budgets.createProjectBudget({ projectId: 'project-1', resourceId: 'resource-1', amount: '2', unit: 'hour', projectContext: 'contingency', capacityPolicy: 'surface', actor: 'planner' });
  });

  afterEach(async () => db.closeAsync());

  const delivery = (taskId: string, amount: string, policy: 'reject' | 'flag' = 'reject') => ({
    taskId, fundingProjectId: 'project-1', resourceId: 'resource-1', amount, unit: 'hour',
    projectContext: 'delivery', overallocationPolicy: policy, actor: 'planner',
  });

  it('returns explicit active Task plans and exact Project/Resource totals with relation reconciliation', async () => {
    const first = await allocations.createTaskAllocation(delivery('task-1', '4.1'));
    const second = await allocations.createTaskAllocation(delivery('task-2', '5.9'));
    await allocations.createTaskAllocation({ ...delivery('task-3', '2'), projectContext: 'contingency' });

    const taskPlans = await queries.listActiveAllocationsForTask('task-1');
    expect(taskPlans).toHaveLength(1);
    expect(taskPlans[0]).toMatchObject({ relationId: first.relation.id, fundingProjectId: 'project-1', projectContext: 'delivery' });
    const total = await queries.getActiveAllocationTotal({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery' });
    expect(total.total?.toString()).toBe('10 hour');
    expect(total.contributingRelationIds).toEqual([first.relation.id, second.relation.id]);
    expect(total.allocations.map((entry) => entry.relation.id)).toEqual(total.contributingRelationIds);
    expect((await queries.getActiveAllocationTotal({ projectId: 'project-1', resourceId: 'resource-1' })).total?.toString()).toBe('12 hour');
    expect((await queries.getActiveAllocationTotalForResource('resource-1')).total?.toString()).toBe('12 hour');
  });

  it('preserves chronological history and uses half-open temporal bounds through supersession and ending', async () => {
    const first = await allocations.createTaskAllocation(delivery('task-1', '4'));
    now = T1;
    const successor = await allocations.supersedeTaskAllocation(delivery('task-1', '6'));
    now = T2;
    await allocations.endTaskAllocation({ relationId: successor.relation.id, actor: 'planner' });

    const history = await queries.listAllocationHistory({ taskId: 'task-1' });
    expect(history.map((entry) => [entry.relationId, entry.validFrom, entry.validUntil]))
      .toEqual([[first.relation.id, T0, T1], [successor.relation.id, T1, T2]]);
    expect((await queries.listActiveAllocationsForTask('task-1', { asOf: T0 })).map((entry) => entry.relationId)).toEqual([first.relation.id]);
    expect((await queries.listActiveAllocationsForTask('task-1', { asOf: T1 })).map((entry) => entry.relationId)).toEqual([successor.relation.id]);
    expect(await queries.listActiveAllocationsForTask('task-1', { asOf: T2 })).toEqual([]);
  });

  it('reports exact budget boundaries and makes a flagged excess informational', async () => {
    await allocations.createTaskAllocation(delivery('task-1', '4'));
    await allocations.createTaskAllocation(delivery('task-2', '6'));
    const exact = await queries.getBudgetDiagnostics({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery' });
    expect(exact).toMatchObject({ status: 'at_budget', unit: 'hour' });
    if (exact.status !== 'budget_missing') {
      expect(exact.budget.toString()).toBe('10 hour');
      expect(exact.allocated.toString()).toBe('10 hour');
      expect(exact.variance.toString()).toBe('0 hour');
    }
    now = T1;
    await allocations.endTaskAllocation({ relationId: (await queries.listActiveAllocationsForTask('task-2'))[0].relationId, actor: 'planner' });
    await allocations.createTaskAllocation(delivery('task-2', '7', 'flag'));
    const flagged = await queries.getBudgetDiagnostics({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery' });
    expect(flagged).toMatchObject({ status: 'over_budget_flag', overallocationPolicies: ['flag', 'reject'] });
    if (flagged.status !== 'budget_missing') expect(flagged.variance.toString()).toBe('1 hour');
  });

  it('rejects corrupt active unit mixtures deterministically instead of combining them', async () => {
    const first = await allocations.createTaskAllocation(delivery('task-1', '4'));
    const second = await allocations.createTaskAllocation(delivery('task-2', '5'));
    await db.runAsync('UPDATE relations SET metadata = ? WHERE id = ?', [
      JSON.stringify({ ...(second.relation.metadata as object), unit: 'day' }), second.relation.id,
    ]);
    await expect(queries.getActiveAllocationTotal({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery' }))
      .rejects.toEqual(expect.objectContaining({
        name: TaskAllocationUnitMismatchError.name,
        mismatchedRelationIds: [second.relation.id],
      }));
    expect((await new SqliteRelationRepository(db).getById(first.relation.id))?.endedAt).toBeNull();
  });
});
