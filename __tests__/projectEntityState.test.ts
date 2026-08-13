import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import { createEntityLabelAssignment } from '../src/domain/entityLabel';
import { createProjectEntityState, endProjectEntityState } from '../src/domain/projectEntityState';
import { createProjectState } from '../src/domain/projectState';
import { ProjectEntityStateService } from '../src/application/projectEntityStateService';
import {
  ProjectEntityStateCurrentConflictError,
  SqliteProjectEntityStateRepository,
} from '../src/persistence/projectEntityStateRepository';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const PROJECT_ID = 'project-1';
const LABEL_ID = 'label-1';
const ENTITY_ID = 'entity-1';
const START = '2026-08-13T00:00:00.000Z';
const LATER = '2026-08-13T01:00:00.000Z';

const deterministic = {
  clock: { now: () => START },
  ids: { newId: () => 'period-1' },
};

async function seedProject(db: SqliteDatabase, archivedAt: string | null = null) {
  await db.runAsync(
    `INSERT INTO projects (id, title, created_at, updated_at, archived_at)
     VALUES (?, 'Project', ?, ?, ?)`,
    [PROJECT_ID, START, START, archivedAt],
  );
}

async function seedEntity(db: SqliteDatabase, type: string, id = ENTITY_ID, archivedAt: string | null = null) {
  const timestamp = [START, START, archivedAt];
  switch (type) {
    case 'task':
      return db.runAsync(`INSERT INTO tasks (id,title,target_description,created_at,updated_at,archived_at) VALUES (?,'Task','Done',?,?,?)`, [id, ...timestamp]);
    case 'goal':
      return db.runAsync(`INSERT INTO goals (id,title,target_state,created_at,updated_at,archived_at) VALUES (?,'Goal','Done',?,?,?)`, [id, ...timestamp]);
    case 'project':
      return db.runAsync(`INSERT INTO projects (id,title,created_at,updated_at,archived_at) VALUES (?,'Project Entity',?,?,?)`, [id, ...timestamp]);
    case 'idea':
      return db.runAsync(`INSERT INTO ideas (id,title,idea_description,captured_at,created_at,updated_at,archived_at) VALUES (?,'Idea','Description',?,?,?,?)`, [id, START, ...timestamp]);
    case 'philosophy':
      return db.runAsync(`INSERT INTO philosophies (id,title,created_at,updated_at,archived_at) VALUES (?,'Philosophy',?,?,?)`, [id, ...timestamp]);
    case 'workflow':
      return db.runAsync(`INSERT INTO workflows (id,title,workflow_type,version,created_at,updated_at,archived_at) VALUES (?,'Workflow','task',1,?,?,?)`, [id, ...timestamp]);
    case 'resource':
      return db.runAsync(`INSERT INTO resources (id,title,resource_type,created_at,updated_at,archived_at) VALUES (?,'Resource','time',?,?,?)`, [id, ...timestamp]);
    case 'record':
      return db.runAsync(`INSERT INTO records (id,description,record_type,occurred_at,recorded_at,created_at,updated_at,archived_at) VALUES (?,'Record','note',?,?,?,?,?)`, [id, START, START, ...timestamp]);
    default:
      throw new Error(`unknown ${type}`);
  }
}

async function seedValidContext(db: SqliteDatabase, type = 'task', entityId = ENTITY_ID) {
  await seedProject(db);
  if (!(type === 'project' && entityId === PROJECT_ID)) await seedEntity(db, type, entityId);
  await db.runAsync(`INSERT INTO labels (id,name,created_at,updated_at) VALUES (?,'Feature',?,?)`, [LABEL_ID, START, START]);
  await new SqliteEntityLabelRepository(db).add(createEntityLabelAssignment({ entityType: type, entityId, labelId: LABEL_ID }, { id: 'assignment-1', now: START }));
  const initial = createProjectState({ projectId: PROJECT_ID, entityType: type, labelId: LABEL_ID, title: 'Backlog', isInitial: true }, { id: 'state-1', now: START });
  await new SqliteProjectStateRepository(db).add(initial);
  return initial;
}

describe('ProjectEntityState domain and repository', () => {
  it('validates core types and ending does not mutate the original period', () => {
    const active = createProjectEntityState({ projectId: PROJECT_ID, entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID, projectStateId: 'state-1' }, { id: 'period-1', now: START });
    const ended = endProjectEntityState(active, LATER);
    expect(active.endedAt).toBeNull();
    expect(ended.endedAt).toBe(LATER);
    expect(() => createProjectEntityState({ ...active, entityType: 'label' })).toThrow(/core entity type/);
  });

  it('queries current and complete chronological history and only ends a period', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectEntityStateRepository(db);
    const first = createProjectEntityState({ projectId: PROJECT_ID, entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID, projectStateId: 'state-1' }, { id: 'period-1', now: START });
    await repository.add(first);
    await repository.end(endProjectEntityState(first, LATER));
    const second = createProjectEntityState({ ...first, projectStateId: 'state-2' }, { id: 'period-2', now: '2026-08-13T02:00:00.000Z' });
    await repository.add(second);
    const context = { projectId: PROJECT_ID, entityType: 'task' as const, entityId: ENTITY_ID, labelId: LABEL_ID };
    expect(await repository.findCurrent(context)).toEqual(second);
    expect(await repository.listHistory(context)).toEqual([endProjectEntityState(first, LATER), second]);
    await expect(repository.end(endProjectEntityState(first, LATER))).rejects.toThrow(/already ended/);
    await closeQuietly(db);
  });

  it('prevents duplicate current periods, including concurrent attempts', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectEntityStateRepository(db);
    const input = { projectId: PROJECT_ID, entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID, projectStateId: 'state-1' };
    const one = createProjectEntityState(input, { id: 'period-1', now: START });
    const two = createProjectEntityState(input, { id: 'period-2', now: START });
    const results = await Promise.allSettled([repository.add(one), repository.add(two)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')?.reason).toBeInstanceOf(ProjectEntityStateCurrentConflictError);
    await closeQuietly(db);
  });
});

describe('ProjectEntityStateService initialization', () => {
  it.each(CORE_ENTITY_TYPES)('initializes a valid initial state for %s', async (entityType) => {
    const db = await createTestDatabase();
    const entityId = entityType === 'project' ? 'project-entity' : ENTITY_ID;
    await seedValidContext(db, entityType, entityId);
    const service = new ProjectEntityStateService({ db, ...deterministic });
    const period = await service.initialize({ projectId: PROJECT_ID, entityType, entityId, labelId: LABEL_ID });
    expect(period).toMatchObject({ projectStateId: 'state-1', enteredAt: START, endedAt: null });
    await closeQuietly(db);
  });

  it('rolls back invalid contexts and reports explicit missing/archived references', async () => {
    const db = await createTestDatabase();
    const service = new ProjectEntityStateService({ db, ...deterministic });
    await expect(service.initialize({ projectId: PROJECT_ID, entityType: 'not-real', entityId: ENTITY_ID, labelId: LABEL_ID })).rejects.toThrow(/does not support/);
    await expect(service.initialize({ projectId: PROJECT_ID, entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID })).rejects.toThrow(/Project project-1 not found/);
    await seedProject(db, START);
    await expect(service.initialize({ projectId: PROJECT_ID, entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID })).rejects.toThrow(/is archived/);
    expect(await db.getAllAsync('SELECT * FROM project_entity_states')).toHaveLength(0);
    await closeQuietly(db);
  });

  it('requires the active label assignment and exactly one active initial state', async () => {
    const db = await createTestDatabase();
    await seedProject(db);
    await seedEntity(db, 'task');
    await db.runAsync(`INSERT INTO labels (id,name,created_at,updated_at) VALUES (?,'Feature',?,?)`, [LABEL_ID, START, START]);
    const service = new ProjectEntityStateService({ db, ...deterministic });
    const command = { projectId: PROJECT_ID, entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID };
    await expect(service.initialize(command)).rejects.toThrow(/not actively assigned/);
    await new SqliteEntityLabelRepository(db).add(createEntityLabelAssignment({ entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID }, { id: 'assignment-1', now: START }));
    await expect(service.initialize(command)).rejects.toThrow(/no active initial state/);
    await closeQuietly(db);
  });

  it('rejects initialization after a current period exists', async () => {
    const db = await createTestDatabase();
    await seedValidContext(db);
    const service = new ProjectEntityStateService({ db, ...deterministic });
    const command = { projectId: PROJECT_ID, entityType: 'task', entityId: ENTITY_ID, labelId: LABEL_ID };
    await service.initialize(command);
    await expect(service.initialize(command)).rejects.toBeInstanceOf(ProjectEntityStateCurrentConflictError);
    await closeQuietly(db);
  });
});
