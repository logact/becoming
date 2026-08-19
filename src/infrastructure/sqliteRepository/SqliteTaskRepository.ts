import { Task, type TaskStatus } from '../../domain/task/Task';
import type {
  TaskFilter,
  TaskRepository,
} from '../../domain/task/repository/TaskRepository';
import type { TaskId } from '../../domain/shared/ids';
import { deleteLabelIds, loadLabelIds, replaceLabelIds } from './entityLabels';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due: number | null;
  status: TaskStatus;
  archived: number;
  project_id: string;
  created_at: number;
  updated_at: number;
}

/** TaskRepository persisted in SQLite; labels live in entity_labels. */
export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(task: Task): Promise<void> {
    await this.db.run(
      `INSERT INTO tasks (id, title, description, due, status, archived, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         due = excluded.due,
         status = excluded.status,
         archived = excluded.archived,
         project_id = excluded.project_id,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      [
        task.id,
        task.title,
        task.description ?? null,
        task.due?.getTime() ?? null,
        task.status,
        task.archived ? 1 : 0,
        task.projectId,
        task.createdAt.getTime(),
        task.updatedAt.getTime(),
      ],
    );
    await replaceLabelIds(this.db, 'task', task.id, task.labelIds);
  }

  async findById(id: TaskId): Promise<Task | null> {
    const row = await this.db.first<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];
    if (filter?.status !== undefined) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.archived !== undefined) {
      conditions.push('archived = ?');
      params.push(filter.archived ? 1 : 0);
    }
    if (filter?.projectId !== undefined) {
      conditions.push('project_id = ?');
      params.push(filter.projectId);
    }
    if (filter?.labelId !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM entity_labels
         WHERE entity_type = 'task' AND entity_id = tasks.id AND label_id = ?)`,
      );
      params.push(filter.labelId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<TaskRow>(`SELECT * FROM tasks${where}`, params);
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async delete(id: TaskId): Promise<void> {
    await this.db.run('DELETE FROM tasks WHERE id = ?', [id]);
    await deleteLabelIds(this.db, 'task', id);
  }

  private async hydrate(row: TaskRow): Promise<Task> {
    return Task.restore({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      due: row.due === null ? undefined : new Date(row.due),
      status: row.status,
      archived: row.archived === 1,
      labelIds: await loadLabelIds(this.db, 'task', row.id),
      projectId: row.project_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
