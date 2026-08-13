import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * An allowed edge in a Project-owned state machine. Condition and action are
 * opaque Project configuration: this aggregate stores them but never executes
 * or interprets them. A self-transition is deliberately allowed; it models a
 * valid re-entry/retry within one state and is subject to the same duplicate
 * edge policy as every other transition.
 */
export interface ProjectStateTransition {
  id: EntityId;
  projectId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
  fromStateId: EntityId;
  toStateId: EntityId;
  title: string | null;
  description: string | null;
  condition: string | null;
  action: string | null;
  requiresExitCriteria: boolean;
  /** Informational source template provenance; never creates live coupling. */
  sourceWorkflowTransitionId: EntityId | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/** Exact identity of a Project-owned state machine. */
export interface ProjectStateTransitionMachine {
  projectId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
}

export interface NewProjectStateTransition {
  projectId: EntityId;
  entityType: string;
  labelId: EntityId;
  fromStateId: EntityId;
  toStateId: EntityId;
  title?: string | null;
  description?: string | null;
  condition?: string | null;
  action?: string | null;
  requiresExitCriteria?: boolean;
  sourceWorkflowTransitionId?: EntityId;
}

export interface ProjectStateTransitionChanges {
  title?: string | null;
  description?: string | null;
  condition?: string | null;
  action?: string | null;
  requiresExitCriteria?: boolean;
}

export interface ProjectStateTransitionFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireNonBlankId(field: string, value: EntityId): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`ProjectStateTransition ${field} must not be blank`);
  }
  return value;
}

function requireCoreEntityType(value: string): CoreEntityType {
  if (!isCoreEntityType(value)) {
    throw new Error(
      `ProjectStateTransition entityType must be a core entity type, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Validate intrinsic fields. Endpoint existence and machine coherence are application concerns. */
export function validateProjectStateTransition(
  transition: ProjectStateTransition,
): void {
  requireNonBlankId('id', transition.id);
  requireNonBlankId('projectId', transition.projectId);
  requireCoreEntityType(transition.entityType);
  requireNonBlankId('labelId', transition.labelId);
  requireNonBlankId('fromStateId', transition.fromStateId);
  requireNonBlankId('toStateId', transition.toStateId);
}

export function createProjectStateTransition(
  input: NewProjectStateTransition,
  deps: ProjectStateTransitionFactoryDeps = {},
): ProjectStateTransition {
  const now = deps.now ?? nowIso();
  const transition: ProjectStateTransition = {
    id: deps.id ?? newId(),
    projectId: requireNonBlankId('projectId', input.projectId),
    entityType: requireCoreEntityType(input.entityType),
    labelId: requireNonBlankId('labelId', input.labelId),
    fromStateId: requireNonBlankId('fromStateId', input.fromStateId),
    toStateId: requireNonBlankId('toStateId', input.toStateId),
    title: input.title ?? null,
    description: input.description ?? null,
    condition: input.condition ?? null,
    action: input.action ?? null,
    requiresExitCriteria: input.requiresExitCriteria ?? false,
    sourceWorkflowTransitionId: input.sourceWorkflowTransitionId ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateProjectStateTransition(transition);
  return transition;
}

/** Endpoints, machine identity, creation identity, and source provenance never change. */
export function updateProjectStateTransition(
  transition: ProjectStateTransition,
  changes: ProjectStateTransitionChanges,
  updatedAt: IsoTimestamp = nowIso(),
): ProjectStateTransition {
  if (transition.archivedAt !== null) {
    throw new Error(`ProjectStateTransition ${transition.id} is archived`);
  }
  const updated: ProjectStateTransition = {
    ...transition,
    title: changes.title === undefined ? transition.title : changes.title,
    description: changes.description === undefined ? transition.description : changes.description,
    condition: changes.condition === undefined ? transition.condition : changes.condition,
    action: changes.action === undefined ? transition.action : changes.action,
    requiresExitCriteria: changes.requiresExitCriteria ?? transition.requiresExitCriteria,
    updatedAt,
  };
  validateProjectStateTransition(updated);
  return updated;
}

/** Archive without erasing the historical edge. */
export function archiveProjectStateTransition(
  transition: ProjectStateTransition,
  archivedAt: IsoTimestamp = nowIso(),
): ProjectStateTransition {
  if (transition.archivedAt !== null) {
    throw new Error(`ProjectStateTransition ${transition.id} is already archived`);
  }
  return { ...transition, updatedAt: archivedAt, archivedAt };
}
