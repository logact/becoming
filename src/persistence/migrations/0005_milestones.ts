import type { Migration } from './migration';

/**
 * V5 introduces the Roadmap Milestones aggregates: ordered Milestones scoped
 * to one exact Project pursuit relation, and temporal Goal assignments that
 * group descendant Goals under a Milestone.
 *
 * There are deliberately no database foreign keys: `pursuit_relation_id`,
 * `milestone_id`, and `goal_id` are logical references validated by the
 * application layer inside the same write unit of work. `pursuit_relation_id`
 * is repeated on assignments intentionally to support efficient pursuit-wide
 * uniqueness and corruption detection.
 *
 * Partial unique indexes keep the rules safe when independent writes race:
 * active Milestones of one pursuit hold distinct sort orders, and a Goal is
 * actively assigned to at most one Milestone per pursuit. Archived Milestones
 * and ended assignments stay stored so history remains resolvable by id.
 */
export const milestones: Migration = {
  version: 5,
  name: 'milestones',
  async up(db) {
    await db.execAsync(`
      CREATE TABLE milestones (
        id                  TEXT PRIMARY KEY,
        pursuit_relation_id TEXT NOT NULL,
        title               TEXT NOT NULL,
        description         TEXT,
        target_at           TEXT,
        sort_order          INTEGER NOT NULL CHECK (sort_order > 0),
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        archived_at         TEXT
      );

      CREATE TABLE milestone_goal_assignments (
        id                  TEXT PRIMARY KEY,
        pursuit_relation_id TEXT NOT NULL,
        milestone_id        TEXT NOT NULL,
        goal_id             TEXT NOT NULL,
        sort_order          INTEGER NOT NULL CHECK (sort_order > 0),
        created_at          TEXT NOT NULL,
        ended_at            TEXT
      );

      CREATE INDEX milestones_pursuit_order_idx
        ON milestones (pursuit_relation_id, archived_at, sort_order, created_at, id);

      CREATE INDEX milestone_goal_assignments_milestone_idx
        ON milestone_goal_assignments (milestone_id, ended_at, sort_order, created_at, id);

      CREATE UNIQUE INDEX milestone_active_order_unique_idx
        ON milestones (pursuit_relation_id, sort_order)
        WHERE archived_at IS NULL;

      CREATE UNIQUE INDEX milestone_goal_active_pursuit_unique_idx
        ON milestone_goal_assignments (pursuit_relation_id, goal_id)
        WHERE ended_at IS NULL;
    `);
  },
};
