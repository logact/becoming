import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * A reusable edge in a Workflow State machine template. `condition` and
 * `action` are intentionally opaque text: this aggregate stores and returns
 * them verbatim and never parses, evaluates, or executes either field.
 */
export interface WorkflowStateTransition {
  id: EntityId;
  workflowId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
  fromStateId: EntityId;
  toStateId: EntityId;
  title: string | null;
  description: string | null;
  condition: string | null;
  action: string | null;
  requiresExitCriteria: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/** The exact Workflow State machine a transition belongs to. */
export interface WorkflowStateTransitionMachine {
  workflowId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
}

export interface NewWorkflowStateTransition {
  workflowId: EntityId;
  entityType: string;
  labelId: EntityId;
  fromStateId: EntityId;
  toStateId: EntityId;
  title?: string | null;
  description?: string | null;
  condition?: string | null;
  action?: string | null;
  requiresExitCriteria?: boolean;
}

export interface WorkflowStateTransitionChanges {
  title?: string | null;
  description?: string | null;
  condition?: string | null;
  action?: string | null;
  requiresExitCriteria?: boolean;
}

export interface WorkflowStateTransitionFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireNonBlankId(field: string, value: EntityId): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`WorkflowStateTransition ${field} must not be blank`);
  }
  return value;
}

function requireCoreEntityType(value: string): CoreEntityType {
  if (!isCoreEntityType(value)) {
    throw new Error(
      `WorkflowStateTransition entityType must be a core entity type, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Validate the intrinsic invariants of a transition template. */
export function validateWorkflowStateTransition(
  transition: WorkflowStateTransition,
): void {
  requireNonBlankId('id', transition.id);
  requireNonBlankId('workflowId', transition.workflowId);
  requireCoreEntityType(transition.entityType);
  requireNonBlankId('labelId', transition.labelId);
  requireNonBlankId('fromStateId', transition.fromStateId);
  requireNonBlankId('toStateId', transition.toStateId);
}

/** Define a transition template. No template content is interpreted here. */
export function createWorkflowStateTransition(
  input: NewWorkflowStateTransition,
  deps: WorkflowStateTransitionFactoryDeps = {},
): WorkflowStateTransition {
  const now = deps.now ?? nowIso();
  const transition: WorkflowStateTransition = {
    id: deps.id ?? newId(),
    workflowId: requireNonBlankId('workflowId', input.workflowId),
    entityType: requireCoreEntityType(input.entityType),
    labelId: requireNonBlankId('labelId', input.labelId),
    fromStateId: requireNonBlankId('fromStateId', input.fromStateId),
    toStateId: requireNonBlankId('toStateId', input.toStateId),
    title: input.title ?? null,
    description: input.description ?? null,
    condition: input.condition ?? null,
    action: input.action ?? null,
    requiresExitCriteria: input.requiresExitCriteria ?? false,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateWorkflowStateTransition(transition);
  return transition;
}

/** Edit opaque template metadata without changing endpoint or machine identity. */
export function updateWorkflowStateTransition(
  transition: WorkflowStateTransition,
  changes: WorkflowStateTransitionChanges,
  updatedAt: IsoTimestamp = nowIso(),
): WorkflowStateTransition {
  if (transition.archivedAt !== null) {
    throw new Error(`WorkflowStateTransition ${transition.id} is archived`);
  }
  const updated: WorkflowStateTransition = {
    ...transition,
    title: changes.title === undefined ? transition.title : changes.title,
    description:
      changes.description === undefined
        ? transition.description
        : changes.description,
    condition:
      changes.condition === undefined ? transition.condition : changes.condition,
    action: changes.action === undefined ? transition.action : changes.action,
    requiresExitCriteria:
      changes.requiresExitCriteria ?? transition.requiresExitCriteria,
    updatedAt,
  };
  validateWorkflowStateTransition(updated);
  return updated;
}

/** Archive a transition while retaining it for historical machine resolution. */
export function archiveWorkflowStateTransition(
  transition: WorkflowStateTransition,
  archivedAt: IsoTimestamp = nowIso(),
): WorkflowStateTransition {
  if (transition.archivedAt !== null) {
    throw new Error(`WorkflowStateTransition ${transition.id} is already archived`);
  }
  return { ...transition, archivedAt, updatedAt: archivedAt };
}
