import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * The Goal aggregate: a state we want to achieve.
 *
 * A Goal is an independent core entity stored in its own `goals` table and
 * owns only its intrinsic definition: identity, title, description, the
 * desired target state, and the observable success criteria. State, labels,
 * Project membership, Workflow, target dates, Resources, and constraints are
 * all external to this aggregate and are represented through supporting
 * tables and relations.
 *
 * Archival is the only lifecycle transition on the definition itself:
 * `archived_at` IS NULL means active. Archived Goals stay stored so
 * historical references (relations, records, state history) remain
 * resolvable by id.
 */
export interface Goal {
  id: EntityId;
  title: string;
  description: string | null;
  targetState: string;
  successCriteria: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/** Input for defining a new Goal. */
export interface NewGoal {
  title: string;
  targetState: string;
  description?: string;
  successCriteria?: string;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Goal ${field} must not be blank`);
  }
  return value;
}

/** Validate the invariants every Goal must satisfy. */
export function validateGoal(goal: Goal): void {
  requireNonBlank('title', goal.title);
  requireNonBlank('targetState', goal.targetState);
}

/**
 * Define a new Goal with a fresh id and current timestamps. Optional detail
 * fields normalize to null when omitted, matching the TEXT columns.
 */
export function createGoal(input: NewGoal): Goal {
  const now = nowIso();
  const goal: Goal = {
    id: newId(),
    title: requireNonBlank('title', input.title),
    description: input.description ?? null,
    targetState: requireNonBlank('targetState', input.targetState),
    successCriteria: input.successCriteria ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  return goal;
}

/**
 * Archive a Goal definition. Returns a new aggregate; the input is not
 * mutated. Archiving an already archived Goal is rejected as an invalid
 * state change.
 */
export function archiveGoal(
  goal: Goal,
  archivedAt: IsoTimestamp = nowIso(),
): Goal {
  if (goal.archivedAt !== null) {
    throw new Error(`Goal ${goal.id} is already archived`);
  }
  return { ...goal, archivedAt, updatedAt: archivedAt };
}
