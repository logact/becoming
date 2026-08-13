import type { CoreEntityType } from './entityTypes';
import type { JsonValue } from './json';
import { isCoreEntityType } from './entityTypes';
import type { EntityId } from './ids';
import { RELATION_TYPES } from './relation';

/** Relation types with directed, constrained origin/transformation semantics. */
export const LINEAGE_RELATION_TYPES = ['origin_of', 'transforms_into'] as const;
export type LineageRelationType = (typeof LINEAGE_RELATION_TYPES)[number];

/** Metadata format understood by V1 lineage consumers. */
export const LINEAGE_METADATA_SCHEMA_VERSION = 1;

/**
 * A source fragment names a bounded piece of an input without copying the
 * input entity into the relation. `locator` is intentionally opaque: a
 * range, URL fragment, selector, or external citation are all valid.
 */
export interface LineageSourceFragment {
  source_type: CoreEntityType;
  source_id: EntityId;
  locator: string;
  excerpt?: string;
}

/** Version 1 transformation context, stored wholly on a Relation. */
export interface LineageMetadataV1 {
  schema_version: 1;
  transformation_kind: string;
  rationale?: string;
  context?: JsonValue;
  actor?: { type: string; id: string };
  tool?: { name: string; version?: string; reference?: string };
  source_fragments?: LineageSourceFragment[];
}

/**
 * The relation-policy contract: the per-relation-type rules the application
 * layer enforces when creating semantic Relations (see issue #74).
 *
 * A RelationPolicy decides, for one `relationType`:
 * - **Direction** — which source/target core-entity-type pairs are permitted.
 *   The default policies are open (any core concept may relate to any core
 *   concept, per `Table-definetion.txt` #9). Stricter direction rules — for
 *   decomposition, Task membership, Goal pursuit, and similar — are supplied
 *   by their owning Features as policy overrides, not hardcoded here.
 * - **Metadata** — policy-specific rules for the structured metadata that
 *   belongs to the relationship itself (for example, requiring a `unit` on
 *   Resource allocations). The default policies accept any metadata that
 *   already passed the aggregate's JSON validation.
 * - **Active cardinality** — whether more than one ACTIVE Relation may share
 *   the same active-duplicate identity. The identity is the full tuple
 *   `(sourceType, sourceId, relationType, targetType, targetId)`. By default
 *   a second active Relation with the same identity is a duplicate and is
 *   rejected; ended rows never block re-creation, so replacing a relation is
 *   always end-old-then-create-new. `consumes` is the documented exception:
 *   one Record may consume the same Resource through several concurrent
 *   active Relations with distinct amounts.
 *
 * Policies are pure: they never touch persistence. Endpoint existence,
 * duplicate checks, and atomic writes live in the application service.
 */

/** Thrown when a relation policy rejects a Relation's metadata. */
export class RelationMetadataPolicyError extends Error {
  constructor(relationType: string, reason: string) {
    super(
      `Relation metadata rejected by the ${JSON.stringify(relationType)} policy: ${reason}`,
    );
    this.name = 'RelationMetadataPolicyError';
  }
}

export interface RelationPolicy {
  /** The relation type this policy governs. */
  readonly relationType: string;

  /**
   * Whether several active Relations may share the same active-duplicate
   * identity (see file documentation). When false, a second active Relation
   * with the same identity is rejected as a duplicate.
   */
  readonly allowsMultipleActive: boolean;

  /**
   * Optional active cardinality scoped to one target endpoint and relation
   * type.  `1` means a derivative can have at most one current direct origin.
   */
  readonly maximumActiveRelationsForTarget?: number;

  /** Whether adding an edge of this type must reject direct or indirect cycles. */
  readonly rejectsCycles?: boolean;

  /** Whether the policy permits this exact source-to-target direction. */
  allowsDirection(
    sourceType: CoreEntityType,
    targetType: CoreEntityType,
  ): boolean;

  /**
   * Validate policy-specific metadata rules. Throws
   * `RelationMetadataPolicyError` on violation. `metadata` has already passed
   * the aggregate's JSON validation (or is null).
   */
  validateMetadata(metadata: JsonValue | null): void;
}

function requireNonBlankMetadataString(field: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RelationMetadataPolicyError('lineage', `${field} must be a non-blank string`);
  }
  return value;
}

function requireKnownFields(
  metadata: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const field of Object.keys(metadata)) {
    if (!allowed.includes(field)) {
      throw new RelationMetadataPolicyError('lineage', `metadata.${field} is not supported by schema version ${LINEAGE_METADATA_SCHEMA_VERSION}`);
    }
  }
}

/** Validate the versioned, non-endpoint-mutating lineage metadata contract. */
export function validateLineageMetadata(metadata: JsonValue | null): void {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new RelationMetadataPolicyError('lineage', 'metadata must be a JSON object');
  }
  const value = metadata as Record<string, JsonValue>;
  requireKnownFields(value, [
    'schema_version', 'transformation_kind', 'rationale', 'context', 'actor',
    'tool', 'source_fragments',
  ]);
  if (value.schema_version !== LINEAGE_METADATA_SCHEMA_VERSION) {
    throw new RelationMetadataPolicyError('lineage', `schema_version must be ${LINEAGE_METADATA_SCHEMA_VERSION}`);
  }
  requireNonBlankMetadataString('transformation_kind', value.transformation_kind);
  if (value.rationale !== undefined) {
    requireNonBlankMetadataString('rationale', value.rationale);
  }
  if (value.actor !== undefined) {
    if (typeof value.actor !== 'object' || value.actor === null || Array.isArray(value.actor)) {
      throw new RelationMetadataPolicyError('lineage', 'actor must be an object');
    }
    const actor = value.actor as Record<string, unknown>;
    requireKnownFields(actor, ['type', 'id']);
    requireNonBlankMetadataString('actor.type', actor.type);
    requireNonBlankMetadataString('actor.id', actor.id);
  }
  if (value.tool !== undefined) {
    if (typeof value.tool !== 'object' || value.tool === null || Array.isArray(value.tool)) {
      throw new RelationMetadataPolicyError('lineage', 'tool must be an object');
    }
    const tool = value.tool as Record<string, unknown>;
    requireKnownFields(tool, ['name', 'version', 'reference']);
    requireNonBlankMetadataString('tool.name', tool.name);
    for (const field of ['version', 'reference']) {
      if (tool[field] !== undefined) requireNonBlankMetadataString(`tool.${field}`, tool[field]);
    }
  }
  if (value.source_fragments !== undefined) {
    if (!Array.isArray(value.source_fragments) || value.source_fragments.length === 0) {
      throw new RelationMetadataPolicyError('lineage', 'source_fragments must be a non-empty array when supplied');
    }
    value.source_fragments.forEach((fragment, index) => {
      if (typeof fragment !== 'object' || fragment === null || Array.isArray(fragment)) {
        throw new RelationMetadataPolicyError('lineage', `source_fragments[${index}] must be an object`);
      }
      const item = fragment as Record<string, unknown>;
      requireKnownFields(item, ['source_type', 'source_id', 'locator', 'excerpt']);
      if (typeof item.source_type !== 'string' || !isCoreEntityType(item.source_type)) {
        throw new RelationMetadataPolicyError('lineage', `source_fragments[${index}].source_type must be a core entity type`);
      }
      requireNonBlankMetadataString(`source_fragments[${index}].source_id`, item.source_id);
      requireNonBlankMetadataString(`source_fragments[${index}].locator`, item.locator);
      if (item.excerpt !== undefined) requireNonBlankMetadataString(`source_fragments[${index}].excerpt`, item.excerpt);
    });
  }
}

/** Every one of the eight independent core types can precede every other. */
export const LINEAGE_ENDPOINT_MATRIX: Readonly<Record<CoreEntityType, readonly CoreEntityType[]>> =
  Object.freeze({
    task: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
    goal: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
    project: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
    idea: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
    philosophy: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
    workflow: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
    resource: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
    record: Object.freeze(['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource', 'record'] as CoreEntityType[]),
  });

/** Canonical source -> derivative policy shared by direct-origin and transformation links. */
export function lineageRelationPolicy(relationType: LineageRelationType): RelationPolicy {
  return {
    relationType,
    allowsMultipleActive: false,
    maximumActiveRelationsForTarget: relationType === 'origin_of' ? 1 : undefined,
    rejectsCycles: true,
    allowsDirection: (sourceType, targetType) =>
      LINEAGE_ENDPOINT_MATRIX[sourceType].includes(targetType),
    validateMetadata: validateLineageMetadata,
  };
}

/**
 * Build an open policy: any direction between core concepts is permitted and
 * any JSON-valid metadata is accepted. This is the shape of every default
 * policy; owning Features tighten direction and metadata through overrides.
 */
export function openRelationPolicy(
  relationType: string,
  options: { allowsMultipleActive?: boolean } = {},
): RelationPolicy {
  return {
    relationType,
    allowsMultipleActive: options.allowsMultipleActive ?? false,
    allowsDirection: () => true,
    validateMetadata: () => undefined,
  };
}

/**
 * The default policy for every supported relation type. All types default to
 * unique active identity; `consumes` allows multiple active Relations with
 * the same identity (repeated consumption of one Resource by one Record).
 */
export const DEFAULT_RELATION_POLICIES: Readonly<Record<string, RelationPolicy>> =
  Object.freeze(
    Object.fromEntries(
      RELATION_TYPES.map((relationType) => [
        relationType,
        LINEAGE_RELATION_TYPES.includes(relationType as LineageRelationType)
          ? lineageRelationPolicy(relationType as LineageRelationType)
          : openRelationPolicy(relationType, {
          // One Workflow can apply to several distinct managed contexts;
          // applicability identity is scoped further by relation metadata.
          allowsMultipleActive:
            relationType === 'consumes' || relationType === 'workflow_applies_to',
          }),
      ]),
    ),
  );

/**
 * Resolve the policy in effect for a relation type: a per-type override when
 * registered, otherwise the default. Returns null when no policy governs the
 * type at all (possible only for relation types adopted beyond
 * `RELATION_TYPES` without registering a policy).
 */
export function resolveRelationPolicy(
  relationType: string,
  overrides?: Readonly<Record<string, RelationPolicy>>,
): RelationPolicy | null {
  return (
    overrides?.[relationType] ?? DEFAULT_RELATION_POLICIES[relationType] ?? null
  );
}
