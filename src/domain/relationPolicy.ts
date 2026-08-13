import type { CoreEntityType } from './entityTypes';
import type { JsonValue } from './json';
import { RELATION_TYPES } from './relation';

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
        openRelationPolicy(relationType, {
          allowsMultipleActive: relationType === 'consumes',
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
