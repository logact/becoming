import { Milestone } from '../../domain/milestone/Milestone';
import type {
  MilestoneFilter,
  MilestoneRepository,
} from '../../domain/milestone/repository/MilestoneRepository';
import type { MilestoneId } from '../../domain/shared/ids';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  date: number;
  created_at: number;
  updated_at: number;
}

/** MilestoneRepository persisted in SQLite. */
export class SqliteMilestoneRepository implements MilestoneRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(milestone: Milestone): Promise<void> {
    await this.db.run(
      `INSERT INTO milestones (id, project_id, title, date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         title = excluded.title,
         date = excluded.date,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      [
        milestone.id,
        milestone.projectId,
        milestone.title,
        milestone.date.getTime(),
        milestone.createdAt.getTime(),
        milestone.updatedAt.getTime(),
      ],
    );
  }

  async findById(id: MilestoneId): Promise<Milestone | null> {
    const row = await this.db.first<MilestoneRow>(
      'SELECT * FROM milestones WHERE id = ?',
      [id],
    );
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: MilestoneFilter): Promise<Milestone[]> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];
    if (filter?.projectId !== undefined) {
      conditions.push('project_id = ?');
      params.push(filter.projectId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<MilestoneRow>(`SELECT * FROM milestones${where}`, params);
    return rows.map((row) => this.hydrate(row));
  }

  async delete(id: MilestoneId): Promise<void> {
    await this.db.run('DELETE FROM milestones WHERE id = ?', [id]);
  }

  private hydrate(row: MilestoneRow): Milestone {
    return Milestone.restore({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      date: new Date(row.date),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
