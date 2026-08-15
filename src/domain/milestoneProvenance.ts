import type { EntityId, IsoTimestamp } from './ids';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';

/**
 * The milestone-change provenance contract. Milestone and
 * MilestoneGoalAssignment rows preserve the temporal roadmap itself; these
 * independent Record payloads explain which actor created, edited, reordered,
 * or archived a Milestone and which Goals entered or left it. The two are
 * deliberately not joined by a foreign key or an entities table.
 *
 * Milestone completion (`milestone_reached` / `milestone_reopened`
 * observations) is intentionally absent: reaching a Milestone is derived from
 * the authoritative execution classification and is never a mutation.
 */
export const MILESTONE_CHANGE_ACTIONS = [
  'milestone_created',
  'milestone_updated',
  'milestone_reordered',
  'milestone_archived',
  'milestone_goal_assigned',
  'milestone_goal_removed',
  'milestone_goals_reordered',
] as const;

export type MilestoneChangeAction = (typeof MILESTONE_CHANGE_ACTIONS)[number];

/** A JSON object used for before/after change data. */
export type MilestoneChangeFieldMap = { [field: string]: JsonValue };

/**
 * The JSON payload carried by exactly one provenance Record per Milestone
 * change. It identifies the Milestone, its exact pursuit relation, the
 * pursuing Project, the pursued root Goal, the affected Goal ids, the actor,
 * and the occurrence time, plus before/after values where applicable.
 */
export interface MilestoneChangePayload {
  action: MilestoneChangeAction;
  milestoneId: EntityId;
  pursuitRelationId: EntityId;
  projectId: EntityId;
  rootGoalId: EntityId;
  /** Affected Goal ids (initial membership, added, removed, or reordered). */
  goalIds: EntityId[];
  actor: string;
  occurredAt: IsoTimestamp;
  before: MilestoneChangeFieldMap | null;
  after: MilestoneChangeFieldMap | null;
}

export interface MilestoneChangePayloadInput {
  action: MilestoneChangeAction;
  milestoneId: EntityId;
  pursuitRelationId: EntityId;
  projectId: EntityId;
  rootGoalId: EntityId;
  goalIds?: readonly EntityId[];
  actor: string;
  occurredAt: IsoTimestamp;
  before?: MilestoneChangeFieldMap | null;
  after?: MilestoneChangeFieldMap | null;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Milestone provenance ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `Milestone provenance ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireFieldMap(
  field: 'before' | 'after',
  value: MilestoneChangeFieldMap | null,
): MilestoneChangeFieldMap {
  if (value === null) {
    throw new Error(`Milestone provenance ${field} data is required for this action`);
  }
  for (const key of Object.keys(value)) {
    assertJsonValue(value[key], `${field}.${key}`);
  }
  return value;
}

/**
 * Build and validate the provenance payload for one Milestone change. The
 * per-action before/after rules:
 *
 * - `milestone_created`: `after` snapshot required; `before` must be absent.
 * - `milestone_updated` / `milestone_reordered` / `milestone_archived`:
 *   both `before` and `after` are required.
 * - `milestone_goal_assigned`: `after` required; `before` optional.
 * - `milestone_goal_removed`: `before` required; `after` optional.
 * - `milestone_goals_reordered`: both `before` and `after` required.
 *
 * All validation runs before any persistence, so an invalid payload can
 * never reach a repository.
 */
export function buildMilestoneChangePayload(
  input: MilestoneChangePayloadInput,
): MilestoneChangePayload {
  if (!MILESTONE_CHANGE_ACTIONS.includes(input.action)) {
    throw new Error(`Unsupported milestone provenance action ${JSON.stringify(input.action)}`);
  }
  const milestoneId = requireNonBlank('milestoneId', input.milestoneId);
  const pursuitRelationId = requireNonBlank('pursuitRelationId', input.pursuitRelationId);
  const projectId = requireNonBlank('projectId', input.projectId);
  const rootGoalId = requireNonBlank('rootGoalId', input.rootGoalId);
  const actor = requireNonBlank('actor', input.actor);
  const occurredAt = requireTimestamp('occurredAt', input.occurredAt);
  const goalIds = (input.goalIds ?? []).map((goalId) => requireNonBlank('goalIds', goalId));
  const before = input.before ?? null;
  const after = input.after ?? null;

  let filteredBefore: MilestoneChangeFieldMap | null = null;
  let filteredAfter: MilestoneChangeFieldMap | null = null;
  switch (input.action) {
    case 'milestone_created': {
      if (before !== null) {
        throw new Error('milestone_created provenance must not carry before data');
      }
      filteredAfter = requireFieldMap('after', after);
      break;
    }
    case 'milestone_updated':
    case 'milestone_reordered':
    case 'milestone_archived':
    case 'milestone_goals_reordered': {
      filteredBefore = requireFieldMap('before', before);
      filteredAfter = requireFieldMap('after', after);
      break;
    }
    case 'milestone_goal_assigned': {
      if (before !== null) filteredBefore = requireFieldMap('before', before);
      filteredAfter = requireFieldMap('after', after);
      break;
    }
    case 'milestone_goal_removed': {
      filteredBefore = requireFieldMap('before', before);
      if (after !== null) filteredAfter = requireFieldMap('after', after);
      break;
    }
  }

  return {
    action: input.action,
    milestoneId,
    pursuitRelationId,
    projectId,
    rootGoalId,
    goalIds,
    actor,
    occurredAt,
    before: filteredBefore,
    after: filteredAfter,
  };
}

/** Serialize a validated payload as the JSON payload of its Record. */
export function milestoneChangePayloadToJson(
  payload: MilestoneChangePayload,
): JsonValue {
  return {
    action: payload.action,
    milestoneId: payload.milestoneId,
    pursuitRelationId: payload.pursuitRelationId,
    projectId: payload.projectId,
    rootGoalId: payload.rootGoalId,
    goalIds: payload.goalIds,
    actor: payload.actor,
    occurredAt: payload.occurredAt,
    before: payload.before,
    after: payload.after,
  };
}
