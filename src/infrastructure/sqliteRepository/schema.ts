import type { SqliteDatabase } from './SqliteDatabase';

/**
 * Schema conventions: dates are stored as epoch-ms INTEGER, booleans as 0/1
 * INTEGER, absent optionals as NULL. `records` is append-only. `entity_labels`
 * round-trips every labelable model's labelIds in one generic table.
 */
const MIGRATION_V1: string[] = [
  `CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due INTEGER,
    status TEXT NOT NULL,
    archived INTEGER NOT NULL,
    project_id TEXT,
    parent_goal_id TEXT,
    milestone_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due INTEGER,
    status TEXT NOT NULL,
    archived INTEGER NOT NULL,
    project_id TEXT NOT NULL,
    goal_id TEXT,
    milestone_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    archived INTEGER NOT NULL,
    pinned_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    due INTEGER,
    status TEXT NOT NULL,
    archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    date INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    type_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resource_allocations (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    amount REAL NOT NULL,
    span_start INTEGER,
    span_end INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    detail TEXT,
    occurred_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attention_entries (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS entity_labels (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (entity_type, entity_id, label_id)
  )`,
  `CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT
  )`,
];

/**
 * v2 reshapes the goal/task hierarchy: goals gain sub-goal membership
 * (project_id) and tree structure (parent_goal_id); tasks drop goal_id and
 * always belong to a project. Each step is applied only when the table's
 * actual columns require it: dev databases created mid-refactor can already
 * carry some of these columns at user_version = 1, and conditional steps let
 * them heal instead of crashing on duplicate or missing columns.
 */
interface ColumnStep {
  table: string;
  column: string;
  action: 'add' | 'drop';
  statement: string;
}

const MIGRATION_V2: ColumnStep[] = [
  {
    table: 'goals',
    column: 'project_id',
    action: 'add',
    statement: 'ALTER TABLE goals ADD COLUMN project_id TEXT',
  },
  {
    table: 'goals',
    column: 'parent_goal_id',
    action: 'add',
    statement: 'ALTER TABLE goals ADD COLUMN parent_goal_id TEXT',
  },
  {
    table: 'tasks',
    column: 'goal_id',
    action: 'drop',
    statement: 'ALTER TABLE tasks DROP COLUMN goal_id',
  },
];

/**
 * v3 brings back task.goal_id (now an optional link to a sub-goal of the
 * project) and introduces milestones: tasks and goals can each point at one.
 * The column steps stay conditional for the same heal-instead-of-crash
 * reason as v2; the milestones table is created with IF NOT EXISTS.
 */
const CREATE_MILESTONES = `CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

const MIGRATION_V3: ColumnStep[] = [
  {
    table: 'tasks',
    column: 'goal_id',
    action: 'add',
    statement: 'ALTER TABLE tasks ADD COLUMN goal_id TEXT',
  },
  {
    table: 'tasks',
    column: 'milestone_id',
    action: 'add',
    statement: 'ALTER TABLE tasks ADD COLUMN milestone_id TEXT',
  },
  {
    table: 'goals',
    column: 'milestone_id',
    action: 'add',
    statement: 'ALTER TABLE goals ADD COLUMN milestone_id TEXT',
  },
];

/** Live column names of a table, used to apply column steps conditionally. */
async function tableColumns(db: SqliteDatabase, table: string): Promise<Set<string>> {
  const rows = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => row.name));
}

async function applyColumnStep(db: SqliteDatabase, step: ColumnStep): Promise<void> {
  const columns = await tableColumns(db, step.table);
  // A missing table is ensureTables' job, not a column step's.
  if (columns.size === 0) {
    return;
  }
  if (step.action === 'add' && !columns.has(step.column)) {
    await db.exec(step.statement);
  }
  if (step.action === 'drop' && columns.has(step.column)) {
    await db.exec(step.statement);
  }
}

/**
 * Columns every table must have in the current schema (post-v3 shape). Keep
 * in sync with MIGRATION_V1, MIGRATION_V2 and MIGRATION_V3.
 */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  goals: [
    'id', 'title', 'description', 'due', 'status', 'archived',
    'project_id', 'parent_goal_id', 'milestone_id', 'created_at', 'updated_at',
  ],
  tasks: [
    'id', 'title', 'description', 'due', 'status', 'archived',
    'project_id', 'goal_id', 'milestone_id', 'created_at', 'updated_at',
  ],
  ideas: ['id', 'content', 'status', 'archived', 'created_at', 'updated_at'],
  notes: ['id', 'content', 'archived', 'pinned_at', 'created_at', 'updated_at'],
  projects: [
    'id', 'name', 'goal_id', 'due', 'status', 'archived', 'created_at', 'updated_at',
  ],
  milestones: ['id', 'project_id', 'title', 'date', 'created_at', 'updated_at'],
  resources: [
    'id', 'type_id', 'kind', 'name', 'amount', 'archived', 'created_at', 'updated_at',
  ],
  resource_allocations: [
    'id', 'resource_id', 'project_id', 'amount', 'span_start', 'span_end',
    'created_at', 'updated_at',
  ],
  relations: [
    'id', 'source_type', 'source_id', 'target_type', 'target_id', 'kind', 'detail',
    'created_at',
  ],
  records: ['id', 'kind', 'detail', 'occurred_at'],
  attention_entries: ['id', 'target_type', 'target_id', 'kind', 'created_at'],
  entity_labels: ['entity_type', 'entity_id', 'label_id'],
  labels: ['id', 'name', 'color'],
};

/**
 * Creates missing tables and rebuilds incompatible ones. Pre-release safety
 * net: a table that exists but lacks columns the current schema requires
 * comes from a legacy/dev build no migration covers; it is dropped and
 * recreated empty rather than failing every query. Replace with real data
 * migrations once the app carries user data.
 */
async function ensureTables(db: SqliteDatabase): Promise<void> {
  for (const ddl of MIGRATION_V1) {
    const table = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(ddl)?.[1];
    if (table === undefined) {
      continue;
    }
    const actual = await tableColumns(db, table);
    if (actual.size === 0) {
      await db.exec(ddl);
      continue;
    }
    const missing = (EXPECTED_COLUMNS[table] ?? []).filter((column) => !actual.has(column));
    if (missing.length > 0) {
      console.warn(
        `Rebuilding incompatible table "${table}" (missing columns: ${missing.join(', ')})`,
      );
      await db.exec(`DROP TABLE IF EXISTS ${table}`);
      await db.exec(ddl);
    }
  }
}

/**
 * Brings the database schema up to date. Migrations are keyed on
 * `PRAGMA user_version`; v2 reshapes the goal/project/task hierarchy of
 * original-v1 databases, v3 adds the goal/milestone links and the milestones
 * table, and ensureTables creates or rebuilds whatever is still not in the
 * current shape.
 */
export async function migrate(db: SqliteDatabase): Promise<void> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  // Only databases that already existed at v1 need the reshape; a fresh
  // database gets the new shape from ensureTables below.
  if (version >= 1 && version < 2) {
    for (const step of MIGRATION_V2) {
      await applyColumnStep(db, step);
    }
  }
  // v1 databases upgraded above also need the v3 additions; fresh databases
  // get them from ensureTables below.
  if (version >= 1 && version < 3) {
    for (const step of MIGRATION_V3) {
      await applyColumnStep(db, step);
    }
    await db.exec(CREATE_MILESTONES);
  }
  await ensureTables(db);
  await db.exec('PRAGMA user_version = 3');
}
