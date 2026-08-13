import { ProjectGoalPursuitQueryService } from '../src/application/projectGoalPursuitQueryService';
import { archiveGoal, createGoal } from '../src/domain/goal';
import { archiveProject, createProject } from '../src/domain/project';
import { PROJECT_GOAL_PURSUIT_RELATION_TYPE } from '../src/domain/relationPolicy';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';
const T3 = '2026-08-13T03:00:00.000Z';

describe('ProjectGoalPursuitQueryService', () => {
  let db: SqliteDatabase;
  let queries: ProjectGoalPursuitQueryService;
  let projects: SqliteProjectRepository;
  let goals: SqliteGoalRepository;
  let relations: SqliteRelationRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    projects = new SqliteProjectRepository(db);
    goals = new SqliteGoalRepository(db);
    relations = new SqliteRelationRepository(db);
    queries = new ProjectGoalPursuitQueryService({ projects, goals, relations, clock: { now: () => T3 } });
    await projects.add(createProject({ title: 'Alpha', description: 'Delivery', purpose: 'Ship' }, { id: 'project-a', now: T0 }));
    await projects.add(createProject({ title: 'Beta' }, { id: 'project-b', now: T0 }));
    await goals.add(createGoal({ title: 'First', targetState: 'Done', description: 'A', successCriteria: 'Pass' }, { id: 'goal-a', now: T0 }));
    await goals.add(createGoal({ title: 'Second', targetState: 'Shipped' }, { id: 'goal-b', now: T0 }));
  });

  afterEach(async () => closeQuietly(db));

  async function pursuit(id: string, projectId: string, goalId: string, createdAt: string, endedAt: string | null = null) {
    await relations.add({
      id, sourceType: 'project', sourceId: projectId, relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE,
      targetType: 'goal', targetId: goalId, metadata: null, createdAt, endedAt,
    });
  }

  it('returns zero, one, and many current pursuit views in both directions with intrinsic summaries', async () => {
    expect(await queries.listGoalsPursuedByProject('project-a')).toEqual([]);
    await pursuit('r-1', 'project-a', 'goal-a', T0);
    const only = await queries.listGoalsPursuedByProject('project-a');
    expect(only[0]).toMatchObject({
      relationId: 'r-1', projectId: 'project-a', goalId: 'goal-a', createdAt: T0, endedAt: null,
      validFrom: T0, validUntil: null,
      project: { id: 'project-a', title: 'Alpha', purpose: 'Ship' },
      goal: { id: 'goal-a', title: 'First', targetState: 'Done', successCriteria: 'Pass' },
      relation: { sourceType: 'project', sourceId: 'project-a', targetType: 'goal', targetId: 'goal-a' },
      anomalies: [],
    });
    await pursuit('r-2', 'project-a', 'goal-b', T1);
    await pursuit('r-3', 'project-b', 'goal-a', T1);
    expect((await queries.listGoalsPursuedByProject('project-a')).map((view) => view.goalId)).toEqual(['goal-a', 'goal-b']);
    const pursuedBy = await queries.listProjectsPursuingGoal('goal-a');
    expect(pursuedBy.map((view) => view.projectId)).toEqual(['project-a', 'project-b']);
    expect(pursuedBy[0].relation).toMatchObject({ sourceType: 'project', targetType: 'goal' });
  });

  it('excludes ended and archived endpoints from current reads but retains them in archive-inclusive history', async () => {
    await pursuit('ended', 'project-a', 'goal-a', T0, T1);
    await pursuit('active', 'project-a', 'goal-b', T1);
    await projects.save(archiveProject((await projects.getById('project-a'))!, T2));
    await goals.save(archiveGoal((await goals.getById('goal-a'))!, T2));

    expect(await queries.listGoalsPursuedByProject('project-a')).toEqual([]);
    const history = await queries.listGoalPursuitHistoryForProject('project-a');
    expect(history.map((view) => [view.relationId, view.createdAt, view.endedAt, view.project?.archivedAt, view.goal?.archivedAt]))
      .toEqual([['ended', T0, T1, T2, T2], ['active', T1, null, T2, null]]);
    expect(await queries.listGoalPursuitHistoryForProject('project-a', { includeArchived: false })).toEqual([]);
  });

  it('uses half-open point-in-time boundaries and keeps re-established history in deterministic order', async () => {
    await pursuit('first', 'project-a', 'goal-a', T0, T1);
    await pursuit('second', 'project-a', 'goal-a', T1, T2);
    await pursuit('third', 'project-a', 'goal-b', T1);

    expect((await queries.listGoalPursuitHistoryForProject('project-a', { asOf: T0 })).map((view) => view.relationId)).toEqual(['first']);
    expect((await queries.listGoalPursuitHistoryForProject('project-a', { asOf: T1 })).map((view) => view.relationId)).toEqual(['second', 'third']);
    expect((await queries.listGoalPursuitHistoryForProject('project-a', { asOf: T2 })).map((view) => view.relationId)).toEqual(['third']);
    expect((await queries.listGoalPursuitHistoryForProject('project-a', { limit: 1, offset: 1 })).map((view) => view.relationId)).toEqual(['second']);
  });

  it('surfaces missing or malformed logical endpoints rather than dropping their historical relation rows', async () => {
    await pursuit('missing-goal', 'project-a', 'absent-goal', T0);
    await db.runAsync(
      `INSERT INTO relations (id, source_type, source_id, relation_type, target_type, target_id, metadata, created_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['mistyped', 'project', 'project-a', PROJECT_GOAL_PURSUIT_RELATION_TYPE, 'task', 'goal-a', null, T1, null],
    );
    const history = await queries.listGoalPursuitHistoryForProject('project-a');
    expect(history.map((view) => view.relationId)).toEqual(['missing-goal', 'mistyped']);
    expect(history[0].anomalies).toEqual([{ kind: 'missing_endpoint', relationId: 'missing-goal', endpoint: 'goal', id: 'absent-goal' }]);
    expect(history[1].anomalies).toEqual([{
      kind: 'malformed_relation_direction', relationId: 'mistyped', sourceType: 'project', targetType: 'task',
    }]);
    expect(await queries.listGoalsPursuedByProject('project-a')).toEqual([]);
  });
});
