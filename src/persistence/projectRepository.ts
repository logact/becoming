import type { EntityId } from '../domain/ids';
import type { Project } from '../domain/project';
import { validateProject } from '../domain/project';
import type { SqliteDatabase } from './database';

/** Persistence and query boundary for intrinsic Project definitions. */
export interface ProjectRepository {
  add(project: Project): Promise<void>;
  /** Resolves both active and archived Projects for historical use. */
  getById(id: EntityId): Promise<Project | null>;
  /** Active Projects by default; historical queries opt in explicitly. */
  list(filter?: ProjectFilter): Promise<Project[]>;
  save(project: Project): Promise<void>;
}

export type ProjectStatusFilter = 'active' | 'archived' | 'all';

export interface ProjectFilter {
  status?: ProjectStatusFilter;
}

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  purpose: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toRow(project: Project): ProjectRow {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    purpose: project.purpose,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    archived_at: project.archivedAt,
  };
}

function toDomain(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    purpose: row.purpose,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(project: Project): Promise<void> {
    validateProject(project);
    const row = toRow(project);
    await this.db.runAsync(
      `INSERT INTO projects (
         id, title, description, purpose, created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.title, row.description, row.purpose, row.created_at,
        row.updated_at, row.archived_at],
    );
  }

  async getById(id: EntityId): Promise<Project | null> {
    const row = await this.db.getFirstAsync<ProjectRow>(
      `SELECT id, title, description, purpose, created_at, updated_at, archived_at
       FROM projects WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async list(filter: ProjectFilter = {}): Promise<Project[]> {
    const status = filter.status ?? 'active';
    const where = status === 'active'
      ? 'WHERE archived_at IS NULL'
      : status === 'archived'
        ? 'WHERE archived_at IS NOT NULL'
        : '';
    const rows = await this.db.getAllAsync<ProjectRow>(
      `SELECT id, title, description, purpose, created_at, updated_at, archived_at
       FROM projects ${where}
       ORDER BY created_at, archived_at IS NULL, updated_at, id`,
    );
    return rows.map(toDomain);
  }

  async save(project: Project): Promise<void> {
    validateProject(project);
    const row = toRow(project);
    const result = await this.db.runAsync(
      `UPDATE projects SET
         title = ?, description = ?, purpose = ?, created_at = ?,
         updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [row.title, row.description, row.purpose, row.created_at,
        row.updated_at, row.archived_at, row.id],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Project ${project.id}`);
    }
  }
}
