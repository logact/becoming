import { createTestDatabase, listTables } from './helpers/testDatabase';
import { NodeSqliteDatabase } from '../src/persistence/sqlite/nodeSqliteDatabase';
import { migrate } from '../src/persistence/migrate';

const CORE_TABLES = [
  'entity_labels',
  'goals',
  'ideas',
  'labels',
  'philosophies',
  'project_entity_states',
  'project_state_transitions',
  'project_states',
  'projects',
  'records',
  'relations',
  'resources',
  'tasks',
  'workflow_state_transitions',
  'workflow_states',
  'workflows',
];

describe('migrations', () => {
  it('builds the complete 16-table V1 schema from an empty database', async () => {
    const db = new NodeSqliteDatabase(':memory:');
    const applied = await migrate(db);

    expect(applied).toEqual([1, 2, 3]);
    expect(await listTables(db)).toEqual(
      [...CORE_TABLES, 'schema_migrations'].sort(),
    );
    await db.closeAsync();
  });

  it('is idempotent: re-running applies nothing and preserves data', async () => {
    const db = await createTestDatabase();
    await db.runAsync(
      `INSERT INTO projects (id, title, created_at, updated_at)
       VALUES ('p-1', 'Life OS', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z')`,
    );

    const applied = await migrate(db);

    expect(applied).toEqual([]);
    const row = await db.getFirstAsync<{ title: string }>(
      'SELECT title FROM projects WHERE id = ?',
      ['p-1'],
    );
    expect(row?.title).toBe('Life OS');
    await db.closeAsync();
  });

  it('records each applied migration in schema_migrations', async () => {
    const db = await createTestDatabase();
    const rows = await db.getAllAsync<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations ORDER BY version',
    );
    expect(rows).toEqual([
      { version: 1, name: 'initial_schema' },
      { version: 2, name: 'workflow_version_lineage' },
      { version: 3, name: 'project_entity_state_current_invariant' },
    ]);
    await db.closeAsync();
  });

  it('creates key columns exactly as specified in the table definitions', async () => {
    const db = await createTestDatabase();

    const taskColumns = (
      await db.getAllAsync<{ name: string; notnull: number }>(
        `PRAGMA table_info(tasks)`,
      )
    ).map((c) => c.name);
    expect(taskColumns).toEqual([
      'id',
      'title',
      'description',
      'target_description',
      'exit_criteria',
      'priority',
      'created_at',
      'updated_at',
      'archived_at',
    ]);

    const workflowColumns = (
      await db.getAllAsync<{ name: string }>(`PRAGMA table_info(workflows)`)
    ).map((c) => c.name);
    expect(workflowColumns).toEqual([
      'id',
      'title',
      'description',
      'workflow_type',
      'purpose',
      'version',
      'entry_criteria',
      'exit_criteria',
      'created_at',
      'updated_at',
      'archived_at',
      'supersedes_id',
      'published_at',
    ]);

    const stateColumns = (
      await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(project_entity_states)`,
      )
    ).map((c) => c.name);
    expect(stateColumns).toEqual([
      'id',
      'project_id',
      'entity_type',
      'entity_id',
      'label_id',
      'project_state_id',
      'entered_at',
      'ended_at',
      'created_at',
    ]);
    await db.closeAsync();
  });
});
