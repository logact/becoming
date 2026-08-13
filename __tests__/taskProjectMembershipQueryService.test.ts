import { TaskProjectMembershipQueryService } from '../src/application/taskProjectMembershipQueryService';
import { archiveProject, createProject } from '../src/domain/project';
import { TASK_PROJECT_MEMBERSHIP_RELATION_TYPE } from '../src/domain/relationPolicy';
import { archiveTask, createTask } from '../src/domain/task';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';
const T3 = '2026-08-13T03:00:00.000Z';

describe('TaskProjectMembershipQueryService', () => {
  let db: SqliteDatabase;
  let queries: TaskProjectMembershipQueryService;
  let tasks: SqliteTaskRepository;
  let projects: SqliteProjectRepository;
  let relations: SqliteRelationRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    tasks = new SqliteTaskRepository(db);
    projects = new SqliteProjectRepository(db);
    relations = new SqliteRelationRepository(db);
    queries = new TaskProjectMembershipQueryService({ tasks, projects, relations, clock: { now: () => T3 } });
    await tasks.add({ ...createTask({ title: 'Build', targetDescription: 'Release', priority: 1 }), id: 'task-a', createdAt: T0, updatedAt: T0 });
    await tasks.add({ ...createTask({ title: 'Test', targetDescription: 'Confidence' }), id: 'task-b', createdAt: T0, updatedAt: T0 });
    await projects.add(createProject({ title: 'Alpha', description: 'Delivery', purpose: 'Ship' }, { id: 'project-a', now: T0 }));
    await projects.add(createProject({ title: 'Beta' }, { id: 'project-b', now: T0 }));
  });

  afterEach(async () => closeQuietly(db));

  async function membership(id: string, taskId: string, projectId: string, createdAt: string, endedAt: string | null = null) {
    await relations.add({
      id, sourceType: 'task', sourceId: taskId, relationType: TASK_PROJECT_MEMBERSHIP_RELATION_TYPE,
      targetType: 'project', targetId: projectId, metadata: null, createdAt, endedAt,
    });
  }

  it('returns zero, one, and many active membership views in both directions with intrinsic summaries', async () => {
    expect(await queries.listActiveTasksForProject('project-a')).toEqual([]);
    await membership('r-1', 'task-a', 'project-a', T0);
    const [only] = await queries.listActiveTasksForProject('project-a');
    expect(only).toMatchObject({
      relationId: 'r-1', taskId: 'task-a', projectId: 'project-a', createdAt: T0, endedAt: null,
      validFrom: T0, validUntil: null,
      task: { id: 'task-a', title: 'Build', targetDescription: 'Release', priority: 1 },
      project: { id: 'project-a', title: 'Alpha', purpose: 'Ship' },
      relation: { sourceType: 'task', sourceId: 'task-a', targetType: 'project', targetId: 'project-a' },
      anomalies: [],
    });
    await membership('r-2', 'task-b', 'project-a', T1);
    await membership('r-3', 'task-a', 'project-b', T1);
    expect((await queries.listActiveTasksForProject('project-a')).map((view) => view.taskId)).toEqual(['task-a', 'task-b']);
    const contexts = await queries.listActiveProjectsForTask('task-a');
    expect(contexts.map((view) => view.projectId)).toEqual(['project-a', 'project-b']);
    expect(contexts[0].relation).toMatchObject({ sourceType: 'task', targetType: 'project' });
  });

  it('excludes ended and archived endpoints from current reads but retains them in archive-inclusive history', async () => {
    await membership('ended', 'task-a', 'project-a', T0, T1);
    await membership('active', 'task-a', 'project-b', T1);
    await tasks.save(archiveTask((await tasks.getById('task-a'))!, T2));
    await projects.save(archiveProject((await projects.getById('project-a'))!, T2));

    expect(await queries.listActiveProjectsForTask('task-a')).toEqual([]);
    const history = await queries.listTaskMembershipHistoryForTask('task-a');
    expect(history.map((view) => [view.relationId, view.createdAt, view.endedAt, view.task?.archivedAt, view.project?.archivedAt]))
      .toEqual([['ended', T0, T1, T2, T2], ['active', T1, null, T2, null]]);
    expect(await queries.listTaskMembershipHistoryForTask('task-a', { includeArchived: false })).toEqual([]);
  });

  it('uses half-open point-in-time boundaries and keeps re-established history in deterministic order', async () => {
    await membership('first', 'task-a', 'project-a', T0, T1);
    await membership('second', 'task-a', 'project-a', T1, T2);
    await membership('third', 'task-a', 'project-b', T1);

    expect((await queries.listTaskMembershipHistoryForTask('task-a', { asOf: T0 })).map((view) => view.relationId)).toEqual(['first']);
    expect((await queries.listTaskMembershipHistoryForTask('task-a', { asOf: T1 })).map((view) => view.relationId)).toEqual(['second', 'third']);
    expect((await queries.listTaskMembershipHistoryForTask('task-a', { asOf: T2 })).map((view) => view.relationId)).toEqual(['third']);
    expect((await queries.listTaskMembershipHistoryForTask('task-a', { limit: 1, offset: 1 })).map((view) => view.relationId)).toEqual(['second']);
  });

  it('surfaces missing or malformed logical endpoints rather than dropping historical relation rows', async () => {
    await membership('missing-project', 'task-a', 'absent-project', T0);
    await db.runAsync(
      `INSERT INTO relations (id, source_type, source_id, relation_type, target_type, target_id, metadata, created_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['mistyped', 'task', 'task-a', TASK_PROJECT_MEMBERSHIP_RELATION_TYPE, 'goal', 'project-a', null, T1, null],
    );
    const history = await queries.listTaskMembershipHistoryForTask('task-a');
    expect(history.map((view) => view.relationId)).toEqual(['missing-project', 'mistyped']);
    expect(history[0].anomalies).toEqual([{ kind: 'missing_endpoint', relationId: 'missing-project', endpoint: 'project', id: 'absent-project' }]);
    expect(history[1].anomalies).toEqual([{
      kind: 'malformed_relation_direction', relationId: 'mistyped', sourceType: 'task', targetType: 'goal',
    }]);
    expect(await queries.listActiveProjectsForTask('task-a')).toEqual([]);
  });
});
