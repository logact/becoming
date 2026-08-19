import { Resource } from '../../domain/resource/Resource';
import { ResourceAllocation, type TimeSpan } from '../../domain/resource/ResourceAllocation';
import type {
  ResourceFilter,
  ResourceRepository,
} from '../../domain/resource/repository/ResourceRepository';
import type { ResourceTypeKind } from '../../domain/resource/ResourceType';
import type { ResourceId } from '../../domain/shared/ids';
import { deleteLabelIds, loadLabelIds, replaceLabelIds } from './entityLabels';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface ResourceRow {
  id: string;
  type_id: string;
  kind: ResourceTypeKind;
  name: string;
  amount: number;
  archived: number;
  created_at: number;
  updated_at: number;
}

interface AllocationRow {
  id: string;
  resource_id: string;
  project_id: string;
  amount: number;
  span_start: number | null;
  span_end: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * ResourceRepository persisted in SQLite. A resource's allocations are stored
 * in resource_allocations and fully replaced on each save; labels live in
 * entity_labels.
 */
export class SqliteResourceRepository implements ResourceRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(resource: Resource): Promise<void> {
    await this.db.run(
      `INSERT INTO resources (id, type_id, kind, name, amount, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type_id = excluded.type_id,
         kind = excluded.kind,
         name = excluded.name,
         amount = excluded.amount,
         archived = excluded.archived,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      [
        resource.id,
        resource.typeId,
        resource.kind,
        resource.name,
        resource.amount,
        resource.archived ? 1 : 0,
        resource.createdAt.getTime(),
        resource.updatedAt.getTime(),
      ],
    );
    await this.db.run('DELETE FROM resource_allocations WHERE resource_id = ?', [resource.id]);
    for (const allocation of resource.allocations) {
      await this.db.run(
        `INSERT INTO resource_allocations
           (id, resource_id, project_id, amount, span_start, span_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          allocation.id,
          resource.id,
          allocation.projectId,
          allocation.amount,
          allocation.span?.startAt.getTime() ?? null,
          allocation.span?.endAt.getTime() ?? null,
          allocation.createdAt.getTime(),
          allocation.updatedAt.getTime(),
        ],
      );
    }
    await replaceLabelIds(this.db, 'resource', resource.id, resource.labelIds);
  }

  async findById(id: ResourceId): Promise<Resource | null> {
    const row = await this.db.first<ResourceRow>('SELECT * FROM resources WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: ResourceFilter): Promise<Resource[]> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];
    if (filter?.typeId !== undefined) {
      conditions.push('type_id = ?');
      params.push(filter.typeId);
    }
    if (filter?.kind !== undefined) {
      conditions.push('kind = ?');
      params.push(filter.kind);
    }
    if (filter?.archived !== undefined) {
      conditions.push('archived = ?');
      params.push(filter.archived ? 1 : 0);
    }
    if (filter?.projectId !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM resource_allocations
         WHERE resource_id = resources.id AND project_id = ?)`,
      );
      params.push(filter.projectId);
    }
    if (filter?.labelId !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM entity_labels
         WHERE entity_type = 'resource' AND entity_id = resources.id AND label_id = ?)`,
      );
      params.push(filter.labelId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<ResourceRow>(`SELECT * FROM resources${where}`, params);
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async delete(id: ResourceId): Promise<void> {
    await this.db.run('DELETE FROM resources WHERE id = ?', [id]);
    await this.db.run('DELETE FROM resource_allocations WHERE resource_id = ?', [id]);
    await deleteLabelIds(this.db, 'resource', id);
  }

  private async hydrate(row: ResourceRow): Promise<Resource> {
    const allocationRows = await this.db.all<AllocationRow>(
      'SELECT * FROM resource_allocations WHERE resource_id = ? ORDER BY created_at, id',
      [row.id],
    );
    return Resource.restore({
      id: row.id,
      typeId: row.type_id,
      kind: row.kind,
      name: row.name,
      amount: row.amount,
      allocations: allocationRows.map((allocationRow) => this.hydrateAllocation(allocationRow)),
      archived: row.archived === 1,
      labelIds: await loadLabelIds(this.db, 'resource', row.id),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private hydrateAllocation(row: AllocationRow): ResourceAllocation {
    const span: TimeSpan | undefined =
      row.span_start !== null && row.span_end !== null
        ? { startAt: new Date(row.span_start), endAt: new Date(row.span_end) }
        : undefined;
    return ResourceAllocation.restore({
      id: row.id,
      projectId: row.project_id,
      amount: row.amount,
      span,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
