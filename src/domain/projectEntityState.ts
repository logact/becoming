import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/** One append-preserved period in a Project state machine's runtime history. */
export interface ProjectEntityState {
  id: EntityId;
  projectId: EntityId;
  entityType: CoreEntityType;
  entityId: EntityId;
  labelId: EntityId;
  projectStateId: EntityId;
  enteredAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}

/** The identity of a single runtime state-machine occupant. */
export interface ProjectEntityStateContext {
  projectId: EntityId;
  entityType: CoreEntityType;
  entityId: EntityId;
  labelId: EntityId;
}

export interface NewProjectEntityState {
  projectId: EntityId;
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
  projectStateId: EntityId;
  enteredAt?: IsoTimestamp;
}

export interface ProjectEntityStateFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireCoreEntityType(value: string): CoreEntityType {
  if (!isCoreEntityType(value)) {
    throw new Error(
      `ProjectEntityState entityType must be a core entity type, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireId(field: string, value: EntityId): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`ProjectEntityState ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `ProjectEntityState ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Validate invariants local to a runtime state-history period. */
export function validateProjectEntityState(state: ProjectEntityState): void {
  requireId('id', state.id);
  requireId('projectId', state.projectId);
  requireCoreEntityType(state.entityType);
  requireId('entityId', state.entityId);
  requireId('labelId', state.labelId);
  requireId('projectStateId', state.projectStateId);
  requireTimestamp('enteredAt', state.enteredAt);
  requireTimestamp('createdAt', state.createdAt);
  if (state.endedAt !== null) {
    requireTimestamp('endedAt', state.endedAt);
    if (Date.parse(state.endedAt) < Date.parse(state.enteredAt)) {
      throw new Error('ProjectEntityState endedAt must not be earlier than enteredAt');
    }
  }
}

/** Create the first/current period. State transitions deliberately live elsewhere. */
export function createProjectEntityState(
  input: NewProjectEntityState,
  deps: ProjectEntityStateFactoryDeps = {},
): ProjectEntityState {
  const now = deps.now ?? nowIso();
  const state: ProjectEntityState = {
    id: deps.id ?? newId(),
    projectId: requireId('projectId', input.projectId),
    entityType: requireCoreEntityType(input.entityType),
    entityId: requireId('entityId', input.entityId),
    labelId: requireId('labelId', input.labelId),
    projectStateId: requireId('projectStateId', input.projectStateId),
    enteredAt: input.enteredAt ?? now,
    endedAt: null,
    createdAt: now,
  };
  validateProjectEntityState(state);
  return state;
}

/** End an active period without changing any historical data. */
export function endProjectEntityState(
  state: ProjectEntityState,
  endedAt: IsoTimestamp = nowIso(),
): ProjectEntityState {
  if (state.endedAt !== null) {
    throw new Error(`ProjectEntityState ${state.id} is already ended`);
  }
  const ended = { ...state, endedAt };
  validateProjectEntityState(ended);
  return ended;
}
