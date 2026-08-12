import { Decimal } from '../domain/decimal';
import type { EntityId } from '../domain/ids';
import type { Resource } from '../domain/resource';
import { validateResource } from '../domain/resource';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the Resource aggregate (the resource catalog).
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `resources` table has no foreign keys; the repository validates the
 * aggregate's catalog invariants on every write. References *to* a Resource
 * (budgets, allocations, consumption, constraints via relations and records)
 * are validated by the services that own those tables, against this
 * boundary.
 *
 * `capacity` is stored as the exact `Decimal` canonical string in a TEXT
 * column; it never passes through binary floating point in either direction.
 * `getById` resolves active and archived Resources alike so history that
 * references an archived Resource stays resolvable.
 */
export interface ResourceRepository {
  /** Insert a new Resource. Throws if the id already exists. */
  add(resource: Resource): Promise<void>;

  /** Return the Resource with this id (active or archived), or null. */
  getById(id: EntityId): Promise<Resource | null>;

  /** Persist changes to an existing Resource. Throws if the id is unknown. */
  save(resource: Resource): Promise<void>;
}

interface ResourceRow {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  unit: string | null;
  behavior: string | null;
  capacity: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toRow(resource: Resource): ResourceRow {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    resource_type: resource.resourceType,
    unit: resource.unit,
    behavior: resource.behavior,
    capacity: resource.capacity === null ? null : resource.capacity.toString(),
    created_at: resource.createdAt,
    updated_at: resource.updatedAt,
    archived_at: resource.archivedAt,
  };
}

function toDomain(row: ResourceRow): Resource {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    resourceType: row.resource_type,
    unit: row.unit,
    behavior: row.behavior,
    capacity: row.capacity === null ? null : Decimal.parse(row.capacity),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/** ResourceRepository over the SqliteDatabase port. */
export class SqliteResourceRepository implements ResourceRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(resource: Resource): Promise<void> {
    validateResource(resource);
    const row = toRow(resource);
    await this.db.runAsync(
      `INSERT INTO resources (
         id, title, description, resource_type, unit, behavior, capacity,
         created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.description,
        row.resource_type,
        row.unit,
        row.behavior,
        row.capacity,
        row.created_at,
        row.updated_at,
        row.archived_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Resource | null> {
    const row = await this.db.getFirstAsync<ResourceRow>(
      `SELECT id, title, description, resource_type, unit, behavior, capacity,
              created_at, updated_at, archived_at
       FROM resources WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(resource: Resource): Promise<void> {
    validateResource(resource);
    const row = toRow(resource);
    const result = await this.db.runAsync(
      `UPDATE resources SET
         title = ?, description = ?, resource_type = ?, unit = ?,
         behavior = ?, capacity = ?,
         created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [
        row.title,
        row.description,
        row.resource_type,
        row.unit,
        row.behavior,
        row.capacity,
        row.created_at,
        row.updated_at,
        row.archived_at,
        row.id,
      ],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Resource ${resource.id}`);
    }
  }
}
