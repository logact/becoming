import { createLabel } from '../src/domain/label';
import { createProject } from '../src/domain/project';
import { createRelation } from '../src/domain/relation';
import { createWorkflow } from '../src/domain/workflow';
import { createWorkflowState } from '../src/domain/workflowState';
import {
  WORKFLOW_APPLICABILITY_RELATION_TYPE,
  WorkflowApplicabilityAmbiguousError,
  WorkflowApplicabilityArchivedError,
  WorkflowApplicabilityIncompatibleError,
  WorkflowApplicabilityLabelNotFoundError,
  WorkflowApplicabilityMissingError,
  WorkflowApplicabilityProjectNotFoundError,
  WorkflowApplicabilityService,
} from '../src/application/workflowApplicabilityService';
import { RelationService } from '../src/application/relationService';
import { RecordRelationProvenancePort } from '../src/application/relationProvenanceService';
import { SqliteCoreEntityLookup } from '../src/persistence/sqlite/coreEntityLookup';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { SqliteWorkflowRepository } from '../src/persistence/workflowRepository';
import { SqliteWorkflowStateRepository } from '../src/persistence/workflowStateRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-13T00:00:00.000Z';
let relationNumber = 0;

describe('WorkflowApplicabilityService', () => {
  let db: SqliteDatabase;
  let service: WorkflowApplicabilityService<SqliteDatabase>;
  let projectId: string;
  let labelId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    projectId = 'project-1';
    labelId = 'label-1';
    await new SqliteProjectRepository(db).add(createProject({ title: 'M1' }, { id: projectId, now: NOW }));
    const label = createLabel({ name: 'Execution' });
    await new SqliteLabelRepository(db).add({ ...label, id: labelId, createdAt: NOW, updatedAt: NOW });
    const relationService = new RelationService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      relations: (context) => new SqliteRelationRepository(context),
      endpoints: (context) => new SqliteCoreEntityLookup(context),
      provenance: new RecordRelationProvenancePort({
        records: (context) => new SqliteRecordRepository(context),
        clock: { now: () => NOW },
        ids: { newId: () => `relation-audit-${++relationNumber}` },
      }),
      clock: { now: () => NOW },
      ids: { newId: () => `relation-${++relationNumber}` },
    });
    service = new WorkflowApplicabilityService({
      relationService,
      relations: new SqliteRelationRepository(db),
      workflows: new SqliteWorkflowRepository(db),
      labels: new SqliteLabelRepository(db),
      workflowStates: new SqliteWorkflowStateRepository(db),
      entities: new SqliteCoreEntityLookup(db),
    });
  });

  afterEach(async () => { await db.closeAsync(); });

  async function workflow(version: number, options: { purpose?: string; entityType?: 'project' | 'goal' | 'task'; label?: string } = {}) {
    const definition = createWorkflow({ title: `Workflow ${version}`, workflowType: 'execution', purpose: options.purpose ?? 'deliver', version });
    await new SqliteWorkflowRepository(db).add(definition);
    await new SqliteWorkflowStateRepository(db).add(createWorkflowState({
      workflowId: definition.id, entityType: options.entityType ?? 'task', labelId: options.label ?? labelId,
      title: 'Ready', isInitial: true,
    }, { id: `state-${definition.id}`, now: NOW }));
    return definition;
  }

  async function apply(workflowId: string, options: { entityType?: string; purpose?: string; labelId?: string } = {}) {
    return service.create({ projectId, workflowId, entityType: options.entityType ?? 'task', purpose: options.purpose ?? 'deliver', labelId: options.labelId ?? labelId, actor: 'planner' });
  }

  it.each(['project', 'goal', 'task'] as const)('creates semantic applicability for supported %s consumers', async (entityType) => {
    const definition = await workflow(1, { entityType });
    const relation = await apply(definition.id, { entityType });
    expect(relation).toMatchObject({ sourceType: 'project', sourceId: projectId, targetType: 'workflow', targetId: definition.id, relationType: WORKFLOW_APPLICABILITY_RELATION_TYPE });
    expect(relation.metadata).toEqual({ entityType, purpose: 'deliver', labelId, workflowVersion: 1 });
  });

  it('validates project, label, workflow, purpose, and configured machine references', async () => {
    const definition = await workflow(1);
    await expect(service.create({ projectId: 'missing-project', workflowId: definition.id, entityType: 'task', purpose: 'deliver', labelId, actor: 'planner' })).rejects.toBeInstanceOf(WorkflowApplicabilityProjectNotFoundError);
    await expect(apply(definition.id, { labelId: 'missing-label' })).rejects.toBeInstanceOf(WorkflowApplicabilityLabelNotFoundError);
    await expect(apply('missing-workflow')).rejects.toThrow(/workflow.*missing-workflow.*not found/i);
    await expect(apply(definition.id, { purpose: 'different' })).rejects.toBeInstanceOf(WorkflowApplicabilityIncompatibleError);
    await expect(apply(definition.id, { entityType: 'goal' })).rejects.toBeInstanceOf(WorkflowApplicabilityIncompatibleError);
  });

  it('resolves the newest compatible linked version, or an exact version', async () => {
    const v1 = await workflow(1);
    const v2 = await workflow(2);
    await apply(v1.id);
    await apply(v2.id);
    await expect(service.resolve({ projectId, entityType: 'task', purpose: 'deliver', labelId })).resolves.toMatchObject({ workflowId: v2.id, version: 2 });
    await expect(service.resolve({ projectId, entityType: 'task', purpose: 'deliver', labelId, version: 1 })).resolves.toMatchObject({ workflowId: v1.id, version: 1 });
  });

  it('does not initialize from ended applicability while retaining it in history', async () => {
    const definition = await workflow(1);
    const relation = await apply(definition.id);
    await service.end(relation.id, 'planner', '2026-08-13T01:00:00.000Z');
    await expect(service.resolve({ projectId, entityType: 'task', purpose: 'deliver', labelId })).rejects.toBeInstanceOf(WorkflowApplicabilityMissingError);
    await expect(service.listHistory(projectId)).resolves.toEqual([expect.objectContaining({ id: relation.id, endedAt: '2026-08-13T01:00:00.000Z' })]);
  });

  it('reports archived and incompatible selected definitions distinctly', async () => {
    const archived = await workflow(1);
    await apply(archived.id);
    await new SqliteWorkflowRepository(db).save({ ...archived, archivedAt: '2026-08-13T01:00:00.000Z', updatedAt: '2026-08-13T01:00:00.000Z' });
    await expect(service.resolve({ projectId, entityType: 'task', purpose: 'deliver', labelId })).rejects.toBeInstanceOf(WorkflowApplicabilityArchivedError);

    const incompatible = await workflow(2);
    await apply(incompatible.id);
    await new SqliteWorkflowStateRepository(db).save({
      ...(await new SqliteWorkflowStateRepository(db).getById(`state-${incompatible.id}`))!,
      archivedAt: '2026-08-13T01:00:00.000Z', updatedAt: '2026-08-13T01:00:00.000Z',
    });
    await expect(service.resolve({ projectId, entityType: 'task', purpose: 'deliver', labelId, version: 2 })).rejects.toBeInstanceOf(WorkflowApplicabilityIncompatibleError);
  });

  it('never selects arbitrarily among equal current definitions', async () => {
    const first = await workflow(1);
    const second = await workflow(1);
    await apply(first.id);
    await apply(second.id);
    await expect(service.resolve({ projectId, entityType: 'task', purpose: 'deliver', labelId })).rejects.toBeInstanceOf(WorkflowApplicabilityAmbiguousError);
  });
});
