import { Project, type ProjectStatus } from '../../domain/project/Project';
import type {
  ProjectFilter,
  ProjectRepository,
} from '../../domain/project/repository/ProjectRepository';
import type { ProjectId } from '../../domain/shared/ids';
import { deleteLabelIds, loadLabelIds, replaceLabelIds } from './entityLabels';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface ProjectRow {
  id: string;
  name: string;
  goal_id: string;
  due: number | null;
  status: ProjectStatus;
  archived: number;
  created_at: number;
  updated_at: number;
}

/** ProjectRepository persisted in SQLite; labels live in entity_labels. */
export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(project: Project): Promise<void> {
    await this.db.run(
      `INSERT INTO projects (id, name, goal_id, due, status, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         goal_id = excluded.goal_id,
         due = excluded.due,
         status = excluded.status,
         archived = excluded.archived,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      [
        project.id,
        project.name,
        project.goalId,
        project.due?.getTime() ?? null,
        project.status,
        project.archived ? 1 : 0,
        project.createdAt.getTime(),
        project.updatedAt.getTime(),
      ],
    );
    await replaceLabelIds(this.db, 'project', project.id, project.labelIds);
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const row = await this.db.first<ProjectRow>('SELECT * FROM projects WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: ProjectFilter): Promise<Project[]> {
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
    if (filter?.goalId !== undefined) {
      conditions.push('goal_id = ?');
      params.push(filter.goalId);
    }
    if (filter?.labelId !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM entity_labels
         WHERE entity_type = 'project' AND entity_id = projects.id AND label_id = ?)`,
      );
      params.push(filter.labelId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<ProjectRow>(`SELECT * FROM projects${where}`, params);
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async delete(id: ProjectId): Promise<void> {
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);
    await deleteLabelIds(this.db, 'project', id);
  }

  private async hydrate(row: ProjectRow): Promise<Project> {
    return Project.restore({
      id: row.id,
      name: row.name,
      goalId: row.goal_id,
      due: row.due === null ? undefined : new Date(row.due),
      status: row.status,
      archived: row.archived === 1,
      labelIds: await loadLabelIds(this.db, 'project', row.id),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
