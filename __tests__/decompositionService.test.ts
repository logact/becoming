import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  DecompositionCycleError,
  DecompositionGraphIntegrityError,
  DecompositionService,
} from '../src/application/decompositionService';
import { RecordDecompositionProvenancePort } from '../src/application/decompositionProvenanceService';
import { createGoal } from '../src/domain/goal';
import { createProject } from '../src/domain/project';
import { createTask } from '../src/domain/task';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { migrate } from '../src/persistence/migrate';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { NodeSqliteDatabase } from '../src/persistence/sqlite/nodeSqliteDatabase';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T09:00:00.000Z';
const T1 = '2026-08-13T10:00:00.000Z';
let sequence = 0;

function service(db: SqliteDatabase, prefix = 'decomposition', bounds?: { maxDepth?: number; maxNodes?: number }) {
  return new DecompositionService<SqliteDatabase>({
    unitOfWork: sqliteUnitOfWork(db),
    projects: (context) => new SqliteProjectRepository(context), goals: (context) => new SqliteGoalRepository(context),
    tasks: (context) => new SqliteTaskRepository(context), relations: (context) => new SqliteRelationRepository(context),
    workflowGuidance: { resolve: async () => ({ status: 'resolved' as const, workflowId: 'decomposition-workflow', version: 1 }) },
    provenance: new RecordDecompositionProvenancePort({ records: (context) => new SqliteRecordRepository(context), clock: { now: () => T0 }, ids: { newId: () => `${prefix}-audit-${++sequence}` } }),
    clock: { now: () => T0 }, ids: { newId: () => `${prefix}-relation-${++sequence}` }, traversal: bounds,
  });
}

async function seed(db: SqliteDatabase) {
  const project = createProject({ title: 'Project' }, { id: 'project', now: T0 });
  const goals = ['goal-a', 'goal-b', 'goal-c'].map((id) => createGoal({ title: id, targetState: 'Done' }, { id, now: T0 }));
  const tasks = ['task-a', 'task-b'].map((id) => ({ ...createTask({ title: id, targetDescription: 'Done' }), id, createdAt: T0, updatedAt: T0 }));
  await new SqliteProjectRepository(db).add(project);
  for (const goal of goals) await new SqliteGoalRepository(db).add(goal);
  for (const task of tasks) await new SqliteTaskRepository(db).add(task);
  const relations = new SqliteRelationRepository(db);
  for (const goal of goals) await relations.add({ id: `pursuit-${goal.id}`, sourceType: 'project', sourceId: project.id, relationType: 'contributes_to', targetType: 'goal', targetId: goal.id, metadata: null, createdAt: T0, endedAt: null });
  for (const task of tasks) await relations.add({ id: `membership-${task.id}`, sourceType: 'task', sourceId: task.id, relationType: 'belongs_to', targetType: 'project', targetId: project.id, metadata: null, createdAt: T0, endedAt: null });
  return { project, goals, tasks, relations };
}

describe('DecompositionService', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); });
  afterEach(async () => { await closeQuietly(db); });

  it('creates each supported hierarchy direction and atomically records Project/endpoints/workflow context', async () => {
    await seed(db); const decompositions = service(db);
    const goalGoal = await decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'planner' });
    const goalTask = await decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-c', childType: 'task', childId: 'task-a', managementLabelId: 'label', actor: 'planner' });
    const taskTask = await decompositions.create({ projectId: 'project', parentType: 'task', parentId: 'task-a', childType: 'task', childId: 'task-b', managementLabelId: 'label', actor: 'planner' });
    expect(goalGoal.workflow).toEqual({ status: 'resolved', workflowId: 'decomposition-workflow', version: 1 });
    expect(goalTask.relation.metadata).toEqual(decompositionMetadata('project'));
    expect(taskTask.relation.endedAt).toBeNull();
    const payloads = (await db.getAllAsync<{ payload: string }>('SELECT payload FROM records')).map(({ payload }) => JSON.parse(payload));
    expect(payloads[0]).toMatchObject({ relationType: 'decomposes', decomposition: { projectId: 'project', parent: { type: 'goal', id: 'goal-a' }, child: { type: 'goal', id: 'goal-b' }, workflow: { workflowId: 'decomposition-workflow', version: 1 } } });
  });

  it('rejects direct and indirect cycles without writing', async () => {
    const { relations } = await seed(db); const decompositions = service(db);
    await decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'planner' });
    await expect(decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-b', childType: 'goal', childId: 'goal-a', managementLabelId: 'label', actor: 'planner' })).rejects.toBeInstanceOf(DecompositionCycleError);
    await relations.add({ id: 'deep-edge', sourceType: 'goal', sourceId: 'goal-b', relationType: 'decomposes', targetType: 'goal', targetId: 'goal-c', metadata: decompositionMetadata('project'), createdAt: T0, endedAt: null });
    await expect(decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-c', childType: 'goal', childId: 'goal-a', managementLabelId: 'label', actor: 'planner' })).rejects.toBeInstanceOf(DecompositionCycleError);
    expect(await new SqliteRelationRepository(db).listCurrent({ relationType: 'decomposes' })).toHaveLength(2);
  });

  it('fails closed on existing malformed cycles and configured graph bounds', async () => {
    const { relations } = await seed(db);
    await relations.add({ id: 'bad-a', sourceType: 'goal', sourceId: 'goal-b', relationType: 'decomposes', targetType: 'goal', targetId: 'goal-c', metadata: decompositionMetadata('project'), createdAt: T0, endedAt: null });
    await relations.add({ id: 'bad-b', sourceType: 'goal', sourceId: 'goal-c', relationType: 'decomposes', targetType: 'goal', targetId: 'goal-b', metadata: decompositionMetadata('project'), createdAt: T0, endedAt: null });
    await expect(service(db).create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'planner' })).rejects.toBeInstanceOf(DecompositionGraphIntegrityError);
    await expect(service(db, 'bounded', { maxDepth: 1 }).create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'planner' })).rejects.toBeInstanceOf(DecompositionGraphIntegrityError);
  });

  it('ends, preserves and re-establishes an edge; repeated ends are idempotent', async () => {
    await seed(db); const decompositions = service(db); const first = await decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'planner' });
    const ended = await decompositions.end({ relationId: first.relation.id, actor: 'planner', endedAt: T1 });
    const repeated = await decompositions.end({ relationId: first.relation.id, actor: 'planner' });
    const restarted = await decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'planner', occurredAt: T1 });
    expect(ended).toEqual({ ...first.relation, endedAt: T1 }); expect(repeated).toEqual(ended); expect(restarted.relation.id).not.toBe(first.relation.id);
    expect(await db.getAllAsync('SELECT id FROM records')).toHaveLength(3);
  });

  it('rolls the relation back when decomposition provenance fails', async () => {
    await seed(db);
    const decompositions = new DecompositionService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db), projects: (context) => new SqliteProjectRepository(context),
      goals: (context) => new SqliteGoalRepository(context), tasks: (context) => new SqliteTaskRepository(context),
      relations: (context) => new SqliteRelationRepository(context),
      workflowGuidance: { resolve: async () => ({ status: 'resolved' as const, workflowId: 'workflow', version: 1 }) },
      provenance: { append: async () => { throw new Error('audit unavailable'); } },
      clock: { now: () => T0 }, ids: { newId: () => 'rolled-back-edge' },
    });
    await expect(decompositions.create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'planner' })).rejects.toThrow('audit unavailable');
    expect(await new SqliteRelationRepository(db).listCurrent({ relationType: 'decomposes' })).toEqual([]);
  });
});

describe('DecompositionService concurrency', () => {
  it('serializes opposing edge creates so no cycle commits', async () => {
    const file = join(tmpdir(), `decomposition-${process.pid}-${Date.now()}.sqlite`); const dbA = new NodeSqliteDatabase(file); let dbB: NodeSqliteDatabase | undefined;
    try {
      await migrate(dbA); await seed(dbA); dbB = new NodeSqliteDatabase(file);
      const results = await Promise.allSettled([
        service(dbA, 'a').create({ projectId: 'project', parentType: 'goal', parentId: 'goal-a', childType: 'goal', childId: 'goal-b', managementLabelId: 'label', actor: 'a' }),
        service(dbB, 'b').create({ projectId: 'project', parentType: 'goal', parentId: 'goal-b', childType: 'goal', childId: 'goal-a', managementLabelId: 'label', actor: 'b' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    } finally { await closeQuietly(dbA); if (dbB !== undefined) await closeQuietly(dbB); rmSync(file, { force: true }); }
  });
});
