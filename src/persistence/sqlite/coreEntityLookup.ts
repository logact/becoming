import type { CoreEntityLookup } from '../../application/coreEntityLookup';
import type { CoreEntityType } from '../../domain/entityTypes';
import type { EntityId } from '../../domain/ids';
import type { SqliteDatabase } from '../database';

/**
 * SQLite adapter for logical core-entity existence checks. Every endpoint
 * keeps its own table; this fixed mapping is intentionally not an `entities`
 * table, FK, or polymorphic persistence model.
 */
const TABLE_BY_TYPE: Readonly<Record<CoreEntityType, string>> = {
  task: 'tasks',
  goal: 'goals',
  project: 'projects',
  idea: 'ideas',
  philosophy: 'philosophies',
  workflow: 'workflows',
  resource: 'resources',
  record: 'records',
};

export class SqliteCoreEntityLookup implements CoreEntityLookup {
  constructor(private readonly db: SqliteDatabase) {}

  async exists(entityType: CoreEntityType, id: EntityId): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM ${TABLE_BY_TYPE[entityType]} WHERE id = ?`,
      [id],
    );
    return row !== null;
  }
}
