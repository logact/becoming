/**
 * Migration upgrade-path tests: databases created by earlier dev builds must
 * migrate to the current schema without crashing or losing data.
 */
import { DashboardService } from '../../../application/dashboard/DashboardService';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { migrate } from '../schema';
import { SqliteAttentionEntryRepository } from '../SqliteAttentionEntryRepository';
import { SqliteGoalRepository } from '../SqliteGoalRepository';
import { SqliteIdeaRepository } from '../SqliteIdeaRepository';
import { SqliteProjectRepository } from '../SqliteProjectRepository';
import { SqliteRecordRepository } from '../SqliteRecordRepository';
import { SqliteRelationRepository } from '../SqliteRelationRepository';
import { SqliteResourceRepository } from '../SqliteResourceRepository';
import { SqliteTaskRepository } from '../SqliteTaskRepository';

/** The v1 schema as first shipped: tasks.goal_id, no goal hierarchy columns. */
const ORIGINAL_V1: string[] = [
  `CREATE TABLE goals (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, due INTEGER,
    status TEXT NOT NULL, archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE tasks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, due INTEGER,
    status TEXT NOT NULL, archived INTEGER NOT NULL, goal_id TEXT, project_id TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE ideas (
    id TEXT PRIMARY KEY, content TEXT NOT NULL, status TEXT NOT NULL,
    archived INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, goal_id TEXT NOT NULL, due INTEGER,
    status TEXT NOT NULL, archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE resources (
    id TEXT PRIMARY KEY, type_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
    amount REAL NOT NULL, archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE resource_allocations (
    id TEXT PRIMARY KEY, resource_id TEXT NOT NULL, project_id TEXT NOT NULL,
    amount REAL NOT NULL, span_start INTEGER, span_end INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE relations (
    id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
    target_type TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL,
    detail TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE records (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, detail TEXT, occurred_at INTEGER NOT NULL)`,
  `CREATE TABLE attention_entries (
    id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
    kind TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE entity_labels (
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label_id TEXT NOT NULL,
    PRIMARY KEY (entity_type, entity_id, label_id))`,
];

async function columnNames(db: NodeSqliteDatabase, table: string): Promise<string[]> {
  const rows = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
}

async function userVersion(db: NodeSqliteDatabase): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

describe('migrate upgrade paths', () => {
  it('upgrades an original-v1 database, keeping its data readable', async () => {
    const db = new NodeSqliteDatabase(':memory:');
    for (const ddl of ORIGINAL_V1) {
      await db.exec(ddl);
    }
    const now = Date.now();
    await db.run(
      `INSERT INTO goals (id, title, status, archived, created_at, updated_at)
       VALUES ('g1', 'Old goal', 'doing', 0, ?, ?)`,
      [now, now],
    );
    await db.run(
      `INSERT INTO tasks (id, title, status, archived, goal_id, project_id, created_at, updated_at)
       VALUES ('t1', 'Old task', 'doing', 0, 'g1', NULL, ?, ?)`,
      [now, now],
    );
    await db.exec('PRAGMA user_version = 1');

    await migrate(db);

    expect(await userVersion(db)).toBe(3);
    expect(await columnNames(db, 'goals')).toEqual(
      expect.arrayContaining(['project_id', 'parent_goal_id', 'milestone_id']),
    );
    // v2 dropped the original tasks.goal_id; v3 adds it back as an optional
    // sub-goal link, alongside milestone_id.
    expect(await columnNames(db, 'tasks')).toEqual(
      expect.arrayContaining(['goal_id', 'milestone_id']),
    );
    expect(await columnNames(db, 'milestones')).toEqual(
      expect.arrayContaining(['id', 'project_id', 'title', 'date', 'created_at', 'updated_at']),
    );
    expect(await columnNames(db, 'notes')).toEqual(
      expect.arrayContaining([
        'id', 'content', 'archived', 'pinned_at', 'created_at', 'updated_at',
      ]),
    );

    const dashboard = new DashboardService(
      new SqliteGoalRepository(db),
      new SqliteTaskRepository(db),
      new SqliteIdeaRepository(db),
      new SqliteProjectRepository(db),
      new SqliteResourceRepository(db),
      new SqliteRelationRepository(db),
      new SqliteRecordRepository(db),
      new SqliteAttentionEntryRepository(db),
    );
    const view = await dashboard.getDashboard(new Date());
    expect(view.doing.map((item) => item.id).sort()).toEqual(['g1', 't1']);
  });

  it('heals an intermediate dev database (new-shape tables stamped v1)', async () => {
    const db = new NodeSqliteDatabase(':memory:');
    // Tables already in the v2 shape but stamped user_version = 1 — the
    // state a dev device holds after running a mid-refactor build.
    await db.exec(
      `CREATE TABLE goals (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, due INTEGER,
        status TEXT NOT NULL, archived INTEGER NOT NULL,
        project_id TEXT, parent_goal_id TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    );
    await db.exec(
      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, due INTEGER,
        status TEXT NOT NULL, archived INTEGER NOT NULL, project_id TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    );
    await db.exec('PRAGMA user_version = 1');

    await expect(migrate(db)).resolves.toBeUndefined();
    expect(await userVersion(db)).toBe(3);
  });

  it('upgrades a v2 database, adding goal/milestone links and the milestones table', async () => {
    const db = new NodeSqliteDatabase(':memory:');
    await db.exec(
      `CREATE TABLE goals (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, due INTEGER,
        status TEXT NOT NULL, archived INTEGER NOT NULL,
        project_id TEXT, parent_goal_id TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    );
    await db.exec(
      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, due INTEGER,
        status TEXT NOT NULL, archived INTEGER NOT NULL, project_id TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    );
    const now = Date.now();
    await db.run(
      `INSERT INTO goals (id, title, status, archived, created_at, updated_at)
       VALUES ('g1', 'Goal', 'doing', 0, ?, ?)`,
      [now, now],
    );
    await db.exec('PRAGMA user_version = 2');

    await migrate(db);

    expect(await userVersion(db)).toBe(3);
    expect(await columnNames(db, 'goals')).toContain('milestone_id');
    expect(await columnNames(db, 'tasks')).toEqual(
      expect.arrayContaining(['goal_id', 'milestone_id']),
    );
    expect(await columnNames(db, 'milestones')).toEqual(
      expect.arrayContaining(['id', 'project_id', 'title', 'date', 'created_at', 'updated_at']),
    );
    // Existing rows survive and are readable through the repository.
    const goal = await new SqliteGoalRepository(db).findById('g1');
    expect(goal?.title).toBe('Goal');
    expect(goal?.milestoneId).toBeUndefined();
  });

  it('rebuilds a legacy table whose shape no migration covers', async () => {
    const db = new NodeSqliteDatabase(':memory:');
    // Legacy dev shape: a goals table without `status`, stamped v1. No
    // versioned migration can fix this; ensureTables rebuilds it empty.
    await db.exec(
      `CREATE TABLE goals (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, project_id TEXT,
        created_at INTEGER NOT NULL)`,
    );
    await db.run("INSERT INTO goals (id, title, created_at) VALUES ('g-old', 'legacy', 1)");
    await db.exec('PRAGMA user_version = 1');

    await migrate(db);

    expect(await userVersion(db)).toBe(3);
    expect(await columnNames(db, 'goals')).toEqual(
      expect.arrayContaining(['status', 'project_id', 'parent_goal_id']),
    );
    // The rebuilt table is empty and queryable through the repository.
    expect(await new SqliteGoalRepository(db).list()).toEqual([]);
  });

  it('rebuilds a pre-release notes table that is missing pinned_at', async () => {
    const db = new NodeSqliteDatabase(':memory:');
    await db.exec(
      `CREATE TABLE notes (
        id TEXT PRIMARY KEY, content TEXT NOT NULL, archived INTEGER NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    );
    await db.run(
      `INSERT INTO notes (id, content, archived, created_at, updated_at)
       VALUES ('n-old', 'legacy', 0, 1, 1)`,
    );
    await db.exec('PRAGMA user_version = 3');

    await migrate(db);

    expect(await columnNames(db, 'notes')).toEqual(
      ['id', 'content', 'archived', 'pinned_at', 'created_at', 'updated_at'],
    );
    expect(await db.all('SELECT * FROM notes')).toEqual([]);
  });
});
