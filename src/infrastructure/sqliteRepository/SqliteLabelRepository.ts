import { Label } from '../../domain/label/Label';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { LabelId } from '../../domain/shared/ids';
import type { SqliteDatabase } from './SqliteDatabase';

interface LabelRow {
  id: string;
  name: string;
  color: string | null;
}

/** LabelRepository persisted in SQLite; entity membership lives in entity_labels. */
export class SqliteLabelRepository implements LabelRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async save(label: Label): Promise<void> {
    await this.db.run(
      `INSERT INTO labels (id, name, color)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         color = excluded.color`,
      [label.id, label.name, label.color ?? null],
    );
  }

  async findById(id: LabelId): Promise<Label | null> {
    const row = await this.db.first<LabelRow>('SELECT * FROM labels WHERE id = ?', [id]);
    return row === null ? null : this.hydrate(row);
  }

  async list(): Promise<Label[]> {
    const rows = await this.db.all<LabelRow>('SELECT * FROM labels ORDER BY name');
    return rows.map((row) => this.hydrate(row));
  }

  async delete(id: LabelId): Promise<void> {
    await this.db.run('DELETE FROM labels WHERE id = ?', [id]);
  }

  private hydrate(row: LabelRow): Label {
    return Label.create({
      id: row.id,
      name: row.name,
      ...(row.color === null ? {} : { color: row.color }),
    });
  }
}
