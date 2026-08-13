import {
  ActiveProjectBudgetNotFoundError,
  DuplicateActiveProjectBudgetError,
  ProjectBudgetService,
} from '../src/application/projectBudgetService';
import { ProjectBudgetCapacityExceededError, ProjectBudgetReferenceNotFoundError } from '../src/domain/projectBudget';
import { createProject } from '../src/domain/project';
import { createResource } from '../src/domain/resource';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { createTestDatabase } from './helpers/testDatabase';

const CREATED = '2026-08-13T00:00:00.000Z';
const CHANGED = '2026-08-13T01:00:00.000Z';
const ENDED = '2026-08-13T02:00:00.000Z';

describe('ProjectBudgetService', () => {
  let db: SqliteDatabase;
  let service: ProjectBudgetService<SqliteDatabase>;
  let clockNow = CREATED;
  let id = 0;

  beforeEach(async () => {
    db = await createTestDatabase();
    clockNow = CREATED;
    id = 0;
    service = new ProjectBudgetService({
      unitOfWork: sqliteUnitOfWork(db),
      projects: (context) => new SqliteProjectRepository(context),
      resources: (context) => new SqliteResourceRepository(context),
      relations: (context) => new SqliteRelationRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => clockNow },
      ids: { newId: () => `budget-service-${++id}` },
    });
    await new SqliteProjectRepository(db).add(createProject(
      { title: 'Ship the first release' }, { id: 'project-1', now: CREATED },
    ));
    await new SqliteResourceRepository(db).add(createResource(
      { title: 'Development time', resourceType: 'time', unit: 'hour', capacity: '40' },
      { id: 'resource-1', now: CREATED },
    ));
    await new SqliteResourceRepository(db).add(createResource(
      { title: 'Token budget', resourceType: 'token', unit: 'token', capacity: '1000' },
      { id: 'resource-2', now: CREATED },
    ));
  });

  afterEach(async () => db.closeAsync());

  async function audits() {
    return new SqliteRecordRepository(db).list({
      status: 'all', recordType: PROVENANCE_RECORD_TYPE, limit: 100,
    });
  }

  const command = {
    projectId: 'project-1', resourceId: 'resource-1', amount: '8.00', unit: 'hour',
    projectContext: 'delivery', capacityPolicy: 'reject' as const, actor: 'planner',
  };

  it('creates multiple resource budgets, preserving exact amount and a create audit', async () => {
    const created = await service.createProjectBudget(command);
    const separate = await service.createProjectBudget({
      ...command, resourceId: 'resource-2', amount: '500', unit: 'token', projectContext: 'ai',
    });

    expect(created.relation.metadata).toMatchObject({ amount: '8', unit: 'hour' });
    expect(created.capacity.status).toBe('within_capacity');
    expect(separate.relation.targetId).toBe('resource-2');
    expect(await new SqliteRelationRepository(db).listHistory({ relationType: 'budgeted_by' }))
      .toHaveLength(2);
    expect((await audits()).map((record) => (record.payload as { action: string }).action))
      .toEqual(['project_budget_created', 'project_budget_created']);
  });

  it('rejects missing/archived references, unit mismatch, duplicate contexts, and reject capacity before writes', async () => {
    await expect(service.createProjectBudget({ ...command, projectId: 'missing' }))
      .rejects.toBeInstanceOf(ProjectBudgetReferenceNotFoundError);
    await expect(service.createProjectBudget({ ...command, resourceId: 'resource-2', unit: 'hour' }))
      .rejects.toThrow(/incompatible/);
    await expect(service.createProjectBudget({ ...command, amount: '41' }))
      .rejects.toBeInstanceOf(ProjectBudgetCapacityExceededError);
    const created = await service.createProjectBudget(command);
    await expect(service.createProjectBudget(command))
      .rejects.toBeInstanceOf(DuplicateActiveProjectBudgetError);

    expect((await new SqliteRelationRepository(db).listHistory({ relationType: 'budgeted_by' }))
      .map((relation) => relation.id)).toEqual([created.relation.id]);
    expect(await audits()).toHaveLength(1);
  });

  it('surfaces over-capacity policy outcomes while committing the intended budget', async () => {
    const created = await service.createProjectBudget({
      ...command, amount: '41', capacityPolicy: 'surface', cause: { approvedBy: 'planner' },
    });

    expect(created.capacity.status).toBe('exceeds_capacity');
    expect((await audits())[0].payload).toMatchObject({
      action: 'project_budget_created', cause: { approvedBy: 'planner' },
    });
  });

  it('supersedes atomically by ending the old relation and appending its successor with provenance', async () => {
    const original = await service.createProjectBudget(command);
    clockNow = CHANGED;
    const changed = await service.changeProjectBudget({ ...command, amount: '12', cause: 're-estimate' });

    expect(changed.priorRelation).toEqual({ ...original.relation, endedAt: CHANGED });
    expect(changed.relation.createdAt).toBe(CHANGED);
    expect(changed.relation.endedAt).toBeNull();
    const relations = await new SqliteRelationRepository(db).listHistory({ relationType: 'budgeted_by' });
    expect(relations).toEqual([changed.priorRelation, changed.relation]);
    expect((await audits()).map((record) => record.payload)).toEqual([
      expect.objectContaining({ action: 'project_budget_created', priorRelationId: null, newRelationId: original.relation.id }),
      expect.objectContaining({ action: 'project_budget_superseded', priorRelationId: original.relation.id, newRelationId: changed.relation.id }),
    ]);
  });

  it('ends without deleting the temporal relation and rejects superseding no active budget', async () => {
    const created = await service.createProjectBudget(command);
    clockNow = ENDED;
    const ended = await service.endProjectBudget({ relationId: created.relation.id, actor: 'planner', cause: 'project paused' });

    expect(ended).toEqual({ ...created.relation, endedAt: ENDED });
    expect(await new SqliteRelationRepository(db).getById(created.relation.id)).toEqual(ended);
    await expect(service.supersedeProjectBudget({ ...command, amount: '10' }))
      .rejects.toBeInstanceOf(ActiveProjectBudgetNotFoundError);
    expect((await audits()).map((record) => (record.payload as { action: string }).action))
      .toEqual(['project_budget_created', 'project_budget_ended']);
  });
});
