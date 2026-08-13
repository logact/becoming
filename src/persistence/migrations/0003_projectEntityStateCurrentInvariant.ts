import type { Migration } from './migration';

/** One current runtime period per Project/entity/Label context. */
export const projectEntityStateCurrentInvariant: Migration = {
  version: 3,
  name: 'project_entity_state_current_invariant',
  async up(db) {
    await db.execAsync(`
      CREATE UNIQUE INDEX project_entity_states_one_current_context
      ON project_entity_states (project_id, entity_type, entity_id, label_id)
      WHERE ended_at IS NULL;
    `);
  },
};
