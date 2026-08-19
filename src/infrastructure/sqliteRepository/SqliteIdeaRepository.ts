import { Idea, type IdeaStatus } from '../../domain/idea/Idea';
import type {
  IdeaFilter,
  IdeaRepository,
} from '../../domain/idea/repository/IdeaRepository';
import type { IdeaId } from '../../domain/shared/ids';
import { deleteLabelIds, loadLabelIds, replaceLabelIds } from './entityLabels';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface IdeaRow {
  id: string;
  content: string;
  status: IdeaStatus;
  archived: number;
  created_at: number;
  updated_at: number;
}

/** IdeaRepository persisted in SQLite; labels live in entity_labels. */
export class SqliteIdeaRepository implements IdeaRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(idea: Idea): Promise<void> {
    await this.db.run(
      `INSERT INTO ideas (id, content, status, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content = excluded.content,
         status = excluded.status,
         archived = excluded.archived,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      [
        idea.id,
        idea.content,
        idea.status,
        idea.archived ? 1 : 0,
        idea.createdAt.getTime(),
        idea.updatedAt.getTime(),
      ],
    );
    await replaceLabelIds(this.db, 'idea', idea.id, idea.labelIds);
  }

  async findById(id: IdeaId): Promise<Idea | null> {
    const row = await this.db.first<IdeaRow>('SELECT * FROM ideas WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: IdeaFilter): Promise<Idea[]> {
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
    if (filter?.labelId !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM entity_labels
         WHERE entity_type = 'idea' AND entity_id = ideas.id AND label_id = ?)`,
      );
      params.push(filter.labelId);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<IdeaRow>(`SELECT * FROM ideas${where}`, params);
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async delete(id: IdeaId): Promise<void> {
    await this.db.run('DELETE FROM ideas WHERE id = ?', [id]);
    await deleteLabelIds(this.db, 'idea', id);
  }

  private async hydrate(row: IdeaRow): Promise<Idea> {
    return Idea.restore({
      id: row.id,
      content: row.content,
      status: row.status,
      archived: row.archived === 1,
      labelIds: await loadLabelIds(this.db, 'idea', row.id),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
