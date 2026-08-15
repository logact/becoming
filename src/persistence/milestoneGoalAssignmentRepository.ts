import type { EntityId } from '../domain/ids';
import type { MilestoneGoalAssignment } from '../domain/milestone';
import { validateMilestoneGoalAssignment } from '../domain/milestone';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the MilestoneGoalAssignment aggregate (temporal
 * Goal assignments on Milestones, stored in `milestone_goal_assignments`).
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The table has no foreign keys by design; the repository validates the
 * aggregate's own invariants on every write. Whether the Goal is an active
 * descendant of the pursuit's root Goal, or whether `pursuit_relation_id`
 * matches the owning Milestone, is decided by the application layer inside
 * the write unit of work, never here.
 *
 * A partial unique index (`milestone_goal_active_pursuit_unique_idx`) keeps
 * a Goal actively assigned to at most one Milestone per pursuit when
 * independent writes race; ended assignments do not block re-assignment.
 * Reads use the total deterministic ordering `sort_order`, then
 * `created_at`, then `id`.
 *
 * Lookups are history-safe: `getById` and `listHistoryForMilestone` resolve
 * active and ended assignments alike, while the `listCurrent*` and
 * `findCurrent*` operations return only currently active assignments.
 * `save` persists `ended_at` only — assignment rows are never repointed or
 * deleted, and reordering goes through `reorderCurrentForMilestone`.
 */
export interface MilestoneGoalAssignmentRepository {
  /**
   * Insert a new assignment. Throws if the id already exists or the Goal is
   * already actively assigned within the same pursuit.
   */
  add(assignment: MilestoneGoalAssignment): Promise<void>;

  /** Return the assignment with this id (active or ended), or null. */
  getById(id: EntityId): Promise<MilestoneGoalAssignment | null>;

  /**
   * Persist `ended_at` on an existing assignment. All other fields are
   * immutable once written. Throws if the id is unknown.
   */
  save(assignment: MilestoneGoalAssignment): Promise<void>;

  /**
   * Return the currently active assignments of one Milestone in total
   * deterministic order: `sort_order`, then `created_at`, then `id`.
   */
  listCurrentForMilestone(
    milestoneId: EntityId,
  ): Promise<MilestoneGoalAssignment[]>;

  /**
   * Return the full temporal assignment history of one Milestone — active
   * and ended — in total deterministic order.
   */
  listHistoryForMilestone(
    milestoneId: EntityId,
  ): Promise<MilestoneGoalAssignment[]>;

  /**
   * Return every currently active assignment across one pursuit in total
   * deterministic order.
   */
  listCurrentForPursuit(
    pursuitRelationId: EntityId,
  ): Promise<MilestoneGoalAssignment[]>;

  /**
   * Return the currently active assignment of `goalId` within the pursuit,
   * or null.
   */
  findCurrentForGoal(
    pursuitRelationId: EntityId,
    goalId: EntityId,
  ): Promise<MilestoneGoalAssignment | null>;

  /**
   * Reorder the currently active assignments of one Milestone atomically.
   * `orderedAssignmentIds` must name every current assignment of the
   * Milestone exactly once; position in the list becomes the new contiguous
   * `sortOrder` (1-based). Ended assignments are never touched.
   */
  reorderCurrentForMilestone(
    milestoneId: EntityId,
    orderedAssignmentIds: readonly EntityId[],
  ): Promise<void>;
}

interface MilestoneGoalAssignmentRow {
  id: string;
  pursuit_relation_id: string;
  milestone_id: string;
  goal_id: string;
  sort_order: number;
  created_at: string;
  ended_at: string | null;
}

const COLUMNS =
  'id, pursuit_relation_id, milestone_id, goal_id, sort_order, created_at, ended_at';

const DETERMINISTIC_ORDER = 'ORDER BY sort_order, created_at, id';

function toRow(
  assignment: MilestoneGoalAssignment,
): MilestoneGoalAssignmentRow {
  return {
    id: assignment.id,
    pursuit_relation_id: assignment.pursuitRelationId,
    milestone_id: assignment.milestoneId,
    goal_id: assignment.goalId,
    sort_order: assignment.sortOrder,
    created_at: assignment.createdAt,
    ended_at: assignment.endedAt,
  };
}

function toDomain(row: MilestoneGoalAssignmentRow): MilestoneGoalAssignment {
  return {
    id: row.id,
    pursuitRelationId: row.pursuit_relation_id,
    milestoneId: row.milestone_id,
    goalId: row.goal_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

/** MilestoneGoalAssignmentRepository over the SqliteDatabase port. */
export class SqliteMilestoneGoalAssignmentRepository
  implements MilestoneGoalAssignmentRepository
{
  constructor(private readonly db: SqliteDatabase) {}

  async add(assignment: MilestoneGoalAssignment): Promise<void> {
    validateMilestoneGoalAssignment(assignment);
    const row = toRow(assignment);
    await this.db.runAsync(
      `INSERT INTO milestone_goal_assignments (${COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.pursuit_relation_id,
        row.milestone_id,
        row.goal_id,
        row.sort_order,
        row.created_at,
        row.ended_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<MilestoneGoalAssignment | null> {
    const row = await this.db.getFirstAsync<MilestoneGoalAssignmentRow>(
      `SELECT ${COLUMNS} FROM milestone_goal_assignments WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(assignment: MilestoneGoalAssignment): Promise<void> {
    validateMilestoneGoalAssignment(assignment);
    const row = toRow(assignment);
    const result = await this.db.runAsync(
      `UPDATE milestone_goal_assignments SET ended_at = ? WHERE id = ?`,
      [row.ended_at, row.id],
    );
    if (result.changes === 0) {
      throw new Error(
        `Cannot save unknown MilestoneGoalAssignment ${assignment.id}`,
      );
    }
  }

  async listCurrentForMilestone(
    milestoneId: EntityId,
  ): Promise<MilestoneGoalAssignment[]> {
    const rows = await this.db.getAllAsync<MilestoneGoalAssignmentRow>(
      `SELECT ${COLUMNS} FROM milestone_goal_assignments
       WHERE milestone_id = ? AND ended_at IS NULL
       ${DETERMINISTIC_ORDER}`,
      [milestoneId],
    );
    return rows.map(toDomain);
  }

  async listHistoryForMilestone(
    milestoneId: EntityId,
  ): Promise<MilestoneGoalAssignment[]> {
    const rows = await this.db.getAllAsync<MilestoneGoalAssignmentRow>(
      `SELECT ${COLUMNS} FROM milestone_goal_assignments
       WHERE milestone_id = ?
       ${DETERMINISTIC_ORDER}`,
      [milestoneId],
    );
    return rows.map(toDomain);
  }

  async listCurrentForPursuit(
    pursuitRelationId: EntityId,
  ): Promise<MilestoneGoalAssignment[]> {
    const rows = await this.db.getAllAsync<MilestoneGoalAssignmentRow>(
      `SELECT ${COLUMNS} FROM milestone_goal_assignments
       WHERE pursuit_relation_id = ? AND ended_at IS NULL
       ${DETERMINISTIC_ORDER}`,
      [pursuitRelationId],
    );
    return rows.map(toDomain);
  }

  async findCurrentForGoal(
    pursuitRelationId: EntityId,
    goalId: EntityId,
  ): Promise<MilestoneGoalAssignment | null> {
    const row = await this.db.getFirstAsync<MilestoneGoalAssignmentRow>(
      `SELECT ${COLUMNS} FROM milestone_goal_assignments
       WHERE pursuit_relation_id = ? AND goal_id = ? AND ended_at IS NULL`,
      [pursuitRelationId, goalId],
    );
    return row === null ? null : toDomain(row);
  }

  async reorderCurrentForMilestone(
    milestoneId: EntityId,
    orderedAssignmentIds: readonly EntityId[],
  ): Promise<void> {
    const current = await this.listCurrentForMilestone(milestoneId);
    assertExactActiveSet(
      'MilestoneGoalAssignment',
      current.map((assignment) => assignment.id),
      orderedAssignmentIds,
    );
    // A single CASE UPDATE assigns contiguous 1-based sort orders.
    const cases = orderedAssignmentIds
      .map(() => 'WHEN id = ? THEN ?')
      .join(' ');
    const params: (string | number)[] = orderedAssignmentIds.flatMap(
      (id, index) => [id, index + 1],
    );
    await this.db.runAsync(
      `UPDATE milestone_goal_assignments
       SET sort_order = CASE ${cases} END
       WHERE milestone_id = ? AND ended_at IS NULL`,
      [...params, milestoneId],
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
