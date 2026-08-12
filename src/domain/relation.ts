import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';
import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';

/**
 * The Relation aggregate: a semantic relationship between two core concepts.
 *
 * Relations are the semantic core graph of the system (see
 * `Table-definetion.txt` #9): they connect core concepts only — Task, Goal,
 * Project, Idea, Philosophy, Workflow, Resource, Record. A Relation owns the
 * endpoints (`sourceType`/`sourceId`, `targetType`/`targetId`), the semantic
 * meaning (`relationType`), optional structured `metadata` belonging to the
 * relationship itself (especially important for Resource relations such as
 * constraints and allocations), and its active interval (`createdAt` until
 * `endedAt`; `endedAt` null means currently active).
 *
 * Logical integrity contracts enforced here (the `relations` table has no
 * database foreign keys by design):
 * - `sourceType` and `targetType` must be core entity types. Labels, states,
 *   and state transitions are NEVER referenced through this table.
 * - `sourceId` and `targetId` must not be blank. Endpoint *existence* is a
 *   logical reference validated by the application service that creates the
 *   Relation, against the per-aggregate repository boundaries — never by the
 *   database.
 * - `relationType` must be supported by the relation-type policy in effect;
 *   the policy is explicit and extensible like the record-type policy.
 * - `metadata`, when present, must be a structured JSON value that serializes
 *   without loss.
 * - `createdAt` is a required ISO 8601 timestamp; `endedAt`, when present,
 *   must be a valid ISO 8601 timestamp not earlier than `createdAt`, so every
 *   Relation's active interval stays historically resolvable.
 *
 * Ending a Relation and recording provenance for relation mutations are
 * added by later (Wave 3) tasks; this aggregate defines creation and the
 * invariants every stored Relation must satisfy.
 */

/**
 * The default supported relation types (see `Table-definetion.txt`). The
 * policy is explicit and extensible: validation accepts an override list so
 * new types can be adopted deliberately instead of silently.
 */
export const RELATION_TYPES = [
  'belongs_to',
  'contributes_to',
  'uses',
  'managed_by',
  'guides',
  'depends_on',
  'requires',
  'constrained_by',
  'consumes',
  'related_to',
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value);
}

export interface Relation {
  id: EntityId;
  sourceType: CoreEntityType;
  sourceId: EntityId;
  relationType: string;
  targetType: CoreEntityType;
  targetId: EntityId;
  metadata: JsonValue | null;
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
}

/** Input for creating a new Relation between two core concepts. */
export interface NewRelation {
  sourceType: string;
  sourceId: EntityId;
  relationType: string;
  targetType: string;
  targetId: EntityId;
  metadata?: unknown;
}

/** Optional dependencies, primarily for deterministic tests and services. */
export interface RelationFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
  supportedRelationTypes?: readonly string[];
}

function requireCoreEntityType(field: string, value: string): CoreEntityType {
  if (!isCoreEntityType(value)) {
    throw new Error(
      `Relation ${field} must be a core entity type, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireNonBlankId(field: string, value: EntityId): EntityId {
  if (value.trim().length === 0) {
    throw new Error(`Relation ${field} must not be blank`);
  }
  return value;
}

function requireSupportedRelationType(
  relationType: string,
  supportedRelationTypes: readonly string[],
): string {
  if (relationType.trim().length === 0) {
    throw new Error('Relation relationType must not be blank');
  }
  if (!supportedRelationTypes.includes(relationType)) {
    throw new Error(
      `Unsupported relation type ${JSON.stringify(relationType)}; supported types: ${supportedRelationTypes.join(', ')}`,
    );
  }
  return relationType;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `Relation ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Validate the invariants every Relation must satisfy. The relation-type
 * policy defaults to `RELATION_TYPES` and can be extended with additional
 * types.
 */
export function validateRelation(
  relation: Relation,
  supportedRelationTypes: readonly string[] = RELATION_TYPES,
): void {
  requireCoreEntityType('sourceType', relation.sourceType);
  requireCoreEntityType('targetType', relation.targetType);
  requireNonBlankId('sourceId', relation.sourceId);
  requireNonBlankId('targetId', relation.targetId);
  requireSupportedRelationType(relation.relationType, supportedRelationTypes);
  requireTimestamp('createdAt', relation.createdAt);
  if (relation.endedAt !== null) {
    requireTimestamp('endedAt', relation.endedAt);
    if (Date.parse(relation.endedAt) < Date.parse(relation.createdAt)) {
      throw new Error(
        `Relation endedAt must not be earlier than createdAt, got ${JSON.stringify(relation.endedAt)} before ${JSON.stringify(relation.createdAt)}`,
      );
    }
  }
  if (relation.metadata !== null) {
    assertJsonValue(relation.metadata, 'metadata');
  }
}

/**
 * Create a new active Relation with a fresh id and the current timestamp as
 * `createdAt`. All validation runs before the aggregate exists, so invalid
 * input can never reach persistence.
 */
export function createRelation(
  input: NewRelation,
  deps: RelationFactoryDeps = {},
): Relation {
  const supportedRelationTypes = deps.supportedRelationTypes ?? RELATION_TYPES;
  const relation: Relation = {
    id: deps.id ?? newId(),
    sourceType: requireCoreEntityType('sourceType', input.sourceType),
    sourceId: requireNonBlankId('sourceId', input.sourceId),
    relationType: requireSupportedRelationType(
      input.relationType,
      supportedRelationTypes,
    ),
    targetType: requireCoreEntityType('targetType', input.targetType),
    targetId: requireNonBlankId('targetId', input.targetId),
    metadata:
      input.metadata === undefined
        ? null
        : assertJsonValue(input.metadata, 'metadata'),
    createdAt: deps.now ?? nowIso(),
    endedAt: null,
  };
  validateRelation(relation, supportedRelationTypes);
  return relation;
}
