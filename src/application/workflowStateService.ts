import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import {
  archiveWorkflowState,
  createWorkflowState,
  updateWorkflowState,
} from '../domain/workflowState';
import type {
  WorkflowState,
  WorkflowStateChanges,
  WorkflowStateMachine,
} from '../domain/workflowState';
import type { WorkflowRepository } from '../persistence/workflowRepository';
import type { LabelRepository } from '../persistence/labelRepository';
import type { WorkflowStateRepository } from '../persistence/workflowStateRepository';
import { WorkflowStateHasActiveTransitionReferencesError } from '../persistence/workflowStateRepository';
import type { WorkflowStateTransitionReferenceRepository } from '../persistence/workflowStateTransitionReferenceRepository';
import {
  LabelArchivedError,
  LabelNotFoundError,
} from './labelAssignmentService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

/**
 * Application boundary for defining and maintaining reusable Workflow State
 * templates and querying them by their exact machine identity
 * (`workflowId + entityType + labelId`).
 *
 * The service depends only on framework-neutral ports — a `Clock`, an
 * `IdGenerator`, and the Workflow/Label/WorkflowState persistence
 * boundaries — so the same behavior runs under any UI, HTTP, or
 * serialization framework (or none at all). All domain validation runs
 * before persistence; invalid commands throw domain errors and never reach
 * the repository.
 *
 * Logical-reference integrity lives here because the `workflow_states` table
 * has no foreign keys:
 * - `workflowId` must resolve to an existing Workflow via
 *   `WorkflowRepository`, and new states for an archived Workflow are
 *   rejected. States already stored for an archived Workflow stay resolvable
 *   by id and in machine queries.
 * - `labelId` must resolve to an existing Label via `LabelRepository`, with
 *   the same active/archived rule.
 * - `entityType` must be one of the eight core entity types; this invariant
 *   is enforced by the domain aggregate itself.
 * - Active titles normalize by trim + lowercase and are unique per machine;
 *   each machine has at most one active initial state. A state may be initial
 *   or terminal but never both; V1 permits draft machines with no initial
 *   state and zero or more terminal states.
 */

/** Thrown when the Workflow referenced by a state command does not exist. */
export class WorkflowNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Workflow ${id} not found`);
    this.name = 'WorkflowNotFoundError';
  }
}

/** Thrown when defining a new state for an archived Workflow. */
export class WorkflowArchivedError extends Error {
  constructor(id: EntityId) {
    super(`Workflow ${id} is archived and cannot define new states`);
    this.name = 'WorkflowArchivedError';
  }
}

/** Thrown when a Workflow State is requested by an id that does not exist. */
export class WorkflowStateNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`WorkflowState ${id} not found`);
    this.name = 'WorkflowStateNotFoundError';
  }
}

/**
 * Command for defining a new Workflow State template. `definedAt` defaults to
 * the clock's current time.
 */
export interface DefineWorkflowStateCommand {
  workflowId: EntityId;
  entityType: string;
  labelId: EntityId;
  title: string;
  description?: string;
  category?: string;
  sortOrder?: number;
  isInitial?: boolean;
  isTerminal?: boolean;
  entryCriteria?: string;
  exitCriteria?: string;
  definedAt?: IsoTimestamp;
}

export interface WorkflowStateServicePorts {
  workflows: WorkflowRepository;
  labels: LabelRepository;
  states: WorkflowStateRepository;
  /** Optional archive preflight; #40 will own richer transition behavior. */
  transitionReferences?: WorkflowStateTransitionReferenceRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

export class WorkflowStateService {
  private readonly workflows: WorkflowRepository;
  private readonly labels: LabelRepository;
  private readonly states: WorkflowStateRepository;
  private readonly transitionReferences?: WorkflowStateTransitionReferenceRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(ports: WorkflowStateServicePorts) {
    this.workflows = ports.workflows;
    this.labels = ports.labels;
    this.states = ports.states;
    this.transitionReferences = ports.transitionReferences;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  /**
   * Define a new State template for exactly one machine, returning the stored
   * aggregate. Throws `WorkflowNotFoundError`/`LabelNotFoundError` when a
   * reference does not exist, `WorkflowArchivedError`/`LabelArchivedError`
   * when a reference is archived, and a domain error when the entity type is
   * not a core concept or a field is invalid.
   */
  async defineState(
    command: DefineWorkflowStateCommand,
  ): Promise<WorkflowState> {
    const workflow = await this.workflows.getById(command.workflowId);
    if (workflow === null) {
      throw new WorkflowNotFoundError(command.workflowId);
    }
    if (workflow.archivedAt !== null) {
      throw new WorkflowArchivedError(command.workflowId);
    }
    const label = await this.labels.getById(command.labelId);
    if (label === null) {
      throw new LabelNotFoundError(command.labelId);
    }
    if (label.archivedAt !== null) {
      throw new LabelArchivedError(command.labelId);
    }
    const state = createWorkflowState(command, {
      id: this.ids.newId(),
      now: command.definedAt ?? this.clock.now(),
    });
    await this.states.add(state);
    return state;
  }

  /**
   * Edit an active State template's intrinsic fields. Machine identity never
   * changes. Throws `WorkflowStateNotFoundError` for an unknown id and a
   * domain error when the template is archived or the change is invalid.
   */
  async updateState(
    stateId: EntityId,
    changes: WorkflowStateChanges,
    updatedAt?: IsoTimestamp,
  ): Promise<WorkflowState> {
    const state = await this.requireState(stateId);
    const updated = updateWorkflowState(
      state,
      changes,
      updatedAt ?? this.clock.now(),
    );
    await this.states.save(updated);
    return updated;
  }

  /**
   * Assign sequential sort orders to the complete active set of one machine.
   * The command rejects unknown, duplicated, omitted, or cross-machine ids,
   * so active ordering is total and deterministic after every reorder.
   */
  async reorderStates(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
    orderedStateIds: readonly EntityId[],
    reorderedAt?: IsoTimestamp,
  ): Promise<WorkflowState[]> {
    const machine = { workflowId, entityType, labelId };
    const active = await this.states.listActiveForMachine(machine);
    const activeIds = new Set(active.map((state) => state.id));
    if (
      orderedStateIds.length !== active.length ||
      new Set(orderedStateIds).size !== orderedStateIds.length ||
      !orderedStateIds.every((id) => activeIds.has(id))
    ) {
      throw new Error(
        `reorderStates must list every active state of machine ${workflowId}/${entityType}/${labelId} exactly once`,
      );
    }
    const now = reorderedAt ?? this.clock.now();
    await this.states.reorderActiveForMachine(machine, orderedStateIds, now);
    const byId = new Map(active.map((state) => [state.id, state]));
    return orderedStateIds.map((id, index) => ({
      ...(byId.get(id) as WorkflowState),
      sortOrder: index + 1,
      updatedAt: now,
    }));
  }

  /**
   * An initial state starts a machine; a terminal state ends it. V1 permits a
   * draft to have no initial state and permits zero or more terminal states.
   */
  async getActiveInitialState(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<WorkflowState | null> {
    return this.states.findActiveInitialForMachine({ workflowId, entityType, labelId });
  }

  async listActiveTerminalStates(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<WorkflowState[]> {
    return this.states.listActiveTerminalsForMachine({ workflowId, entityType, labelId });
  }

  /**
   * Archive a State template. The archived template stays retrievable by id
   * and in historical machine queries. Throws `WorkflowStateNotFoundError`
   * for an unknown id and a domain error when already archived.
   */
  async archiveState(
    stateId: EntityId,
    archivedAt?: IsoTimestamp,
  ): Promise<WorkflowState> {
    const state = await this.requireState(stateId);
    if (
      this.transitionReferences &&
      await this.transitionReferences.hasActiveReferences(stateId)
    ) {
      throw new WorkflowStateHasActiveTransitionReferencesError(stateId);
    }
    const archived = archiveWorkflowState(state, archivedAt ?? this.clock.now());
    await this.states.save(archived);
    return archived;
  }

  /** Return the State template with this id (active or archived), or null. */
  async getState(stateId: EntityId): Promise<WorkflowState | null> {
    return this.states.getById(stateId);
  }

  /**
   * Return the active State templates of exactly one machine in deterministic
   * order (`sortOrder` NULLs last, then `createdAt`, then `id`).
   */
  async listActiveStates(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<WorkflowState[]> {
    return this.states.listActiveForMachine({ workflowId, entityType, labelId });
  }

  /**
   * Return the full template history of exactly one machine — active and
   * archived — in the same deterministic order, so historical machine
   * definitions stay inspectable.
   */
  async listMachineHistory(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<WorkflowState[]> {
    return this.states.listForMachine({ workflowId, entityType, labelId });
  }

  private async requireState(stateId: EntityId): Promise<WorkflowState> {
    const state = await this.states.getById(stateId);
    if (state === null) {
      throw new WorkflowStateNotFoundError(stateId);
    }
    return state;
  }
}
