import type { EntityId } from '../domain/ids';
import type { Label } from '../domain/label';
import { validateLabel } from '../domain/label';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the Label aggregate.
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `labels` table has no foreign keys and no name-uniqueness constraint;
 * the repository validates the aggregate's own invariants on every write and
 * enforces application-level name uniqueness among active Labels.
 *
 * Lookups are archive-safe: `getById` resolves active and archived Labels
 * alike so history that references an archived Label stays resolvable, while
 * `findActiveByName` ignores archived definitions. A name freed by archival
 * may be reused by a new Label without breaking id-based history.
 */
export interface LabelRepository {
  /** Insert a new Label. Throws if the id or an active name already exists. */
  add(label: Label): Promise<void>;

  /** Return the Label with this id (active or archived), or null. */
  getById(id: EntityId): Promise<Label | null>;

  /** Return the active Label with this exact name, or null. */
  findActiveByName(name: string): Promise<Label | null>;

  /** Persist changes to an existing Label. Throws if the id is unknown. */
  save(label: Label): Promise<void>;

  /**
   * List definitions in deterministic name, creation-time, id order. Active
   * discovery excludes archived definitions unless historical mode is named
   * explicitly. Offset pagination is deliberately deterministic and useful
   * for small on-device result sets.
   */
  list(options?: LabelListOptions): Promise<Label[]>;
}

export interface LabelListOptions {
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

interface LabelRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toRow(label: Label): LabelRow {
  return {
    id: label.id,
    name: label.name,
    description: label.description,
    created_at: label.createdAt,
    updated_at: label.updatedAt,
    archived_at: label.archivedAt,
  };
}

function toDomain(row: LabelRow): Label {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/** LabelRepository over the SqliteDatabase port. */
export class SqliteLabelRepository implements LabelRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(label: Label): Promise<void> {
    validateLabel(label);
    await this.assertActiveNameFree(label);
    const row = toRow(label);
    await this.db.runAsync(
      `INSERT INTO labels (id, name, description, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.description,
        row.created_at,
        row.updated_at,
        row.archived_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Label | null> {
    const row = await this.db.getFirstAsync<LabelRow>(
      `SELECT id, name, description, created_at, updated_at, archived_at
       FROM labels WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async findActiveByName(name: string): Promise<Label | null> {
    const row = await this.db.getFirstAsync<LabelRow>(
      `SELECT id, name, description, created_at, updated_at, archived_at
       FROM labels WHERE name = ? AND archived_at IS NULL`,
      [name],
    );
    return row === null ? null : toDomain(row);
  }

  async save(label: Label): Promise<void> {
    validateLabel(label);
    await this.assertActiveNameFree(label);
    const row = toRow(label);
    const result = await this.db.runAsync(
      `UPDATE labels SET
         name = ?, description = ?, created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [row.name, row.description, row.created_at, row.updated_at, row.archived_at, row.id],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Label ${label.id}`);
    }
  }

  async list(options: LabelListOptions = {}): Promise<Label[]> {
    const includeArchived = options.includeArchived ?? false;
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    assertPagination(limit, offset);
    const rows = await this.db.getAllAsync<LabelRow>(
      `SELECT id, name, description, created_at, updated_at, archived_at
       FROM labels
       WHERE (? = 1 OR archived_at IS NULL)
       ORDER BY name, created_at, id
       LIMIT ? OFFSET ?`,
      [includeArchived ? 1 : 0, limit, offset],
    );
    return rows.map(toDomain);
  }

  /**
   * Reject a name already held by a *different* active Label. Archived
   * Labels do not block reuse; their historical references stay keyed by id.
   */
  private async assertActiveNameFree(label: Label): Promise<void> {
    if (label.archivedAt !== null) {
      return;
    }
    const existing = await this.findActiveByName(label.name);
    if (existing !== null && existing.id !== label.id) {
      throw new Error(`An active Label named "${label.name}" already exists`);
    }
  }
}

function assertPagination(limit: number, offset: number): void {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Label list limit must be a positive integer');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Label list offset must be a non-negative integer');
  }
}
