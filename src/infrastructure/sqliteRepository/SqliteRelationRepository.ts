import { Relation, type RelationEndType } from '../../domain/relation/Relation';
import type {
  RelationFilter,
  RelationRepository,
} from '../../domain/relation/repository/RelationRepository';
import type { RelationId } from '../../domain/shared/ids';
import type { SqliteDatabase, SqlValue } from './SqliteDatabase';

interface RelationRow {
  id: string;
  source_type: RelationEndType;
  source_id: string;
  target_type: RelationEndType;
  target_id: string;
  kind: string;
  detail: string | null;
  created_at: number;
}

/** RelationRepository persisted in SQLite. */
export class SqliteRelationRepository implements RelationRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(relation: Relation): Promise<void> {
    await this.db.run(
      `INSERT INTO relations
         (id, source_type, source_id, target_type, target_id, kind, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source_type = excluded.source_type,
         source_id = excluded.source_id,
         target_type = excluded.target_type,
         target_id = excluded.target_id,
         kind = excluded.kind,
         detail = excluded.detail,
         created_at = excluded.created_at`,
      [
        relation.id,
        relation.sourceType,
        relation.sourceId,
        relation.targetType,
        relation.targetId,
        relation.kind,
        relation.detail ?? null,
        relation.createdAt.getTime(),
      ],
    );
  }

  async findById(id: RelationId): Promise<Relation | null> {
    const row = await this.db.first<RelationRow>('SELECT * FROM relations WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(filter?: RelationFilter): Promise<Relation[]> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];
    if (filter?.sourceType !== undefined) {
      conditions.push('source_type = ?');
      params.push(filter.sourceType);
    }
    if (filter?.sourceId !== undefined) {
      conditions.push('source_id = ?');
      params.push(filter.sourceId);
    }
    if (filter?.targetType !== undefined) {
      conditions.push('target_type = ?');
      params.push(filter.targetType);
    }
    if (filter?.targetId !== undefined) {
      conditions.push('target_id = ?');
      params.push(filter.targetId);
    }
    if (filter?.kind !== undefined) {
      conditions.push('kind = ?');
      params.push(filter.kind);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all<RelationRow>(`SELECT * FROM relations${where}`, params);
    return rows.map((row) => this.hydrate(row));
  }

  async delete(id: RelationId): Promise<void> {
    await this.db.run('DELETE FROM relations WHERE id = ?', [id]);
  }

  private hydrate(row: RelationRow): Relation {
    return Relation.restore({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      targetType: row.target_type,
      targetId: row.target_id,
      kind: row.kind,
      detail: row.detail ?? undefined,
      createdAt: new Date(row.created_at),
    });
  }
}
