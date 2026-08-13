import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import type { EntityId, IsoTimestamp } from './ids';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';
import type { Relation } from './relation';

/**
 * The relation-change provenance contract.  Relation rows preserve the
 * temporal relationship itself; these independent Record payloads explain
 * which actor created or ended that relationship.  The two are deliberately
 * not joined by a foreign key or an entities table.
 */
export const RELATION_CHANGE_ACTIONS = [
  'relation_created',
  'relation_ended',
] as const;

export type RelationChangeAction = (typeof RELATION_CHANGE_ACTIONS)[number];

/**
 * Metadata selection for audit payloads.  Relation metadata may contain
 * local operational context, so audit output is opt-in by field and
 * redaction always wins.  Only top-level JSON-object properties are selected;
 * scalar or array metadata has no named field to allowlist and is omitted.
 */
export interface RelationMetadataSelectionPolicy {
  readonly allowlist: readonly string[];
  readonly redacted: readonly string[];
}

/**
 * V1's portable relationship context.  Owning relation policies can provide
 * a narrower or broader policy at their application boundary.  Sensitive
 * keys should always be supplied in `redacted` by that owner.
 */
export const DEFAULT_RELATION_METADATA_SELECTION_POLICY: RelationMetadataSelectionPolicy =
  Object.freeze({
    allowlist: [
      'amount',
      'unit',
      'constraint_type',
      'allocation_type',
      'semantic',
      'role',
      'purpose',
      'reason',
    ],
    redacted: [],
  });

/**
 * Conservative provenance view of versioned lineage context. The relation
 * itself retains the complete transformation description; potentially
 * sensitive rationale, free-form context, and source excerpts/fragments are
 * not copied into append-only audit Records unless an owning boundary opts in
 * with a narrower, explicit selection policy.
 */
export const DEFAULT_LINEAGE_METADATA_SELECTION_POLICY: RelationMetadataSelectionPolicy =
  Object.freeze({
    allowlist: ['schema_version', 'transformation_kind', 'actor', 'tool'],
    redacted: ['rationale', 'context', 'source_fragments'],
  });

/** The JSON payload carried by exactly one provenance Record per change. */
export interface RelationChangePayload {
  action: RelationChangeAction;
  relationId: EntityId;
  sourceType: CoreEntityType;
  sourceId: EntityId;
  relationType: string;
  targetType: CoreEntityType;
  targetId: EntityId;
  metadata: { [key: string]: JsonValue } | null;
  actor: string;
  occurredAt: IsoTimestamp;
  /** The Relation's immutable creation fact, intentionally snake-cased. */
  created_at: IsoTimestamp;
  /** Present only after the Relation has actually ended. */
  ended_at?: IsoTimestamp;
}

export interface RelationChangePayloadInput {
  action: RelationChangeAction;
  relation: Relation;
  actor: string;
  occurredAt: IsoTimestamp;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Relation provenance ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `Relation provenance ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Select non-sensitive, explicitly allowed relation metadata for history. */
export function filterRelationMetadata(
  metadata: JsonValue | null,
  policy: RelationMetadataSelectionPolicy = DEFAULT_RELATION_METADATA_SELECTION_POLICY,
): { [key: string]: JsonValue } | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const redacted = new Set(policy.redacted);
  const selected: { [key: string]: JsonValue } = {};
  for (const field of policy.allowlist) {
    if (redacted.has(field) || !Object.prototype.hasOwnProperty.call(metadata, field)) {
      continue;
    }
    selected[field] = assertJsonValue(metadata[field], `metadata.${field}`);
  }
  return selected;
}

/**
 * Build the relation-change audit payload.  The event time is the Relation's
 * `createdAt` for creates and its `endedAt` for ends; callers may only supply
 * the matching value through the application service notice.
 */
export function buildRelationChangePayload(
  input: RelationChangePayloadInput,
  metadataPolicy: RelationMetadataSelectionPolicy = DEFAULT_RELATION_METADATA_SELECTION_POLICY,
): RelationChangePayload {
  const { relation } = input;
  if (!RELATION_CHANGE_ACTIONS.includes(input.action)) {
    throw new Error(`Unsupported relation provenance action ${JSON.stringify(input.action)}`);
  }
  if (!isCoreEntityType(relation.sourceType) || !isCoreEntityType(relation.targetType)) {
    throw new Error('Relation provenance endpoints must be core entity types');
  }
  const relationId = requireNonBlank('relationId', relation.id);
  const actor = requireNonBlank('actor', input.actor);
  const occurredAt = requireTimestamp('occurredAt', input.occurredAt);
  const createdAt = requireTimestamp('created_at', relation.createdAt);
  if (input.action === 'relation_created' && relation.endedAt !== null) {
    throw new Error('relation_created provenance requires an active Relation');
  }
  if (input.action === 'relation_ended' && relation.endedAt === null) {
    throw new Error('relation_ended provenance requires an ended Relation');
  }
  if (input.action === 'relation_ended' && occurredAt !== relation.endedAt) {
    throw new Error('relation_ended provenance occurredAt must equal Relation endedAt');
  }
  if (input.action === 'relation_created' && occurredAt !== relation.createdAt) {
    throw new Error('relation_created provenance occurredAt must equal Relation createdAt');
  }

  const payload: RelationChangePayload = {
    action: input.action,
    relationId,
    sourceType: relation.sourceType,
    sourceId: requireNonBlank('sourceId', relation.sourceId),
    relationType: requireNonBlank('relationType', relation.relationType),
    targetType: relation.targetType,
    targetId: requireNonBlank('targetId', relation.targetId),
    metadata: filterRelationMetadata(relation.metadata, metadataPolicy),
    actor,
    occurredAt,
    created_at: createdAt,
  };
  if (relation.endedAt !== null) {
    payload.ended_at = requireTimestamp('ended_at', relation.endedAt);
  }
  return payload;
}

/** Serialize a validated payload as the JSON payload of its Record. */
export function relationChangePayloadToJson(payload: RelationChangePayload): JsonValue {
  return {
    action: payload.action,
    relationId: payload.relationId,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    relationType: payload.relationType,
    targetType: payload.targetType,
    targetId: payload.targetId,
    metadata: payload.metadata,
    actor: payload.actor,
    occurredAt: payload.occurredAt,
    created_at: payload.created_at,
    ...(payload.ended_at === undefined ? {} : { ended_at: payload.ended_at }),
  };
}
