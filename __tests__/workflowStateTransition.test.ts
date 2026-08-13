import {
  archiveWorkflowStateTransition,
  createWorkflowStateTransition,
  updateWorkflowStateTransition,
} from '../src/domain/workflowStateTransition';
import type { WorkflowStateTransitionMachine } from '../src/domain/workflowStateTransition';
import { createWorkflowState } from '../src/domain/workflowState';
import { archiveLabel, createLabel } from '../src/domain/label';
import { archiveWorkflow, createWorkflow } from '../src/domain/workflow';
import { SqliteWorkflowStateRepository } from '../src/persistence/workflowStateRepository';
import { SqliteWorkflowStateTransitionRepository } from '../src/persistence/workflowStateTransitionRepository';
import { SqliteWorkflowRepository } from '../src/persistence/workflowRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import {
  WorkflowStateTransitionEndpointArchivedError,
  WorkflowStateTransitionEndpointNotFoundError,
  WorkflowStateTransitionDuplicateActiveEdgeError,
  WorkflowStateTransitionMachineMismatchError,
  WorkflowStateTransitionNotFoundError,
  WorkflowStateTransitionService,
} from '../src/application/workflowStateTransitionService';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED_AT = '2026-08-13T04:00:00.000Z';
const UPDATED_AT = '2026-08-13T05:00:00.000Z';
const ARCHIVED_AT = '2026-08-13T06:00:00.000Z';
const MACHINE: WorkflowStateTransitionMachine = {
  workflowId: 'workflow-1',
  entityType: 'task',
  labelId: 'label-1',
};

function transitionInput() {
  return {
    ...MACHINE,
    fromStateId: 'state-a',
    toStateId: 'state-b',
  };
}

describe('workflow state transition domain model', () => {
  it('stores conditions and actions as opaque template data without execution', () => {
    const condition = '(() => { throw new Error("must not execute") })()';
    const action = 'DROP TABLE workflow_states; this is inert template text';
    const transition = createWorkflowStateTransition(
      { ...transitionInput(), condition, action, requiresExitCriteria: true },
      { id: 'transition-1', now: CREATED_AT },
    );

    expect(transition.condition).toBe(condition);
    expect(transition.action).toBe(action);
    expect(transition.requiresExitCriteria).toBe(true);
    expect(transition.createdAt).toBe(CREATED_AT);

    const updated = updateWorkflowStateTransition(
      transition,
      { condition: 'next opaque condition', action: null },
      UPDATED_AT,
    );
    expect(updated.condition).toBe('next opaque condition');
    expect(updated.action).toBeNull();
    expect(updated.updatedAt).toBe(UPDATED_AT);
    expect(transition.condition).toBe(condition);
  });

  it('rejects blank logical identities and invalid machine entity types', () => {
    expect(() =>
      createWorkflowStateTransition({ ...transitionInput(), fromStateId: ' ' }),
    ).toThrow(/fromStateId/);
    expect(() =>
      createWorkflowStateTransition({ ...transitionInput(), entityType: 'label' }),
    ).toThrow(/core entity type/);
  });

  it('archives without erasing historical data and freezes the template', () => {
    const transition = createWorkflowStateTransition(transitionInput(), {
      now: CREATED_AT,
    });
    const archived = archiveWorkflowStateTransition(transition, ARCHIVED_AT);

    expect(archived.archivedAt).toBe(ARCHIVED_AT);
    expect(archived.condition).toBeNull();
    expect(() => updateWorkflowStateTransition(archived, { title: 'nope' })).toThrow(/archived/);
    expect(() => archiveWorkflowStateTransition(archived)).toThrow(/already archived/);
  });
});

describe('WorkflowStateTransitionRepository contract', () => {
  it('round-trips every schema field and supports updates and archival', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateTransitionRepository(db);
    const transition = createWorkflowStateTransition(
      {
        ...transitionInput(),
        title: 'Start work',
        description: 'Move from ready to active',
        condition: '{"allOf":["assignee","estimate"]}',
        action: 'notify:assignee',
        requiresExitCriteria: true,
      },
      { id: 'transition-1', now: CREATED_AT },
    );

    await repository.add(transition);
    expect(await repository.getById(transition.id)).toEqual(transition);

    const updated = updateWorkflowStateTransition(
      transition,
      { title: null, action: 'create:work-log', requiresExitCriteria: false },
      UPDATED_AT,
    );
    await repository.save(updated);
    expect(await repository.getById(updated.id)).toEqual(updated);

    const archived = archiveWorkflowStateTransition(updated, ARCHIVED_AT);
    await repository.save(archived);
    expect(await repository.getById(archived.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('has deterministic active and historical machine, outgoing, and incoming queries', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateTransitionRepository(db);
    const first = createWorkflowStateTransition(
      { ...transitionInput(), toStateId: 'state-c' },
      { id: 'transition-a', now: CREATED_AT },
    );
    const tied = createWorkflowStateTransition(
      { ...transitionInput(), fromStateId: 'state-c' },
      { id: 'transition-b', now: CREATED_AT },
    );
    const later = createWorkflowStateTransition(
      transitionInput(),
      { id: 'transition-c', now: UPDATED_AT },
    );
    const archived = archiveWorkflowStateTransition(
      createWorkflowStateTransition(
        { ...transitionInput(), toStateId: 'state-d' },
        { id: 'transition-d', now: CREATED_AT },
      ),
      ARCHIVED_AT,
    );
    const otherMachine = createWorkflowStateTransition(
      { ...transitionInput(), workflowId: 'workflow-2' },
      { id: 'transition-other', now: CREATED_AT },
    );
    await Promise.all([first, tied, later, archived, otherMachine].map((item) => repository.add(item)));

    expect((await repository.listActiveForMachine(MACHINE)).map((item) => item.id))
      .toEqual(['transition-a', 'transition-b', 'transition-c']);
    expect((await repository.listForMachine(MACHINE)).map((item) => item.id))
      .toEqual(['transition-a', 'transition-b', 'transition-d', 'transition-c']);
    expect((await repository.listActiveOutgoingForState(MACHINE, 'state-a')).map((item) => item.id))
      .toEqual(['transition-a', 'transition-c']);
    expect((await repository.listOutgoingForState(MACHINE, 'state-a')).map((item) => item.id))
      .toEqual(['transition-a', 'transition-d', 'transition-c']);
    expect((await repository.listActiveIncomingForState(MACHINE, 'state-b')).map((item) => item.id))
      .toEqual(['transition-b', 'transition-c']);
    expect((await repository.listIncomingForState(MACHINE, 'state-b')).map((item) => item.id))
      .toEqual(['transition-b', 'transition-c']);
    await closeQuietly(db);
  });

  it('keeps the #38 state-archive safety query compatible with full transition storage', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateTransitionRepository(db);
    const active = createWorkflowStateTransition(transitionInput());
    await repository.add(active);
    expect(await repository.hasActiveReferences('state-a')).toBe(true);
    await repository.save(archiveWorkflowStateTransition(active, ARCHIVED_AT));
    expect(await repository.hasActiveReferences('state-a')).toBe(false);
    await closeQuietly(db);
  });

  it('does not use database foreign keys for transition endpoint references', async () => {
    const db = await createTestDatabase();
    const foreignKeys = await db.getAllAsync<{ sql: string | null }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workflow_state_transitions'`,
    );
    expect(foreignKeys[0].sql?.toUpperCase()).not.toContain('FOREIGN KEY');
    await closeQuietly(db);
  });

  it('permits self-transitions but storage permits only one active edge per exact endpoint pair', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowStateTransitionRepository(db);
    const self = createWorkflowStateTransition(
      { ...transitionInput(), toStateId: 'state-a', title: 'Retry' },
      { id: 'self-edge', now: CREATED_AT },
    );
    await repository.add(self);
    await expect(repository.add(createWorkflowStateTransition(
      { ...transitionInput(), toStateId: 'state-a', title: 'Differently titled duplicate' },
      { id: 'duplicate-self-edge', now: UPDATED_AT },
    ))).rejects.toThrow(/UNIQUE constraint failed/);
    await repository.save(archiveWorkflowStateTransition(self, ARCHIVED_AT));
    await repository.add(createWorkflowStateTransition(
      { ...transitionInput(), toStateId: 'state-a' },
      { id: 'replacement-self-edge', now: UPDATED_AT },
    ));
    await closeQuietly(db);
  });
});

describe('WorkflowStateTransitionService', () => {
  async function setup() {
    const db = await createTestDatabase();
    const states = new SqliteWorkflowStateRepository(db);
    const transitions = new SqliteWorkflowStateTransitionRepository(db);
    let next = 0;
    const service = new WorkflowStateTransitionService({
      states,
      transitions,
      clock: { now: () => CREATED_AT },
      ids: { newId: () => `service-transition-${++next}` },
    });
    return { db, states, transitions, service };
  }

  function state(id: string, changes: Partial<{ workflowId: string; entityType: string; labelId: string }> = {}) {
    return createWorkflowState(
      { ...MACHINE, title: id, ...changes },
      { id, now: CREATED_AT },
    );
  }

  it('resolves both endpoints and persists a machine-coherent transition', async () => {
    const { db, states, service } = await setup();
    const source = state('source');
    const destination = state('destination');
    await states.add(source);
    await states.add(destination);

    const transition = await service.defineTransition({
      fromStateId: source.id,
      toStateId: destination.id,
      condition: 'opaque',
      action: 'also opaque',
      requiresExitCriteria: true,
    });

    expect(transition).toMatchObject({
      workflowId: MACHINE.workflowId,
      entityType: MACHINE.entityType,
      labelId: MACHINE.labelId,
      fromStateId: source.id,
      toStateId: destination.id,
      requiresExitCriteria: true,
    });
    expect((await service.listActiveOutgoing(source.id)).map((item) => item.id)).toEqual([transition.id]);
    expect((await service.listActiveIncoming(destination.id)).map((item) => item.id)).toEqual([transition.id]);
    await closeQuietly(db);
  });

  it('reports missing, archived, and cross-machine endpoints explicitly', async () => {
    const { db, states, service } = await setup();
    const source = state('source');
    const archivedDestination = {
      ...state('archived-destination'),
      archivedAt: ARCHIVED_AT,
      updatedAt: ARCHIVED_AT,
    };
    const otherMachine = state('other-machine', { labelId: 'label-2' });
    await states.add(source);
    await states.add(archivedDestination);
    await states.add(otherMachine);

    await expect(service.defineTransition({ fromStateId: 'missing', toStateId: source.id }))
      .rejects.toBeInstanceOf(WorkflowStateTransitionEndpointNotFoundError);
    await expect(service.defineTransition({ fromStateId: source.id, toStateId: archivedDestination.id }))
      .rejects.toBeInstanceOf(WorkflowStateTransitionEndpointArchivedError);
    await expect(service.defineTransition({ fromStateId: source.id, toStateId: otherMachine.id }))
      .rejects.toBeInstanceOf(WorkflowStateTransitionMachineMismatchError);
    await expect(service.updateTransition('missing', {}))
      .rejects.toBeInstanceOf(WorkflowStateTransitionNotFoundError);
    await closeQuietly(db);
  });

  it.each([
    ['workflowId', { workflowId: 'workflow-2' }],
    ['entityType', { entityType: 'goal' }],
    ['labelId', { labelId: 'label-2' }],
  ])('rejects a destination with a mismatched %s without persisting', async (_dimension, change) => {
    const { db, states, transitions, service } = await setup();
    const source = state('source');
    const destination = state('destination', change);
    await states.add(source);
    await states.add(destination);

    await expect(service.defineTransition({ fromStateId: source.id, toStateId: destination.id }))
      .rejects.toBeInstanceOf(WorkflowStateTransitionMachineMismatchError);
    expect(await transitions.listForMachine(MACHINE)).toEqual([]);
    await closeQuietly(db);
  });

  it('allows one self-edge, rejects differently titled duplicates, and reactivates only against valid active endpoints', async () => {
    const { db, states, transitions, service } = await setup();
    const source = state('source');
    const destination = state('destination');
    await states.add(source);
    await states.add(destination);

    const self = await service.defineTransition({ fromStateId: source.id, toStateId: source.id, title: 'Retry' });
    await expect(service.defineTransition({ fromStateId: source.id, toStateId: source.id, title: 'Another retry' }))
      .rejects.toBeInstanceOf(WorkflowStateTransitionDuplicateActiveEdgeError);
    const edge = await service.defineTransition({ fromStateId: source.id, toStateId: destination.id });
    await service.archiveTransition(edge.id, ARCHIVED_AT);
    await transitions.add(createWorkflowStateTransition(
      { ...MACHINE, fromStateId: source.id, toStateId: destination.id },
      { id: 'replacement', now: UPDATED_AT },
    ));
    await expect(service.reactivateTransition(edge.id))
      .rejects.toBeInstanceOf(WorkflowStateTransitionDuplicateActiveEdgeError);
    expect(self.archivedAt).toBeNull();
    await closeQuietly(db);
  });

  it('reactivates an archived edge when its original topology remains valid', async () => {
    const { db, states, service } = await setup();
    const source = state('source');
    const destination = state('destination');
    await states.add(source);
    await states.add(destination);
    const edge = await service.defineTransition({ fromStateId: source.id, toStateId: destination.id });
    await service.archiveTransition(edge.id, ARCHIVED_AT);

    await expect(service.reactivateTransition(edge.id, UPDATED_AT)).resolves.toMatchObject({
      id: edge.id,
      archivedAt: null,
      updatedAt: UPDATED_AT,
    });
    await closeQuietly(db);
  });

  it('rejects update and reactivation when an endpoint becomes archived or no longer belongs to the transition machine', async () => {
    const { db, states, transitions, service } = await setup();
    const source = state('source');
    const destination = state('destination');
    await states.add(source);
    await states.add(destination);
    const edge = await service.defineTransition({ fromStateId: source.id, toStateId: destination.id });
    await transitions.save(archiveWorkflowStateTransition(edge, ARCHIVED_AT));
    await states.save({ ...destination, archivedAt: ARCHIVED_AT, updatedAt: ARCHIVED_AT });
    await expect(service.reactivateTransition(edge.id))
      .rejects.toBeInstanceOf(WorkflowStateTransitionEndpointArchivedError);
    await expect(service.updateTransition(edge.id, { title: 'blocked' }))
      .rejects.toBeInstanceOf(WorkflowStateTransitionEndpointArchivedError);
    await closeQuietly(db);
  });

  it('keeps one active edge when duplicate define requests race', async () => {
    const { db, states, transitions, service } = await setup();
    const source = state('source');
    const destination = state('destination');
    await states.add(source);
    await states.add(destination);
    const results = await Promise.allSettled([
      service.defineTransition({ fromStateId: source.id, toStateId: destination.id }),
      service.defineTransition({ fromStateId: source.id, toStateId: destination.id }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(await transitions.listActiveForMachine(MACHINE)).toHaveLength(1);
    await closeQuietly(db);
  });

  it('resolves archived workflow, label, endpoints, and transitions as one historical machine', async () => {
    const db = await createTestDatabase();
    const workflows = new SqliteWorkflowRepository(db);
    const labels = new SqliteLabelRepository(db);
    const states = new SqliteWorkflowStateRepository(db);
    const transitions = new SqliteWorkflowStateTransitionRepository(db);
    const workflow = { ...createWorkflow({ title: 'Task flow', workflowType: 'task_execution' }), id: MACHINE.workflowId, createdAt: CREATED_AT, updatedAt: CREATED_AT };
    const label = { ...createLabel({ name: 'Sprint' }), id: MACHINE.labelId, createdAt: CREATED_AT, updatedAt: CREATED_AT };
    await workflows.add(workflow);
    await labels.add(label);
    const source = createWorkflowState({ ...MACHINE, title: 'Ready', exitCriteria: 'assigned' }, { id: 'source', now: CREATED_AT });
    const destination = createWorkflowState({ ...MACHINE, title: 'Doing' }, { id: 'destination', now: CREATED_AT });
    await states.add(source);
    await states.add(destination);
    const service = new WorkflowStateTransitionService({ states, transitions, workflows, labels });
    const edge = await service.defineTransition({
      fromStateId: source.id, toStateId: destination.id, condition: 'opaque:assignee',
      action: 'opaque:notify', requiresExitCriteria: true,
    });
    await service.archiveTransition(edge.id, ARCHIVED_AT);
    await states.save({ ...source, archivedAt: ARCHIVED_AT, updatedAt: ARCHIVED_AT });
    await states.save({ ...destination, archivedAt: ARCHIVED_AT, updatedAt: ARCHIVED_AT });
    await workflows.save(archiveWorkflow(workflow, ARCHIVED_AT));
    await labels.save(archiveLabel(label, ARCHIVED_AT));

    const resolved = await service.resolveMachineHistory(MACHINE.workflowId, 'task', MACHINE.labelId);
    expect(resolved.workflow?.archivedAt).toBe(ARCHIVED_AT);
    expect(resolved.label?.archivedAt).toBe(ARCHIVED_AT);
    expect(resolved.states).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: source.id, exitCriteria: 'assigned', archivedAt: ARCHIVED_AT }),
    ]));
    expect(resolved.transitions).toEqual([
      expect.objectContaining({ id: edge.id, condition: 'opaque:assignee', action: 'opaque:notify', requiresExitCriteria: true, archivedAt: ARCHIVED_AT }),
    ]);
    await closeQuietly(db);
  });

  it('commits transition lifecycle provenance atomically with allowlisted opaque fields', async () => {
    const db = await createTestDatabase();
    const states = new SqliteWorkflowStateRepository(db);
    const transitions = new SqliteWorkflowStateTransitionRepository(db);
    const source = stateForAudit('source');
    const destination = stateForAudit('destination');
    await states.add(source);
    await states.add(destination);
    let next = 0;
    const service = new WorkflowStateTransitionService<SqliteDatabase>({
      states, transitions, unitOfWork: sqliteUnitOfWork(db),
      transitionsInTransaction: (context) => new SqliteWorkflowStateTransitionRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => UPDATED_AT }, ids: { newId: () => `transition-audit-${++next}` },
    });
    const created = await service.defineTransition({
      actor: 'planner', fromStateId: source.id, toStateId: destination.id,
      condition: 'must be assigned', action: 'send notification', requiresExitCriteria: true,
    });
    await service.updateTransition(created.id, { action: 'send escalation' }, UPDATED_AT, 'planner');
    await service.archiveTransition(created.id, ARCHIVED_AT, 'planner');

    const rows = await db.getAllAsync<{ payload: string }>(
      'SELECT payload FROM records WHERE record_type = ? ORDER BY created_at, id', [PROVENANCE_RECORD_TYPE],
    );
    const payloads = rows.map(({ payload }) => JSON.parse(payload) as { entityType: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null });
    expect(payloads.map((payload) => payload.action)).toEqual(['create', 'update', 'archive']);
    expect(payloads.every((payload) => payload.entityType === 'workflow_state_transition')).toBe(true);
    expect(payloads[0].after).toMatchObject({ condition: 'must be assigned', action: 'send notification', requiresExitCriteria: true });
    expect(Object.keys(payloads[0].after ?? {}).sort()).toEqual([
      'action', 'archivedAt', 'condition', 'createdAt', 'description', 'entityType', 'fromStateId',
      'labelId', 'requiresExitCriteria', 'title', 'toStateId', 'updatedAt', 'workflowId',
    ]);
    await closeQuietly(db);
  });

  it('rolls back a transition create when provenance cannot be appended', async () => {
    const db = await createTestDatabase();
    const states = new SqliteWorkflowStateRepository(db);
    const transitions = new SqliteWorkflowStateTransitionRepository(db);
    const source = stateForAudit('source');
    const destination = stateForAudit('destination');
    await states.add(source);
    await states.add(destination);
    const service = new WorkflowStateTransitionService<SqliteDatabase>({
      states, transitions, unitOfWork: sqliteUnitOfWork(db),
      transitionsInTransaction: (context) => new SqliteWorkflowStateTransitionRepository(context),
      records: () => ({ add: async () => { throw new Error('record write failed'); } } as unknown as SqliteRecordRepository),
    });
    await expect(service.defineTransition({ actor: 'planner', fromStateId: source.id, toStateId: destination.id }))
      .rejects.toThrow(/rolled back/);
    expect(await transitions.listForMachine(MACHINE)).toEqual([]);
    await closeQuietly(db);
  });
});

function stateForAudit(id: string) {
  return createWorkflowState({ ...MACHINE, title: id }, { id, now: CREATED_AT });
}
