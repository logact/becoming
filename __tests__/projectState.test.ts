import {
  archiveProjectState,
  createProjectState,
  normalizeProjectStateTitle,
  ProjectStateInitialConflictError,
  ProjectStateTitleConflictError,
  updateProjectState,
  validateProjectState,
} from '../src/domain/projectState';
import type {
  ProjectState,
  ProjectStateMachine,
} from '../src/domain/projectState';
import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../src/domain/ids';
import { archiveLabel, createLabel } from '../src/domain/label';
import { createWorkflow } from '../src/domain/workflow';
import { createWorkflowState } from '../src/domain/workflowState';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteWorkflowRepository } from '../src/persistence/workflowRepository';
import { SqliteWorkflowStateRepository } from '../src/persistence/workflowStateRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import {
  LabelArchivedError,
  LabelNotFoundError,
} from '../src/application/labelAssignmentService';
import {
  ProjectArchivedError,
  ProjectNotFoundError,
  ProjectStateNotFoundError,
  ProjectStateService,
} from '../src/application/projectStateService';
import type { ProjectLookup } from '../src/application/projectStateService';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED_AT = '2026-08-12T14:00:00.000Z';
const UPDATED_AT = '2026-08-12T15:00:00.000Z';
const ARCHIVED_AT = '2026-08-12T16:00:00.000Z';
const PROJECT_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_PROJECT_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const LABEL_ID = '5c8e7a1b-2d3f-4e5a-9b0c-1d2e3f4a5b6c';
const OTHER_LABEL_ID = '6d9f8b2c-3e4a-4f5b-8c1d-2e3f4a5b6c7d';
const SOURCE_WORKFLOW_STATE_ID = '7e0a9c3d-4f5a-4b6c-8d9e-0f1a2b3c4d5e';

const MACHINE: ProjectStateMachine = {
  projectId: PROJECT_ID,
  entityType: 'task',
  labelId: LABEL_ID,
};

function validInput() {
  return {
    projectId: PROJECT_ID,
    entityType: 'task',
    labelId: LABEL_ID,
    title: 'Backlog',
  };
}

/**
 * Test-local ProjectLookup over the real `projects` table. The full Project
 * aggregate and repository arrive with the Project management feature (#91);
 * until then tests seed rows directly.
 */
class SqliteProjectLookup implements ProjectLookup {
  constructor(private readonly db: SqliteDatabase) {}

  async getById(
    id: EntityId,
  ): Promise<{ id: EntityId; archivedAt: IsoTimestamp | null } | null> {
    return this.db.getFirstAsync<{
      id: EntityId;
      archivedAt: IsoTimestamp | null;
    }>('SELECT id, archived_at AS archivedAt FROM projects WHERE id = ?', [
      id,
    ]);
  }
}

async function seedProject(
  db: SqliteDatabase,
  id: EntityId = PROJECT_ID,
  archivedAt: IsoTimestamp | null = null,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO projects (id, title, created_at, updated_at, archived_at)
     VALUES (?, 'Test Project', ?, ?, ?)`,
    [id, CREATED_AT, CREATED_AT, archivedAt],
  );
}

describe('project state domain model', () => {
  it('creates an active Project-native state with fresh id and defaults', () => {
    const state = createProjectState(validInput());

    expect(state.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(state.entityType).toBe('task');
    expect(state.isInitial).toBe(false);
    expect(state.isTerminal).toBe(false);
    expect(state.sortOrder).toBeNull();
    expect(state.sourceWorkflowStateId).toBeNull();
    expect(state.createdAt).not.toBe('');
    expect(state.updatedAt).toBe(state.createdAt);
    expect(state.archivedAt).toBeNull();
    expect(() => validateProjectState(state)).not.toThrow();
  });

  it('keeps the source Workflow State id as provenance on copied states', () => {
    const state = createProjectState({
      ...validInput(),
      sourceWorkflowStateId: SOURCE_WORKFLOW_STATE_ID,
    });

    expect(state.sourceWorkflowStateId).toBe(SOURCE_WORKFLOW_STATE_ID);
    expect(() => validateProjectState(state)).not.toThrow();
  });

  it('accepts every core entity type as the machine entity type', () => {
    for (const entityType of CORE_ENTITY_TYPES) {
      const state = createProjectState({ ...validInput(), entityType });
      expect(state.entityType).toBe(entityType);
    }
  });

  it('rejects entity types outside the eight core concepts', () => {
    for (const nonCore of [
      'label',
      'entity_label',
      'workflow_state',
      'project_state',
      'project_state_transition',
    ]) {
      expect(() =>
        createProjectState({ ...validInput(), entityType: nonCore }),
      ).toThrow(/core entity type/);
    }
  });

  it('rejects blank machine references and blank titles', () => {
    expect(() =>
      createProjectState({ ...validInput(), projectId: '  ' }),
    ).toThrow(/projectId/);
    expect(() => createProjectState({ ...validInput(), labelId: '' })).toThrow(
      /labelId/,
    );
    expect(() => createProjectState({ ...validInput(), title: ' ' })).toThrow(
      /title/,
    );
  });

  it('rejects a non-integer sort order', () => {
    expect(() =>
      createProjectState({ ...validInput(), sortOrder: 1.5 }),
    ).toThrow(/sortOrder/);
    expect(() =>
      validateProjectState({
        ...createProjectState(validInput()),
        sortOrder: Number.NaN,
      }),
    ).toThrow(/sortOrder/);
  });

  it('rejects a state that is both initial and terminal', () => {
    expect(() =>
      createProjectState({ ...validInput(), isInitial: true, isTerminal: true }),
    ).toThrow(/both initial and terminal/);
    const state = createProjectState(validInput());
    expect(() =>
      updateProjectState(state, { isInitial: true, isTerminal: true }),
    ).toThrow(/both initial and terminal/);
  });

  it('normalizes titles by trimming and folding case', () => {
    expect(normalizeProjectStateTitle('  Backlog ')).toBe('backlog');
    expect(normalizeProjectStateTitle('BACKLOG')).toBe('backlog');
    expect(normalizeProjectStateTitle('backlog')).toBe('backlog');
  });

  it('updates intrinsic fields without mutating the original', () => {
    const state = createProjectState(
      { ...validInput(), sourceWorkflowStateId: SOURCE_WORKFLOW_STATE_ID },
      { now: CREATED_AT },
    );
    const updated = updateProjectState(
      state,
      {
        title: 'Ready',
        description: 'Ready for work',
        category: 'pending',
        sortOrder: 2,
        isInitial: true,
        entryCriteria: 'groomed',
        exitCriteria: 'estimated',
      },
      UPDATED_AT,
    );

    expect(state.title).toBe('Backlog');
    expect(updated.id).toBe(state.id);
    expect(updated.projectId).toBe(state.projectId);
    expect(updated.createdAt).toBe(CREATED_AT);
    expect(updated.updatedAt).toBe(UPDATED_AT);
    // Provenance survives edits untouched.
    expect(updated.sourceWorkflowStateId).toBe(SOURCE_WORKFLOW_STATE_ID);
    expect(updated).toMatchObject({
      title: 'Ready',
      description: 'Ready for work',
      category: 'pending',
      sortOrder: 2,
      isInitial: true,
      isTerminal: false,
      entryCriteria: 'groomed',
      exitCriteria: 'estimated',
    });
    expect(() => validateProjectState(updated)).not.toThrow();
  });

  it('rejects editing an archived state', () => {
    const archived = archiveProjectState(
      createProjectState(validInput()),
      ARCHIVED_AT,
    );

    expect(() => updateProjectState(archived, { title: 'New' })).toThrow(
      /archived/,
    );
  });

  it('archives a state without mutating the original', () => {
    const state = createProjectState(validInput(), { now: CREATED_AT });
    const archived = archiveProjectState(state, ARCHIVED_AT);

    expect(state.archivedAt).toBeNull();
    expect(archived.archivedAt).toBe(ARCHIVED_AT);
    expect(archived.updatedAt).toBe(ARCHIVED_AT);
  });

  it('rejects archiving an already archived state', () => {
    const archived = archiveProjectState(
      createProjectState(validInput()),
      ARCHIVED_AT,
    );

    expect(() => archiveProjectState(archived)).toThrow(/already archived/);
  });
});

describe('ProjectStateRepository contract', () => {
  it('round-trips a copied state with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const state = createProjectState(
      {
        ...validInput(),
        description: 'Work waiting to start',
        category: 'pending',
        sortOrder: 1,
        isInitial: true,
        entryCriteria: 'has an assignee',
        exitCriteria: 'is groomed',
        sourceWorkflowStateId: SOURCE_WORKFLOW_STATE_ID,
      },
      { now: CREATED_AT },
    );

    await repository.add(state);
    const loaded = await repository.getById(state.id);

    expect(loaded).toEqual(state);
    expect(loaded?.isInitial).toBe(true);
    expect(loaded?.sourceWorkflowStateId).toBe(SOURCE_WORKFLOW_STATE_ID);
    await closeQuietly(db);
  });

  it('round-trips optional fields as null and flags as false', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const state = createProjectState(validInput(), { now: CREATED_AT });

    await repository.add(state);
    const loaded = await repository.getById(state.id);

    expect(loaded).toEqual(state);
    expect(loaded?.description).toBeNull();
    expect(loaded?.category).toBeNull();
    expect(loaded?.sortOrder).toBeNull();
    expect(loaded?.entryCriteria).toBeNull();
    expect(loaded?.exitCriteria).toBeNull();
    expect(loaded?.sourceWorkflowStateId).toBeNull();
    expect(loaded?.isInitial).toBe(false);
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);

    expect(await repository.getById('no-such-state')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const state = createProjectState(validInput());

    await repository.add(state);
    await expect(repository.add(state)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate before persistence', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const invalid = {
      ...createProjectState(validInput()),
      entityType: 'label',
    } as unknown as ProjectState;

    await expect(repository.add(invalid)).rejects.toThrow(/core entity type/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('scopes machine queries to the exact project/entity-type/label identity', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const inMachine = createProjectState(validInput());
    const otherProject = createProjectState({
      ...validInput(),
      projectId: OTHER_PROJECT_ID,
    });
    const otherEntityType = createProjectState({
      ...validInput(),
      entityType: 'goal',
    });
    const otherLabel = createProjectState({
      ...validInput(),
      labelId: OTHER_LABEL_ID,
    });
    await repository.add(inMachine);
    await repository.add(otherProject);
    await repository.add(otherEntityType);
    await repository.add(otherLabel);

    expect(await repository.listActiveForMachine(MACHINE)).toEqual([inMachine]);
    expect(await repository.listForMachine(MACHINE)).toEqual([inMachine]);
    // The neighboring machines are independent.
    expect(
      await repository.listActiveForMachine({
        ...MACHINE,
        projectId: OTHER_PROJECT_ID,
      }),
    ).toEqual([otherProject]);
    expect(
      await repository.listActiveForMachine({ ...MACHINE, entityType: 'goal' }),
    ).toEqual([otherEntityType]);
    expect(
      await repository.listActiveForMachine({
        ...MACHINE,
        labelId: OTHER_LABEL_ID,
      }),
    ).toEqual([otherLabel]);
    await closeQuietly(db);
  });

  it('orders machine queries by sort order, then creation time, then id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const noOrder = createProjectState(
      { ...validInput(), title: 'Unsorted' },
      { id: '00000000-0000-4000-8000-000000000004', now: CREATED_AT },
    );
    const second = createProjectState(
      { ...validInput(), title: 'Second', sortOrder: 2 },
      { id: '00000000-0000-4000-8000-000000000002', now: CREATED_AT },
    );
    const tiedEarlier = createProjectState(
      { ...validInput(), title: 'First A', sortOrder: 1 },
      { id: '00000000-0000-4000-8000-000000000003', now: CREATED_AT },
    );
    const tiedLater = createProjectState(
      { ...validInput(), title: 'First B', sortOrder: 1 },
      { id: '00000000-0000-4000-8000-000000000001', now: UPDATED_AT },
    );
    await repository.add(noOrder);
    await repository.add(second);
    await repository.add(tiedEarlier);
    await repository.add(tiedLater);

    const ordered = await repository.listActiveForMachine(MACHINE);

    expect(ordered.map((s) => s.id)).toEqual([
      tiedEarlier.id,
      tiedLater.id,
      second.id,
      noOrder.id,
    ]);
    await closeQuietly(db);
  });

  it('keeps archived states retrievable by id and in machine history', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const archived = createProjectState(
      { ...validInput(), title: 'Old', sortOrder: 1 },
      { now: CREATED_AT },
    );
    const active = createProjectState(
      { ...validInput(), title: 'New', sortOrder: 2 },
      { now: UPDATED_AT },
    );
    await repository.add(archived);
    await repository.save(archiveProjectState(archived, ARCHIVED_AT));
    await repository.add(active);

    // Archived states leave the active machine view...
    expect(await repository.listActiveForMachine(MACHINE)).toEqual([active]);
    // ...but stay resolvable by id and in the full machine history.
    expect(await repository.getById(archived.id)).toEqual({
      ...archived,
      archivedAt: ARCHIVED_AT,
      updatedAt: ARCHIVED_AT,
    });
    const history = await repository.listForMachine(MACHINE);
    expect(history.map((s) => s.id)).toEqual([archived.id, active.id]);
    expect(history[0].archivedAt).toBe(ARCHIVED_AT);
    await closeQuietly(db);
  });

  it('persists edits to an active state', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const state = createProjectState(validInput(), { now: CREATED_AT });
    await repository.add(state);

    const updated = updateProjectState(
      state,
      { title: 'Ready', sortOrder: 3, isTerminal: true },
      UPDATED_AT,
    );
    await repository.save(updated);

    expect(await repository.getById(state.id)).toEqual(updated);
    await closeQuietly(db);
  });

  it('rejects saving an unknown state', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);

    await expect(
      repository.save(createProjectState(validInput())),
    ).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });

  it('rejects changing machine identity, creation identity, or provenance on save', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const state = createProjectState(
      { ...validInput(), sourceWorkflowStateId: SOURCE_WORKFLOW_STATE_ID },
      { now: CREATED_AT },
    );
    await repository.add(state);

    await expect(
      repository.save({ ...state, projectId: OTHER_PROJECT_ID }),
    ).rejects.toThrow(/immutable/);
    await expect(repository.save({ ...state, entityType: 'goal' })).rejects
      .toThrow(/immutable/);
    await expect(
      repository.save({ ...state, labelId: OTHER_LABEL_ID }),
    ).rejects.toThrow(/immutable/);
    await expect(
      repository.save({ ...state, createdAt: UPDATED_AT }),
    ).rejects.toThrow(/immutable/);
    await expect(
      repository.save({ ...state, sourceWorkflowStateId: null }),
    ).rejects.toThrow(/immutable/);
    expect(await repository.getById(state.id)).toEqual(state);
    await closeQuietly(db);
  });

  it('freezes an archived state against further edits', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const state = createProjectState(validInput(), { now: CREATED_AT });
    await repository.add(state);
    const archived = archiveProjectState(state, ARCHIVED_AT);
    await repository.save(archived);

    await expect(
      repository.save({ ...archived, title: 'Rewritten' }),
    ).rejects.toThrow(/immutable/);
    expect(await repository.getById(state.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('enforces normalized title uniqueness among active machine states', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    await repository.add(createProjectState(validInput()));

    // Same normalized title: trimmed and case-folded duplicates are rejected.
    await expect(
      repository.add(createProjectState({ ...validInput(), title: ' backlog ' })),
    ).rejects.toThrow(ProjectStateTitleConflictError);
    await expect(
      repository.add(createProjectState({ ...validInput(), title: 'BACKLOG' })),
    ).rejects.toThrow(ProjectStateTitleConflictError);
    // A different title in the same machine is fine.
    await repository.add(createProjectState({ ...validInput(), title: 'Done' }));
    // The same title in a different machine is fine.
    await repository.add(
      createProjectState({ ...validInput(), projectId: OTHER_PROJECT_ID }),
    );
    expect(await repository.listForMachine(MACHINE)).toHaveLength(2);
    await closeQuietly(db);
  });

  it('rejects a title change that collides with another active state', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const backlog = createProjectState(validInput());
    const ready = createProjectState({ ...validInput(), title: 'Ready' });
    await repository.add(backlog);
    await repository.add(ready);

    await expect(
      repository.save(updateProjectState(ready, { title: 'Backlog' })),
    ).rejects.toThrow(ProjectStateTitleConflictError);
    // Renaming to a free title still works.
    const renamed = updateProjectState(ready, { title: 'In Progress' });
    await repository.save(renamed);
    expect(await repository.getById(ready.id)).toEqual(renamed);
    await closeQuietly(db);
  });

  it('frees a normalized title for reuse once the state is archived', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const old = createProjectState(validInput(), { now: CREATED_AT });
    await repository.add(old);
    await repository.save(archiveProjectState(old, ARCHIVED_AT));

    const reused = createProjectState(validInput(), { now: UPDATED_AT });
    await repository.add(reused);

    expect(await repository.findActiveByTitle(MACHINE, 'Backlog')).toEqual(
      reused,
    );
    await closeQuietly(db);
  });

  it('enforces one active initial state per machine', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const initial = createProjectState({ ...validInput(), isInitial: true });
    await repository.add(initial);

    await expect(
      repository.add(
        createProjectState({
          ...validInput(),
          title: 'Other Start',
          isInitial: true,
        }),
      ),
    ).rejects.toThrow(ProjectStateInitialConflictError);
    expect(await repository.findActiveInitialForMachine(MACHINE)).toEqual(
      initial,
    );
    // A non-initial state is unaffected.
    await repository.add(createProjectState({ ...validInput(), title: 'Done' }));
    // Another machine may have its own initial state.
    await repository.add(
      createProjectState({
        ...validInput(),
        projectId: OTHER_PROJECT_ID,
        isInitial: true,
      }),
    );
    await closeQuietly(db);
  });

  it('rejects promoting a second state to initial while one is active', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const initial = createProjectState({ ...validInput(), isInitial: true });
    const other = createProjectState({ ...validInput(), title: 'Ready' });
    await repository.add(initial);
    await repository.add(other);

    await expect(
      repository.save(updateProjectState(other, { isInitial: true })),
    ).rejects.toThrow(ProjectStateInitialConflictError);
    expect(await repository.getById(other.id)).toEqual(other);
    await closeQuietly(db);
  });

  it('allows a new initial state after the previous one is archived', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateRepository(db);
    const old = createProjectState(
      { ...validInput(), isInitial: true },
      { now: CREATED_AT },
    );
    await repository.add(old);
    await repository.save(archiveProjectState(old, ARCHIVED_AT));

    const fresh = createProjectState(
      { ...validInput(), title: 'Start', isInitial: true },
      { now: UPDATED_AT },
    );
    await repository.add(fresh);

    expect(await repository.findActiveInitialForMachine(MACHINE)).toEqual(fresh);
    await closeQuietly(db);
  });
});

describe('project_states schema shape', () => {
  it('has exactly the documented columns and no foreign keys', async () => {
    const db = await createTestDatabase();
    const columns = (
      await db.getAllAsync<{ name: string; notnull: number }>(
        `PRAGMA table_info(project_states)`,
      )
    ).map((c) => c.name);
    expect(columns).toEqual([
      'id',
      'project_id',
      'entity_type',
      'label_id',
      'title',
      'description',
      'category',
      'sort_order',
      'is_initial',
      'is_terminal',
      'entry_criteria',
      'exit_criteria',
      'source_workflow_state_id',
      'created_at',
      'updated_at',
      'archived_at',
    ]);

    const foreignKeys = await db.getAllAsync(
      `PRAGMA foreign_key_list(project_states)`,
    );
    expect(foreignKeys).toEqual([]);

    const ddl = await db.getFirstAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_states'`,
    );
    expect(ddl?.sql.toUpperCase()).not.toMatch(/FOREIGN\s+KEY/);
    expect(ddl?.sql.toUpperCase()).not.toMatch(/REFERENCES/);
    await closeQuietly(db);
  });
});

describe('ProjectStateService', () => {
  async function createService() {
    const db = await createTestDatabase();
    const projects = new SqliteProjectLookup(db);
    const labels = new SqliteLabelRepository(db);
    const states = new SqliteProjectStateRepository(db);
    const service = new ProjectStateService({ projects, labels, states });
    return { db, projects, labels, states, service };
  }

  async function seedMachine(repos: {
    db: SqliteDatabase;
    labels: SqliteLabelRepository;
  }) {
    await seedProject(repos.db);
    const label = createLabel({ name: 'Feature' });
    await repos.labels.add(label);
    return { label };
  }

  it('creates a Project-native state with no source Workflow id', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });

    const state = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      category: 'pending',
      sortOrder: 1,
      isInitial: true,
      createdAt: CREATED_AT,
    });

    expect(state.projectId).toBe(PROJECT_ID);
    expect(state.labelId).toBe(label.id);
    expect(state.sourceWorkflowStateId).toBeNull();
    expect(state.createdAt).toBe(CREATED_AT);
    expect(await service.getState(state.id)).toEqual(state);
    await closeQuietly(db);
  });

  it('creates a copied state that keeps its source id as provenance only', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });

    const state = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      sourceWorkflowStateId: SOURCE_WORKFLOW_STATE_ID,
    });

    expect(state.sourceWorkflowStateId).toBe(SOURCE_WORKFLOW_STATE_ID);
    expect((await service.getState(state.id))?.sourceWorkflowStateId).toBe(
      SOURCE_WORKFLOW_STATE_ID,
    );
    await closeQuietly(db);
  });

  it('rejects a missing Project with an explicit error', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });

    await expect(
      service.createState({
        projectId: OTHER_PROJECT_ID,
        entityType: 'task',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(ProjectNotFoundError);
    await closeQuietly(db);
  });

  it('rejects an archived Project for new states', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    await seedProject(db, OTHER_PROJECT_ID, ARCHIVED_AT);

    await expect(
      service.createState({
        projectId: OTHER_PROJECT_ID,
        entityType: 'task',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(ProjectArchivedError);
    await closeQuietly(db);
  });

  it('rejects a missing Label with an explicit error', async () => {
    const { db, labels, service } = await createService();
    await seedMachine({ db, labels });

    await expect(
      service.createState({
        projectId: PROJECT_ID,
        entityType: 'task',
        labelId: LABEL_ID,
        title: 'Backlog',
      }),
    ).rejects.toThrow(LabelNotFoundError);
    await closeQuietly(db);
  });

  it('rejects an archived Label for new states', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    await labels.save(archiveLabel(label));

    await expect(
      service.createState({
        projectId: PROJECT_ID,
        entityType: 'task',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(LabelArchivedError);
    await closeQuietly(db);
  });

  it('rejects an unsupported entity type before persistence', async () => {
    const { db, labels, states, service } = await createService();
    const { label } = await seedMachine({ db, labels });

    await expect(
      service.createState({
        projectId: PROJECT_ID,
        entityType: 'label',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(/core entity type/);
    expect(
      await states.listForMachine({
        projectId: PROJECT_ID,
        entityType: 'task',
        labelId: label.id,
      }),
    ).toEqual([]);
    await closeQuietly(db);
  });

  it('rejects duplicate normalized titles and second initial states', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      isInitial: true,
    });

    await expect(
      service.createState({
        projectId: PROJECT_ID,
        entityType: 'task',
        labelId: label.id,
        title: ' backlog ',
      }),
    ).rejects.toThrow(ProjectStateTitleConflictError);
    await expect(
      service.createState({
        projectId: PROJECT_ID,
        entityType: 'task',
        labelId: label.id,
        title: 'Restart',
        isInitial: true,
      }),
    ).rejects.toThrow(ProjectStateInitialConflictError);
    await closeQuietly(db);
  });

  it('updates and archives states through the service', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    const state = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      createdAt: CREATED_AT,
    });

    const updated = await service.updateState(
      state.id,
      { title: 'Ready', sortOrder: 2 },
      UPDATED_AT,
    );
    expect(updated.title).toBe('Ready');
    expect(updated.updatedAt).toBe(UPDATED_AT);

    const archived = await service.archiveState(state.id, ARCHIVED_AT);
    expect(archived.archivedAt).toBe(ARCHIVED_AT);
    expect(
      await service.listActiveStates(PROJECT_ID, 'task', label.id),
    ).toEqual([]);
    expect(
      (await service.listMachineHistory(PROJECT_ID, 'task', label.id)).map(
        (s) => s.id,
      ),
    ).toEqual([state.id]);
    await closeQuietly(db);
  });

  it('lists active machine states in deterministic order', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    const done = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Done',
      sortOrder: 2,
      isTerminal: true,
    });
    const backlog = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      sortOrder: 1,
      isInitial: true,
    });

    const active = await service.listActiveStates(PROJECT_ID, 'task', label.id);

    expect(active.map((s) => s.id)).toEqual([backlog.id, done.id]);
    await closeQuietly(db);
  });

  it('reorders the active machine into a total deterministic order', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    const first = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
    });
    const second = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Doing',
    });
    const third = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Done',
    });

    const reordered = await service.reorderStates(
      PROJECT_ID,
      'task',
      label.id,
      [third.id, first.id, second.id],
      UPDATED_AT,
    );

    expect(reordered.map((s) => [s.id, s.sortOrder])).toEqual([
      [third.id, 1],
      [first.id, 2],
      [second.id, 3],
    ]);
    const active = await service.listActiveStates(PROJECT_ID, 'task', label.id);
    expect(active.map((s) => s.id)).toEqual([third.id, first.id, second.id]);
    await closeQuietly(db);
  });

  it('rejects reorder commands that do not cover exactly the active states', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    const state = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
    });

    // Missing an active state.
    await expect(
      service.reorderStates(PROJECT_ID, 'task', label.id, []),
    ).rejects.toThrow(/exactly once/);
    // Unknown id.
    await expect(
      service.reorderStates(PROJECT_ID, 'task', label.id, [
        state.id,
        'no-such-state',
      ]),
    ).rejects.toThrow(/exactly once/);
    // Duplicated id.
    await expect(
      service.reorderStates(PROJECT_ID, 'task', label.id, [
        state.id,
        state.id,
      ]),
    ).rejects.toThrow(/exactly once/);
    // Nothing was written.
    expect(await service.getState(state.id)).toEqual(state);
    await closeQuietly(db);
  });

  it('throws ProjectStateNotFoundError for unknown update or archive targets', async () => {
    const { db, service } = await createService();

    await expect(
      service.updateState('no-such-state', { title: 'X' }),
    ).rejects.toThrow(ProjectStateNotFoundError);
    await expect(service.archiveState('no-such-state')).rejects.toThrow(
      ProjectStateNotFoundError,
    );
    await closeQuietly(db);
  });

  it('never writes back to the source Workflow State template', async () => {
    const db = await createTestDatabase();
    const projects = new SqliteProjectLookup(db);
    const labels = new SqliteLabelRepository(db);
    const workflows = new SqliteWorkflowRepository(db);
    const workflowStates = new SqliteWorkflowStateRepository(db);
    const states = new SqliteProjectStateRepository(db);
    const service = new ProjectStateService({ projects, labels, states });

    // A published Workflow template with one State.
    const workflow = createWorkflow({
      title: 'Software Delivery',
      workflowType: 'task_execution',
    });
    const label = createLabel({ name: 'Feature' });
    await workflows.add(workflow);
    await labels.add(label);
    const template = createWorkflowState({
      workflowId: workflow.id,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      sortOrder: 1,
      isInitial: true,
    });
    await workflowStates.add(template);
    await seedProject(db);

    // Initialize a Project State from the template, then edit and archive it.
    const copied = await service.createState({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title: template.title,
      sortOrder: template.sortOrder ?? undefined,
      isInitial: template.isInitial,
      sourceWorkflowStateId: template.id,
      createdAt: CREATED_AT,
    });
    await service.updateState(
      copied.id,
      { title: 'Idea Parking Lot', sortOrder: 7, isInitial: false },
      UPDATED_AT,
    );
    await service.archiveState(copied.id, ARCHIVED_AT);

    // The source template is byte-for-byte untouched.
    expect(await workflowStates.getById(template.id)).toEqual(template);
    // Provenance still points at the template.
    expect((await service.getState(copied.id))?.sourceWorkflowStateId).toBe(
      template.id,
    );
    await closeQuietly(db);
  });

  it('lets only one of two competing initial-state creations win', async () => {
    const { db, labels, service } = await createService();
    const { label } = await seedMachine({ db, labels });
    const command = (title: string) => ({
      projectId: PROJECT_ID,
      entityType: 'task',
      labelId: label.id,
      title,
      isInitial: true,
    });

    const results = await Promise.allSettled([
      service.createState(command('Backlog')),
      service.createState(command('Start Here')),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ProjectStateInitialConflictError,
    );

    const active = await service.listActiveStates(PROJECT_ID, 'task', label.id);
    expect(active).toHaveLength(1);
    expect(active[0].isInitial).toBe(true);
    await closeQuietly(db);
  });
});
