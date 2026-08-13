import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId } from '../domain/ids';
import type {
  WorkflowStateTransition,
  WorkflowStateTransitionMachine,
} from '../domain/workflowStateTransition';
import { validateWorkflowStateTransition } from '../domain/workflowStateTransition';
import type { SqliteDatabase } from './database';
import type { WorkflowStateTransitionReferenceRepository } from './workflowStateTransitionReferenceRepository';

/**
 * Persistence boundary for reusable Workflow State transition templates.
 * Endpoint existence and coherence are logical-reference concerns owned by
 * the application service; this repository never relies on database foreign
 * keys. Lists are stable by creation timestamp and id.
 */
export interface WorkflowStateTransitionRepository {
  add(transition: WorkflowStateTransition): Promise<void>;
  getById(id: EntityId): Promise<WorkflowStateTransition | null>;
  save(transition: WorkflowStateTransition): Promise<void>;
  listActiveForMachine(
    machine: WorkflowStateTransitionMachine,
  ): Promise<WorkflowStateTransition[]>;
  listForMachine(
    machine: WorkflowStateTransitionMachine,
  ): Promise<WorkflowStateTransition[]>;
  listActiveOutgoingForState(
    machine: WorkflowStateTransitionMachine,
    fromStateId: EntityId,
  ): Promise<WorkflowStateTransition[]>;
  listOutgoingForState(
    machine: WorkflowStateTransitionMachine,
    fromStateId: EntityId,
  ): Promise<WorkflowStateTransition[]>;
  listActiveIncomingForState(
    machine: WorkflowStateTransitionMachine,
    toStateId: EntityId,
  ): Promise<WorkflowStateTransition[]>;
  listIncomingForState(
    machine: WorkflowStateTransitionMachine,
    toStateId: EntityId,
  ): Promise<WorkflowStateTransition[]>;
  findActiveByEndpoints(
    machine: WorkflowStateTransitionMachine,
    fromStateId: EntityId,
    toStateId: EntityId,
  ): Promise<WorkflowStateTransition | null>;
}

interface WorkflowStateTransitionRow {
  id: string;
  workflow_id: string;
  entity_type: string;
  label_id: string;
  from_state_id: string;
  to_state_id: string;
  title: string | null;
  description: string | null;
  condition: string | null;
  action: string | null;
  requires_exit_criteria: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const COLUMNS = `id, workflow_id, entity_type, label_id, from_state_id,
  to_state_id, title, description, condition, action, requires_exit_criteria,
  created_at, updated_at, archived_at`;
const ORDER = 'ORDER BY created_at, id';

function toRow(
  transition: WorkflowStateTransition,
): WorkflowStateTransitionRow {
  return {
    id: transition.id,
    workflow_id: transition.workflowId,
    entity_type: transition.entityType,
    label_id: transition.labelId,
    from_state_id: transition.fromStateId,
    to_state_id: transition.toStateId,
    title: transition.title,
    description: transition.description,
    condition: transition.condition,
    action: transition.action,
    requires_exit_criteria: transition.requiresExitCriteria ? 1 : 0,
    created_at: transition.createdAt,
    updated_at: transition.updatedAt,
    archived_at: transition.archivedAt,
  };
}

function toDomain(
  row: WorkflowStateTransitionRow,
): WorkflowStateTransition {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    entityType: row.entity_type as CoreEntityType,
    labelId: row.label_id,
    fromStateId: row.from_state_id,
    toStateId: row.to_state_id,
    title: row.title,
    description: row.description,
    condition: row.condition,
    action: row.action,
    requiresExitCriteria: row.requires_exit_criteria === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function assertUpdateAllowed(
  stored: WorkflowStateTransition,
  next: WorkflowStateTransition,
): void {
  if (
    stored.workflowId !== next.workflowId ||
    stored.entityType !== next.entityType ||
    stored.labelId !== next.labelId ||
    stored.fromStateId !== next.fromStateId ||
    stored.toStateId !== next.toStateId ||
    stored.createdAt !== next.createdAt
  ) {
    throw new Error(
      `WorkflowStateTransition ${stored.id} machine, endpoint, and creation identity are immutable`,
    );
  }
  if (stored.archivedAt !== null && next.archivedAt !== null) {
    throw new Error(
      `WorkflowStateTransition ${stored.id} is archived and its definition is immutable`,
    );
  }
  if (stored.archivedAt !== null && (
    stored.title !== next.title ||
    stored.description !== next.description ||
    stored.condition !== next.condition ||
    stored.action !== next.action ||
    stored.requiresExitCriteria !== next.requiresExitCriteria
  )) {
    throw new Error(
      `WorkflowStateTransition ${stored.id} may only be reactivated without changing its definition`,
    );
  }
}

export class SqliteWorkflowStateTransitionRepository
  implements
    WorkflowStateTransitionRepository,
    WorkflowStateTransitionReferenceRepository
{
  constructor(private readonly db: SqliteDatabase) {}

  async add(transition: WorkflowStateTransition): Promise<void> {
    validateWorkflowStateTransition(transition);
    await this.db.runAsync(
      `INSERT INTO workflow_state_transitions (${COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.values(toRow(transition)),
    );
  }

  async getById(id: EntityId): Promise<WorkflowStateTransition | null> {
    const row = await this.db.getFirstAsync<WorkflowStateTransitionRow>(
      `SELECT ${COLUMNS} FROM workflow_state_transitions WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(transition: WorkflowStateTransition): Promise<void> {
    validateWorkflowStateTransition(transition);
    const stored = await this.getById(transition.id);
    if (stored === null) {
      throw new Error(`Cannot save unknown WorkflowStateTransition ${transition.id}`);
    }
    assertUpdateAllowed(stored, transition);
    const result = await this.db.runAsync(
      `UPDATE workflow_state_transitions SET
         workflow_id = ?, entity_type = ?, label_id = ?, from_state_id = ?,
         to_state_id = ?, title = ?, description = ?, condition = ?, action = ?,
         requires_exit_criteria = ?, created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [...this.values(toRow(transition)).slice(1), transition.id],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown WorkflowStateTransition ${transition.id}`);
    }
  }

  async hasActiveReferences(stateId: EntityId): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ found: number }>(
      `SELECT 1 AS found FROM workflow_state_transitions
       WHERE archived_at IS NULL AND (from_state_id = ? OR to_state_id = ?)
       LIMIT 1`,
      [stateId, stateId],
    );
    return row !== null;
  }

  async listActiveForMachine(machine: WorkflowStateTransitionMachine): Promise<WorkflowStateTransition[]> {
    return this.list(machine, 'archived_at IS NULL');
  }

  async listForMachine(machine: WorkflowStateTransitionMachine): Promise<WorkflowStateTransition[]> {
    return this.list(machine);
  }

  async listActiveOutgoingForState(machine: WorkflowStateTransitionMachine, fromStateId: EntityId): Promise<WorkflowStateTransition[]> {
    return this.list(machine, 'archived_at IS NULL AND from_state_id = ?', [fromStateId]);
  }

  async listOutgoingForState(machine: WorkflowStateTransitionMachine, fromStateId: EntityId): Promise<WorkflowStateTransition[]> {
    return this.list(machine, 'from_state_id = ?', [fromStateId]);
  }

  async listActiveIncomingForState(machine: WorkflowStateTransitionMachine, toStateId: EntityId): Promise<WorkflowStateTransition[]> {
    return this.list(machine, 'archived_at IS NULL AND to_state_id = ?', [toStateId]);
  }

  async listIncomingForState(machine: WorkflowStateTransitionMachine, toStateId: EntityId): Promise<WorkflowStateTransition[]> {
    return this.list(machine, 'to_state_id = ?', [toStateId]);
  }

  async findActiveByEndpoints(
    machine: WorkflowStateTransitionMachine,
    fromStateId: EntityId,
    toStateId: EntityId,
  ): Promise<WorkflowStateTransition | null> {
    const row = await this.db.getFirstAsync<WorkflowStateTransitionRow>(
      `SELECT ${COLUMNS} FROM workflow_state_transitions
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
         AND from_state_id = ? AND to_state_id = ? AND archived_at IS NULL
       LIMIT 1`,
      [machine.workflowId, machine.entityType, machine.labelId, fromStateId, toStateId],
    );
    return row === null ? null : toDomain(row);
  }

  private async list(
    machine: WorkflowStateTransitionMachine,
    predicate?: string,
    params: EntityId[] = [],
  ): Promise<WorkflowStateTransition[]> {
    const suffix = predicate === undefined ? '' : ` AND ${predicate}`;
    const rows = await this.db.getAllAsync<WorkflowStateTransitionRow>(
      `SELECT ${COLUMNS} FROM workflow_state_transitions
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?${suffix}
       ${ORDER}`,
      [machine.workflowId, machine.entityType, machine.labelId, ...params],
    );
    return rows.map(toDomain);
  }

  private values(row: WorkflowStateTransitionRow): (string | number | null)[] {
    return [row.id, row.workflow_id, row.entity_type, row.label_id,
      row.from_state_id, row.to_state_id, row.title, row.description,
      row.condition, row.action, row.requires_exit_criteria, row.created_at,
      row.updated_at, row.archived_at];
  }
}
