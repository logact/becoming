import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { WorkflowState } from '../domain/workflowState';
import type { WorkflowStateRepository } from '../persistence/workflowStateRepository';
import type {
  WorkflowStateTransitionRepository,
} from '../persistence/workflowStateTransitionRepository';
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
  fromStateId: EntityId;
  toStateId: EntityId;
  title?: string | null;
  description?: string | null;
  condition?: string | null;
  action?: string | null;
  requiresExitCriteria?: boolean;
  definedAt?: IsoTimestamp;
}

export interface WorkflowStateTransitionServicePorts {
  states: WorkflowStateRepository;
  transitions: WorkflowStateTransitionRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Application boundary for transition templates. It resolves both endpoint
 * ids before persistence, derives stored machine identity from the source,
 * and rejects cross-machine logical references without using foreign keys.
 */
export class WorkflowStateTransitionService {
  private readonly states: WorkflowStateRepository;
  private readonly transitions: WorkflowStateTransitionRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(ports: WorkflowStateTransitionServicePorts) {
    this.states = ports.states;
    this.transitions = ports.transitions;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
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
      await this.transitions.add(transition);
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
  ): Promise<WorkflowStateTransition> {
    const transition = await this.requireTransition(id);
    await this.requireActiveTopology(transition);
    const updated = updateWorkflowStateTransition(
      transition,
      changes,
      updatedAt ?? this.clock.now(),
    );
    await this.transitions.save(updated);
    return updated;
  }

  async archiveTransition(
    id: EntityId,
    archivedAt?: IsoTimestamp,
  ): Promise<WorkflowStateTransition> {
    const transition = await this.requireTransition(id);
    const archived = archiveWorkflowStateTransition(
      transition,
      archivedAt ?? this.clock.now(),
    );
    await this.transitions.save(archived);
    return archived;
  }

  /**
   * Reactivation re-validates endpoint existence, active status, machine
   * identity, and the normalized active-edge rule before it is persisted.
   */
  async reactivateTransition(
    id: EntityId,
    reactivatedAt?: IsoTimestamp,
  ): Promise<WorkflowStateTransition> {
    const transition = await this.requireTransition(id);
    const { source, destination, machine } = await this.requireActiveTopology(transition);
    await this.requireNoActiveEdge(machine, source.id, destination.id);
    const reactivated = reactivateWorkflowStateTransition(
      transition,
      reactivatedAt ?? this.clock.now(),
    );
    try {
      await this.transitions.save(reactivated);
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
