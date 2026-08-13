import { ProjectBudgetQueryService } from '../src/application/projectBudgetQueryService';
import { ProjectBudgetService } from '../src/application/projectBudgetService';
import { createProject } from '../src/domain/project';
import { createResource } from '../src/domain/resource';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';
const T3 = '2026-08-13T03:00:00.000Z';

describe('ProjectBudgetQueryService', () => {
  let db: SqliteDatabase;
  let mutations: ProjectBudgetService<SqliteDatabase>;
  let queries: ProjectBudgetQueryService;
  let now = T0;
  let id = 0;

  beforeEach(async () => {
    db = await createTestDatabase();
    now = T0;
    id = 0;
    const projects = new SqliteProjectRepository(db);
    const resources = new SqliteResourceRepository(db);
    await projects.add(createProject({ title: 'One' }, { id: 'project-1', now: T0 }));
    await projects.add(createProject({ title: 'Two' }, { id: 'project-2', now: T0 }));
    await resources.add(createResource({ title: 'Hours', resourceType: 'time', unit: 'hour', capacity: '10' }, { id: 'resource-1', now: T0 }));
    mutations = new ProjectBudgetService({
      unitOfWork: sqliteUnitOfWork(db), projects: (context) => new SqliteProjectRepository(context),
      resources: (context) => new SqliteResourceRepository(context),
      relations: (context) => new SqliteRelationRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => now }, ids: { newId: () => `budget-${++id}` },
    });
    queries = new ProjectBudgetQueryService({
      relations: new SqliteRelationRepository(db), resources,
      clock: { now: () => now },
    });
  });

  afterEach(async () => db.closeAsync());

  const base = {
    projectId: 'project-1', resourceId: 'resource-1', amount: '2.00', unit: 'hour',
    projectContext: 'delivery', capacityPolicy: 'surface' as const, actor: 'planner',
  };

  it('selects active relations at half-open temporal boundaries and preserves history reconciliation', async () => {
    const first = await mutations.createProjectBudget(base);
    now = T1;
    const second = await mutations.supersedeProjectBudget({ ...base, amount: '3' });

    expect((await queries.getActiveBudget({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery', asOf: T0 }))?.relationId).toBe(first.relation.id);
    expect((await queries.getActiveBudget({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery', asOf: T1 }))?.relationId).toBe(second.relation.id);
    expect(await queries.getActiveBudget({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery', asOf: T2 })).toMatchObject({ relationId: second.relation.id, amount: { unit: 'hour' } });
    now = T2;
    await mutations.endProjectBudget({ relationId: second.relation.id, actor: 'planner' });
    expect(await queries.getActiveBudget({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery', asOf: T2 })).toBeNull();
    const history = await queries.listBudgetHistory({ projectId: 'project-1', resourceId: 'resource-1', projectContext: 'delivery' });
    expect(history.map((budget) => [budget.relationId, budget.validFrom, budget.validUntil, budget.relation.id]))
      .toEqual([[first.relation.id, T0, T1, first.relation.id], [second.relation.id, T1, T2, second.relation.id]]);
  });

  it('uses optional business-effective bounds rather than only created/ended timestamps', async () => {
    await mutations.createProjectBudget({ ...base, effectiveFrom: T1, effectiveUntil: T2 });
    expect(await queries.listActiveBudgetsForProject('project-1', { asOf: T0 })).toEqual([]);
    expect((await queries.listActiveBudgetsForProject('project-1', { asOf: T1 }))[0].amount.toString()).toBe('2 hour');
    expect(await queries.listActiveBudgetsForProject('project-1', { asOf: T2 })).toEqual([]);
  });

  it('reconciles exact multi-project commitments and reports policies without mutation', async () => {
    const first = await mutations.createProjectBudget({ ...base, amount: '4.25' });
    const second = await mutations.createProjectBudget({ ...base, projectId: 'project-2', amount: '5.75', capacityPolicy: 'reject' });
    const diagnostic = await queries.getCapacityDiagnostics('resource-1');

    expect(diagnostic).toMatchObject({ status: 'at_capacity', configuredPolicies: ['reject', 'surface'] });
    if (diagnostic.status === 'at_capacity') {
      expect(diagnostic.capacity.toString()).toBe('10 hour');
      expect(diagnostic.committed.toString()).toBe('10 hour');
      expect(diagnostic.remaining.toString()).toBe('0 hour');
      expect(diagnostic.variance.toString()).toBe('0 hour');
      expect(diagnostic.activeBudgets.map((budget) => budget.relationId)).toEqual([first.relation.id, second.relation.id]);
    }
    now = T1;
    await mutations.createProjectBudget({ ...base, projectId: 'project-1', projectContext: 'contingency', amount: '0.01' });
    const over = await queries.getCapacityDiagnostics('resource-1');
    expect(over.status).toBe('over_capacity');
    if (over.status === 'over_capacity') expect(over.variance.toString()).toBe('0.01 hour');
  });

  it('surfaces unspecified capacity and unit mismatches without altering the temporal relation', async () => {
    await new SqliteResourceRepository(db).add(createResource(
      { title: 'Unbounded', resourceType: 'time', unit: 'hour' }, { id: 'resource-2', now: T0 },
    ));
    await mutations.createProjectBudget({ ...base, resourceId: 'resource-2' });
    expect(await queries.getCapacityDiagnostics('resource-2')).toMatchObject({ status: 'capacity_unspecified' });

    const relation = await new SqliteRelationRepository(db).getById('budget-1');
    expect(relation).not.toBeNull();
    // A malformed historical import must be visible as a diagnostic, never repaired on read.
    await db.runAsync("UPDATE relations SET metadata = ? WHERE id = ?", [JSON.stringify({ ...(relation!.metadata as object), unit: 'day' }), relation!.id]);
    const mismatch = await queries.getCapacityDiagnostics('resource-2');
    expect(mismatch).toMatchObject({ status: 'unit_mismatch', mismatchedBudgetRelationIds: [relation!.id] });
    expect((await new SqliteRelationRepository(db).getById(relation!.id))?.endedAt).toBeNull();
  });
});
