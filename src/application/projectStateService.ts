import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import {
  archiveProjectState,
  createProjectState,
  updateProjectState,
} from '../domain/projectState';
import type {
  ProjectState,
  ProjectStateChanges,
} from '../domain/projectState';
import type { LabelRepository } from '../persistence/labelRepository';
import type { ProjectStateRepository } from '../persistence/projectStateRepository';
import { SqliteProjectStateRepository } from '../persistence/projectStateRepository';
import { SqliteProjectEntityStateRepository } from '../persistence/projectEntityStateRepository';
import type { SqliteDatabase } from '../persistence/database';
import { withTransaction } from '../persistence/transactions';
import { createProjectEntityState, endProjectEntityState } from '../domain/projectEntityState';
import type { ProjectEntityState } from '../domain/projectEntityState';
import type { RecordRepository } from '../persistence/recordRepository';
import type { EntitySnapshot, FieldSelectionPolicy } from '../domain/mutationProvenance';
import { MutationProvenanceService } from './mutationProvenanceService';
import type { UnitOfWork } from './unitOfWork';
import {
  LabelArchivedError,
  LabelNotFoundError,
} from './labelAssignmentService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

/**
 * Application boundary for owning, editing, ordering, archiving, and querying
 * the State definitions of one Project state machine
 * (`projectId + entityType + labelId`).
 *
 * The service depends only on framework-neutral ports — a `Clock`, an
 * `IdGenerator`, and the Project/Label/ProjectState persistence boundaries —
 * so the same behavior runs under any UI, HTTP, or serialization framework
 * (or none at all). All domain validation runs before persistence; invalid
 * commands throw domain errors and never reach the repository.
 *
 * Logical-reference integrity lives here because the `project_states` table
 * has no foreign keys:
 * - `projectId` must resolve to an existing Project via the `ProjectLookup`
 *   port, and new states for an archived Project are rejected. States already
 *   stored for an archived Project stay resolvable by id and in machine
 *   queries.
 * - `labelId` must resolve to an existing Label via `LabelRepository`, with
 *   the same active/archived rule.
 * - `entityType` must be one of the eight core entity types; this invariant
 *   is enforced by the domain aggregate itself.
 * - `sourceWorkflowStateId` is accepted as provenance-only data: it is
 *   stored and queryable but deliberately never validated against, or written
 *   back to, the Workflow templates, so an initialized Project machine stays
 *   independent of later Workflow edits.
 *
 * Machine invariants — normalized title uniqueness and one active initial
 * state per machine — are enforced atomically by the repository on every
 * write, so concurrent create/update commands cannot produce a second
 * initial state.
 */

/**
 * Minimal read boundary the service needs for Project reference validation.
 * The full Project aggregate and its repository arrive with the Project
 * management feature; any repository whose `getById` resolves a Project's id
 * and archival timestamp satisfies this port structurally.
 */
export interface ProjectLookup {
  getById(
    id: EntityId,
  ): Promise<{ id: EntityId; archivedAt: IsoTimestamp | null } | null>;
}

/** Thrown when the Project referenced by a state command does not exist. */
export class ProjectNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Project ${id} not found`);
    this.name = 'ProjectNotFoundError';
  }
}

/** Thrown when defining a new state for an archived Project. */
export class ProjectArchivedError extends Error {
  constructor(id: EntityId) {
    super(`Project ${id} is archived and cannot define new states`);
    this.name = 'ProjectArchivedError';
  }
}

/** Thrown when a Project State is requested by an id that does not exist. */
export class ProjectStateNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`ProjectState ${id} not found`);
    this.name = 'ProjectStateNotFoundError';
  }
}

/** Raised rather than silently invalidating current runtime state history. */
export class ProjectStateOccupiedError extends Error {
  constructor(readonly stateId: EntityId, readonly occupancyCount: number) {
    super(`ProjectState ${stateId} is occupied by ${occupancyCount} current Project entity state${occupancyCount === 1 ? '' : 's'}; migrate occupants before archival`);
    this.name = 'ProjectStateOccupiedError';
  }
}

/** A bulk migration can only remain in the exact same active state machine. */
export class ProjectStateMigrationDestinationError extends Error {
  constructor(sourceId: EntityId, destinationId: EntityId, reason: 'missing' | 'archived' | 'machine_mismatch' | 'same_state') {
    super(`ProjectState migration destination ${destinationId} for ${sourceId} is invalid: ${reason}`);
    this.name = 'ProjectStateMigrationDestinationError';
  }
}

/**
 * Command for defining a new Project State. Works for Project-native states
 * (no `sourceWorkflowStateId`) and for states copied from a Workflow template
 * (`sourceWorkflowStateId` kept as provenance only). `createdAt` defaults to
 * the clock's current time.
 */
export interface CreateProjectStateCommand {
  actor?: string;
  projectId: EntityId;
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
  sourceWorkflowStateId?: EntityId;
  createdAt?: IsoTimestamp;
}

export interface ProjectStateServicePorts {
  projects: ProjectLookup;
  labels: LabelRepository;
  states: ProjectStateRepository;
  /** Required only for atomic occupant migration. */
  db?: SqliteDatabase;
  /** Optional atomic provenance transport for Project State mutations. */
  unitOfWork?: UnitOfWork<SqliteDatabase>;
  statesInTransaction?: (context: SqliteDatabase) => ProjectStateRepository;
  records?: (context: SqliteDatabase) => RecordRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

export interface MigrateProjectStateOccupantsCommand {
  sourceStateId: EntityId;
  destinationStateId: EntityId;
  /** Archive the source once every current occupant has moved. Defaults true. */
  archiveSource?: boolean;
  migratedAt?: IsoTimestamp;
  actor?: string;
}

export interface ProjectStateOccupantMigration {
  source: ProjectState;
  destination: ProjectState;
  previous: ProjectEntityState[];
  current: ProjectEntityState[];
  archivedSource: ProjectState | null;
}

/** An inspectable machine view intentionally includes archived references. */
export interface ResolvedProjectStateMachine {
  project: Awaited<ReturnType<ProjectLookup['getById']>>;
  label: Awaited<ReturnType<LabelRepository['getById']>>;
  states: ProjectState[];
}

const PROJECT_STATE_POLICY: FieldSelectionPolicy = {
  allowlist: [
    'projectId', 'entityType', 'labelId', 'title', 'description', 'category',
    'sortOrder', 'isInitial', 'isTerminal', 'entryCriteria', 'exitCriteria',
    'sourceWorkflowStateId', 'createdAt', 'updatedAt', 'archivedAt',
  ],
  redacted: [],
};

export class ProjectStateService {
  private readonly projects: ProjectLookup;
  private readonly labels: LabelRepository;
  private readonly states: ProjectStateRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly db?: SqliteDatabase;
  private readonly statesInTransaction?: (context: SqliteDatabase) => ProjectStateRepository;
  private readonly provenance?: MutationProvenanceService<SqliteDatabase>;

  constructor(ports: ProjectStateServicePorts) {
    this.projects = ports.projects;
    this.labels = ports.labels;
    this.states = ports.states;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.db = ports.db;
    this.statesInTransaction = ports.statesInTransaction;
    if (ports.unitOfWork !== undefined || ports.records !== undefined || ports.statesInTransaction !== undefined) {
      if (ports.unitOfWork === undefined || ports.records === undefined || ports.statesInTransaction === undefined) {
        throw new Error('ProjectStateService provenance requires unitOfWork, statesInTransaction, and records');
      }
      this.provenance = new MutationProvenanceService({
        unitOfWork: ports.unitOfWork,
        records: ports.records,
        clock: this.clock,
        ids: this.ids,
        additionalFieldPolicies: { project_state: PROJECT_STATE_POLICY },
      });
    }
  }

  /**
   * Define a new State for exactly one Project machine, returning the stored
   * aggregate. Throws `ProjectNotFoundError`/`LabelNotFoundError` when a
   * reference does not exist, `ProjectArchivedError`/`LabelArchivedError`
   * when a reference is archived, `ProjectStateTitleConflictError` when the
   * machine already has an active state with the same normalized title,
   * `ProjectStateInitialConflictError` when it already has an active initial
   * state, and a domain error when the entity type is not a core concept or a
   * field is invalid.
   */
  async createState(command: CreateProjectStateCommand): Promise<ProjectState> {
    const project = await this.projects.getById(command.projectId);
    if (project === null) {
      throw new ProjectNotFoundError(command.projectId);
    }
    if (project.archivedAt !== null) {
      throw new ProjectArchivedError(command.projectId);
    }
    const label = await this.labels.getById(command.labelId);
    if (label === null) {
      throw new LabelNotFoundError(command.labelId);
    }
    if (label.archivedAt !== null) {
      throw new LabelArchivedError(command.labelId);
    }
    const state = createProjectState(command, {
      id: this.ids.newId(),
      now: command.createdAt ?? this.clock.now(),
    });
    return this.mutate('create', state.id, command.actor, command.createdAt, undefined, state,
      async (states) => { await states.add(state); return state; });
  }

  /**
   * Edit an active Project State's intrinsic fields. Machine identity,
   * creation identity, and the source provenance id never change, and no part
   * of the edit writes back to any Workflow template. Throws
   * `ProjectStateNotFoundError` for an unknown id,
   * `ProjectStateTitleConflictError`/`ProjectStateInitialConflictError` when
   * the change would break a machine invariant, and a domain error when the
   * state is archived or the change is invalid.
   */
  async updateState(
    stateId: EntityId,
    changes: ProjectStateChanges,
    updatedAt?: IsoTimestamp,
    actor?: string,
  ): Promise<ProjectState> {
    const state = await this.requireState(stateId);
    const updated = updateProjectState(
      state,
      changes,
      updatedAt ?? this.clock.now(),
    );
    return this.mutate('update', stateId, actor, updatedAt, state, updated,
      async (states) => { await states.save(updated); return updated; });
  }

  /**
   * Order the active states of exactly one machine by assigning sequential
   * sort orders (1..n) in the given order. `orderedStateIds` must list every
   * active state of the machine exactly once, so the resulting order is total
   * and deterministic; archived states keep their recorded order in the
   * historical view.
   */
  async reorderStates(
    projectId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
    orderedStateIds: readonly EntityId[],
    reorderedAt?: IsoTimestamp,
  ): Promise<ProjectState[]> {
    const machine = { projectId, entityType, labelId };
    const active = await this.states.listActiveForMachine(machine);
    const activeIds = new Set(active.map((state) => state.id));
    if (
      orderedStateIds.length !== active.length ||
      new Set(orderedStateIds).size !== orderedStateIds.length ||
      !orderedStateIds.every((id) => activeIds.has(id))
    ) {
      throw new Error(
        `reorderStates must list every active state of machine ${projectId}/${entityType}/${labelId} exactly once`,
      );
    }
    const now = reorderedAt ?? this.clock.now();
    const byId = new Map(active.map((state) => [state.id, state]));
    const reordered: ProjectState[] = [];
    for (const [index, id] of orderedStateIds.entries()) {
      const state = byId.get(id) as ProjectState;
      const updated = updateProjectState(state, { sortOrder: index + 1 }, now);
      await this.states.save(updated);
      reordered.push(updated);
    }
    return reordered;
  }

  /**
   * Archive a Project State. The archived state stays retrievable by id and
   * in historical machine queries, and its normalized title and initial flag
   * become reusable. Throws `ProjectStateNotFoundError` for an unknown id and
   * a domain error when already archived.
   */
  async archiveState(
    stateId: EntityId,
    archivedAt?: IsoTimestamp,
    actor?: string,
  ): Promise<ProjectState> {
    const state = await this.requireState(stateId);
    if (this.db === undefined) {
      // Legacy repository-only construction cannot inspect runtime occupancy.
      // It remains valid only when there is no current-state persistence port.
      const archived = archiveProjectState(state, archivedAt ?? this.clock.now());
      return this.mutate('archive', stateId, actor, archivedAt, state, archived,
        async (states) => { await states.save(archived); return archived; });
    }
    const at = archivedAt ?? this.clock.now();
    const archive = async (context: SqliteDatabase): Promise<ProjectState> => {
      const states = new SqliteProjectStateRepository(context);
      const current = await states.getById(stateId);
      if (current === null) throw new ProjectStateNotFoundError(stateId);
      const occupancy = await new SqliteProjectEntityStateRepository(context).listCurrentForProjectState(stateId);
      if (occupancy.length !== 0) throw new ProjectStateOccupiedError(stateId, occupancy.length);
      const archived = archiveProjectState(current, at);
      await states.save(archived);
      return archived;
    };
    if (this.provenance === undefined) return withTransaction(this.db, archive);
    if (actor === undefined) throw new Error('ProjectState provenance mutations require an actor');
    const archived = archiveProjectState(state, at);
    return this.provenance.mutateWithProvenance({
      entityType: 'project_state', entityId: stateId, action: 'archive', actor, occurredAt: at,
      before: snapshot(state), after: snapshot(archived),
      mutate: (context) => archive(context),
    });
  }

  /**
   * Explicitly move every current occupant to an active State in the same
   * machine. Closing and opening all periods and optional source archival are
   * one transaction, so a fault or competing command leaves no partial move.
   */
  async migrateOccupants(
    command: MigrateProjectStateOccupantsCommand,
  ): Promise<ProjectStateOccupantMigration> {
    if (this.db === undefined) throw new Error('ProjectStateService migration requires db');
    const at = command.migratedAt ?? this.clock.now();
    const migrate = async (context: SqliteDatabase): Promise<ProjectStateOccupantMigration> => {
      const states = new SqliteProjectStateRepository(context);
      const source = await states.getById(command.sourceStateId);
      if (source === null) throw new ProjectStateNotFoundError(command.sourceStateId);
      const destination = await states.getById(command.destinationStateId);
      if (destination === null) throw new ProjectStateMigrationDestinationError(source.id, command.destinationStateId, 'missing');
      if (destination.id === source.id) throw new ProjectStateMigrationDestinationError(source.id, destination.id, 'same_state');
      if (destination.archivedAt !== null) throw new ProjectStateMigrationDestinationError(source.id, destination.id, 'archived');
      if (source.projectId !== destination.projectId || source.entityType !== destination.entityType || source.labelId !== destination.labelId) {
        throw new ProjectStateMigrationDestinationError(source.id, destination.id, 'machine_mismatch');
      }
      const periods = new SqliteProjectEntityStateRepository(context);
      const open = await periods.listCurrentForProjectState(source.id);
      const previous = open.map((period) => endProjectEntityState(period, at));
      for (const period of previous) await periods.end(period);
      const current = previous.map((period) => createProjectEntityState({
        projectId: period.projectId, entityType: period.entityType, entityId: period.entityId,
        labelId: period.labelId, projectStateId: destination.id, enteredAt: at,
      }, { id: this.ids.newId(), now: at }));
      for (const period of current) await periods.add(period);
      const archivedSource = command.archiveSource === false ? null : archiveProjectState(source, at);
      if (archivedSource !== null) await states.save(archivedSource);
      return { source, destination, previous, current, archivedSource };
    };
    // A migration records the source definition's archival, when requested;
    // period history itself is append-preserved transition evidence.
    if (this.provenance === undefined || command.archiveSource === false) return withTransaction(this.db, migrate);
    if (command.actor === undefined) throw new Error('ProjectState provenance mutations require an actor');
    const source = await this.requireState(command.sourceStateId);
    const archived = archiveProjectState(source, at);
    return this.provenance.mutateWithProvenance({
      entityType: 'project_state', entityId: source.id, action: 'archive', actor: command.actor, occurredAt: at,
      description: `migrate occupants from ProjectState ${source.id} to ${command.destinationStateId}`,
      before: snapshot(source), after: snapshot(archived), mutate: migrate,
    });
  }

  /** Return the Project State with this id (active or archived), or null. */
  async getState(stateId: EntityId): Promise<ProjectState | null> {
    return this.states.getById(stateId);
  }

  /**
   * Return the active States of exactly one Project machine in deterministic
   * order (`sortOrder` NULLs last, then `createdAt`, then `id`).
   */
  async listActiveStates(
    projectId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<ProjectState[]> {
    return this.states.listActiveForMachine({ projectId, entityType, labelId });
  }

  /**
   * Return the full history of exactly one Project machine — active and
   * archived — in the same deterministic order, so historical machine
   * definitions stay inspectable.
   */
  async listMachineHistory(
    projectId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<ProjectState[]> {
    return this.states.listForMachine({ projectId, entityType, labelId });
  }

  /** Resolve complete history without hiding archived Project/Label origins. */
  async resolveMachineHistory(
    projectId: EntityId,
    entityType: CoreEntityType,
    labelId: EntityId,
  ): Promise<ResolvedProjectStateMachine> {
    const project = await this.projects.getById(projectId);
    if (project === null) throw new ProjectNotFoundError(projectId);
    const label = await this.labels.getById(labelId);
    if (label === null) throw new LabelNotFoundError(labelId);
    return { project, label, states: await this.listMachineHistory(projectId, entityType, labelId) };
  }

  private async requireState(stateId: EntityId): Promise<ProjectState> {
    const state = await this.states.getById(stateId);
    if (state === null) {
      throw new ProjectStateNotFoundError(stateId);
    }
    return state;
  }

  private async mutate(
    action: 'create' | 'update' | 'archive', entityId: EntityId, actor: string | undefined,
    occurredAt: IsoTimestamp | undefined, before: ProjectState | undefined, after: ProjectState,
    mutation: (states: ProjectStateRepository) => Promise<ProjectState>,
  ): Promise<ProjectState> {
    if (this.provenance === undefined) return mutation(this.states);
    if (actor === undefined) throw new Error('ProjectState provenance mutations require an actor');
    return this.provenance.mutateWithProvenance({
      entityType: 'project_state', entityId, action, actor, occurredAt,
      before: before === undefined ? undefined : snapshot(before), after: snapshot(after),
      mutate: (context) => mutation((this.statesInTransaction as (context: SqliteDatabase) => ProjectStateRepository)(context)),
    });
  }
}

function snapshot(state: ProjectState): EntitySnapshot { return { ...state }; }
