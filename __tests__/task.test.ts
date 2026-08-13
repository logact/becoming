import { TaskService, TaskNotFoundError } from '../src/application/taskService';
import {
  archiveTask,
  createTask,
  TASK_PRIORITY_MAX,
  TASK_PRIORITY_MIN,
  updateTask,
  validateTask,
} from '../src/domain/task';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import type { Record } from '../src/domain/record';
import type { SqliteDatabase } from '../src/persistence/database';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-13T08:00:00.000Z';
const LATER = '2026-08-13T09:00:00.000Z';

describe('Task domain model', () => {
  it('defines only intrinsic work fields and normalizes omitted optionals', () => {
    const task = createTask({ title: 'Ship M1', targetDescription: 'Release the accepted build' });
    expect(task).toMatchObject({
      title: 'Ship M1', targetDescription: 'Release the accepted build',
      description: null, exitCriteria: null, priority: null, archivedAt: null,
    });
    expect(task.createdAt).toBe(task.updatedAt);
    expect(Object.keys(task)).not.toEqual(expect.arrayContaining([
      'projectId', 'goalId', 'workflowId', 'state', 'label', 'deadline',
      'budget', 'allocation', 'dependency', 'resource',
    ]));
  });

  it('retains every valid optional field and uses 1-highest through 5-lowest priority', () => {
    const task = createTask({
      title: 'Ship M1', targetDescription: 'Release the accepted build',
      description: 'Store submission', exitCriteria: 'Build accepted', priority: 1,
    });
    expect(task.description).toBe('Store submission');
    expect(task.exitCriteria).toBe('Build accepted');
    expect(task.priority).toBe(TASK_PRIORITY_MIN);
    expect(createTask({ title: 'Low', targetDescription: 'Later work', priority: 5 }).priority)
      .toBe(TASK_PRIORITY_MAX);
  });

  it('rejects blank required values and priorities outside the explicit contract', () => {
    expect(() => createTask({ title: ' ', targetDescription: 'Result' })).toThrow(/title/);
    expect(() => createTask({ title: 'Work', targetDescription: ' ' })).toThrow(/targetDescription/);
    expect(() => createTask({ title: 'Work', targetDescription: 'Result', priority: 0 })).toThrow(/priority/);
    expect(() => createTask({ title: 'Work', targetDescription: 'Result', priority: 6 })).toThrow(/priority/);
    expect(() => createTask({ title: 'Work', targetDescription: 'Result', priority: 1.5 })).toThrow(/priority/);
  });

  it('updates active Tasks immutably, preserving creation and clearing optionals explicitly', () => {
    const task = createTask({ title: 'Draft', targetDescription: 'Initial result', description: 'Context', priority: 2 });
    const updated = updateTask(task, {
      title: 'Refined', targetDescription: 'Refined result', description: null,
      exitCriteria: 'Reviewed', priority: null,
    }, LATER);
    expect(task.title).toBe('Draft');
    expect(updated).toMatchObject({
      title: 'Refined', targetDescription: 'Refined result', description: null,
      exitCriteria: 'Reviewed', priority: null, createdAt: task.createdAt, updatedAt: LATER,
    });
  });

  it('archives once, retains the row data, and prevents repeated archive and updates', () => {
    const archived = archiveTask(createTask({ title: 'Old', targetDescription: 'Past work' }), LATER);
    expect(archived.archivedAt).toBe(LATER);
    expect(archived.updatedAt).toBe(LATER);
    expect(() => archiveTask(archived)).toThrow(/already archived/);
    expect(() => updateTask(archived, { title: 'Nope' })).toThrow(/archived/);
    expect(() => validateTask({ ...archived, priority: 9 })).toThrow(/priority/);
  });
});

describe('TaskRepository contract', () => {
  it('round-trips minimal and full Tasks and separates active from explicit history', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteTaskRepository(db);
    const minimal = {
      ...createTask({ title: 'First', targetDescription: 'First target' }),
      id: 'task-minimal', createdAt: NOW, updatedAt: NOW,
    };
    const full = {
      ...createTask({
        title: 'Second', targetDescription: 'Second target', description: 'Context',
        exitCriteria: 'Exit', priority: 3,
      }),
      id: 'task-full', createdAt: NOW, updatedAt: NOW,
    };
    await repository.add(minimal);
    await repository.add(full);
    const archived = archiveTask(minimal, LATER);
    await repository.save(archived);

    expect(await repository.getById(archived.id)).toEqual(archived);
    expect(await repository.list()).toEqual([full]);
    expect(await repository.list({ includeArchived: true })).toEqual([archived, full]);
    await closeQuietly(db);
  });

  it('uses a total historical ordering when timestamps tie', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteTaskRepository(db);
    const sameCreatedAt = '2026-08-13T07:00:00.000Z';
    const active = {
      ...createTask({ title: 'Active', targetDescription: 'Current work' }),
      id: 'task-active', createdAt: sameCreatedAt, updatedAt: sameCreatedAt,
    };
    const toArchive = {
      ...createTask({ title: 'Archived', targetDescription: 'Historical work' }),
      id: 'task-archived', createdAt: sameCreatedAt, updatedAt: sameCreatedAt,
    };
    await repository.add(active);
    await repository.add(toArchive);
    const archived = archiveTask(toArchive, LATER);
    await repository.save(archived);

    expect((await repository.list({ includeArchived: true })).map((task) => task.id))
      .toEqual(['task-archived', 'task-active']);
    await closeQuietly(db);
  });

  it('validates write boundaries, rejects unknown saves, and validates pagination', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteTaskRepository(db);
    const invalid = { ...createTask({ title: 'Work', targetDescription: 'Result' }), priority: 99 };
    await expect(repository.add(invalid)).rejects.toThrow(/priority/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await expect(repository.save(createTask({ title: 'Unknown', targetDescription: 'None' }))).rejects.toThrow(/unknown/);
    await expect(repository.list({ limit: 0 })).rejects.toThrow(/limit/);
    await expect(repository.list({ offset: -1 })).rejects.toThrow(/offset/);
    await closeQuietly(db);
  });

  it('has the exact task schema boundary without foreign keys', async () => {
    const db = await createTestDatabase();
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(tasks)');
    expect(columns.map(({ name }) => name)).toEqual([
      'id', 'title', 'description', 'target_description', 'exit_criteria', 'priority',
      'created_at', 'updated_at', 'archived_at',
    ]);
    expect(await db.getAllAsync('PRAGMA foreign_key_list(tasks)')).toEqual([]);
    await closeQuietly(db);
  });
});

describe('TaskService', () => {
  let db: SqliteDatabase;
  let service: TaskService<SqliteDatabase>;
  let id = 0;

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new TaskService({
      unitOfWork: sqliteUnitOfWork(db),
      tasks: (context) => new SqliteTaskRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      readTasks: new SqliteTaskRepository(db),
      clock: { now: () => LATER },
      ids: { newId: () => `provenance-${++id}` },
    });
  });

  afterEach(async () => db.closeAsync());

  async function count(table: 'tasks' | 'records'): Promise<number> {
    return (await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0;
  }

  async function provenance(): Promise<Record[]> {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM records WHERE record_type = ? ORDER BY created_at, id',
      [PROVENANCE_RECORD_TYPE],
    );
    const repository = new SqliteRecordRepository(db);
    return Promise.all(rows.map(({ id: recordId }) => repository.getById(recordId) as Promise<Record>));
  }

  it('creates, updates, archives, and queries Task history with atomic structured provenance', async () => {
    const created = await service.createTask({
      actor: 'creator', title: 'Draft release', targetDescription: 'Ready build',
      description: 'M1', exitCriteria: 'QA accepted', priority: 2, occurredAt: NOW,
    });
    const updated = await service.updateTask(created.id, { title: 'Release M1', priority: 1 }, 'editor', LATER);
    const archived = await service.archiveTask(created.id, 'archivist', LATER);

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe(LATER);
    expect(archived.archivedAt).toBe(LATER);
    expect(await service.listActive()).toEqual([]);
    expect(await service.listHistory()).toEqual([archived]);
    expect(await service.getTask(created.id)).toEqual(archived);
    const audit = await provenance();
    expect(audit).toHaveLength(3);
    expect(audit.map((record) => (record.payload as { action: string }).action)).toEqual(['create', 'update', 'archive']);
    expect(audit[0].payload).toMatchObject({
      entityType: 'task', entityId: created.id, actor: 'creator',
      after: { title: 'Draft release', targetDescription: 'Ready build', priority: 2 },
    });
    expect(audit[1].payload).toMatchObject({ after: { title: 'Release M1', priority: 1, updatedAt: LATER } });
    expect(audit[2].payload).toMatchObject({ after: { archivedAt: LATER } });
  });

  it('rejects invalid creates before opening a write and reports missing and repeated archives', async () => {
    await expect(service.createTask({ actor: 'user', title: ' ', targetDescription: 'Result' })).rejects.toThrow(/title/);
    expect(await count('tasks')).toBe(0);
    expect(await count('records')).toBe(0);
    await expect(service.updateTask('missing', { title: 'No' }, 'user')).rejects.toBeInstanceOf(TaskNotFoundError);
    const task = await service.createTask({ actor: 'user', title: 'Archive', targetDescription: 'Keep' });
    await service.archiveTask(task.id, 'user');
    await expect(service.archiveTask(task.id, 'user')).rejects.toThrow(/already archived/);
  });

  it('rolls back Task writes when the provenance append fails', async () => {
    const failing = new TaskService({
      unitOfWork: sqliteUnitOfWork(db),
      tasks: (context) => new SqliteTaskRepository(context),
      records: () => ({ add: async () => { throw new Error('record write failed'); }, getById: async () => null }),
      readTasks: new SqliteTaskRepository(db),
      clock: { now: () => LATER },
    });
    await expect(failing.createTask({ actor: 'user', title: 'Atomic', targetDescription: 'No partial row' }))
      .rejects.toThrow(/Provenance append/);
    expect(await count('tasks')).toBe(0);
    expect(await count('records')).toBe(0);
  });
});
