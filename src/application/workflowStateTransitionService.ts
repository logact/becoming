import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { WorkflowState } from '../domain/workflowState';
import type { WorkflowStateRepository } from '../persistence/workflowStateRepository';
import type { WorkflowRepository } from '../persistence/workflowRepository';
import type { LabelRepository } from '../persistence/labelRepository';
import type {
  WorkflowStateTransitionRepository,
} from '../persistence/workflowStateTransitionRepository';
import type { RecordRepository } from '../persistence/recordRepository';
import {
  archiveWorkflowStateTransition,
  createWorkflowStateTransition,
  reactivateWorkflowStateTransition,
  updateWorkflowStateTransition,
} from '../domain/workflowStateTransition';
import type {
  WorkflowStateTransition,
  WorkflowStateTransitionChanges,
  WorkflowStateTransitionMachine,
} from '../domain/workflowStateTransition';
import type { EntitySnapshot, FieldSelectionPolicy } from '../domain/mutationProvenance';
import { MutationProvenanceService } from './mutationProvenanceService';
import type { UnitOfWork } from './unitOfWork';
import { LabelNotFoundError } from './labelAssignmentService';
import { WorkflowNotFoundError } from './workflowStateService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

/** A transition endpoint does not exist in the Workflow State history. */
export class WorkflowStateTransitionEndpointNotFoundError extends Error {
  constructor(endpoint: 'source' | 'destination', id: EntityId) {
    super(`WorkflowStateTransition ${endpoint} state ${id} not found`);
    this.name = 'WorkflowStateTransitionEndpointNotFoundError';
  }
}

/** New active transition templates may only target active state templates. */
export class WorkflowStateTransitionEndpointArchivedError extends Error {
  constructor(endpoint: 'source' | 'destination', id: EntityId) {
    super(`WorkflowStateTransition ${endpoint} state ${id} is archived`);
    this.name = 'WorkflowStateTransitionEndpointArchivedError';
  }
}

/** Both endpoint states must belong to one exact reusable state machine. */
export class WorkflowStateTransitionMachineMismatchError extends Error {
  constructor(sourceId: EntityId, destinationId: EntityId) {
    super(
      `WorkflowStateTransition endpoints ${sourceId} and ${destinationId} must belong to the same workflow state machine`,
    );
    this.name = 'WorkflowStateTransitionMachineMismatchError';
  }
}

export class WorkflowStateTransitionNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`WorkflowStateTransition ${id} not found`);
    this.name = 'WorkflowStateTransitionNotFoundError';
  }
}

/** Each active endpoint pair is normalized to exactly one transition edge. */
export class WorkflowStateTransitionDuplicateActiveEdgeError extends Error {
  constructor(
    readonly existingTransitionId: EntityId,
    fromStateId: EntityId,
    toStateId: EntityId,
  ) {
    super(
      `WorkflowStateTransition active edge ${fromStateId} -> ${toStateId} already exists as ${existingTransitionId}`,
    );
    this.name = 'WorkflowStateTransitionDuplicateActiveEdgeError';
  }
}

export interface DefineWorkflowStateTransitionCommand {
  actor?: string;
  fromStateId: EntityId;
  toStateId: EntityId;
  title?: string | null;
  description?: string | null;
  condition?: string | null;
  action?: string | null;
  requiresExitCriteria?: boolean;
  definedAt?: IsoTimestamp;
}

/** Historical transition lookup returns archived machine references as-is. */
export interface ResolvedWorkflowStateTransitionMachine {
  workflow: Awaited<ReturnType<WorkflowRepository['getById']>>;
  label: Awaited<ReturnType<LabelRepository['getById']>>;
  states: WorkflowState[];
  transitions: WorkflowStateTransition[];
}

export interface WorkflowStateTransitionServicePorts<TContext = unknown> {
  states: WorkflowStateRepository;
  transitions: WorkflowStateTransitionRepository;
  /** Used only by explicit historical machine resolution. */
  workflows?: WorkflowRepository;
  /** Used only by explicit historical machine resolution. */
  labels?: LabelRepository;
  /** Optional atomic provenance transport for transition mutations. */
  unitOfWork?: UnitOfWork<TContext>;
  transitionsInTransaction?: (context: TContext) => WorkflowStateTransitionRepository;
  records?: (context: TContext) => RecordRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

const WORKFLOW_STATE_TRANSITION_POLICY: FieldSelectionPolicy = {
  allowlist: [
    'workflowId', 'entityType', 'labelId', 'fromStateId', 'toStateId',
    'title', 'description', 'condition', 'action', 'requiresExitCriteria',
    'createdAt', 'updatedAt', 'archivedAt',
  ],
  redacted: [],
};

/**
 * Application boundary for transition templates. It resolves both endpoint
 * ids before persistence, derives stored machine identity from the source,
 * and rejects cross-machine logical references without using foreign keys.
 */
export class WorkflowStateTransitionService<TContext = unknown> {
  private readonly states: WorkflowStateRepository;
  private readonly transitions: WorkflowStateTransitionRepository;
  private readonly workflows?: WorkflowRepository;
  private readonly labels?: LabelRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly transitionsInTransaction?: (context: TContext) => WorkflowStateTransitionRepository;
  private readonly provenance?: MutationProvenanceService<TContext>;

  constructor(ports: WorkflowStateTransitionServicePorts<TContext>) {
    this.states = ports.states;
    this.transitions = ports.transitions;
    this.workflows = ports.workflows;
    this.labels = ports.labels;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.transitionsInTransaction = ports.transitionsInTransaction;
    if (ports.unitOfWork !== undefined || ports.records !== undefined || ports.transitionsInTransaction !== undefined) {
      if (ports.unitOfWork === undefined || ports.records === undefined || ports.transitionsInTransaction === undefined) {
        throw new Error('WorkflowStateTransitionService provenance requires unitOfWork, transitionsInTransaction, and records');
      }
      this.provenance = new MutationProvenanceService({
        unitOfWork: ports.unitOfWork,
        records: ports.records,
        clock: this.clock,
        ids: this.ids,
        additionalFieldPolicies: { workflow_state_transition: WORKFLOW_STATE_TRANSITION_POLICY },
      });
    }
  }

  async defineTransition(
    command: DefineWorkflowStateTransitionCommand,
  ): Promise<WorkflowStateTransition> {
    const source = await this.requireActiveEndpoint('source', command.fromStateId);
    const destination = await this.requireActiveEndpoint(
      'destination',
      command.toStateId,
    );
    if (!sameMachine(source, destination)) {
      throw new WorkflowStateTransitionMachineMismatchError(
        source.id,
        destination.id,
      );
    }
    await this.requireNoActiveEdge(machineOf(source), source.id, destination.id);
    const transition = createWorkflowStateTransition(
      {
        workflowId: source.workflowId,
        entityType: source.entityType,
        labelId: source.labelId,
        fromStateId: source.id,
        toStateId: destination.id,
        title: command.title,
        description: command.description,
        condition: command.condition,
        action: command.action,
        requiresExitCriteria: command.requiresExitCriteria,
      },
      { id: this.ids.newId(), now: command.definedAt ?? this.clock.now() },
    );
    try {
      await this.persist('create', transition.id, command.actor, command.definedAt, undefined, transition,
        async (transitions) => { await transitions.add(transition); return transition; });
    } catch (error) {
      await this.rethrowDuplicateEdgeConstraint(error, machineOf(source), source.id, destination.id);
      throw error;
    }
    return transition;
  }

  async getTransition(id: EntityId): Promise<WorkflowStateTransition | null> {
    return this.transitions.getById(id);
  }

  async updateTransition(
    id: EntityId,
    changes: WorkflowStateTransitionChanges,
    updatedAt?: IsoTimestamp,
    actor?: string,
  ): Promise<WorkflowStateTransition> {
    const transition = await this.requireTransition(id);
    await this.requireActiveTopology(transition);
    const updated = updateWorkflowStateTransition(
      transition,
      changes,
      updatedAt ?? this.clock.now(),
    );
    return this.persist('update', id, actor, updatedAt, transition, updated,
      async (transitions) => { await transitions.save(updated); return updated; });
  }

  async archiveTransition(
    id: EntityId,
    archivedAt?: IsoTimestamp,
    actor?: string,
  ): Promise<WorkflowStateTransition> {
    const transition = await this.requireTransition(id);
    const archived = archiveWorkflowStateTransition(
      transition,
      archivedAt ?? this.clock.now(),
    );
    return this.persist('archive', id, actor, archivedAt, transition, archived,
      async (transitions) => { await transitions.save(archived); return archived; });
  }

  /**
   * Reactivation re-validates endpoint existence, active status, machine
   * identity, and the normalized active-edge rule before it is persisted.
   */
  async reactivateTransition(
    id: EntityId,
    reactivatedAt?: IsoTimestamp,
    actor?: string,
  ): Promise<WorkflowStateTransition> {
    const transition = await this.requireTransition(id);
    const { source, destination, machine } = await this.requireActiveTopology(transition);
    await this.requireNoActiveEdge(machine, source.id, destination.id);
    const reactivated = reactivateWorkflowStateTransition(
      transition,
      reactivatedAt ?? this.clock.now(),
    );
    try {
      await this.persist('restore', id, actor, reactivatedAt, transition, reactivated,
        async (transitions) => { await transitions.save(reactivated); return reactivated; });
    } catch (error) {
      await this.rethrowDuplicateEdgeConstraint(error, machine, source.id, destination.id);
      throw error;
    }
    return reactivated;
  }

  async listActiveTransitions(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<WorkflowStateTransition[]> {
    return this.transitions.listActiveForMachine({ workflowId, entityType, labelId });
  }

  async listMachineHistory(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<WorkflowStateTransition[]> {
    return this.transitions.listForMachine({ workflowId, entityType, labelId });
  }

  /**
   * Resolve a complete historical transition machine. Workflow and Label
   * references deliberately remain resolvable after archival, while state
   * rows supply source exit criteria alongside each opaque transition rule.
   */
  async resolveMachineHistory(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<ResolvedWorkflowStateTransitionMachine> {
    if (this.workflows === undefined || this.labels === undefined) {
      throw new Error('WorkflowStateTransitionService historical resolution requires workflows and labels');
    }
    const workflow = await this.workflows.getById(workflowId);
    if (workflow === null) throw new WorkflowNotFoundError(workflowId);
    const label = await this.labels.getById(labelId);
    if (label === null) throw new LabelNotFoundError(labelId);
    const machine = { workflowId, entityType, labelId };
    return {
      workflow,
      label,
      states: await this.states.listForMachine(machine),
      transitions: await this.transitions.listForMachine(machine),
    };
  }

  async listActiveOutgoing(stateId: EntityId): Promise<WorkflowStateTransition[]> {
    const state = await this.requireState(stateId);
    return this.transitions.listActiveOutgoingForState(machineOf(state), stateId);
  }

  async listOutgoingHistory(stateId: EntityId): Promise<WorkflowStateTransition[]> {
    const state = await this.requireState(stateId);
    return this.transitions.listOutgoingForState(machineOf(state), stateId);
  }

  async listActiveIncoming(stateId: EntityId): Promise<WorkflowStateTransition[]> {
    const state = await this.requireState(stateId);
    return this.transitions.listActiveIncomingForState(machineOf(state), stateId);
  }

  async listIncomingHistory(stateId: EntityId): Promise<WorkflowStateTransition[]> {
    const state = await this.requireState(stateId);
    return this.transitions.listIncomingForState(machineOf(state), stateId);
  }

  private async requireActiveEndpoint(
    endpoint: 'source' | 'destination',
    id: EntityId,
  ): Promise<WorkflowState> {
    const state = await this.requireState(id, endpoint);
    if (state.archivedAt !== null) {
      throw new WorkflowStateTransitionEndpointArchivedError(endpoint, id);
    }
    return state;
  }

  private async requireState(
    id: EntityId,
    endpoint?: 'source' | 'destination',
  ): Promise<WorkflowState> {
    const state = await this.states.getById(id);
    if (state === null) {
      if (endpoint) throw new WorkflowStateTransitionEndpointNotFoundError(endpoint, id);
      throw new WorkflowStateTransitionEndpointNotFoundError('source', id);
    }
    return state;
  }

  private async requireTransition(id: EntityId): Promise<WorkflowStateTransition> {
    const transition = await this.transitions.getById(id);
    if (transition === null) throw new WorkflowStateTransitionNotFoundError(id);
    return transition;
  }

  private async requireNoActiveEdge(
    machine: WorkflowStateTransitionMachine,
    fromStateId: EntityId,
    toStateId: EntityId,
  ): Promise<void> {
    const existing = await this.transitions.findActiveByEndpoints(
      machine,
      fromStateId,
      toStateId,
    );
    if (existing !== null) {
      throw new WorkflowStateTransitionDuplicateActiveEdgeError(
        existing.id,
        fromStateId,
        toStateId,
      );
    }
  }

  private async requireActiveTopology(
    transition: WorkflowStateTransition,
  ): Promise<{
    source: WorkflowState;
    destination: WorkflowState;
    machine: WorkflowStateTransitionMachine;
  }> {
    const source = await this.requireActiveEndpoint('source', transition.fromStateId);
    const destination = await this.requireActiveEndpoint('destination', transition.toStateId);
    const machine = machineOf(source);
    if (!sameMachine(source, destination) ||
      transition.workflowId !== machine.workflowId ||
      transition.entityType !== machine.entityType ||
      transition.labelId !== machine.labelId) {
      throw new WorkflowStateTransitionMachineMismatchError(source.id, destination.id);
    }
    return { source, destination, machine };
  }

  private async rethrowDuplicateEdgeConstraint(
    error: unknown,
    machine: WorkflowStateTransitionMachine,
    fromStateId: EntityId,
    toStateId: EntityId,
  ): Promise<void> {
    if (!(error instanceof Error) ||
      (!error.message.includes('UNIQUE constraint failed') &&
        !error.message.includes('unique constraint'))) {
      return;
    }
    const existing = await this.transitions.findActiveByEndpoints(
      machine,
      fromStateId,
      toStateId,
    );
    if (existing !== null) {
      throw new WorkflowStateTransitionDuplicateActiveEdgeError(
        existing.id,
        fromStateId,
        toStateId,
      );
    }
  }

  private async persist(
    action: 'create' | 'update' | 'archive' | 'restore',
    entityId: EntityId,
    actor: string | undefined,
    occurredAt: IsoTimestamp | undefined,
    before: WorkflowStateTransition | undefined,
    after: WorkflowStateTransition,
    mutation: (transitions: WorkflowStateTransitionRepository) => Promise<WorkflowStateTransition>,
  ): Promise<WorkflowStateTransition> {
    if (this.provenance === undefined) return mutation(this.transitions);
    if (actor === undefined) throw new Error('WorkflowStateTransition provenance mutations require an actor');
    return this.provenance.mutateWithProvenance({
      entityType: 'workflow_state_transition', entityId, action, actor, occurredAt,
      before: before === undefined ? undefined : snapshot(before), after: snapshot(after),
      mutate: (context) => mutation((this.transitionsInTransaction as (context: TContext) => WorkflowStateTransitionRepository)(context)),
    });
  }
}

function machineOf(state: WorkflowState): WorkflowStateTransitionMachine {
  return {
    workflowId: state.workflowId,
    entityType: state.entityType,
    labelId: state.labelId,
  };
}

function sameMachine(source: WorkflowState, destination: WorkflowState): boolean {
  return source.workflowId === destination.workflowId &&
    source.entityType === destination.entityType &&
    source.labelId === destination.labelId;
}

function snapshot(transition: WorkflowStateTransition): EntitySnapshot {
  return { ...transition };
}
