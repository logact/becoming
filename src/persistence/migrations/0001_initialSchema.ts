import type { Migration } from './migration';

/**
 * V1 initial schema: the sixteen tables from Table-definetion.txt.
 *
 * Hard rules enforced here and verified by tests:
 * - No database-level FOREIGN KEY / REFERENCES clauses anywhere. Columns such
 *   as workflow_id, label_id, entity_id, from_state_id are logical references
 *   validated by the application/domain layer.
 * - No shared `entities` table; the eight core concepts are independent.
 * - UUID ids, ISO 8601 UTC datetimes, exact decimals, and JSON payloads are
 *   all stored as TEXT; booleans are INTEGER 0/1 with CHECK constraints.
 */
export const initialSchema: Migration = {
  version: 1,
  name: 'initial_schema',
  async up(db) {
    await db.execAsync(`
      -- Core concepts ------------------------------------------------------

      CREATE TABLE tasks (
        id                 TEXT PRIMARY KEY,
        title              TEXT NOT NULL,
        description        TEXT,
        target_description TEXT NOT NULL,
        exit_criteria      TEXT,
        priority           INTEGER,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL,
        archived_at        TEXT
      );

      CREATE TABLE goals (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        description      TEXT,
        target_state     TEXT NOT NULL,
        success_criteria TEXT,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL,
        archived_at      TEXT
      );

      CREATE TABLE projects (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT,
        purpose     TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE TABLE ideas (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        description      TEXT,
        idea_description TEXT NOT NULL,
        captured_at      TEXT NOT NULL,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL,
        archived_at      TEXT
      );

      CREATE TABLE philosophies (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE TABLE workflows (
        id             TEXT PRIMARY KEY,
        title          TEXT NOT NULL,
        description    TEXT,
        workflow_type  TEXT NOT NULL,
        purpose        TEXT,
        version        INTEGER NOT NULL,
        entry_criteria TEXT,
        exit_criteria  TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        archived_at    TEXT
      );

      CREATE TABLE resources (
        id            TEXT PRIMARY KEY,
        title         TEXT NOT NULL,
        description   TEXT,
        resource_type TEXT NOT NULL,
        unit          TEXT,
        behavior      TEXT,
        capacity      TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        archived_at   TEXT
      );

      CREATE TABLE records (
        id          TEXT PRIMARY KEY,
        title       TEXT,
        description TEXT NOT NULL,
        record_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        actor       TEXT,
        payload     TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        archived_at TEXT
      );

      -- Semantic core graph -------------------------------------------------

      CREATE TABLE relations (
        id            TEXT PRIMARY KEY,
        source_type   TEXT NOT NULL,
        source_id     TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        target_type   TEXT NOT NULL,
        target_id     TEXT NOT NULL,
        metadata      TEXT,
        created_at    TEXT NOT NULL,
        ended_at      TEXT
      );

      -- Classification ------------------------------------------------------

      CREATE TABLE labels (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE TABLE entity_labels (
        id          TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        label_id    TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        ended_at    TEXT
      );

      -- Workflow state machine templates ------------------------------------

      CREATE TABLE workflow_states (
        id             TEXT PRIMARY KEY,
        workflow_id    TEXT NOT NULL,
        entity_type    TEXT NOT NULL,
        label_id       TEXT NOT NULL,
        title          TEXT NOT NULL,
        description    TEXT,
        category       TEXT,
        sort_order     INTEGER,
        is_initial     INTEGER NOT NULL DEFAULT 0 CHECK (is_initial IN (0, 1)),
        is_terminal    INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0, 1)),
        entry_criteria TEXT,
        exit_criteria  TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        archived_at    TEXT
      );

      CREATE TABLE workflow_state_transitions (
        id                      TEXT PRIMARY KEY,
        workflow_id             TEXT NOT NULL,
        entity_type             TEXT NOT NULL,
        label_id                TEXT NOT NULL,
        from_state_id           TEXT NOT NULL,
        to_state_id             TEXT NOT NULL,
        title                   TEXT,
        description             TEXT,
        condition               TEXT,
        action                  TEXT,
        requires_exit_criteria  INTEGER NOT NULL DEFAULT 0
                                CHECK (requires_exit_criteria IN (0, 1)),
        created_at              TEXT NOT NULL,
        updated_at              TEXT NOT NULL,
        archived_at             TEXT
      );

      -- Project state machines ----------------------------------------------

      CREATE TABLE project_states (
        id                        TEXT PRIMARY KEY,
        project_id                TEXT NOT NULL,
        entity_type               TEXT NOT NULL,
        label_id                  TEXT NOT NULL,
        title                     TEXT NOT NULL,
        description               TEXT,
        category                  TEXT,
        sort_order                INTEGER,
        is_initial                INTEGER NOT NULL DEFAULT 0
                                  CHECK (is_initial IN (0, 1)),
        is_terminal               INTEGER NOT NULL DEFAULT 0
                                  CHECK (is_terminal IN (0, 1)),
        entry_criteria            TEXT,
        exit_criteria             TEXT,
        source_workflow_state_id  TEXT,
        created_at                TEXT NOT NULL,
        updated_at                TEXT NOT NULL,
        archived_at               TEXT
      );

      CREATE TABLE project_state_transitions (
        id                             TEXT PRIMARY KEY,
        project_id                     TEXT NOT NULL,
        entity_type                    TEXT NOT NULL,
        label_id                       TEXT NOT NULL,
        from_state_id                  TEXT NOT NULL,
        to_state_id                    TEXT NOT NULL,
        title                          TEXT,
        description                    TEXT,
        condition                      TEXT,
        action                         TEXT,
        requires_exit_criteria         INTEGER NOT NULL DEFAULT 0
                                       CHECK (requires_exit_criteria IN (0, 1)),
        source_workflow_transition_id  TEXT,
        created_at                     TEXT NOT NULL,
        updated_at                     TEXT NOT NULL,
        archived_at                    TEXT
      );

      -- Runtime state history ------------------------------------------------

      CREATE TABLE project_entity_states (
        id               TEXT PRIMARY KEY,
        project_id       TEXT NOT NULL,
        entity_type      TEXT NOT NULL,
        entity_id        TEXT NOT NULL,
        label_id         TEXT NOT NULL,
        project_state_id TEXT NOT NULL,
        entered_at       TEXT NOT NULL,
        ended_at         TEXT,
        created_at       TEXT NOT NULL
      );
    `);
  },
};
