import {
  archiveWorkflowState,
  createWorkflowState,
  updateWorkflowState,
  validateWorkflowState,
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
import { SqliteWorkflowStateRepository } from '../src/persistence/workflowStateRepository';
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
    const higherId = createWorkflowState(validInput(), {
      id: '00000000-0000-4000-8000-0000000000ff',
      now: CREATED_AT,
    });
    const lowerId = createWorkflowState(validInput(), {
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
    const service = new WorkflowStateService({ workflows, labels, states });
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
});
