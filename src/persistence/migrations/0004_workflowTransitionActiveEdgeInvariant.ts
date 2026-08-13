import type { Migration } from './migration';

/**
 * V1 permits self-transitions, but normalizes each machine/source/destination
 * pair to at most one active edge. A partial unique index keeps that rule safe
 * when independent requests race, while preserving archived edge history.
 */
export const workflowTransitionActiveEdgeInvariant: Migration = {
  version: 4,
  name: 'workflow_transition_active_edge_invariant',
  async up(db) {
    await db.execAsync(`
      CREATE UNIQUE INDEX workflow_state_transitions_one_active_edge
      ON workflow_state_transitions (
        workflow_id, entity_type, label_id, from_state_id, to_state_id
      )
      WHERE archived_at IS NULL;
    `);
  },
};
