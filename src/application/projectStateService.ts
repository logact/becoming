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

/**
 * Command for defining a new Project State. Works for Project-native states
 * (no `sourceWorkflowStateId`) and for states copied from a Workflow template
 * (`sourceWorkflowStateId` kept as provenance only). `createdAt` defaults to
 * the clock's current time.
 */
export interface CreateProjectStateCommand {
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
  clock?: Clock;
  ids?: IdGenerator;
}

export class ProjectStateService {
  private readonly projects: ProjectLookup;
  private readonly labels: LabelRepository;
  private readonly states: ProjectStateRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(ports: ProjectStateServicePorts) {
    this.projects = ports.projects;
    this.labels = ports.labels;
    this.states = ports.states;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
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
    await this.states.add(state);
    return state;
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
  ): Promise<ProjectState> {
    const state = await this.requireState(stateId);
    const updated = updateProjectState(
      state,
      changes,
      updatedAt ?? this.clock.now(),
    );
    await this.states.save(updated);
    return updated;
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
  ): Promise<ProjectState> {
    const state = await this.requireState(stateId);
    const archived = archiveProjectState(state, archivedAt ?? this.clock.now());
    await this.states.save(archived);
    return archived;
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

  private async requireState(stateId: EntityId): Promise<ProjectState> {
    const state = await this.states.getById(stateId);
    if (state === null) {
      throw new ProjectStateNotFoundError(stateId);
    }
    return state;
  }
}
