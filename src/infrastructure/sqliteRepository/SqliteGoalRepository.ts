import { Goal, type GoalStatus } from '../../domain/goal/Goal';
import type {
  GoalFilter,
  GoalRepository,
} from '../../domain/goal/repository/GoalRepository';
import type { GoalId } from '../../domain/shared/ids';
import { deleteLabelIds, loadLabelIds, replaceLabelIds } from './entityLabels';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  due: number | null;
  status: GoalStatus;
  archived: number;
  project_id: string | null;
  parent_goal_id: string | null;
  milestone_id: string | null;
  created_at: number;
  updated_at: number;
}

/** GoalRepository persisted in SQLite; labels live in entity_labels. */
export class SqliteGoalRepository implements GoalRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(goal: Goal): Promise<void> {
    await this.db.run(
      `INSERT INTO goals (id, title, description, due, status, archived, project_id, parent_goal_id, milestone_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         due = excluded.due,
         status = excluded.status,
         archived = excluded.archived,
         project_id = excluded.project_id,
         parent_goal_id = excluded.parent_goal_id,
         milestone_id = excluded.milestone_id,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      [
        goal.id,
        goal.title,
        goal.description ?? null,
        goal.due?.getTime() ?? null,
        goal.status,
        goal.archived ? 1 : 0,
        goal.projectId ?? null,
        goal.parentGoalId ?? null,
        goal.milestoneId ?? null,
        goal.createdAt.getTime(),
        goal.updatedAt.getTime(),
      ],
    );
    await replaceLabelIds(this.db, 'goal', goal.id, goal.labelIds);
  }

  async findById(id: GoalId): Promise<Goal | null> {
    const row = await this.db.first<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: GoalFilter): Promise<Goal[]> {
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
    if (filter?.parentGoalId !== undefined) {
      conditions.push('parent_goal_id = ?');
      params.push(filter.parentGoalId);
    }
    if (filter?.labelId !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM entity_labels
         WHERE entity_type = 'goal' AND entity_id = goals.id AND label_id = ?)`,
      );
      params.push(filter.labelId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<GoalRow>(`SELECT * FROM goals${where}`, params);
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async delete(id: GoalId): Promise<void> {
    await this.db.run('DELETE FROM goals WHERE id = ?', [id]);
    await deleteLabelIds(this.db, 'goal', id);
  }

  private async hydrate(row: GoalRow): Promise<Goal> {
    return Goal.restore({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      due: row.due === null ? undefined : new Date(row.due),
      status: row.status,
      archived: row.archived === 1,
      labelIds: await loadLabelIds(this.db, 'goal', row.id),
      projectId: row.project_id ?? undefined,
      parentGoalId: row.parent_goal_id ?? undefined,
      milestoneId: row.milestone_id ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
