import type { EntityId } from '../domain/ids';
import type { SqliteDatabase } from './database';

/**
 * Narrow logical-reference boundary used by Workflow State archival. #40
 * owns transition persistence; this port only exposes the safety query #38
 * requires, so it does not pre-empt that aggregate.
 */
export interface WorkflowStateTransitionReferenceRepository {
  hasActiveReferences(stateId: EntityId): Promise<boolean>;
}

/** SQLite implementation over transition-template rows. */
export class SqliteWorkflowStateTransitionReferenceRepository
  implements WorkflowStateTransitionReferenceRepository
{
  constructor(private readonly db: SqliteDatabase) {}

  async hasActiveReferences(stateId: EntityId): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ found: number }>(
      `SELECT 1 AS found FROM workflow_state_transitions
       WHERE archived_at IS NULL AND (from_state_id = ? OR to_state_id = ?)
       LIMIT 1`,
      [stateId, stateId],
    );
    return row !== null;
  }
}
