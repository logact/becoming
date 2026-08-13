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
    await this.transitions.add(transition);
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
