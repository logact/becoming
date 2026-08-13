import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * The ProjectState aggregate: a State actually used within one Project,
 * belonging to exactly one Project state machine (see `Table-definetion.txt`
 * #17, `project_states`).
 *
 * A Project state machine is identified by the triple `projectId +
 * entityType + labelId` (the "machine identity"), so one Project can manage
 * different State Machines for different kinds of entities and Labels.
 *
 * A Project State may be initialized from a Workflow State template; the
 * template id is kept in `sourceWorkflowStateId` as provenance only. The
 * Project State is fully independent afterward: editing, reordering, or
 * archiving it never writes back to the Workflow template, and Project-native
 * states simply carry `null`. The source id never changes after creation.
 *
 * Invariants enforced here (the `project_states` table has no database
 * foreign keys by design):
 * - `entityType` must be one of the eight core entity types.
 * - `projectId` and `labelId` must not be blank. Their *existence* — and
 *   whether they are archived — is a logical reference validated by the
 *   application layer against the Project and Label repository boundaries,
 *   never by the database.
 * - `title` must not be blank and `sortOrder`, when present, must be an
 *   integer.
 * - A state cannot be both initial and terminal: the initial state starts
 *   the machine's lifecycle, a terminal state ends it.
 *
 * Machine-level invariants that need sibling rows are enforced by the
 * repository on every write:
 * - normalized title uniqueness among the active states of one machine, and
 * - at most one active initial state per machine.
 *
 * Editing updates the intrinsic fields; machine identity, creation identity,
 * and the source provenance id never change. Archival is the only lifecycle
 * transition: `archivedAt` IS NULL means active. Archived states stay stored
 * so historical machine definitions remain resolvable by id.
 */
export interface ProjectState {
  id: EntityId;
  projectId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
  title: string;
  description: string | null;
  category: string | null;
  sortOrder: number | null;
  isInitial: boolean;
  isTerminal: boolean;
  entryCriteria: string | null;
  exitCriteria: string | null;
  sourceWorkflowStateId: EntityId | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/** The exact machine identity every Project State belongs to. */
export interface ProjectStateMachine {
  projectId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
}

/**
 * Thrown when a command would leave two active states with the same
 * normalized title in one machine.
 */
export class ProjectStateTitleConflictError extends Error {
  constructor(machine: ProjectStateMachine, title: string) {
    super(
      `Project machine ${machine.projectId}/${machine.entityType}/${machine.labelId} already has an active state titled ${JSON.stringify(title)}`,
    );
    this.name = 'ProjectStateTitleConflictError';
  }
}

/**
 * Thrown when a command would leave a machine with a second active initial
 * state.
 */
export class ProjectStateInitialConflictError extends Error {
  constructor(machine: ProjectStateMachine) {
    super(
      `Project machine ${machine.projectId}/${machine.entityType}/${machine.labelId} already has an active initial state`,
    );
    this.name = 'ProjectStateInitialConflictError';
  }
}

/**
 * Normalize a state title for the per-machine uniqueness rule: surrounding
 * whitespace is ignored and comparison is case-insensitive. Archived states
 * do not participate, so an archived title can be reused.
 */
export function normalizeProjectStateTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Input for defining a new Project State. */
export interface NewProjectState {
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
  /** Provenance-only id of the Workflow State this state was copied from. */
  sourceWorkflowStateId?: EntityId;
}

/** Optional dependencies, primarily for deterministic tests and services. */
export interface ProjectStateFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireCoreEntityType(value: string): CoreEntityType {
  if (!isCoreEntityType(value)) {
    throw new Error(
      `ProjectState entityType must be a core entity type, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireNonBlankId(field: string, value: EntityId): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`ProjectState ${field} must not be blank`);
  }
  return value;
}

function requireNonBlankTitle(value: string): string {
  if (value.trim().length === 0) {
    throw new Error('ProjectState title must not be blank');
  }
  return value;
}

function requireValidSortOrder(value: number | null): number | null {
  if (value !== null && !Number.isInteger(value)) {
    throw new Error(`ProjectState sortOrder must be an integer, got ${value}`);
  }
  return value;
}

function requireNotBothInitialAndTerminal(
  isInitial: boolean,
  isTerminal: boolean,
): void {
  if (isInitial && isTerminal) {
    throw new Error('ProjectState cannot be both initial and terminal');
  }
}

/** Validate the invariants every ProjectState must satisfy. */
export function validateProjectState(state: ProjectState): void {
  requireCoreEntityType(state.entityType);
  requireNonBlankId('projectId', state.projectId);
  requireNonBlankId('labelId', state.labelId);
  requireNonBlankTitle(state.title);
  requireValidSortOrder(state.sortOrder);
  requireNotBothInitialAndTerminal(state.isInitial, state.isTerminal);
}

/**
 * Define a new Project State with a fresh id and current timestamps. Optional
 * detail fields normalize to null when omitted, matching the TEXT/INTEGER
 * columns; `isInitial`/`isTerminal` default to false and
 * `sourceWorkflowStateId` defaults to null (a Project-native state). All
 * validation runs before the aggregate exists, so invalid input can never
 * reach persistence.
 */
export function createProjectState(
  input: NewProjectState,
  deps: ProjectStateFactoryDeps = {},
): ProjectState {
  const now = deps.now ?? nowIso();
  const state: ProjectState = {
    id: deps.id ?? newId(),
    projectId: requireNonBlankId('projectId', input.projectId),
    entityType: requireCoreEntityType(input.entityType),
    labelId: requireNonBlankId('labelId', input.labelId),
    title: requireNonBlankTitle(input.title),
    description: input.description ?? null,
    category: input.category ?? null,
    sortOrder: requireValidSortOrder(input.sortOrder ?? null),
    isInitial: input.isInitial ?? false,
    isTerminal: input.isTerminal ?? false,
    entryCriteria: input.entryCriteria ?? null,
    exitCriteria: input.exitCriteria ?? null,
    sourceWorkflowStateId: input.sourceWorkflowStateId ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateProjectState(state);
  return state;
}

/**
 * Fields a Project State may change; machine identity, creation identity, and
 * the source provenance id may not.
 */
export interface ProjectStateChanges {
  title?: string;
  description?: string | null;
  category?: string | null;
  sortOrder?: number | null;
  isInitial?: boolean;
  isTerminal?: boolean;
  entryCriteria?: string | null;
  exitCriteria?: string | null;
}

/**
 * Edit a Project State. Returns a new aggregate; the input is not mutated.
 * Archived states are no longer edited, so they are rejected. Machine
 * identity (projectId + entityType + labelId), creation identity, and
 * `sourceWorkflowStateId` never change.
 */
export function updateProjectState(
  state: ProjectState,
  changes: ProjectStateChanges,
  updatedAt: IsoTimestamp = nowIso(),
): ProjectState {
  if (state.archivedAt !== null) {
    throw new Error(`ProjectState ${state.id} is archived`);
  }
  const updated: ProjectState = {
    ...state,
    title: changes.title ?? state.title,
    description:
      changes.description === undefined ? state.description : changes.description,
    category:
      changes.category === undefined ? state.category : changes.category,
    sortOrder:
      changes.sortOrder === undefined ? state.sortOrder : changes.sortOrder,
    isInitial: changes.isInitial ?? state.isInitial,
    isTerminal: changes.isTerminal ?? state.isTerminal,
    entryCriteria:
      changes.entryCriteria === undefined
        ? state.entryCriteria
        : changes.entryCriteria,
    exitCriteria:
      changes.exitCriteria === undefined
        ? state.exitCriteria
        : changes.exitCriteria,
    updatedAt,
  };
  validateProjectState(updated);
  return updated;
}

/**
 * Archive a Project State. Returns a new aggregate; the input is not mutated.
 * Archiving an already archived state is rejected as an invalid state change.
 * Archived states stay retrievable by id and in historical machine queries,
 * and free their normalized title and initial flag for reuse.
 */
export function archiveProjectState(
  state: ProjectState,
  archivedAt: IsoTimestamp = nowIso(),
): ProjectState {
  if (state.archivedAt !== null) {
    throw new Error(`ProjectState ${state.id} is already archived`);
  }
  return { ...state, archivedAt, updatedAt: archivedAt };
}
