import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';
import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';

/**
 * The EntityLabelAssignment aggregate: a temporal assignment of a Label to
 * one of the eight core entities (see `Table-definetion.txt` #12,
 * `entity_labels`).
 *
 * An assignment connects exactly one core entity (`entityType` + `entityId`)
 * with exactly one Label (`labelId`) over an active interval: `createdAt` is
 * when the Label became active on the entity and `endedAt` is when it stopped
 * applying (`null` means currently active). Ending an assignment never
 * deletes it; ended assignments stay stored so historical classifications
 * remain resolvable and re-assigning the same Label later produces a new
 * assignment row instead of rewriting history.
 *
 * Invariants enforced here (the `entity_labels` table has no database foreign
 * keys by design):
 * - `entityType` must be a core entity type; Labels, states, and state
 *   transitions are never assignment targets.
 * - `entityId` and `labelId` must not be blank. Their *existence* is a
 *   logical reference validated by the application layer against the
 *   per-aggregate repository boundaries — never by the database.
 * - `createdAt` is a required ISO 8601 timestamp; `endedAt`, when present,
 *   must be a valid ISO 8601 timestamp not earlier than `createdAt`, so every
 *   assignment's active interval stays historically resolvable.
 *
 * The application layer additionally enforces that at most one assignment of
 * the same Label to the same entity is active at any moment.
 */
export interface EntityLabelAssignment {
  id: EntityId;
  entityType: CoreEntityType;
  entityId: EntityId;
  labelId: EntityId;
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
}

/** Input for assigning a Label to a core entity. */
export interface NewEntityLabelAssignment {
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
}

/** Optional dependencies, primarily for deterministic tests and services. */
export interface EntityLabelAssignmentFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireCoreEntityType(value: string): CoreEntityType {
  if (!isCoreEntityType(value)) {
    throw new Error(
      `EntityLabelAssignment entityType must be a core entity type, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireNonBlankId(field: string, value: EntityId): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`EntityLabelAssignment ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `EntityLabelAssignment ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Validate the invariants every EntityLabelAssignment must satisfy. */
export function validateEntityLabelAssignment(
  assignment: EntityLabelAssignment,
): void {
  requireCoreEntityType(assignment.entityType);
  requireNonBlankId('entityId', assignment.entityId);
  requireNonBlankId('labelId', assignment.labelId);
  requireTimestamp('createdAt', assignment.createdAt);
  if (assignment.endedAt !== null) {
    requireTimestamp('endedAt', assignment.endedAt);
    if (Date.parse(assignment.endedAt) < Date.parse(assignment.createdAt)) {
      throw new Error(
        `EntityLabelAssignment endedAt must not be earlier than createdAt, got ${JSON.stringify(assignment.endedAt)} before ${JSON.stringify(assignment.createdAt)}`,
      );
    }
  }
}

/**
 * Assign a Label to a core entity: create a new active assignment with a
 * fresh id and the current timestamp as `createdAt`. All validation runs
 * before the aggregate exists, so invalid input can never reach persistence.
 */
export function createEntityLabelAssignment(
  input: NewEntityLabelAssignment,
  deps: EntityLabelAssignmentFactoryDeps = {},
): EntityLabelAssignment {
  const assignment: EntityLabelAssignment = {
    id: deps.id ?? newId(),
    entityType: requireCoreEntityType(input.entityType),
    entityId: requireNonBlankId('entityId', input.entityId),
    labelId: requireNonBlankId('labelId', input.labelId),
    createdAt: deps.now ?? nowIso(),
    endedAt: null,
  };
  validateEntityLabelAssignment(assignment);
  return assignment;
}

/**
 * End an active assignment: the Label stops applying to the entity at
 * `endedAt`. Returns a new aggregate; the input is not mutated. Ending an
 * already ended assignment is rejected as an invalid state change — temporal
 * history is never rewritten.
 */
export function endEntityLabelAssignment(
  assignment: EntityLabelAssignment,
  endedAt: IsoTimestamp = nowIso(),
): EntityLabelAssignment {
  if (assignment.endedAt !== null) {
    throw new Error(
      `EntityLabelAssignment ${assignment.id} is already ended`,
    );
  }
  const ended: EntityLabelAssignment = { ...assignment, endedAt };
  validateEntityLabelAssignment(ended);
  return ended;
}
