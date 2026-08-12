import type { EntityId } from '../domain/ids';
import type { Goal } from '../domain/goal';
import { validateGoal } from '../domain/goal';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the Goal aggregate.
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `goals` table has no foreign keys; the repository validates the
 * aggregate's own invariants on every write. References *to* a Goal (from
 * relations, records, state history, etc.) are validated by the services
 * that own those tables, against this boundary.
 *
 * Lookups are archive-safe: `getById` resolves active and archived Goals
 * alike so history that references an archived Goal stays resolvable.
 */
export interface GoalRepository {
  /** Insert a new Goal. Throws if the id already exists. */
  add(goal: Goal): Promise<void>;

  /** Return the Goal with this id (active or archived), or null. */
  getById(id: EntityId): Promise<Goal | null>;

  /** Persist changes to an existing Goal. Throws if the id is unknown. */
  save(goal: Goal): Promise<void>;
}

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  target_state: string;
  success_criteria: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toRow(goal: Goal): GoalRow {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    target_state: goal.targetState,
    success_criteria: goal.successCriteria,
    created_at: goal.createdAt,
    updated_at: goal.updatedAt,
    archived_at: goal.archivedAt,
  };
}

function toDomain(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetState: row.target_state,
    successCriteria: row.success_criteria,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/** GoalRepository over the SqliteDatabase port. */
export class SqliteGoalRepository implements GoalRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(goal: Goal): Promise<void> {
    validateGoal(goal);
    const row = toRow(goal);
    await this.db.runAsync(
      `INSERT INTO goals (
         id, title, description, target_state, success_criteria,
         created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.description,
        row.target_state,
        row.success_criteria,
        row.created_at,
        row.updated_at,
        row.archived_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Goal | null> {
    const row = await this.db.getFirstAsync<GoalRow>(
      `SELECT id, title, description, target_state, success_criteria,
              created_at, updated_at, archived_at
       FROM goals WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(goal: Goal): Promise<void> {
    validateGoal(goal);
    const row = toRow(goal);
    const result = await this.db.runAsync(
      `UPDATE goals SET
         title = ?, description = ?, target_state = ?, success_criteria = ?,
         created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [
        row.title,
        row.description,
        row.target_state,
        row.success_criteria,
        row.created_at,
        row.updated_at,
        row.archived_at,
        row.id,
      ],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Goal ${goal.id}`);
    }
  }
}
