import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DuplicateActiveTaskProjectMembershipError,
  TaskProjectMembershipEndpointArchivedError,
  TaskProjectMembershipEndpointNotFoundError,
  TaskProjectMembershipNotFoundError,
  TaskProjectMembershipService,
} from '../src/application/taskProjectMembershipService';
import { RecordRelationProvenancePort } from '../src/application/relationProvenanceService';
import {
  TASK_PROJECT_MEMBERSHIP_POLICY,
  TASK_PROJECT_MEMBERSHIP_RELATION_TYPE,
} from '../src/domain/relationPolicy';
import { archiveProject, createProject } from '../src/domain/project';
import { archiveTask, createTask } from '../src/domain/task';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { migrate } from '../src/persistence/migrate';
import { NodeSqliteDatabase } from '../src/persistence/sqlite/nodeSqliteDatabase';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T09:00:00.000Z';
const T1 = '2026-08-13T10:00:00.000Z';
let sequence = 0;

function service(db: SqliteDatabase, prefix = 'membership', failProvenance = false) {
  return new TaskProjectMembershipService<SqliteDatabase>({
    unitOfWork: sqliteUnitOfWork(db),
    tasks: (context) => new SqliteTaskRepository(context),
    projects: (context) => new SqliteProjectRepository(context),
    relations: (context) => new SqliteRelationRepository(context),
    provenance: failProvenance ? { append: async () => { throw new Error('audit unavailable'); } } :
      new RecordRelationProvenancePort({
        records: (context) => new SqliteRecordRepository(context),
        clock: { now: () => T0 }, ids: { newId: () => `${prefix}-audit-${++sequence}` },
      }),
    clock: { now: () => T0 }, ids: { newId: () => `${prefix}-relation-${++sequence}` },
  });
}

async function seed(db: SqliteDatabase, suffix = '') {
  const task = { ...createTask({ title: `Task ${suffix}`, targetDescription: 'Done' }), id: `task${suffix}`, createdAt: T0, updatedAt: T0 };
  const project = createProject({ title: `Project ${suffix}` }, { id: `project${suffix}`, now: T0 });
  await new SqliteTaskRepository(db).add(task);
  await new SqliteProjectRepository(db).add(project);
  return { task, project };
}

describe('TaskProjectMembershipService', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); });
  afterEach(async () => { await closeQuietly(db); });

  it('defines a directed Task -> belongs_to -> Project policy with explicit many-to-many cardinality', () => {
    expect(TASK_PROJECT_MEMBERSHIP_RELATION_TYPE).toBe('belongs_to');
    expect(TASK_PROJECT_MEMBERSHIP_POLICY.allowsDirection('task', 'project')).toBe(true);
    expect(TASK_PROJECT_MEMBERSHIP_POLICY.allowsDirection('project', 'task')).toBe(false);
    expect(TASK_PROJECT_MEMBERSHIP_POLICY.allowsMultipleActive).toBe(false);
  });

  it('allows multi-Project membership and atomically records both typed endpoints in provenance', async () => {
    const { task, project } = await seed(db, '-one');
    const otherProject = createProject({ title: 'Other' }, { id: 'project-other', now: T0 });
    await new SqliteProjectRepository(db).add(otherProject);
    const memberships = service(db);
    const first = await memberships.startMembership({ taskId: task.id, projectId: project.id, metadata: { role: 'primary' }, actor: 'planner' });
    await memberships.startMembership({ taskId: task.id, projectId: otherProject.id, actor: 'planner' });
    expect(first).toMatchObject({ sourceType: 'task', sourceId: task.id, relationType: 'belongs_to', targetType: 'project', targetId: project.id, endedAt: null });
    expect(await new SqliteRelationRepository(db).listCurrent({ source: { type: 'task', id: task.id } })).toHaveLength(2);
    const records = await db.getAllAsync<{ payload: string }>('SELECT payload FROM records');
    expect(records).toHaveLength(2);
    expect(JSON.parse(records[0].payload)).toMatchObject({ action: 'relation_created', relationId: first.id, sourceType: 'task', sourceId: task.id, relationType: 'belongs_to', targetType: 'project', targetId: project.id, actor: 'planner', occurredAt: T0 });
  });

  it('rejects missing or archived typed endpoints before writing', async () => {
    const { task, project } = await seed(db, '-eligible');
    const memberships = service(db);
    await expect(memberships.startMembership({ taskId: 'missing', projectId: project.id, actor: 'planner' })).rejects.toEqual(new TaskProjectMembershipEndpointNotFoundError('task', 'missing'));
    await new SqliteTaskRepository(db).save(archiveTask(task, T1));
    await expect(memberships.startMembership({ taskId: task.id, projectId: project.id, actor: 'planner' })).rejects.toEqual(new TaskProjectMembershipEndpointArchivedError('task', task.id));
    await new SqliteTaskRepository(db).add({ ...createTask({ title: 'Active', targetDescription: 'Done' }), id: 'active-task', createdAt: T0, updatedAt: T0 });
    await new SqliteProjectRepository(db).save(archiveProject(project, T1));
    await expect(memberships.startMembership({ taskId: 'active-task', projectId: project.id, actor: 'planner' })).rejects.toEqual(new TaskProjectMembershipEndpointArchivedError('project', project.id));
    expect(await new SqliteRelationRepository(db).listHistory()).toEqual([]);
    expect(await db.getAllAsync('SELECT id FROM records')).toEqual([]);
  });

  it('rejects active duplicate identity, preserves end history, and permits rejoining', async () => {
    const { task, project } = await seed(db, '-history');
    const memberships = service(db);
    const first = await memberships.startMembership({ taskId: task.id, projectId: project.id, actor: 'planner' });
    await expect(memberships.startMembership({ taskId: task.id, projectId: project.id, actor: 'planner' })).rejects.toBeInstanceOf(DuplicateActiveTaskProjectMembershipError);
    const ended = await memberships.endMembership({ relationId: first.id, actor: 'planner', endedAt: T1 });
    const repeated = await memberships.endMembership({ relationId: first.id, actor: 'planner', endedAt: '2026-08-13T11:00:00.000Z' });
    const rejoined = await memberships.startMembership({ taskId: task.id, projectId: project.id, actor: 'planner', occurredAt: T1 });
    expect(ended).toEqual({ ...first, endedAt: T1 });
    expect(repeated).toEqual(ended);
    expect(rejoined.id).not.toBe(first.id);
    expect(await db.getAllAsync('SELECT id FROM records')).toHaveLength(3);
  });

  it('will not end reversed or unrelated relations and retains relation-only schemas without foreign keys', async () => {
    const { task, project } = await seed(db, '-schema');
    await new SqliteRelationRepository(db).add({ id: 'reversed', sourceType: 'project', sourceId: project.id, relationType: 'belongs_to', targetType: 'task', targetId: task.id, metadata: null, createdAt: T0, endedAt: null });
    await expect(service(db).endMembership({ relationId: 'reversed', actor: 'planner' })).rejects.toEqual(new TaskProjectMembershipNotFoundError('reversed'));
    for (const table of ['tasks', 'projects']) {
      const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      expect(columns.map(({ name }) => name)).not.toEqual(expect.arrayContaining(['project_id', 'task_id', 'membership_id', 'belongs_to']));
      expect(await db.getAllAsync(`PRAGMA foreign_key_list(${table})`)).toEqual([]);
    }
  });

  it('rolls relation creation back when membership provenance fails', async () => {
    const { task, project } = await seed(db, '-rollback');
    await expect(service(db, 'failure', true).startMembership({ taskId: task.id, projectId: project.id, actor: 'planner' })).rejects.toThrow('audit unavailable');
    expect(await new SqliteRelationRepository(db).listHistory()).toEqual([]);
  });
});

describe('TaskProjectMembershipService concurrency', () => {
  it('serializes competing starts so one active Task/Project membership survives', async () => {
    const location = join(tmpdir(), `task-membership-${process.pid}-${Date.now()}.sqlite`);
    const dbA = new NodeSqliteDatabase(location); let dbB: NodeSqliteDatabase | undefined;
    try {
      await migrate(dbA); const { task, project } = await seed(dbA, '-race'); dbB = new NodeSqliteDatabase(location);
      const results = await Promise.allSettled([
        service(dbA, 'a').startMembership({ taskId: task.id, projectId: project.id, actor: 'a' }),
        service(dbB, 'b').startMembership({ taskId: task.id, projectId: project.id, actor: 'b' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(await new SqliteRelationRepository(dbA).listCurrent({ source: { type: 'task', id: task.id }, target: { type: 'project', id: project.id } })).toHaveLength(1);
    } finally { await closeQuietly(dbA); if (dbB !== undefined) await closeQuietly(dbB); rmSync(location, { force: true }); }
  });
});
