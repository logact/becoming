import {
  archiveWorkflowState,
  createWorkflowState,
  normalizeWorkflowStateTitle,
  updateWorkflowState,
  validateWorkflowState,
  WorkflowStateInitialConflictError,
  WorkflowStateTitleConflictError,
} from '../src/domain/workflowState';
import type {
  WorkflowState,
  WorkflowStateMachine,
} from '../src/domain/workflowState';
import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import { archiveLabel, createLabel } from '../src/domain/label';
import { archiveWorkflow, createWorkflow } from '../src/domain/workflow';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteWorkflowRepository } from '../src/persistence/workflowRepository';
import {
  SqliteWorkflowStateRepository,
  WorkflowStateHasActiveTransitionReferencesError,
} from '../src/persistence/workflowStateRepository';
import { SqliteWorkflowStateTransitionReferenceRepository } from '../src/persistence/workflowStateTransitionReferenceRepository';
import { withTransaction } from '../src/persistence/transactions';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import type { SqliteDatabase } from '../src/persistence/database';
import {
  LabelArchivedError,
  LabelNotFoundError,
} from '../src/application/labelAssignmentService';
import {
  WorkflowArchivedError,
  WorkflowNotFoundError,
  WorkflowStateNotFoundError,
  WorkflowStateService,
} from '../src/application/workflowStateService';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED_AT = '2026-08-12T14:00:00.000Z';
const UPDATED_AT = '2026-08-12T15:00:00.000Z';
const ARCHIVED_AT = '2026-08-12T16:00:00.000Z';
const WORKFLOW_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_WORKFLOW_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const LABEL_ID = '5c8e7a1b-2d3f-4e5a-9b0c-1d2e3f4a5b6c';
const OTHER_LABEL_ID = '6d9f8b2c-3e4a-4f5b-8c1d-2e3f4a5b6c7d';

const MACHINE: WorkflowStateMachine = {
  workflowId: WORKFLOW_ID,
  entityType: 'task',
  labelId: LABEL_ID,
};

function validInput() {
  return {
    workflowId: WORKFLOW_ID,
    entityType: 'task',
    labelId: LABEL_ID,
    title: 'Backlog',
  };
}

describe('workflow state domain model', () => {
  it('creates an active template with fresh id and default flags', () => {
    const state = createWorkflowState(validInput());

    expect(state.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(state.entityType).toBe('task');
    expect(state.isInitial).toBe(false);
    expect(state.isTerminal).toBe(false);
    expect(state.sortOrder).toBeNull();
    expect(state.createdAt).not.toBe('');
    expect(state.updatedAt).toBe(state.createdAt);
    expect(state.archivedAt).toBeNull();
    expect(() => validateWorkflowState(state)).not.toThrow();
  });

  it('accepts every core entity type as the machine entity type', () => {
    for (const entityType of CORE_ENTITY_TYPES) {
      const state = createWorkflowState({ ...validInput(), entityType });
      expect(state.entityType).toBe(entityType);
    }
  });

  it('rejects entity types outside the eight core concepts', () => {
    for (const nonCore of [
      'label',
      'entity_label',
      'workflow_state',
      'workflow_state_transition',
      'project_state',
      'project_state_transition',
    ]) {
      expect(() =>
        createWorkflowState({ ...validInput(), entityType: nonCore }),
      ).toThrow(/core entity type/);
    }
  });

  it('rejects blank machine references and blank titles', () => {
    expect(() =>
      createWorkflowState({ ...validInput(), workflowId: '  ' }),
    ).toThrow(/workflowId/);
    expect(() => createWorkflowState({ ...validInput(), labelId: '' })).toThrow(
      /labelId/,
    );
    expect(() => createWorkflowState({ ...validInput(), title: ' ' })).toThrow(
      /title/,
    );
  });

  it('rejects a non-integer sort order', () => {
    expect(() =>
      createWorkflowState({ ...validInput(), sortOrder: 1.5 }),
    ).toThrow(/sortOrder/);
    expect(() =>
      validateWorkflowState({
        ...createWorkflowState(validInput()),
        sortOrder: Number.NaN,
      }),
    ).toThrow(/sortOrder/);
  });

  it('documents trimmed, case-insensitive title normalization', () => {
    expect(normalizeWorkflowStateTitle('  In Progress  ')).toBe('in progress');
  });

  it('permits independent initial or terminal flags but rejects their overlap', () => {
    expect(() =>
      createWorkflowState({ ...validInput(), isInitial: true, isTerminal: true }),
    ).toThrow(/both initial and terminal/);
    const state = createWorkflowState(validInput());
    expect(() =>
      updateWorkflowState(state, { isInitial: true, isTerminal: true }),
    ).toThrow(/both initial and terminal/);
    expect(
      createWorkflowState({ ...validInput(), isInitial: true }).isInitial,
    ).toBe(true);
    expect(
      createWorkflowState({ ...validInput(), isTerminal: true }).isTerminal,
    ).toBe(true);
  });

  it('updates intrinsic template fields without mutating the original', () => {
    const state = createWorkflowState(validInput(), { now: CREATED_AT });
    const updated = updateWorkflowState(
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
    expect(updated.workflowId).toBe(state.workflowId);
    expect(updated.createdAt).toBe(CREATED_AT);
    expect(updated.updatedAt).toBe(UPDATED_AT);
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
    expect(() => validateWorkflowState(updated)).not.toThrow();
  });

  it('rejects editing an archived template', () => {
    const archived = archiveWorkflowState(
      createWorkflowState(validInput()),
      ARCHIVED_AT,
    );

    expect(() => updateWorkflowState(archived, { title: 'New' })).toThrow(
      /archived/,
    );
  });

  it('archives a template without mutating the original', () => {
    const state = createWorkflowState(validInput(), { now: CREATED_AT });
    const archived = archiveWorkflowState(state, ARCHIVED_AT);

    expect(state.archivedAt).toBeNull();
    expect(archived.archivedAt).toBe(ARCHIVED_AT);
    expect(archived.updatedAt).toBe(ARCHIVED_AT);
  });

  it('rejects archiving an already archived template', () => {
    const archived = archiveWorkflowState(
      createWorkflowState(validInput()),
      ARCHIVED_AT,
    );

    expect(() => archiveWorkflowState(archived)).toThrow(/already archived/);
  });
});

describe('WorkflowStateRepository contract', () => {
  it('round-trips a template with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const state = createWorkflowState(
      {
        ...validInput(),
        description: 'Work waiting to start',
        category: 'pending',
        sortOrder: 1,
        isInitial: true,
        isTerminal: false,
        entryCriteria: 'has an assignee',
        exitCriteria: 'is groomed',
      },
      { now: CREATED_AT },
    );

    await repository.add(state);
    const loaded = await repository.getById(state.id);

    expect(loaded).toEqual(state);
    expect(loaded?.isInitial).toBe(true);
    expect(loaded?.isTerminal).toBe(false);
    await closeQuietly(db);
  });

  it('round-trips optional fields as null and flags as false', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const state = createWorkflowState(validInput(), { now: CREATED_AT });

    await repository.add(state);
    const loaded = await repository.getById(state.id);

    expect(loaded).toEqual(state);
    expect(loaded?.description).toBeNull();
    expect(loaded?.category).toBeNull();
    expect(loaded?.sortOrder).toBeNull();
    expect(loaded?.entryCriteria).toBeNull();
    expect(loaded?.exitCriteria).toBeNull();
    expect(loaded?.isInitial).toBe(false);
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);

    expect(await repository.getById('no-such-state')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const state = createWorkflowState(validInput());

    await repository.add(state);
    await expect(repository.add(state)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate before persistence', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const invalid = {
      ...createWorkflowState(validInput()),
      entityType: 'label',
    } as unknown as WorkflowState;

    await expect(repository.add(invalid)).rejects.toThrow(/core entity type/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('scopes machine queries to the exact workflow/entity-type/label identity', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const inMachine = createWorkflowState(validInput());
    const otherWorkflow = createWorkflowState({
      ...validInput(),
      workflowId: OTHER_WORKFLOW_ID,
    });
    const otherEntityType = createWorkflowState({
      ...validInput(),
      entityType: 'goal',
    });
    const otherLabel = createWorkflowState({
      ...validInput(),
      labelId: OTHER_LABEL_ID,
    });
    await repository.add(inMachine);
    await repository.add(otherWorkflow);
    await repository.add(otherEntityType);
    await repository.add(otherLabel);

    expect(await repository.listActiveForMachine(MACHINE)).toEqual([inMachine]);
    expect(await repository.listForMachine(MACHINE)).toEqual([inMachine]);
    // The neighboring machines are independent.
    expect(
      await repository.listActiveForMachine({
        ...MACHINE,
        workflowId: OTHER_WORKFLOW_ID,
      }),
    ).toEqual([otherWorkflow]);
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
    const repository = new SqliteWorkflowStateRepository(db);
    const noOrder = createWorkflowState(
      { ...validInput(), title: 'Unsorted' },
      { id: '00000000-0000-4000-8000-000000000004', now: CREATED_AT },
    );
    const second = createWorkflowState(
      { ...validInput(), title: 'Second', sortOrder: 2 },
      { id: '00000000-0000-4000-8000-000000000002', now: CREATED_AT },
    );
    // Two templates share sort_order 1: the earlier created_at wins; the
    // final tie is broken by id.
    const tiedEarlier = createWorkflowState(
      { ...validInput(), title: 'First A', sortOrder: 1 },
      { id: '00000000-0000-4000-8000-000000000003', now: CREATED_AT },
    );
    const tiedLater = createWorkflowState(
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

  it('breaks identical sort order and creation time ties by id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const higherId = createWorkflowState({ ...validInput(), title: 'Higher' }, {
      id: '00000000-0000-4000-8000-0000000000ff',
      now: CREATED_AT,
    });
    const lowerId = createWorkflowState({ ...validInput(), title: 'Lower' }, {
      id: '00000000-0000-4000-8000-000000000001',
      now: CREATED_AT,
    });
    await repository.add(higherId);
    await repository.add(lowerId);

    const ordered = await repository.listActiveForMachine(MACHINE);

    expect(ordered.map((s) => s.id)).toEqual([lowerId.id, higherId.id]);
    await closeQuietly(db);
  });

  it('keeps archived templates retrievable by id and in machine history', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const archived = createWorkflowState(
      { ...validInput(), title: 'Old', sortOrder: 1 },
      { now: CREATED_AT },
    );
    const active = createWorkflowState(
      { ...validInput(), title: 'New', sortOrder: 2 },
      { now: UPDATED_AT },
    );
    await repository.add(archived);
    await repository.save(archiveWorkflowState(archived, ARCHIVED_AT));
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

  it('persists edits to an active template', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const state = createWorkflowState(validInput(), { now: CREATED_AT });
    await repository.add(state);

    const updated = updateWorkflowState(
      state,
      { title: 'Ready', sortOrder: 3, isTerminal: true },
      UPDATED_AT,
    );
    await repository.save(updated);

    expect(await repository.getById(state.id)).toEqual(updated);
    await closeQuietly(db);
  });

  it('rejects saving an unknown template', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);

    await expect(
      repository.save(createWorkflowState(validInput())),
    ).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });

  it('rejects changing machine identity or creation identity on save', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const state = createWorkflowState(validInput(), { now: CREATED_AT });
    await repository.add(state);

    await expect(
      repository.save({ ...state, workflowId: OTHER_WORKFLOW_ID }),
    ).rejects.toThrow(/immutable/);
    await expect(repository.save({ ...state, entityType: 'goal' })).rejects
      .toThrow(/immutable/);
    await expect(
      repository.save({ ...state, labelId: OTHER_LABEL_ID }),
    ).rejects.toThrow(/immutable/);
    await expect(
      repository.save({ ...state, createdAt: UPDATED_AT }),
    ).rejects.toThrow(/immutable/);
    expect(await repository.getById(state.id)).toEqual(state);
    await closeQuietly(db);
  });

  it('enforces normalized active title uniqueness per machine only', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const backlog = createWorkflowState(validInput());
    await repository.add(backlog);

    await expect(
      repository.add(createWorkflowState({ ...validInput(), title: '  BACKLOG ' })),
    ).rejects.toThrow(WorkflowStateTitleConflictError);
    await repository.add(
      createWorkflowState({ ...validInput(), workflowId: OTHER_WORKFLOW_ID, title: 'backlog' }),
    );
    await expect(
      repository.save(updateWorkflowState(backlog, { title: ' Backlog ' })),
    ).resolves.toBeUndefined();
    await closeQuietly(db);
  });

  it('enforces one active initial state and exposes initial and terminal queries', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const initial = createWorkflowState({ ...validInput(), isInitial: true });
    const terminalA = createWorkflowState({ ...validInput(), title: 'Done', isTerminal: true, sortOrder: 2 });
    const terminalB = createWorkflowState({ ...validInput(), title: 'Cancelled', isTerminal: true, sortOrder: 1 });
    await repository.add(initial);
    await repository.add(terminalA);
    await repository.add(terminalB);

    await expect(
      repository.add(createWorkflowState({ ...validInput(), title: 'Other start', isInitial: true })),
    ).rejects.toThrow(WorkflowStateInitialConflictError);
    expect(await repository.findActiveInitialForMachine(MACHINE)).toEqual(initial);
    expect((await repository.listActiveTerminalsForMachine(MACHINE)).map((state) => state.id))
      .toEqual([terminalB.id, terminalA.id]);
    await closeQuietly(db);
  });

  it('rolls back a competing initial-state write in one transaction', async () => {
    const db = await createTestDatabase();
    const first = createWorkflowState({ ...validInput(), isInitial: true });
    const second = createWorkflowState({ ...validInput(), title: 'Start Here', isInitial: true });

    await expect(
      withTransaction(db, async (tx) => {
        const repository = new SqliteWorkflowStateRepository(tx);
        await repository.add(first);
        await repository.add(second);
      }),
    ).rejects.toThrow(WorkflowStateInitialConflictError);
    expect(await new SqliteWorkflowStateRepository(db).listActiveForMachine(MACHINE)).toEqual([]);
    await closeQuietly(db);
  });

  it('lets only one of two competing initial-state creations win', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const results = await Promise.allSettled([
      repository.add(createWorkflowState({ ...validInput(), title: 'Backlog', isInitial: true })),
      repository.add(createWorkflowState({ ...validInput(), title: 'Start Here', isInitial: true })),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      WorkflowStateInitialConflictError,
    );
    expect(await repository.listActiveForMachine(MACHINE)).toHaveLength(1);
    await closeQuietly(db);
  });

  it('reorders only a complete active machine and assigns deterministic sequential orders', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const first = createWorkflowState({ ...validInput(), title: 'First', sortOrder: 9 });
    const second = createWorkflowState({ ...validInput(), title: 'Second', sortOrder: 8 });
    const outsider = createWorkflowState({ ...validInput(), workflowId: OTHER_WORKFLOW_ID, title: 'Outsider' });
    await repository.add(first);
    await repository.add(second);
    await repository.add(outsider);

    await expect(
      repository.reorderActiveForMachine(MACHINE, [second.id, outsider.id], UPDATED_AT),
    ).rejects.toThrow(/exactly once/);
    expect(await repository.getById(second.id)).toEqual(second);
    await repository.reorderActiveForMachine(MACHINE, [second.id, first.id], UPDATED_AT);
    expect((await repository.listActiveForMachine(MACHINE)).map((state) => state.id))
      .toEqual([second.id, first.id]);
    expect(await repository.getById(outsider.id)).toEqual(outsider);
    await closeQuietly(db);
  });

  it('blocks archival while an active transition references the state', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const state = createWorkflowState(validInput());
    await repository.add(state);
    await db.runAsync(
      `INSERT INTO workflow_state_transitions (
         id, workflow_id, entity_type, label_id, from_state_id, to_state_id,
         requires_exit_criteria, created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['transition-1', state.workflowId, state.entityType, state.labelId,
        state.id, 'other-state', 0, CREATED_AT, CREATED_AT, null],
    );

    await expect(repository.save(archiveWorkflowState(state, ARCHIVED_AT)))
      .rejects.toThrow(WorkflowStateHasActiveTransitionReferencesError);
    expect(await repository.getById(state.id)).toEqual(state);
    await closeQuietly(db);
  });

  it('freezes an archived template against further edits', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateRepository(db);
    const state = createWorkflowState(validInput(), { now: CREATED_AT });
    await repository.add(state);
    const archived = archiveWorkflowState(state, ARCHIVED_AT);
    await repository.save(archived);

    await expect(
      repository.save({ ...archived, title: 'Rewritten' }),
    ).rejects.toThrow(/immutable/);
    expect(await repository.getById(state.id)).toEqual(archived);
    await closeQuietly(db);
  });
});

describe('workflow_states schema shape', () => {
  it('has exactly the documented columns and no foreign keys', async () => {
    const db = await createTestDatabase();
    const columns = (
      await db.getAllAsync<{ name: string; notnull: number }>(
        `PRAGMA table_info(workflow_states)`,
      )
    ).map((c) => c.name);
    expect(columns).toEqual([
      'id',
      'workflow_id',
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
      'created_at',
      'updated_at',
      'archived_at',
    ]);

    const foreignKeys = await db.getAllAsync(
      `PRAGMA foreign_key_list(workflow_states)`,
    );
    expect(foreignKeys).toEqual([]);

    const ddl = await db.getFirstAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workflow_states'`,
    );
    expect(ddl?.sql.toUpperCase()).not.toMatch(/FOREIGN\s+KEY/);
    expect(ddl?.sql.toUpperCase()).not.toMatch(/REFERENCES/);
    await closeQuietly(db);
  });
});

describe('WorkflowStateService', () => {
  async function createService() {
    const db = await createTestDatabase();
    const workflows = new SqliteWorkflowRepository(db);
    const labels = new SqliteLabelRepository(db);
    const states = new SqliteWorkflowStateRepository(db);
    const transitionReferences = new SqliteWorkflowStateTransitionReferenceRepository(db);
    const service = new WorkflowStateService({ workflows, labels, states, transitionReferences });
    return { db, workflows, labels, states, service };
  }

  async function seedMachine(repos: {
    workflows: SqliteWorkflowRepository;
    labels: SqliteLabelRepository;
  }) {
    const workflow = createWorkflow({
      title: 'Software Delivery',
      workflowType: 'task_execution',
    });
    const label = createLabel({ name: 'Feature' });
    await repos.workflows.add(workflow);
    await repos.labels.add(label);
    return { workflow, label };
  }

  it('defines a state template for an existing Workflow and Label', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });

    const state = await service.defineState({
      workflowId: workflow.id,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      category: 'pending',
      sortOrder: 1,
      isInitial: true,
      definedAt: CREATED_AT,
    });

    expect(state.workflowId).toBe(workflow.id);
    expect(state.labelId).toBe(label.id);
    expect(state.createdAt).toBe(CREATED_AT);
    expect(await service.getState(state.id)).toEqual(state);
    await closeQuietly(db);
  });

  it('rejects a missing Workflow with an explicit error', async () => {
    const { db, workflows, labels, service } = await createService();
    const { label } = await seedMachine({ workflows, labels });

    await expect(
      service.defineState({
        workflowId: WORKFLOW_ID,
        entityType: 'task',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(WorkflowNotFoundError);
    await closeQuietly(db);
  });

  it('rejects an archived Workflow for new states', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });
    await workflows.save(archiveWorkflow(workflow));

    await expect(
      service.defineState({
        workflowId: workflow.id,
        entityType: 'task',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(WorkflowArchivedError);
    await closeQuietly(db);
  });

  it('rejects a missing Label with an explicit error', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow } = await seedMachine({ workflows, labels });

    await expect(
      service.defineState({
        workflowId: workflow.id,
        entityType: 'task',
        labelId: LABEL_ID,
        title: 'Backlog',
      }),
    ).rejects.toThrow(LabelNotFoundError);
    await closeQuietly(db);
  });

  it('rejects an archived Label for new states', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });
    await labels.save(archiveLabel(label));

    await expect(
      service.defineState({
        workflowId: workflow.id,
        entityType: 'task',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(LabelArchivedError);
    await closeQuietly(db);
  });

  it('rejects an unsupported entity type before persistence', async () => {
    const { db, workflows, labels, states, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });

    await expect(
      service.defineState({
        workflowId: workflow.id,
        entityType: 'label',
        labelId: label.id,
        title: 'Backlog',
      }),
    ).rejects.toThrow(/core entity type/);
    expect(
      await states.listForMachine({
        workflowId: workflow.id,
        entityType: 'task',
        labelId: label.id,
      }),
    ).toEqual([]);
    await closeQuietly(db);
  });

  it('updates and archives templates through the service', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });
    const state = await service.defineState({
      workflowId: workflow.id,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      definedAt: CREATED_AT,
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
      await service.listActiveStates(workflow.id, 'task', label.id),
    ).toEqual([]);
    expect(
      (await service.listMachineHistory(workflow.id, 'task', label.id)).map(
        (s) => s.id,
      ),
    ).toEqual([state.id]);
    await closeQuietly(db);
  });

  it('lists active machine states in deterministic order', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });
    const done = await service.defineState({
      workflowId: workflow.id,
      entityType: 'task',
      labelId: label.id,
      title: 'Done',
      sortOrder: 2,
      isTerminal: true,
    });
    const backlog = await service.defineState({
      workflowId: workflow.id,
      entityType: 'task',
      labelId: label.id,
      title: 'Backlog',
      sortOrder: 1,
      isInitial: true,
    });

    const active = await service.listActiveStates(workflow.id, 'task', label.id);

    expect(active.map((s) => s.id)).toEqual([backlog.id, done.id]);
    await closeQuietly(db);
  });

  it('reorders safely and exposes V1 initial and terminal semantics', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });
    const start = await service.defineState({
      workflowId: workflow.id, entityType: 'task', labelId: label.id,
      title: 'Start', isInitial: true,
    });
    const done = await service.defineState({
      workflowId: workflow.id, entityType: 'task', labelId: label.id,
      title: 'Done', isTerminal: true,
    });

    await expect(service.reorderStates(workflow.id, 'task', label.id, [start.id]))
      .rejects.toThrow(/exactly once/);
    const reordered = await service.reorderStates(
      workflow.id, 'task', label.id, [done.id, start.id], UPDATED_AT,
    );
    expect(reordered.map((state) => state.sortOrder)).toEqual([1, 2]);
    expect(await service.getActiveInitialState(workflow.id, 'task', label.id)).toEqual({
      ...start, sortOrder: 2, updatedAt: UPDATED_AT,
    });
    expect(await service.listActiveTerminalStates(workflow.id, 'task', label.id))
      .toEqual([{ ...done, sortOrder: 1, updatedAt: UPDATED_AT }]);
    await closeQuietly(db);
  });

  it('throws WorkflowStateNotFoundError for unknown update or archive targets', async () => {
    const { db, service } = await createService();

    await expect(
      service.updateState('no-such-state', { title: 'X' }),
    ).rejects.toThrow(WorkflowStateNotFoundError);
    await expect(service.archiveState('no-such-state')).rejects.toThrow(
      WorkflowStateNotFoundError,
    );
    await closeQuietly(db);
  });

  it('filters active and historical machine definitions and resolves archived references', async () => {
    const { db, workflows, labels, service } = await createService();
    const { workflow, label } = await seedMachine({ workflows, labels });
    const active = await service.defineState({
      workflowId: workflow.id, entityType: 'task', labelId: label.id,
      title: 'Backlog', category: 'queue', isInitial: true,
    });
    const terminal = await service.defineState({
      workflowId: workflow.id, entityType: 'task', labelId: label.id,
      title: 'Done', category: 'complete', isTerminal: true,
    });
    await service.archiveState(terminal.id, ARCHIVED_AT);
    await workflows.save(archiveWorkflow(workflow, ARCHIVED_AT));
    await labels.save(archiveLabel(label, ARCHIVED_AT));

    expect(await service.listActiveStates(workflow.id, 'task', label.id, { isInitial: true }))
      .toEqual([active]);
    expect(await service.listMachineHistory(workflow.id, 'task', label.id, { isTerminal: true }))
      .toEqual([{ ...terminal, archivedAt: ARCHIVED_AT, updatedAt: ARCHIVED_AT }]);
    const resolved = await service.resolveMachineHistory(workflow.id, 'task', label.id);
    expect(resolved.workflow?.archivedAt).toBe(ARCHIVED_AT);
    expect(resolved.label?.archivedAt).toBe(ARCHIVED_AT);
    expect(resolved.states.map((state) => state.id)).toEqual([active.id, terminal.id].sort());
    await closeQuietly(db);
  });

  it('commits state create/update/reorder/archive provenance atomically with allowlisted snapshots', async () => {
    const db = await createTestDatabase();
    const workflows = new SqliteWorkflowRepository(db);
    const labels = new SqliteLabelRepository(db);
    const states = new SqliteWorkflowStateRepository(db);
    const service = new WorkflowStateService<SqliteDatabase>({
      workflows, labels, states,
      unitOfWork: sqliteUnitOfWork(db),
      statesInTransaction: (context) => new SqliteWorkflowStateRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => UPDATED_AT },
      ids: (() => { let id = 0; return { newId: () => `state-audit-${++id}` }; })(),
    });
    const { workflow, label } = await seedMachine({ workflows, labels });
    const first = await service.defineState({
      actor: 'planner', workflowId: workflow.id, entityType: 'task', labelId: label.id,
      title: 'Backlog', isInitial: true,
    });
    const second = await service.defineState({
      actor: 'planner', workflowId: workflow.id, entityType: 'task', labelId: label.id,
      title: 'Done', isTerminal: true,
    });
    await service.updateState(first.id, { category: 'queue' }, UPDATED_AT, 'planner');
    await service.reorderStates(workflow.id, 'task', label.id, [second.id, first.id], UPDATED_AT, 'planner');
    await service.archiveState(second.id, ARCHIVED_AT, 'planner');

    const records = await db.getAllAsync<{ payload: string }>(
      'SELECT payload FROM records WHERE record_type = ? ORDER BY created_at, id', [PROVENANCE_RECORD_TYPE],
    );
    expect(records).toHaveLength(6);
    const payloads = records.map(({ payload }) => JSON.parse(payload) as { entityType: string; action: string; after: Record<string, unknown> | null });
    expect(payloads.map((payload) => payload.action)).toEqual(['create', 'create', 'update', 'update', 'update', 'archive']);
    expect(payloads.every((payload) => payload.entityType === 'workflow_state')).toBe(true);
    expect(payloads[0].after).toMatchObject({ workflowId: workflow.id, labelId: label.id, title: 'Backlog' });
    expect(Object.keys(payloads[0].after ?? {}).sort()).toEqual([
      'archivedAt', 'category', 'createdAt', 'description', 'entityType', 'entryCriteria',
      'exitCriteria', 'isInitial', 'isTerminal', 'labelId', 'sortOrder', 'title', 'updatedAt', 'workflowId',
    ]);
    await closeQuietly(db);
  });

  it('rolls back a state mutation when its provenance append fails', async () => {
    const db = await createTestDatabase();
    const workflows = new SqliteWorkflowRepository(db);
    const labels = new SqliteLabelRepository(db);
    const states = new SqliteWorkflowStateRepository(db);
    const { workflow, label } = await seedMachine({ workflows, labels });
    const service = new WorkflowStateService<SqliteDatabase>({
      workflows, labels, states,
      unitOfWork: sqliteUnitOfWork(db),
      statesInTransaction: (context) => new SqliteWorkflowStateRepository(context),
      records: () => ({ add: async () => { throw new Error('record write failed'); } } as unknown as SqliteRecordRepository),
    });

    await expect(service.defineState({
      actor: 'planner', workflowId: workflow.id, entityType: 'task', labelId: label.id, title: 'Backlog',
    })).rejects.toThrow(/rolled back/);
    expect(await states.listForMachine({ workflowId: workflow.id, entityType: 'task', labelId: label.id }))
      .toEqual([]);
    await closeQuietly(db);
  });
});
