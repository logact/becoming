import type { SqliteDatabase } from './SqliteDatabase';

/** Model types whose labelIds are stored in the generic entity_labels table. */
export type LabeledEntityType = 'goal' | 'task' | 'idea' | 'project' | 'resource';

/**
 * Loads one entity's label ids from entity_labels. Order is deterministic
 * (sorted by label id) rather than insertion order.
 */
export async function loadLabelIds(
  db: SqliteDatabase,
  entityType: LabeledEntityType,
  entityId: string,
): Promise<string[]> {
  const rows = await db.all<{ label_id: string }>(
    'SELECT label_id FROM entity_labels WHERE entity_type = ? AND entity_id = ? ORDER BY label_id',
    [entityType, entityId],
  );
  return rows.map((row) => row.label_id);
}

/** Replaces all of an entity's label rows with the given ids. */
export async function replaceLabelIds(
  db: SqliteDatabase,
  entityType: LabeledEntityType,
  entityId: string,
  labelIds: string[],
): Promise<void> {
  await deleteLabelIds(db, entityType, entityId);
  for (const labelId of labelIds) {
    await db.run(
      'INSERT INTO entity_labels (entity_type, entity_id, label_id) VALUES (?, ?, ?)',
      [entityType, entityId, labelId],
    );
  }
}

/** Removes all of an entity's label rows. */
export async function deleteLabelIds(
  db: SqliteDatabase,
  entityType: LabeledEntityType,
  entityId: string,
): Promise<void> {
  await db.run('DELETE FROM entity_labels WHERE entity_type = ? AND entity_id = ?', [
    entityType,
    entityId,
  ]);
}
