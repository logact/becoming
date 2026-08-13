import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * The WorkflowState aggregate: a reusable State template belonging to exactly
 * one Workflow state machine (see `Table-definetion.txt` #14,
 * `workflow_states`).
 *
 * A state machine is identified by the triple `workflowId + entityType +
 * labelId` (the "machine identity"), so the same Workflow can manage
 * different State Machines for different kinds of entities and Labels. Core
 * entities never enter Workflow States directly; these are templates from
 * which Project-specific machines are initialized.
 *
 * Invariants enforced here (the `workflow_states` table has no database
 * foreign keys by design):
 * - `entityType` must be one of the eight core entity types.
 * - `workflowId` and `labelId` must not be blank. Their *existence* — and
 *   whether they are archived — is a logical reference validated by the
 *   application layer against the Workflow and Label repository boundaries,
 *   never by the database.
 * - `title` must not be blank and `sortOrder`, when present, must be an
 *   integer.
 *
 * Editing updates the intrinsic template fields; machine identity and
 * creation identity never change. Archival is the only lifecycle transition:
 * `archivedAt` IS NULL means active. Archived templates stay stored so
 * historical machine definitions and Project States initialized from them
 * remain resolvable by id.
 */
export interface WorkflowState {
  id: EntityId;
  workflowId: EntityId;
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
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/** The exact machine identity every Workflow State belongs to. */
export interface WorkflowStateMachine {
  workflowId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
}

/** Input for defining a new Workflow State template. */
export interface NewWorkflowState {
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
}

/** Optional dependencies, primarily for deterministic tests and services. */
export interface WorkflowStateFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireCoreEntityType(value: string): CoreEntityType {
  if (!isCoreEntityType(value)) {
    throw new Error(
      `WorkflowState entityType must be a core entity type, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireNonBlankId(field: string, value: EntityId): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`WorkflowState ${field} must not be blank`);
  }
  return value;
}

function requireNonBlankTitle(value: string): string {
  if (value.trim().length === 0) {
    throw new Error('WorkflowState title must not be blank');
  }
  return value;
}

function requireValidSortOrder(value: number | null): number | null {
  if (value !== null && !Number.isInteger(value)) {
    throw new Error(
      `WorkflowState sortOrder must be an integer, got ${value}`,
    );
  }
  return value;
}

/** Validate the invariants every WorkflowState must satisfy. */
export function validateWorkflowState(state: WorkflowState): void {
  requireCoreEntityType(state.entityType);
  requireNonBlankId('workflowId', state.workflowId);
  requireNonBlankId('labelId', state.labelId);
  requireNonBlankTitle(state.title);
  requireValidSortOrder(state.sortOrder);
}

/**
 * Define a new Workflow State template with a fresh id and current
 * timestamps. Optional detail fields normalize to null when omitted, matching
 * the TEXT/INTEGER columns; `isInitial`/`isTerminal` default to false. All
 * validation runs before the aggregate exists, so invalid input can never
 * reach persistence.
 */
export function createWorkflowState(
  input: NewWorkflowState,
  deps: WorkflowStateFactoryDeps = {},
): WorkflowState {
  const now = deps.now ?? nowIso();
  const state: WorkflowState = {
    id: deps.id ?? newId(),
    workflowId: requireNonBlankId('workflowId', input.workflowId),
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
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateWorkflowState(state);
  return state;
}

/** Template fields a Workflow State may change; machine identity may not. */
export interface WorkflowStateChanges {
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
 * Edit a Workflow State template. Returns a new aggregate; the input is not
 * mutated. Archived templates are no longer edited, so they are rejected.
 * Machine identity (workflowId + entityType + labelId) and creation identity
 * never change.
 */
export function updateWorkflowState(
  state: WorkflowState,
  changes: WorkflowStateChanges,
  updatedAt: IsoTimestamp = nowIso(),
): WorkflowState {
  if (state.archivedAt !== null) {
    throw new Error(`WorkflowState ${state.id} is archived`);
  }
  const updated: WorkflowState = {
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
  validateWorkflowState(updated);
  return updated;
}

/**
 * Archive a Workflow State template. Returns a new aggregate; the input is
 * not mutated. Archiving an already archived template is rejected as an
 * invalid state change. Archived templates stay retrievable by id and in
 * historical machine queries.
 */
export function archiveWorkflowState(
  state: WorkflowState,
  archivedAt: IsoTimestamp = nowIso(),
): WorkflowState {
  if (state.archivedAt !== null) {
    throw new Error(`WorkflowState ${state.id} is already archived`);
  }
  return { ...state, archivedAt, updatedAt: archivedAt };
}
