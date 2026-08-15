import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * The Milestone aggregate: an ordered checkpoint within one exact Project
 * Goal pursuit (`pursuitRelationId` references the active
 * `project -> contributes_to -> goal` relation, not merely a Project).
 *
 * A Milestone groups descendant Goals of the pursuit's root Goal through
 * temporal MilestoneGoalAssignment rows. It is not a Goal, Task, lifecycle
 * State, or percentage: reaching a Milestone is derived from the assigned
 * Goals' authoritative lifecycle classification and is never persisted on
 * this aggregate.
 *
 * Archival is the only lifecycle transition on the Milestone itself:
 * `archivedAt` IS NULL means active. Archived Milestones stay stored so
 * historical Roadmaps remain resolvable; they are immutable and cannot
 * receive new Goal assignments.
 *
 * Invariants enforced here (the `milestones` table has no database foreign
 * keys by design):
 * - `title` and every id must not be blank. Endpoint *existence* and
 *   hierarchy membership are logical references validated by the application
 *   layer against the repository boundaries — never by the database.
 * - `sortOrder` is a positive integer; deterministic, user-controlled
 *   ordering among a pursuit's active Milestones.
 * - `createdAt` and `updatedAt` are required ISO 8601 timestamps;
 *   `targetAt` and `archivedAt`, when present, must be valid ISO 8601
 *   timestamps, and `archivedAt` must not be earlier than `createdAt`.
 */
export interface Milestone {
  id: EntityId;
  pursuitRelationId: EntityId;
  title: string;
  description: string | null;
  targetAt: IsoTimestamp | null;
  sortOrder: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/**
 * The MilestoneGoalAssignment aggregate: a temporal assignment of one Goal
 * to one Milestone over an active interval. `createdAt` is when the Goal
 * joined the Milestone and `endedAt` is when it left (`null` means currently
 * assigned). Ending an assignment never deletes it; ended rows stay stored
 * so historical Roadmaps remain resolvable, and re-assigning the same Goal
 * later produces a new assignment row instead of rewriting history.
 *
 * `pursuitRelationId` is repeated from the owning Milestone intentionally:
 * it supports efficient pursuit-wide uniqueness and corruption detection.
 * The application layer verifies it matches the owning Milestone; the domain
 * constructor derives it from the Milestone so the two can never diverge at
 * creation time.
 */
export interface MilestoneGoalAssignment {
  id: EntityId;
  pursuitRelationId: EntityId;
  milestoneId: EntityId;
  goalId: EntityId;
  sortOrder: number;
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
}

/** Input for defining a new Milestone. */
export interface NewMilestone {
  pursuitRelationId: EntityId;
  title: string;
  description?: string;
  targetAt?: IsoTimestamp | null;
  sortOrder: number;
}

/** The editable fields of an active Milestone. */
export interface MilestoneChanges {
  title?: string;
  /** Omit to retain the description; pass null to clear it. */
  description?: string | null;
  /** Omit to retain the target; pass null to clear it. */
  targetAt?: IsoTimestamp | null;
  sortOrder?: number;
}

/** Input for assigning a Goal to a Milestone. */
export interface NewMilestoneGoalAssignment {
  goalId: EntityId;
  sortOrder: number;
}

/** Optional dependencies, primarily for deterministic tests and services. */
export interface MilestoneFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireNonBlankId(
  aggregate: string,
  field: string,
  value: EntityId,
): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`${aggregate} ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(
  aggregate: string,
  field: string,
  value: IsoTimestamp,
): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `${aggregate} ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireSortOrder(aggregate: string, value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `${aggregate} sortOrder must be a positive integer, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Validate the invariants every Milestone must satisfy. */
export function validateMilestone(milestone: Milestone): void {
  requireNonBlankId('Milestone', 'id', milestone.id);
  requireNonBlankId('Milestone', 'pursuitRelationId', milestone.pursuitRelationId);
  if (milestone.title.trim().length === 0) {
    throw new Error('Milestone title must not be blank');
  }
  requireSortOrder('Milestone', milestone.sortOrder);
  requireTimestamp('Milestone', 'createdAt', milestone.createdAt);
  requireTimestamp('Milestone', 'updatedAt', milestone.updatedAt);
  if (milestone.targetAt !== null) {
    requireTimestamp('Milestone', 'targetAt', milestone.targetAt);
  }
  if (milestone.archivedAt !== null) {
    requireTimestamp('Milestone', 'archivedAt', milestone.archivedAt);
    if (Date.parse(milestone.archivedAt) < Date.parse(milestone.createdAt)) {
      throw new Error(
        `Milestone archivedAt must not be earlier than createdAt, got ${JSON.stringify(milestone.archivedAt)} before ${JSON.stringify(milestone.createdAt)}`,
      );
    }
  }
}

/** Validate the invariants every MilestoneGoalAssignment must satisfy. */
export function validateMilestoneGoalAssignment(
  assignment: MilestoneGoalAssignment,
): void {
  requireNonBlankId('MilestoneGoalAssignment', 'id', assignment.id);
  requireNonBlankId(
    'MilestoneGoalAssignment',
    'pursuitRelationId',
    assignment.pursuitRelationId,
  );
  requireNonBlankId(
    'MilestoneGoalAssignment',
    'milestoneId',
    assignment.milestoneId,
  );
  requireNonBlankId('MilestoneGoalAssignment', 'goalId', assignment.goalId);
  requireSortOrder('MilestoneGoalAssignment', assignment.sortOrder);
  requireTimestamp('MilestoneGoalAssignment', 'createdAt', assignment.createdAt);
  if (assignment.endedAt !== null) {
    requireTimestamp('MilestoneGoalAssignment', 'endedAt', assignment.endedAt);
    if (Date.parse(assignment.endedAt) < Date.parse(assignment.createdAt)) {
      throw new Error(
        `MilestoneGoalAssignment endedAt must not be earlier than createdAt, got ${JSON.stringify(assignment.endedAt)} before ${JSON.stringify(assignment.createdAt)}`,
      );
    }
  }
}

/**
 * Define a new active Milestone with a fresh id and current timestamps.
 * `description` and `targetAt` normalize to null when omitted, matching the
 * TEXT columns. All validation runs before the aggregate exists, so invalid
 * input can never reach persistence.
 */
export function createMilestone(
  input: NewMilestone,
  deps: MilestoneFactoryDeps = {},
): Milestone {
  const now = deps.now ?? nowIso();
  const milestone: Milestone = {
    id: deps.id ?? newId(),
    pursuitRelationId: input.pursuitRelationId,
    title: input.title,
    description: input.description ?? null,
    targetAt: input.targetAt ?? null,
    sortOrder: input.sortOrder,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateMilestone(milestone);
  return milestone;
}

/**
 * Update an active Milestone without mutating its historical identity.
 * Archived Milestones are intentionally immutable: a caller must define a
 * new Milestone if its meaning needs to be reintroduced.
 */
export function updateMilestone(
  milestone: Milestone,
  changes: MilestoneChanges,
  updatedAt: IsoTimestamp = nowIso(),
): Milestone {
  if (milestone.archivedAt !== null) {
    throw new Error(
      `Milestone ${milestone.id} is archived and cannot be updated`,
    );
  }
  const updated: Milestone = {
    ...milestone,
    title: changes.title ?? milestone.title,
    description:
      changes.description === undefined
        ? milestone.description
        : changes.description,
    targetAt:
      changes.targetAt === undefined ? milestone.targetAt : changes.targetAt,
    sortOrder: changes.sortOrder ?? milestone.sortOrder,
    updatedAt,
  };
  validateMilestone(updated);
  return updated;
}

/**
 * Archive a Milestone. Returns a new aggregate; the input is not mutated.
 * Archiving an already archived Milestone is rejected as an invalid state
 * change; service-level idempotency decides whether a repeated archive
 * request is a no-op before reaching this function.
 */
export function archiveMilestone(
  milestone: Milestone,
  archivedAt: IsoTimestamp = nowIso(),
): Milestone {
  if (milestone.archivedAt !== null) {
    throw new Error(`Milestone ${milestone.id} is already archived`);
  }
  const archived: Milestone = {
    ...milestone,
    archivedAt,
    updatedAt: archivedAt,
  };
  validateMilestone(archived);
  return archived;
}

/**
 * Assign a Goal to a Milestone: create a new active assignment with a fresh
 * id, the Milestone's pursuit relation, and the current timestamp as
 * `createdAt`. Archived Milestones cannot receive assignments.
 */
export function createMilestoneGoalAssignment(
  milestone: Milestone,
  input: NewMilestoneGoalAssignment,
  deps: MilestoneFactoryDeps = {},
): MilestoneGoalAssignment {
  if (milestone.archivedAt !== null) {
    throw new Error(
      `Milestone ${milestone.id} is archived and cannot receive Goal assignments`,
    );
  }
  const assignment: MilestoneGoalAssignment = {
    id: deps.id ?? newId(),
    pursuitRelationId: milestone.pursuitRelationId,
    milestoneId: milestone.id,
    goalId: input.goalId,
    sortOrder: input.sortOrder,
    createdAt: deps.now ?? nowIso(),
    endedAt: null,
  };
  validateMilestoneGoalAssignment(assignment);
  return assignment;
}

/**
 * End an active assignment: the Goal leaves the Milestone at `endedAt`.
 * Returns a new aggregate; the input is not mutated. Ended assignments are
 * immutable — temporal history is never rewritten.
 */
export function endMilestoneGoalAssignment(
  assignment: MilestoneGoalAssignment,
  endedAt: IsoTimestamp = nowIso(),
): MilestoneGoalAssignment {
  if (assignment.endedAt !== null) {
    throw new Error(
      `MilestoneGoalAssignment ${assignment.id} is already ended`,
    );
  }
  const ended: MilestoneGoalAssignment = { ...assignment, endedAt };
  validateMilestoneGoalAssignment(ended);
  return ended;
}
