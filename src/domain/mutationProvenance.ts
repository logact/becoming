import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import type { EntityId, IsoTimestamp } from './ids';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';

/**
 * The core-mutation provenance contract: the structured payload every
 * core-entity mutation records so history can explain how the system reached
 * its current state.
 *
 * One provenance payload identifies:
 * - which core entity changed (`entityType` + `entityId`),
 * - how it changed (`action`: create, update, archive, restore, or delete),
 * - who or what caused it (`actor`),
 * - when it happened (`occurredAt`), and
 * - the relevant before/after values (`before`/`after`), selected through an
 *   explicit per-entity allowlist/redaction policy.
 *
 * The payload is persisted as the JSON `payload` of one append-oriented
 * provenance Record of type `PROVENANCE_RECORD_TYPE`; the application service
 * in `src/application/mutationProvenanceService.ts` commits that Record
 * atomically with the current-state mutation.
 *
 * Scope notes:
 * - `archive` and `restore` are distinct actions; archival is the standard
 *   lifecycle for V1 core entities. `delete` is reserved for concepts that
 *   explicitly support hard deletion — no V1 aggregate does, so it is
 *   defined here for contract completeness and rejected nowhere else.
 * - Lifecycle-transition audit payloads (Feature #9) and semantic-relation
 *   change payloads (Feature #5) are separate contracts layered on the same
 *   Record mechanism, not special cases of this one.
 */

/** Actions a core-mutation provenance payload can describe. */
export const MUTATION_ACTIONS = [
  'create',
  'update',
  'archive',
  'restore',
  'delete',
] as const;

export type MutationAction = (typeof MUTATION_ACTIONS)[number];

/**
 * Entity discriminators accepted by the provenance transport. The default
 * contract audits only the eight core entities; supporting aggregates opt in
 * explicitly through an application service and its field policy.
 */
export type ProvenanceEntityType =
  | CoreEntityType
  | 'label'
  | 'entity_label'
  | 'workflow_state'
  | 'workflow_state_transition';

export function isMutationAction(value: string): value is MutationAction {
  return (MUTATION_ACTIONS as readonly string[]).includes(value);
}

/**
 * Record type of the provenance Records this contract appends. It is part of
 * the default record-type policy (see `RECORD_TYPES` in ./record), so
 * provenance Records pass validation everywhere ordinary Records do.
 */
export const PROVENANCE_RECORD_TYPE = 'mutation';

/** A JSON object used for filtered before/after change data. */
export type FieldMap = { [field: string]: JsonValue };

/**
 * A plain snapshot of an entity's fields, keyed by domain (camelCase) field
 * name. Values must be JSON-serializable; exact `Decimal` values enter as
 * their canonical string form (`Decimal.toString()`), never as binary
 * floating point or class instances.
 */
export type EntitySnapshot = { readonly [field: string]: unknown };

/**
 * Per-entity field-selection policy for before/after data.
 *
 * - `allowlist` names the material fields that may enter provenance data.
 *   Fields absent from the allowlist never appear, even when present in a
 *   snapshot.
 * - `redacted` names fields that must never enter provenance data. Redaction
 *   wins over the allowlist, so a secret field cannot leak by being
 *   allowlisted by mistake.
 */
export interface FieldSelectionPolicy {
  readonly allowlist: readonly string[];
  readonly redacted: readonly string[];
}

/**
 * Default field-selection policies for the eight independent core concepts.
 * `id` is never allowlisted: the payload's `entityId` already identifies the
 * entity. For Task, Project, Idea, and Philosophy — whose aggregates land in
 * later tasks — the allowlists follow `Table-definetion.txt` and are refined
 * with their aggregates. No V1 field is redacted by default; services adopt
 * redactions deliberately through policy overrides.
 */
export const DEFAULT_FIELD_POLICIES: {
  readonly [K in CoreEntityType]: FieldSelectionPolicy;
} = {
  task: {
    allowlist: [
      'title',
      'description',
      'targetDescription',
      'exitCriteria',
      'priority',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
  goal: {
    allowlist: [
      'title',
      'description',
      'targetState',
      'successCriteria',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
  project: {
    allowlist: [
      'title',
      'description',
      'purpose',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
  idea: {
    allowlist: [
      'title',
      'description',
      'ideaDescription',
      'capturedAt',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
  philosophy: {
    allowlist: [
      'title',
      'description',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
  workflow: {
    allowlist: [
      'title',
      'description',
      'workflowType',
      'purpose',
      'version',
      'entryCriteria',
      'exitCriteria',
      'supersedesId',
      'publishedAt',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
  resource: {
    allowlist: [
      'title',
      'description',
      'resourceType',
      'unit',
      'behavior',
      'capacity',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
  record: {
    allowlist: [
      'title',
      'description',
      'recordType',
      'occurredAt',
      'recordedAt',
      'actor',
      'payload',
      'createdAt',
      'updatedAt',
      'archivedAt',
    ],
    redacted: [],
  },
};

/** Resolve the effective policy for an entity type, honoring overrides. */
export function resolveFieldPolicy(
  entityType: CoreEntityType,
  overrides?: Partial<{ [K in CoreEntityType]: FieldSelectionPolicy }>,
): FieldSelectionPolicy {
  return overrides?.[entityType] ?? DEFAULT_FIELD_POLICIES[entityType];
}

/**
 * Select the provenance-visible fields of a snapshot: every allowlisted,
 * non-redacted field present in the snapshot, validated as a structured JSON
 * value. Fields with `undefined` values are treated as absent; any other
 * non-JSON value (functions, BigInt, class instances such as `Decimal`,
 * circular references) is rejected.
 */
export function applyFieldPolicy(
  snapshot: EntitySnapshot,
  policy: FieldSelectionPolicy,
): FieldMap {
  const redacted = new Set(policy.redacted);
  const selected: FieldMap = {};
  for (const field of policy.allowlist) {
    if (redacted.has(field)) {
      continue;
    }
    const value = snapshot[field];
    if (value === undefined) {
      continue;
    }
    selected[field] = assertJsonValue(value, field);
  }
  return selected;
}

/**
 * Reduce two filtered snapshots to the fields that actually changed. A field
 * appears in both results when its value differs or it exists on only one
 * side; the missing side is represented as null. Unchanged fields are
 * omitted so update payloads carry only relevant before/after values.
 */
export function diffFieldMaps(
  before: FieldMap,
  after: FieldMap,
): { before: FieldMap; after: FieldMap } {
  const changedBefore: FieldMap = {};
  const changedAfter: FieldMap = {};
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    const hasBefore = Object.prototype.hasOwnProperty.call(before, field);
    const hasAfter = Object.prototype.hasOwnProperty.call(after, field);
    const unchanged =
      hasBefore &&
      hasAfter &&
      JSON.stringify(before[field]) === JSON.stringify(after[field]);
    if (unchanged) {
      continue;
    }
    changedBefore[field] = hasBefore ? before[field] : null;
    changedAfter[field] = hasAfter ? after[field] : null;
  }
  return { before: changedBefore, after: changedAfter };
}

/**
 * The validated provenance payload for one core-entity mutation. `before`
 * and `after` hold policy-filtered change data: full filtered snapshots for
 * `create` (after) and `delete` (before), changed fields only for `update`,
 * `archive`, and `restore`.
 */
export interface ProvenancePayload {
  entityType: ProvenanceEntityType;
  entityId: EntityId;
  action: MutationAction;
  actor: string;
  occurredAt: IsoTimestamp;
  before: FieldMap | null;
  after: FieldMap | null;
}

/** Input for building a provenance payload; validated field by field. */
export interface ProvenancePayloadInput {
  entityType: string;
  entityId: EntityId;
  action: string;
  actor: string;
  occurredAt: IsoTimestamp;
  before?: EntitySnapshot | null;
  after?: EntitySnapshot | null;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Provenance ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `Provenance ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Build and validate the provenance payload for one mutation, applying the
 * entity's field-selection policy and the per-action snapshot rules:
 *
 * - `create`: `after` snapshot required; `before` must be absent.
 * - `update`: both snapshots required; only changed, allowed fields are kept.
 * - `archive` / `restore`: `before` required; `after` optional and diffed
 *   against `before` when present.
 * - `delete`: `before` snapshot required; `after` must be absent.
 *
 * All validation runs before any persistence, so an invalid payload can
 * never reach a repository.
 */
export function buildProvenancePayload(
  input: ProvenancePayloadInput,
  policy: FieldSelectionPolicy,
  isAllowedEntityType: (value: string) => value is ProvenanceEntityType = isCoreEntityType,
): ProvenancePayload {
  if (!isAllowedEntityType(input.entityType)) {
    throw new Error(
      `Provenance entityType must be a core entity type, got ${JSON.stringify(input.entityType)}`,
    );
  }
  if (!isMutationAction(input.action)) {
    throw new Error(
      `Provenance action must be one of ${MUTATION_ACTIONS.join(', ')}, got ${JSON.stringify(input.action)}`,
    );
  }
  const entityId = requireNonBlank('entityId', input.entityId);
  const actor = requireNonBlank('actor', input.actor);
  const occurredAt = requireTimestamp('occurredAt', input.occurredAt);
  const before = input.before ?? null;
  const after = input.after ?? null;

  let filteredBefore: FieldMap | null = null;
  let filteredAfter: FieldMap | null = null;
  switch (input.action) {
    case 'create': {
      if (before !== null) {
        throw new Error('Provenance create action must not carry before data');
      }
      if (after === null) {
        throw new Error('Provenance create action requires an after snapshot');
      }
      filteredAfter = applyFieldPolicy(after, policy);
      break;
    }
    case 'update': {
      if (before === null || after === null) {
        throw new Error(
          'Provenance update action requires before and after snapshots',
        );
      }
      const diff = diffFieldMaps(
        applyFieldPolicy(before, policy),
        applyFieldPolicy(after, policy),
      );
      filteredBefore = diff.before;
      filteredAfter = diff.after;
      break;
    }
    case 'archive':
    case 'restore': {
      if (before === null) {
        throw new Error(
          `Provenance ${input.action} action requires a before snapshot`,
        );
      }
      filteredBefore = applyFieldPolicy(before, policy);
      if (after !== null) {
        const diff = diffFieldMaps(
          filteredBefore,
          applyFieldPolicy(after, policy),
        );
        filteredBefore = diff.before;
        filteredAfter = diff.after;
      }
      break;
    }
    case 'delete': {
      if (before === null) {
        throw new Error('Provenance delete action requires a before snapshot');
      }
      if (after !== null) {
        throw new Error('Provenance delete action must not carry after data');
      }
      filteredBefore = applyFieldPolicy(before, policy);
      break;
    }
  }

  return {
    entityType: input.entityType,
    entityId,
    action: input.action,
    actor,
    occurredAt,
    before: filteredBefore,
    after: filteredAfter,
  };
}

/** Serialize a provenance payload as the JSON payload of a Record. */
export function provenancePayloadToJson(payload: ProvenancePayload): JsonValue {
  return {
    entityType: payload.entityType,
    entityId: payload.entityId,
    action: payload.action,
    actor: payload.actor,
    occurredAt: payload.occurredAt,
    before: payload.before,
    after: payload.after,
  };
}
