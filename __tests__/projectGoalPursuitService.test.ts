import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ProjectGoalPursuitService, DuplicateActiveGoalPursuitError, GoalAlreadyPursuedByProjectError, GoalPursuitNotFoundError, ProjectAlreadyPursuesGoalError, ProjectGoalPursuitEndpointArchivedError, ProjectGoalPursuitEndpointNotFoundError, projectGoalPursuitProvenancePort } from '../src/application/projectGoalPursuitService';
import { PROJECT_GOAL_PURSUIT_POLICY, PROJECT_GOAL_PURSUIT_RELATION_TYPE } from '../src/domain/relationPolicy';
import { archiveGoal, createGoal } from '../src/domain/goal';
import { archiveProject, createProject } from '../src/domain/project';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { migrate } from '../src/persistence/migrate';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { NodeSqliteDatabase } from '../src/persistence/sqlite/nodeSqliteDatabase';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T09:00:00.000Z';
const T1 = '2026-08-13T10:00:00.000Z';
let sequence = 0;

function service(db: SqliteDatabase, prefix = 'pursuit') {
  return new ProjectGoalPursuitService<SqliteDatabase>({
    unitOfWork: sqliteUnitOfWork(db),
    projects: (context) => new SqliteProjectRepository(context),
    goals: (context) => new SqliteGoalRepository(context),
    relations: (context) => new SqliteRelationRepository(context),
    provenance: projectGoalPursuitProvenancePort({
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => T0 },
      ids: { newId: () => `${prefix}-audit-${++sequence}` },
    }),
    clock: { now: () => T0 },
    ids: { newId: () => `${prefix}-relation-${++sequence}` },
  });
}

async function seed(db: SqliteDatabase, suffix = '') {
  const project = createProject({ title: `Project ${suffix}` }, { id: `project${suffix}`, now: T0 });
  const goal = createGoal({ title: `Goal ${suffix}`, targetState: 'Done' }, { id: `goal${suffix}`, now: T0 });
  await new SqliteProjectRepository(db).add(project);
  await new SqliteGoalRepository(db).add(goal);
  return { project, goal };
}

describe('ProjectGoalPursuitService', () => {
  let db: SqliteDatabase;

  beforeEach(async () => { db = await createTestDatabase(); });
  afterEach(async () => { await closeQuietly(db); });

  it('defines the canonical directed Project -> contributes_to -> Goal policy', () => {
    expect(PROJECT_GOAL_PURSUIT_RELATION_TYPE).toBe('contributes_to');
    expect(PROJECT_GOAL_PURSUIT_POLICY.allowsDirection('project', 'goal')).toBe(true);
    expect(PROJECT_GOAL_PURSUIT_POLICY.allowsDirection('goal', 'project')).toBe(false);
    expect(PROJECT_GOAL_PURSUIT_POLICY.allowsMultipleActive).toBe(false);
  });

  it('starts a pursuit and appends directional provenance atomically', async () => {
    const { project, goal } = await seed(db, '-one');
    const pursuits = service(db);

    const first = await pursuits.startPursuit({ projectId: project.id, goalId: goal.id, metadata: { rationale: 'primary' }, actor: 'planner' });

    expect(first).toMatchObject({
      sourceType: 'project', sourceId: project.id, relationType: 'contributes_to',
      targetType: 'goal', targetId: goal.id, metadata: { rationale: 'primary' },
      createdAt: T0, endedAt: null,
    });
    const rows = await new SqliteRelationRepository(db).listCurrent({ relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE });
    expect(rows).toHaveLength(1);
    const records = await db.getAllAsync<{ payload: string }>('SELECT payload FROM records');
    expect(records).toHaveLength(1);
    const firstPayload = records.map(({ payload }) => JSON.parse(payload))
      .find((payload) => payload.relationId === first.id);
    expect(firstPayload).toMatchObject({
      action: 'relation_created', relationId: first.id, sourceType: 'project', sourceId: project.id,
      relationType: 'contributes_to', targetType: 'goal', targetId: goal.id,
      metadata: { rationale: 'primary' }, actor: 'planner', occurredAt: T0,
    });
  });

  it('rejects a second active pursuit for the same Project toward a different Goal', async () => {
    const { project, goal } = await seed(db, '-busy-project');
    const secondGoal = createGoal({ title: 'Second', targetState: 'Done' }, { id: 'goal-busy-two', now: T0 });
    await new SqliteGoalRepository(db).add(secondGoal);
    const pursuits = service(db);

    await pursuits.startPursuit({ projectId: project.id, goalId: goal.id, actor: 'planner' });
    await expect(pursuits.startPursuit({ projectId: project.id, goalId: secondGoal.id, actor: 'planner' }))
      .rejects.toBeInstanceOf(ProjectAlreadyPursuesGoalError);

    // Nothing was written for the rejected start.
    expect(await new SqliteRelationRepository(db).listCurrent({ relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE })).toHaveLength(1);
    expect(await db.getAllAsync('SELECT id FROM records')).toHaveLength(1);
  });

  it('rejects a pursuit toward a Goal already actively pursued by another Project', async () => {
    const { project, goal } = await seed(db, '-busy-goal');
    const secondProject = createProject({ title: 'Second project' }, { id: 'project-busy-two', now: T0 });
    await new SqliteProjectRepository(db).add(secondProject);
    const pursuits = service(db);

    await pursuits.startPursuit({ projectId: project.id, goalId: goal.id, actor: 'planner' });
    await expect(pursuits.startPursuit({ projectId: secondProject.id, goalId: goal.id, actor: 'planner' }))
      .rejects.toBeInstanceOf(GoalAlreadyPursuedByProjectError);

    expect(await new SqliteRelationRepository(db).listCurrent({ relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE })).toHaveLength(1);
    expect(await db.getAllAsync('SELECT id FROM records')).toHaveLength(1);
  });

  it('frees both sides after endPursuit so each can start a replacement pursuit', async () => {
    const { project, goal } = await seed(db, '-swap');
    const secondGoal = createGoal({ title: 'Second', targetState: 'Done' }, { id: 'goal-swap-two', now: T0 });
    const secondProject = createProject({ title: 'Second project' }, { id: 'project-swap-two', now: T0 });
    await new SqliteGoalRepository(db).add(secondGoal);
    await new SqliteProjectRepository(db).add(secondProject);
    const pursuits = service(db);

    const first = await pursuits.startPursuit({ projectId: project.id, goalId: goal.id, actor: 'planner' });
    await pursuits.endPursuit({ relationId: first.id, actor: 'planner', endedAt: T1 });

    // The Project can pursue a new Goal and the Goal can be pursued by a new Project.
    const reAimed = await pursuits.startPursuit({ projectId: project.id, goalId: secondGoal.id, actor: 'planner', occurredAt: T1 });
    const restaffed = await pursuits.startPursuit({ projectId: secondProject.id, goalId: goal.id, actor: 'planner', occurredAt: T1 });
    expect(reAimed).toMatchObject({ sourceId: project.id, targetId: secondGoal.id, createdAt: T1, endedAt: null });
    expect(restaffed).toMatchObject({ sourceId: secondProject.id, targetId: goal.id, createdAt: T1, endedAt: null });

    const current = await new SqliteRelationRepository(db).listCurrent({ relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE });
    expect(current.map((row) => row.id).sort()).toEqual([reAimed.id, restaffed.id].sort());
  });

  it('rejects missing and archived typed endpoints before writing a relation or provenance', async () => {
    const { project, goal } = await seed(db, '-eligibility');
    const pursuits = service(db);
    await expect(pursuits.startPursuit({ projectId: 'missing', goalId: goal.id, actor: 'planner' }))
      .rejects.toEqual(new ProjectGoalPursuitEndpointNotFoundError('project', 'missing'));
    await new SqliteProjectRepository(db).save(archiveProject(project, T1));
    await expect(pursuits.startPursuit({ projectId: project.id, goalId: goal.id, actor: 'planner' }))
      .rejects.toEqual(new ProjectGoalPursuitEndpointArchivedError('project', project.id));
    await new SqliteProjectRepository(db).add(createProject({ title: 'Active' }, { id: 'active-project', now: T0 }));
    await new SqliteGoalRepository(db).save(archiveGoal(goal, T1));
    await expect(pursuits.startPursuit({ projectId: 'active-project', goalId: goal.id, actor: 'planner' }))
      .rejects.toEqual(new ProjectGoalPursuitEndpointArchivedError('goal', goal.id));
    expect(await new SqliteRelationRepository(db).listHistory()).toEqual([]);
    expect(await db.getAllAsync('SELECT id FROM records')).toEqual([]);
  });

  it('rejects only duplicate active identity; an ended pursuit can be established again', async () => {
    const { project, goal } = await seed(db, '-history');
    const pursuits = service(db);
    const first = await pursuits.startPursuit({ projectId: project.id, goalId: goal.id, actor: 'planner' });
    await expect(pursuits.startPursuit({ projectId: project.id, goalId: goal.id, actor: 'planner' }))
      .rejects.toBeInstanceOf(DuplicateActiveGoalPursuitError);
    const ended = await pursuits.endPursuit({ relationId: first.id, actor: 'planner', endedAt: T1 });
    const repeated = await pursuits.endPursuit({ relationId: first.id, actor: 'planner', endedAt: '2026-08-13T11:00:00.000Z' });
    const restarted = await pursuits.startPursuit({ projectId: project.id, goalId: goal.id, actor: 'planner', occurredAt: T1 });
    expect(ended).toEqual({ ...first, endedAt: T1 });
    expect(repeated).toEqual(ended);
    expect(restarted.id).not.toBe(first.id);
    expect(await new SqliteRelationRepository(db).listHistory({ source: { type: 'project', id: project.id }, target: { type: 'goal', id: goal.id } })).toEqual([ended, restarted]);
    expect(await db.getAllAsync('SELECT id FROM records')).toHaveLength(3);
  });

  it('never ends a non-pursuit relation and keeps Project/Goal schemas relation-only', async () => {
    const { project, goal } = await seed(db, '-schema');
    const relations = new SqliteRelationRepository(db);
    await relations.add({
      id: 'not-pursuit', sourceType: 'goal', sourceId: goal.id, relationType: 'related_to',
      targetType: 'project', targetId: project.id, metadata: null, createdAt: T0, endedAt: null,
    });
    await expect(service(db).endPursuit({ relationId: 'not-pursuit', actor: 'planner' }))
      .rejects.toEqual(new GoalPursuitNotFoundError('not-pursuit'));
    for (const table of ['projects', 'goals']) {
      const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      expect(columns.map((column) => column.name)).not.toEqual(expect.arrayContaining(['goal_id', 'project_id', 'pursuit_id', 'pursues']));
      expect(await db.getAllAsync(`PRAGMA foreign_key_list(${table})`)).toEqual([]);
    }
  });
});

describe('ProjectGoalPursuitService concurrency', () => {
  it('serializes competing starts so one active Project/Goal pursuit survives', async () => {
    const location = join(tmpdir(), `goal-pursuit-${process.pid}-${Date.now()}.sqlite`);
    const dbA = new NodeSqliteDatabase(location);
    let dbB: NodeSqliteDatabase | undefined;
    try {
      await migrate(dbA);
      const { project, goal } = await seed(dbA, '-race');
      dbB = new NodeSqliteDatabase(location);
      const results = await Promise.allSettled([
        service(dbA, 'a').startPursuit({ projectId: project.id, goalId: goal.id, actor: 'a' }),
        service(dbB, 'b').startPursuit({ projectId: project.id, goalId: goal.id, actor: 'b' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(await new SqliteRelationRepository(dbA).listCurrent({ source: { type: 'project', id: project.id }, target: { type: 'goal', id: goal.id } })).toHaveLength(1);
    } finally {
      await closeQuietly(dbA);
      if (dbB !== undefined) await closeQuietly(dbB);
      rmSync(location, { force: true });
    }
  });
});
