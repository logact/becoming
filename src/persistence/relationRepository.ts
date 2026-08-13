import type { EntityId } from '../domain/ids';
import type { IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import { isCoreEntityType } from '../domain/entityTypes';
import type { JsonValue } from '../domain/json';
import type { Relation } from '../domain/relation';
import { validateRelation } from '../domain/relation';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the Relation aggregate (the semantic core graph).
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `relations` table has no foreign keys; the repository validates the
 * aggregate's invariants on every write. Endpoint *existence* is a logical
 * reference validated by the application services that compose Relations,
 * against the per-aggregate repository boundaries — never by the database.
 *
 * `metadata` is stored as canonical JSON TEXT produced by `JSON.stringify`
 * from a validated `JsonValue`; it never passes through an ORM serializer.
 * `getById` resolves active and ended Relations alike so history that
 * references a Relation stays resolvable.
 *
 * Relations are immutable once created except for ending: `save` persists only
 * the `ended_at` column, so endpoints, direction, metadata, and `created_at`
 * can never be rewritten through this boundary. There is deliberately no
 * delete operation — hard deletion of Relations is forbidden; history is
 * preserved by ending, and replacing a relationship is end-old/create-new.
 * Active-cardinality rules are relation-type policies enforced by the
 * application service (see `src/domain/relationPolicy.ts`), which queries
 * `findActiveByIdentity` inside its unit of work.
 */
export interface RelationRepository {
  /** Insert a new Relation. Throws if the id already exists. */
  add(relation: Relation): Promise<void>;

  /** Return the Relation with this id (active or ended), or null. */
  getById(id: EntityId): Promise<Relation | null>;

  /**
   * Return the currently active Relation with this exact active-duplicate
   * identity — `(sourceType, sourceId, relationType, targetType, targetId)` —
   * or null. Ended rows never match.
   */
  findActiveByIdentity(
    sourceType: CoreEntityType,
    sourceId: EntityId,
    relationType: string,
    targetType: CoreEntityType,
    targetId: EntityId,
  ): Promise<Relation | null>;

  /** Return all relation history directed at one endpoint, including ended rows. */
  listByTarget(
    targetType: CoreEntityType,
    targetId: EntityId,
  ): Promise<Relation[]>;

  /**
   * Query active and ended relations with composable endpoint, type, status,
   * and temporal predicates. Results use the total `created_at, id` order so
   * offset pages have a repeatable traversal order.
   */
  list(query?: RelationQuery): Promise<Relation[]>;

  /** A named current-state helper; it always selects `ended_at IS NULL`. */
  listCurrent(query?: RelationListQuery): Promise<Relation[]>;

  /** A named history helper; it retains both active and ended rows. */
  listHistory(query?: RelationListQuery): Promise<Relation[]>;

  /**
   * End an existing Relation: persists only `ended_at`. Throws if the id is
   * unknown. Every other column is immutable through this boundary.
   */
  save(relation: Relation): Promise<void>;
}

/** A typed endpoint constraint. Relation direction is never reversed by a query. */
export interface RelationEndpointFilter {
  type: CoreEntityType;
  id: EntityId;
}

export type RelationStatus = 'active' | 'ended';

/**
 * A half-open interval `[start, end)`. A relation is selected when its active
 * interval `[createdAt, endedAt)` overlaps this interval. `end` is required
 * to make the open-ended active relation predicate unambiguous.
 */
export interface RelationTimeRange {
  start: IsoTimestamp;
  end: IsoTimestamp;
}

/** Filters shared by current and historical relation listings. */
export interface RelationListQuery {
  source?: RelationEndpointFilter;
  target?: RelationEndpointFilter;
  relationType?: string;
  /**
   * Select a relation active at this exact instant. Intervals are half-open:
   * createdAt is included, while endedAt is excluded.
   */
  at?: IsoTimestamp;
  /** Select relations whose `[createdAt, endedAt)` interval overlaps this range. */
  overlaps?: RelationTimeRange;
  /** Offset pagination over the deterministic `created_at ASC, id ASC` order. */
  limit?: number;
  offset?: number;
}

/** Full relation query. Omitted `status` retains history (active and ended). */
export interface RelationQuery extends RelationListQuery {
  status?: RelationStatus;
}

interface RelationRow {
  id: string;
  source_type: string;
  source_id: string;
  relation_type: string;
  target_type: string;
  target_id: string;
  metadata: string | null;
  created_at: string;
  ended_at: string | null;
}

function toRow(relation: Relation): RelationRow {
  return {
    id: relation.id,
    source_type: relation.sourceType,
    source_id: relation.sourceId,
    relation_type: relation.relationType,
    target_type: relation.targetType,
    target_id: relation.targetId,
    metadata:
      relation.metadata === null ? null : JSON.stringify(relation.metadata),
    created_at: relation.createdAt,
    ended_at: relation.endedAt,
  };
}

function toDomain(row: RelationRow): Relation {
  return {
    id: row.id,
    sourceType: row.source_type as Relation['sourceType'],
    sourceId: row.source_id,
    relationType: row.relation_type,
    targetType: row.target_type as Relation['targetType'],
    targetId: row.target_id,
    metadata: row.metadata === null ? null : (JSON.parse(row.metadata) as JsonValue),
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

/** RelationRepository over the SqliteDatabase port. */
export class SqliteRelationRepository implements RelationRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(relation: Relation): Promise<void> {
    validateRelation(relation);
    const row = toRow(relation);
    await this.db.runAsync(
      `INSERT INTO relations (
         id, source_type, source_id, relation_type, target_type, target_id,
         metadata, created_at, ended_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.source_type,
        row.source_id,
        row.relation_type,
        row.target_type,
        row.target_id,
        row.metadata,
        row.created_at,
        row.ended_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Relation | null> {
    const row = await this.db.getFirstAsync<RelationRow>(
      `SELECT id, source_type, source_id, relation_type, target_type, target_id,
              metadata, created_at, ended_at
       FROM relations WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async findActiveByIdentity(
    sourceType: CoreEntityType,
    sourceId: EntityId,
    relationType: string,
    targetType: CoreEntityType,
    targetId: EntityId,
  ): Promise<Relation | null> {
    const row = await this.db.getFirstAsync<RelationRow>(
      `SELECT id, source_type, source_id, relation_type, target_type, target_id,
              metadata, created_at, ended_at
       FROM relations
       WHERE source_type = ? AND source_id = ? AND relation_type = ?
         AND target_type = ? AND target_id = ?
         AND ended_at IS NULL`,
      [sourceType, sourceId, relationType, targetType, targetId],
    );
    return row === null ? null : toDomain(row);
  }

  async listByTarget(
    targetType: CoreEntityType,
    targetId: EntityId,
  ): Promise<Relation[]> {
    const rows = await this.db.getAllAsync<RelationRow>(
      `SELECT id, source_type, source_id, relation_type, target_type, target_id,
              metadata, created_at, ended_at
       FROM relations
       WHERE target_type = ? AND target_id = ?
       ORDER BY created_at ASC, id ASC`,
      [targetType, targetId],
    );
    return rows.map(toDomain);
  }

  async list(query: RelationQuery = {}): Promise<Relation[]> {
    assertRelationQuery(query);
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];
    if (query.source !== undefined) {
      conditions.push('source_type = ? AND source_id = ?');
      params.push(query.source.type, query.source.id);
    }
    if (query.target !== undefined) {
      conditions.push('target_type = ? AND target_id = ?');
      params.push(query.target.type, query.target.id);
    }
    if (query.relationType !== undefined) {
      conditions.push('relation_type = ?');
      params.push(query.relationType);
    }
    if (query.status === 'active') {
      conditions.push('ended_at IS NULL');
    } else if (query.status === 'ended') {
      conditions.push('ended_at IS NOT NULL');
    }
    if (query.at !== undefined) {
      conditions.push('created_at <= ? AND (ended_at IS NULL OR ended_at > ?)');
      params.push(query.at, query.at);
    }
    if (query.overlaps !== undefined) {
      conditions.push('created_at < ? AND (ended_at IS NULL OR ended_at > ?)');
      params.push(query.overlaps.end, query.overlaps.start);
    }
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const rows = await this.db.getAllAsync<RelationRow>(
      `SELECT id, source_type, source_id, relation_type, target_type, target_id,
              metadata, created_at, ended_at
       FROM relations
       ${where}
       ORDER BY created_at ASC, id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(toDomain);
  }

  async listCurrent(query: RelationListQuery = {}): Promise<Relation[]> {
    return this.list({ ...query, status: 'active' });
  }

  async listHistory(query: RelationListQuery = {}): Promise<Relation[]> {
    return this.list(query);
  }

  async save(relation: Relation): Promise<void> {
    validateRelation(relation);
    // Relations are immutable once created except for ending: only ended_at
    // is ever updated, so history (endpoints, direction, metadata,
    // created_at) can never be rewritten through this boundary.
    const result = await this.db.runAsync(
      `UPDATE relations SET ended_at = ? WHERE id = ?`,
      [relation.endedAt, relation.id],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Relation ${relation.id}`);
    }
  }
}

function assertRelationQuery(query: RelationQuery): void {
  assertEndpoint('source', query.source);
  assertEndpoint('target', query.target);
  if (query.relationType !== undefined && query.relationType.trim().length === 0) {
    throw new Error('Relation query relationType must not be blank');
  }
  if (query.at !== undefined) assertTimestamp('at', query.at);
  if (query.overlaps !== undefined) {
    assertTimestamp('overlaps.start', query.overlaps.start);
    assertTimestamp('overlaps.end', query.overlaps.end);
    if (Date.parse(query.overlaps.start) >= Date.parse(query.overlaps.end)) {
      throw new Error('Relation query overlaps must have start before end');
    }
  }
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Relation query limit must be a positive integer');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Relation query offset must be a non-negative integer');
  }
}

function assertEndpoint(name: string, endpoint: RelationEndpointFilter | undefined): void {
  if (endpoint === undefined) return;
  if (!isCoreEntityType(endpoint.type)) {
    throw new Error(`Relation query ${name} endpoint type must be a core entity type`);
  }
  if (endpoint.id.trim().length === 0) {
    throw new Error(`Relation query ${name} endpoint id must not be blank`);
  }
}

function assertTimestamp(name: string, value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(`Relation query ${name} must be a valid ISO 8601 timestamp`);
  }
}
