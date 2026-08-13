import type { EntityId } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
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

  /**
   * End an existing Relation: persists only `ended_at`. Throws if the id is
   * unknown. Every other column is immutable through this boundary.
   */
  save(relation: Relation): Promise<void>;
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
