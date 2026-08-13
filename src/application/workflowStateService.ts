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
import type { RecordRepository } from '../persistence/recordRepository';
import type { EntitySnapshot, FieldSelectionPolicy } from '../domain/mutationProvenance';
import { MutationProvenanceService } from './mutationProvenanceService';
import type { UnitOfWork } from './unitOfWork';
import type { ProvenanceEntry } from './mutationProvenanceService';
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
  actor?: string;
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

/** Optional semantic filters for active or historical machine inspection. */
export interface WorkflowStateQuery {
  category?: string | null;
  isInitial?: boolean;
  isTerminal?: boolean;
}

/** A historical machine remains intelligible even when its references archive. */
export interface ResolvedWorkflowStateMachine {
  workflow: Awaited<ReturnType<WorkflowRepository['getById']>>;
  label: Awaited<ReturnType<LabelRepository['getById']>>;
  states: WorkflowState[];
}

export interface WorkflowStateServicePorts<TContext = unknown> {
  workflows: WorkflowRepository;
  labels: LabelRepository;
  states: WorkflowStateRepository;
  /** Optional archive preflight; #40 will own richer transition behavior. */
  transitionReferences?: WorkflowStateTransitionReferenceRepository;
  /**
   * Optional provenance transport. Supplying all three ports makes state
   * definition mutations atomic with one allowlisted mutation Record; the
   * original direct repository mode remains available to bootstrap callers.
   */
  unitOfWork?: UnitOfWork<TContext>;
  statesInTransaction?: (context: TContext) => WorkflowStateRepository;
  records?: (context: TContext) => RecordRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

const WORKFLOW_STATE_POLICY: FieldSelectionPolicy = {
  allowlist: [
    'workflowId', 'entityType', 'labelId', 'title', 'description', 'category',
    'sortOrder', 'isInitial', 'isTerminal', 'entryCriteria', 'exitCriteria',
    'createdAt', 'updatedAt', 'archivedAt',
  ],
  redacted: [],
};

export class WorkflowStateService<TContext = unknown> {
  private readonly workflows: WorkflowRepository;
  private readonly labels: LabelRepository;
  private readonly states: WorkflowStateRepository;
  private readonly transitionReferences?: WorkflowStateTransitionReferenceRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly statesInTransaction?: (context: TContext) => WorkflowStateRepository;
  private readonly provenance?: MutationProvenanceService<TContext>;

  constructor(ports: WorkflowStateServicePorts<TContext>) {
    this.workflows = ports.workflows;
    this.labels = ports.labels;
    this.states = ports.states;
    this.transitionReferences = ports.transitionReferences;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.statesInTransaction = ports.statesInTransaction;
    if (ports.unitOfWork !== undefined || ports.records !== undefined || ports.statesInTransaction !== undefined) {
      if (ports.unitOfWork === undefined || ports.records === undefined || ports.statesInTransaction === undefined) {
        throw new Error('WorkflowStateService provenance requires unitOfWork, statesInTransaction, and records');
      }
      this.provenance = new MutationProvenanceService({
        unitOfWork: ports.unitOfWork,
        records: ports.records,
        clock: this.clock,
        ids: this.ids,
        additionalFieldPolicies: { workflow_state: WORKFLOW_STATE_POLICY },
      });
    }
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
    return this.mutate('create', state.id, command.actor, command.definedAt, undefined, state,
      async (states) => { await states.add(state); return state; });
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
    actor?: string,
  ): Promise<WorkflowState> {
    const state = await this.requireState(stateId);
    const updated = updateWorkflowState(
      state,
      changes,
      updatedAt ?? this.clock.now(),
    );
    return this.mutate('update', stateId, actor, updatedAt, state, updated,
      async (states) => { await states.save(updated); return updated; });
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
    actor?: string,
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
    const byId = new Map(active.map((state) => [state.id, state]));
    const reordered = orderedStateIds.map((id, index) => ({
      ...(byId.get(id) as WorkflowState),
      sortOrder: index + 1,
      updatedAt: now,
    }));
    if (this.provenance === undefined) {
      await this.states.reorderActiveForMachine(machine, orderedStateIds, now);
      return reordered;
    }
    if (actor === undefined) throw new Error('WorkflowState provenance mutations require an actor');
    const entries: ProvenanceEntry[] = reordered.map((state) => ({
      entityType: 'workflow_state', entityId: state.id, action: 'update', actor,
      occurredAt: reorderedAt, before: snapshot(byId.get(state.id) as WorkflowState), after: snapshot(state),
    }));
    return this.provenance.mutateBatchWithProvenance(entries, async (context) => {
      await (this.statesInTransaction as (context: TContext) => WorkflowStateRepository)(context)
        .reorderActiveForMachine(machine, orderedStateIds, now);
      return reordered;
    });
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
    actor?: string,
  ): Promise<WorkflowState> {
    const state = await this.requireState(stateId);
    if (
      this.transitionReferences &&
      await this.transitionReferences.hasActiveReferences(stateId)
    ) {
      throw new WorkflowStateHasActiveTransitionReferencesError(stateId);
    }
    const archived = archiveWorkflowState(state, archivedAt ?? this.clock.now());
    return this.mutate('archive', stateId, actor, archivedAt, state, archived,
      async (states) => { await states.save(archived); return archived; });
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
    query?: WorkflowStateQuery,
  ): Promise<WorkflowState[]> {
    return filterStates(
      await this.states.listActiveForMachine({ workflowId, entityType, labelId }),
      query,
    );
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
    query?: WorkflowStateQuery,
  ): Promise<WorkflowState[]> {
    return filterStates(
      await this.states.listForMachine({ workflowId, entityType, labelId }),
      query,
    );
  }

  /**
   * Resolve an explicit historical machine definition. Archived Workflow and
   * Label rows are intentionally returned rather than treated as missing;
   * only a broken logical reference throws, because it makes history
   * uninterpretable.
   */
  async resolveMachineHistory(
    workflowId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
    query?: WorkflowStateQuery,
  ): Promise<ResolvedWorkflowStateMachine> {
    const workflow = await this.workflows.getById(workflowId);
    if (workflow === null) throw new WorkflowNotFoundError(workflowId);
    const label = await this.labels.getById(labelId);
    if (label === null) throw new LabelNotFoundError(labelId);
    return { workflow, label, states: await this.listMachineHistory(workflowId, entityType, labelId, query) };
  }

  private async requireState(stateId: EntityId): Promise<WorkflowState> {
    const state = await this.states.getById(stateId);
    if (state === null) {
      throw new WorkflowStateNotFoundError(stateId);
    }
    return state;
  }

  private async mutate(
    action: 'create' | 'update' | 'archive',
    entityId: EntityId,
    actor: string | undefined,
    occurredAt: IsoTimestamp | undefined,
    before: WorkflowState | undefined,
    after: WorkflowState,
    mutation: (states: WorkflowStateRepository) => Promise<WorkflowState>,
  ): Promise<WorkflowState> {
    if (this.provenance === undefined) return mutation(this.states);
    if (actor === undefined) throw new Error('WorkflowState provenance mutations require an actor');
    return this.provenance.mutateWithProvenance({
      entityType: 'workflow_state', entityId, action, actor, occurredAt,
      before: before === undefined ? undefined : snapshot(before), after: snapshot(after),
      mutate: (context) => mutation((this.statesInTransaction as (context: TContext) => WorkflowStateRepository)(context)),
    });
  }
}

function snapshot(state: WorkflowState): EntitySnapshot {
  return { ...state };
}

function filterStates(
  states: WorkflowState[],
  query: WorkflowStateQuery | undefined,
): WorkflowState[] {
  if (query === undefined) return states;
  return states.filter((state) =>
    (query.category === undefined || state.category === query.category) &&
    (query.isInitial === undefined || state.isInitial === query.isInitial) &&
    (query.isTerminal === undefined || state.isTerminal === query.isTerminal),
  );
}
