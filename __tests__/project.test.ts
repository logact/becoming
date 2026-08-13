import { ProjectService, ProjectNotFoundError } from '../src/application/projectService';
import {
  archiveProject,
  createProject,
  updateProject,
  validateProject,
} from '../src/domain/project';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import type { Record } from '../src/domain/record';
import type { SqliteDatabase } from '../src/persistence/database';
import type { RecordRepository } from '../src/persistence/recordRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED = '2026-08-13T08:00:00.000Z';
const UPDATED = '2026-08-13T09:00:00.000Z';

describe('Project domain model', () => {
  it('owns only intrinsic fields and normalizes omitted optional values', () => {
    const project = createProject({ title: 'Ship M1' });
    expect(project).toMatchObject({
      title: 'Ship M1', description: null, purpose: null, archivedAt: null,
    });
    expect(project.createdAt).toBe(project.updatedAt);
    expect(Object.keys(project)).not.toEqual(expect.arrayContaining([
      'goalId', 'workflowId', 'state', 'lifecycle', 'resource', 'budget',
      'progress', 'relation', 'taskIds', 'allocation',
    ]));
  });

  it('requires a title, updates immutably, and has an explicit archive contract', () => {
    expect(() => createProject({ title: ' ' })).toThrow(/title/);
    const project = createProject({ title: 'Draft', description: 'Context', purpose: 'Outcome' }, {
      id: 'project-1', now: CREATED,
    });
    const updated = updateProject(project, {
      title: 'Refined', description: null, purpose: 'Refined outcome',
    }, UPDATED);
    expect(project).toMatchObject({ title: 'Draft', createdAt: CREATED, updatedAt: CREATED });
    expect(updated).toMatchObject({
      title: 'Refined', description: null, purpose: 'Refined outcome',
      createdAt: CREATED, updatedAt: UPDATED,
    });
    const archived = archiveProject(updated, UPDATED);
    expect(archived).toMatchObject({ archivedAt: UPDATED, updatedAt: UPDATED });
    expect(() => updateProject(archived, { title: 'Rewrite' })).toThrow(/archived/);
    expect(() => archiveProject(archived)).toThrow(/already archived/);
    expect(() => validateProject({ ...updated, title: ' ' })).toThrow(/title/);
  });
});

describe('ProjectRepository contract', () => {
  it('round-trips minimal and full Projects and keeps archived history queryable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectRepository(db);
    const minimal = createProject({ title: 'First' }, { id: 'project-minimal', now: CREATED });
    const full = createProject({ title: 'Second', description: 'Context', purpose: 'Outcome' }, {
      id: 'project-full', now: CREATED,
    });
    await repository.add(minimal);
    await repository.add(full);
    const archived = archiveProject(minimal, UPDATED);
    await repository.save(archived);

    expect(await repository.getById(archived.id)).toEqual(archived);
    expect(await repository.list()).toEqual([full]);
    expect(await repository.list({ status: 'archived' })).toEqual([archived]);
    expect(await repository.list({ status: 'all' })).toEqual([archived, full]);
    await closeQuietly(db);
  });

  it('validates writes, refuses unknown saves, and exposes exactly the intrinsic schema', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectRepository(db);
    const invalid = createProject({ title: 'Valid' }, { id: 'invalid', now: CREATED });
    await expect(repository.add({ ...invalid, title: ' ' })).rejects.toThrow(/title/);
    await expect(repository.save(invalid)).rejects.toThrow(/unknown/);
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(projects)');
    expect(columns.map(({ name }) => name)).toEqual([
      'id', 'title', 'description', 'purpose', 'created_at', 'updated_at', 'archived_at',
    ]);
    expect(await db.getAllAsync('PRAGMA foreign_key_list(projects)')).toEqual([]);
    await closeQuietly(db);
  });
});

describe('ProjectService', () => {
  let db: SqliteDatabase;
  let service: ProjectService<SqliteDatabase>;
  let id = 0;

  async function provenance(): Promise<Record[]> {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM records WHERE record_type = ? ORDER BY created_at, id',
      [PROVENANCE_RECORD_TYPE],
    );
    const records = new SqliteRecordRepository(db);
    return Promise.all(rows.map(({ id: recordId }) => records.getById(recordId) as Promise<Record>));
  }

  beforeEach(async () => {
    db = await createTestDatabase();
    id = 0;
    service = new ProjectService({
      unitOfWork: sqliteUnitOfWork(db),
      projects: (context) => new SqliteProjectRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      readProjects: new SqliteProjectRepository(db),
      clock: { now: () => UPDATED },
      ids: { newId: () => `project-service-${++id}` },
    });
  });

  afterEach(async () => db.closeAsync());

  it('creates, updates, archives, and returns active versus explicit history with provenance', async () => {
    const created = await service.createProject({
      actor: 'creator', title: 'M1', description: 'Foundation', purpose: 'Release',
      occurredAt: CREATED,
    });
    const updated = await service.updateProject({
      id: created.id, actor: 'editor', changes: { title: 'M1 refined', purpose: null },
    });
    const archived = await service.archiveProject({ id: created.id, actor: 'archivist' });
    const repeated = await service.archiveProject({ id: created.id, actor: 'another-actor' });

    expect(updated).toMatchObject({ createdAt: UPDATED, updatedAt: UPDATED });
    expect(archived.archivedAt).toBe(UPDATED);
    expect(repeated).toEqual(archived);
    expect(await service.listActiveProjects()).toEqual([]);
    expect(await service.listProjectHistory()).toEqual([archived]);
    expect(await service.getProject(created.id)).toEqual(archived);
    const records = await provenance();
    expect(records.map((record) => (record.payload as { action: string }).action))
      .toEqual(['create', 'update', 'archive']);
    expect(records[1].payload).toMatchObject({
      before: { title: 'M1', purpose: 'Release' },
      after: { title: 'M1 refined', purpose: null },
    });
  });

  it('fails missing operations without provenance and rolls Project writes back if provenance fails', async () => {
    await expect(service.updateProject({ id: 'missing', actor: 'editor', changes: { title: 'Nope' } }))
      .rejects.toThrow(ProjectNotFoundError);
    expect(await provenance()).toEqual([]);

    const failingRecords: RecordRepository = {
      add: async () => { throw new Error('record persistence unavailable'); },
      getById: async () => null,
    };
    const failingService = new ProjectService({
      unitOfWork: sqliteUnitOfWork(db),
      projects: (context) => new SqliteProjectRepository(context),
      records: () => failingRecords,
      readProjects: new SqliteProjectRepository(db),
      clock: { now: () => UPDATED },
      ids: { newId: () => 'rolled-back-project' },
    });
    await expect(failingService.createProject({ actor: 'creator', title: 'Atomic' }))
      .rejects.toThrow(/rolled back/);
    expect(await failingService.getProject('rolled-back-project')).toBeNull();
  });
});
