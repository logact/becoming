import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Milestone } from '../domain/milestone';
import { validateMilestone } from '../domain/milestone';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the Milestone aggregate.
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `milestones` table has no foreign keys by design; the repository
 * validates the aggregate's own invariants on every write. Whether a
 * pursuit relation exists or its Goals form a valid hierarchy is decided by
 * the application layer, never here.
 *
 * A partial unique index (`milestone_active_order_unique_idx`) keeps active
 * sort orders distinct per pursuit when independent writes race; archived
 * Milestones do not block sort-order reuse. Reads use the total
 * deterministic ordering `sort_order`, then `created_at`, then `id`.
 *
 * Lookups are archive-safe: `getById` resolves active and archived
 * Milestones alike so historical Roadmaps stay resolvable, while
 * `listForPursuit` excludes archived Milestones unless historical mode is
 * named explicitly.
 */
export interface MilestoneRepository {
  /**
   * Insert a new Milestone. Throws if the id already exists or an active
   * Milestone of the same pursuit already holds its sort order.
   */
  add(milestone: Milestone): Promise<void>;

  /** Return the Milestone with this id (active or archived), or null. */
  getById(id: EntityId): Promise<Milestone | null>;

  /** Persist changes to an existing Milestone. Throws if the id is unknown. */
  save(milestone: Milestone): Promise<void>;

  /**
   * List the Milestones of one pursuit in total deterministic order:
   * `sort_order`, then `created_at`, then `id`. Active discovery excludes
   * archived Milestones unless historical mode is named explicitly.
   */
  listForPursuit(
    pursuitRelationId: EntityId,
    options?: MilestoneListOptions,
  ): Promise<Milestone[]>;

  /**
   * Reorder the currently active Milestones of one pursuit atomically.
   * `orderedMilestoneIds` must name every active Milestone of the pursuit
   * exactly once; position in the list becomes the new contiguous
   * `sortOrder` (1-based) and every reordered row receives `updatedAt`.
   * Archived Milestones are never touched.
   */
  reorderActiveForPursuit(
    pursuitRelationId: EntityId,
    orderedMilestoneIds: readonly EntityId[],
    updatedAt: IsoTimestamp,
  ): Promise<void>;
}

export interface MilestoneListOptions {
  includeArchived?: boolean;
}

interface MilestoneRow {
  id: string;
  pursuit_relation_id: string;
  title: string;
  description: string | null;
  target_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const COLUMNS =
  'id, pursuit_relation_id, title, description, target_at, sort_order, created_at, updated_at, archived_at';

const DETERMINISTIC_ORDER = 'ORDER BY sort_order, created_at, id';

/**
 * Temporary shift applied to active sort orders during a reorder so the
 * partial unique index never sees an intermediate collision. Far above any
 * realistic user-controlled position.
 */
const REORDER_OFFSET = 1_000_000;

function toRow(milestone: Milestone): MilestoneRow {
  return {
    id: milestone.id,
    pursuit_relation_id: milestone.pursuitRelationId,
    title: milestone.title,
    description: milestone.description,
    target_at: milestone.targetAt,
    sort_order: milestone.sortOrder,
    created_at: milestone.createdAt,
    updated_at: milestone.updatedAt,
    archived_at: milestone.archivedAt,
  };
}

function toDomain(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    pursuitRelationId: row.pursuit_relation_id,
    title: row.title,
    description: row.description,
    targetAt: row.target_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/** MilestoneRepository over the SqliteDatabase port. */
export class SqliteMilestoneRepository implements MilestoneRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(milestone: Milestone): Promise<void> {
    validateMilestone(milestone);
    const row = toRow(milestone);
    await this.db.runAsync(
      `INSERT INTO milestones (${COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.pursuit_relation_id,
        row.title,
        row.description,
        row.target_at,
        row.sort_order,
        row.created_at,
        row.updated_at,
        row.archived_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Milestone | null> {
    const row = await this.db.getFirstAsync<MilestoneRow>(
      `SELECT ${COLUMNS} FROM milestones WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(milestone: Milestone): Promise<void> {
    validateMilestone(milestone);
    const row = toRow(milestone);
    const result = await this.db.runAsync(
      `UPDATE milestones SET
         pursuit_relation_id = ?, title = ?, description = ?, target_at = ?,
         sort_order = ?, created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [
        row.pursuit_relation_id,
        row.title,
        row.description,
        row.target_at,
        row.sort_order,
        row.created_at,
        row.updated_at,
        row.archived_at,
        row.id,
      ],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Milestone ${milestone.id}`);
    }
  }

  async listForPursuit(
    pursuitRelationId: EntityId,
    options: MilestoneListOptions = {},
  ): Promise<Milestone[]> {
    const includeArchived = options.includeArchived ?? false;
    const rows = await this.db.getAllAsync<MilestoneRow>(
      `SELECT ${COLUMNS} FROM milestones
       WHERE pursuit_relation_id = ? AND (? = 1 OR archived_at IS NULL)
       ${DETERMINISTIC_ORDER}`,
      [pursuitRelationId, includeArchived ? 1 : 0],
    );
    return rows.map(toDomain);
  }

  async reorderActiveForPursuit(
    pursuitRelationId: EntityId,
    orderedMilestoneIds: readonly EntityId[],
    updatedAt: IsoTimestamp,
  ): Promise<void> {
    const active = await this.listForPursuit(pursuitRelationId);
    assertExactActiveSet(
      'Milestone',
      active.map((milestone) => milestone.id),
      orderedMilestoneIds,
    );
    // SQLite checks the partial unique index row by row, so a direct CASE
    // rewrite could collide with not-yet-updated rows. Shift every active
    // row out of the way first, then assign contiguous 1-based positions.
    await this.db.runAsync(
      `UPDATE milestones SET sort_order = sort_order + ?
       WHERE pursuit_relation_id = ? AND archived_at IS NULL`,
      [REORDER_OFFSET, pursuitRelationId],
    );
    const cases = orderedMilestoneIds
      .map(() => 'WHEN id = ? THEN ?')
      .join(' ');
    const params: (string | number)[] = orderedMilestoneIds.flatMap(
      (id, index) => [id, index + 1],
    );
    await this.db.runAsync(
      `UPDATE milestones
       SET sort_order = CASE ${cases} END, updated_at = ?
       WHERE pursuit_relation_id = ? AND archived_at IS NULL`,
      [...params, updatedAt, pursuitRelationId],
    );
  }
}

/**
 * Require the requested ids to name every currently active aggregate exactly
 * once: no duplicates, no unknown ids, no omissions. Reordering a partial or
 * superset list would silently corrupt the deterministic ordering.
 */
function assertExactActiveSet(
  aggregate: string,
  activeIds: readonly EntityId[],
  orderedIds: readonly EntityId[],
): void {
  if (orderedIds.length === 0) {
    throw new Error(`${aggregate} reorder must name at least one id`);
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new Error(`${aggregate} reorder must not contain duplicate ids`);
  }
  const active = new Set(activeIds);
  const unknown = orderedIds.filter((id) => !active.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `${aggregate} reorder names unknown or inactive ids: ${unknown.join(', ')}`,
    );
  }
  if (orderedIds.length !== activeIds.length) {
    throw new Error(
      `${aggregate} reorder must name every active id exactly once`,
    );
  }
}
