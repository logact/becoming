import type { EntityId } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityLabelAssignment } from '../domain/entityLabel';
import { validateEntityLabelAssignment } from '../domain/entityLabel';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the EntityLabelAssignment aggregate (temporal
 * Label assignments on core entities, stored in `entity_labels`).
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `entity_labels` table has no foreign keys and no uniqueness
 * constraints; the repository validates the aggregate's own invariants on
 * every write and enforces the application-level rule that at most one
 * assignment of the same Label to the same entity is active at any moment.
 * Re-assigning a Label after the previous assignment ended creates a new row,
 * so the full temporal history is preserved.
 *
 * Lookups are history-safe: `getById` and `listForEntity` resolve active and
 * ended assignments alike, while `findActiveForEntity` and `findActive`
 * return only currently active assignments.
 */
export interface EntityLabelRepository {
  /**
   * Insert a new assignment. Throws if the id already exists or an active
   * assignment of the same Label to the same entity already exists.
   */
  add(assignment: EntityLabelAssignment): Promise<void>;

  /** Return the assignment with this id (active or ended), or null. */
  getById(id: EntityId): Promise<EntityLabelAssignment | null>;

  /**
   * Return the currently active assignment of `labelId` to the given entity,
   * or null.
   */
  findActive(
    entityType: CoreEntityType,
    entityId: EntityId,
    labelId: EntityId,
  ): Promise<EntityLabelAssignment | null>;

  /**
   * Return every currently active assignment on the given entity, ordered by
   * `createdAt` then id.
   */
  findActiveForEntity(
    entityType: CoreEntityType,
    entityId: EntityId,
  ): Promise<EntityLabelAssignment[]>;

  /**
   * Return the full temporal assignment history of the given entity — active
   * and ended — ordered by `createdAt` then id.
   */
  listForEntity(
    entityType: CoreEntityType,
    entityId: EntityId,
  ): Promise<EntityLabelAssignment[]>;

  /**
   * Persist changes to an existing assignment (ending it). Throws if the id
   * is unknown or the change would leave two active assignments of the same
   * Label on the same entity.
   */
  save(assignment: EntityLabelAssignment): Promise<void>;
}

interface EntityLabelRow {
  id: string;
  entity_type: string;
  entity_id: string;
  label_id: string;
  created_at: string;
  ended_at: string | null;
}

const COLUMNS = 'id, entity_type, entity_id, label_id, created_at, ended_at';

function toRow(assignment: EntityLabelAssignment): EntityLabelRow {
  return {
    id: assignment.id,
    entity_type: assignment.entityType,
    entity_id: assignment.entityId,
    label_id: assignment.labelId,
    created_at: assignment.createdAt,
    ended_at: assignment.endedAt,
  };
}

function toDomain(row: EntityLabelRow): EntityLabelAssignment {
  return {
    id: row.id,
    entityType: row.entity_type as EntityLabelAssignment['entityType'],
    entityId: row.entity_id,
    labelId: row.label_id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

/** EntityLabelRepository over the SqliteDatabase port. */
export class SqliteEntityLabelRepository implements EntityLabelRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(assignment: EntityLabelAssignment): Promise<void> {
    validateEntityLabelAssignment(assignment);
    await this.assertNoOtherActiveAssignment(assignment);
    const row = toRow(assignment);
    await this.db.runAsync(
      `INSERT INTO entity_labels (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.entity_type,
        row.entity_id,
        row.label_id,
        row.created_at,
        row.ended_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<EntityLabelAssignment | null> {
    const row = await this.db.getFirstAsync<EntityLabelRow>(
      `SELECT ${COLUMNS} FROM entity_labels WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async findActive(
    entityType: CoreEntityType,
    entityId: EntityId,
    labelId: EntityId,
  ): Promise<EntityLabelAssignment | null> {
    const row = await this.db.getFirstAsync<EntityLabelRow>(
      `SELECT ${COLUMNS} FROM entity_labels
       WHERE entity_type = ? AND entity_id = ? AND label_id = ?
         AND ended_at IS NULL`,
      [entityType, entityId, labelId],
    );
    return row === null ? null : toDomain(row);
  }

  async findActiveForEntity(
    entityType: CoreEntityType,
    entityId: EntityId,
  ): Promise<EntityLabelAssignment[]> {
    const rows = await this.db.getAllAsync<EntityLabelRow>(
      `SELECT ${COLUMNS} FROM entity_labels
       WHERE entity_type = ? AND entity_id = ? AND ended_at IS NULL
       ORDER BY created_at, id`,
      [entityType, entityId],
    );
    return rows.map(toDomain);
  }

  async listForEntity(
    entityType: CoreEntityType,
    entityId: EntityId,
  ): Promise<EntityLabelAssignment[]> {
    const rows = await this.db.getAllAsync<EntityLabelRow>(
      `SELECT ${COLUMNS} FROM entity_labels
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at, id`,
      [entityType, entityId],
    );
    return rows.map(toDomain);
  }

  async save(assignment: EntityLabelAssignment): Promise<void> {
    validateEntityLabelAssignment(assignment);
    await this.assertNoOtherActiveAssignment(assignment);
    const row = toRow(assignment);
    const result = await this.db.runAsync(
      `UPDATE entity_labels SET
         entity_type = ?, entity_id = ?, label_id = ?,
         created_at = ?, ended_at = ?
       WHERE id = ?`,
      [
        row.entity_type,
        row.entity_id,
        row.label_id,
        row.created_at,
        row.ended_at,
        row.id,
      ],
    );
    if (result.changes === 0) {
      throw new Error(
        `Cannot save unknown EntityLabelAssignment ${assignment.id}`,
      );
    }
  }

  /**
   * Reject a second active assignment of the same Label to the same entity.
   * Ended assignments do not block reuse; their history stays keyed by id.
   */
  private async assertNoOtherActiveAssignment(
    assignment: EntityLabelAssignment,
  ): Promise<void> {
    if (assignment.endedAt !== null) {
      return;
    }
    const existing = await this.findActive(
      assignment.entityType,
      assignment.entityId,
      assignment.labelId,
    );
    if (existing !== null && existing.id !== assignment.id) {
      throw new Error(
        `Label ${assignment.labelId} is already actively assigned to ${assignment.entityType} ${assignment.entityId}`,
      );
    }
  }
}
