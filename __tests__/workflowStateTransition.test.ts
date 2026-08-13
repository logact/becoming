import {
  archiveWorkflowStateTransition,
  createWorkflowStateTransition,
  updateWorkflowStateTransition,
} from '../src/domain/workflowStateTransition';
import type { WorkflowStateTransitionMachine } from '../src/domain/workflowStateTransition';
import { createWorkflowState } from '../src/domain/workflowState';
import { SqliteWorkflowStateRepository } from '../src/persistence/workflowStateRepository';
import { SqliteWorkflowStateTransitionRepository } from '../src/persistence/workflowStateTransitionRepository';
import {
  WorkflowStateTransitionEndpointArchivedError,
  WorkflowStateTransitionEndpointNotFoundError,
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
        transitionInput(),
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
      .toEqual(['transition-b', 'transition-d', 'transition-c']);
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
});
