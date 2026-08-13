import type { EntityId } from '../domain/ids';
import type { Task } from '../domain/task';
import { validateTask } from '../domain/task';
import type { SqliteDatabase } from './database';

/** Persistence and query boundary for independent Task definitions. */
export interface TaskRepository {
  add(task: Task): Promise<void>;
  getById(id: EntityId): Promise<Task | null>;
  /**
   * Active Tasks by default; set includeArchived for explicit history.
   * Results are ordered by creation time. When Tasks share a creation instant,
   * archived history precedes still-active work, then update time and id make
   * the order total and stable for pagination.
   */
  list(options?: TaskListOptions): Promise<Task[]>;
  save(task: Task): Promise<void>;
}

export interface TaskListOptions {
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  target_description: string;
  exit_criteria: string | null;
  priority: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toRow(task: Task): TaskRow {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    target_description: task.targetDescription,
    exit_criteria: task.exitCriteria,
    priority: task.priority,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    archived_at: task.archivedAt,
  };
}

function toDomain(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetDescription: row.target_description,
    exitCriteria: row.exit_criteria,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(task: Task): Promise<void> {
    validateTask(task);
    const row = toRow(task);
    await this.db.runAsync(
      `INSERT INTO tasks (
         id, title, description, target_description, exit_criteria, priority,
         created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.title, row.description, row.target_description, row.exit_criteria,
        row.priority, row.created_at, row.updated_at, row.archived_at],
    );
  }

  async getById(id: EntityId): Promise<Task | null> {
    const row = await this.db.getFirstAsync<TaskRow>(
      `SELECT id, title, description, target_description, exit_criteria, priority,
              created_at, updated_at, archived_at
       FROM tasks WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async list(options: TaskListOptions = {}): Promise<Task[]> {
    const includeArchived = options.includeArchived ?? false;
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    assertPagination(limit, offset);
    const rows = await this.db.getAllAsync<TaskRow>(
      `SELECT id, title, description, target_description, exit_criteria, priority,
              created_at, updated_at, archived_at
       FROM tasks
       WHERE (? = 1 OR archived_at IS NULL)
       ORDER BY created_at, archived_at IS NULL, updated_at, id
       LIMIT ? OFFSET ?`,
      [includeArchived ? 1 : 0, limit, offset],
    );
    return rows.map(toDomain);
  }

  async save(task: Task): Promise<void> {
    validateTask(task);
    const row = toRow(task);
    const result = await this.db.runAsync(
      `UPDATE tasks SET
         title = ?, description = ?, target_description = ?, exit_criteria = ?,
         priority = ?, created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [row.title, row.description, row.target_description, row.exit_criteria,
        row.priority, row.created_at, row.updated_at, row.archived_at, row.id],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Task ${task.id}`);
    }
  }
}

function assertPagination(limit: number, offset: number): void {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Task list limit must be a positive integer');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Task list offset must be a non-negative integer');
  }
}
