import type { EntityId } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import type {
  WorkflowState,
  WorkflowStateMachine,
} from '../domain/workflowState';
import {
  normalizeWorkflowStateTitle,
  WorkflowStateInitialConflictError,
  WorkflowStateTitleConflictError,
  validateWorkflowState,
} from '../domain/workflowState';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the WorkflowState aggregate (reusable State
 * templates stored in `workflow_states`).
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `workflow_states` table has no foreign keys; the repository validates
 * the aggregate's own invariants on every write. The existence of the
 * referenced Workflow and Label is validated by the application service that
 * owns this boundary, never by the database.
 *
 * Machine queries are scoped by the exact machine identity
 * (`workflow_id + entity_type + label_id`) and are deterministically ordered:
 * ascending `sort_order` with NULLs last, ties broken by `created_at` then
 * `id`. `listActiveForMachine` returns only active templates, while
 * `listForMachine` returns the full machine history — active and archived —
 * so archived states stay resolvable in historical version queries.
 *
 * Machine-wide write invariants are part of the guarded INSERT/UPDATE
 * statements: active titles are unique after trim/lowercase normalization,
 * and at most one active initial state exists per machine. This keeps
 * competing create/update commands safe. Archiving also refuses to strand an
 * active transition row through a logical-reference check, not a foreign key.
 *
 * The repository also guards identity rules on `save`: machine identity and
 * creation identity never change, and an archived template is frozen — only
 * the transition from active to archived may move `archived_at`.
 */
export interface WorkflowStateRepository {
  /** Insert a new Workflow State. Throws if the id already exists. */
  add(state: WorkflowState): Promise<void>;

  /** Return the Workflow State with this id (active or archived), or null. */
  getById(id: EntityId): Promise<WorkflowState | null>;

  /** Persist changes to an existing Workflow State. Throws if the id is unknown. */
  save(state: WorkflowState): Promise<void>;

  /** Return the active initial state of one machine, or null. */
  findActiveInitialForMachine(
    machine: WorkflowStateMachine,
  ): Promise<WorkflowState | null>;

  /** Return an active state by normalized title in one machine, or null. */
  findActiveByTitle(
    machine: WorkflowStateMachine,
    title: string,
  ): Promise<WorkflowState | null>;

  /** Return all active terminal states of one machine in deterministic order. */
  listActiveTerminalsForMachine(
    machine: WorkflowStateMachine,
  ): Promise<WorkflowState[]>;

  /**
   * Assign sequential orders to precisely the supplied active states in one
   * atomic statement. The list must cover the machine's active set exactly.
   */
  reorderActiveForMachine(
    machine: WorkflowStateMachine,
    orderedStateIds: readonly EntityId[],
    updatedAt: string,
  ): Promise<void>;

  /**
   * Return the active State templates of exactly one machine, ordered by
   * `sort_order` (NULLs last), then `created_at`, then `id`.
   */
  listActiveForMachine(machine: WorkflowStateMachine): Promise<WorkflowState[]>;

  /**
   * Return every active template state belonging to a Workflow. The result is
   * grouped deterministically by machine identity and then by state order so
   * callers can take one coherent snapshot before initializing Project
   * machines.
   */
  listActiveForWorkflow(workflowId: EntityId): Promise<WorkflowState[]>;

  /**
   * Return the full template history of exactly one machine — active and
   * archived — with the same deterministic ordering as
   * `listActiveForMachine`.
   */
  listForMachine(machine: WorkflowStateMachine): Promise<WorkflowState[]>;
}

interface WorkflowStateRow {
  id: string;
  workflow_id: string;
  entity_type: string;
  label_id: string;
  title: string;
  description: string | null;
  category: string | null;
  sort_order: number | null;
  is_initial: number;
  is_terminal: number;
  entry_criteria: string | null;
  exit_criteria: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const COLUMNS = `id, workflow_id, entity_type, label_id, title, description,
       category, sort_order, is_initial, is_terminal,
       entry_criteria, exit_criteria, created_at, updated_at, archived_at`;

/** Deterministic machine ordering: sort_order (NULLs last), created_at, id. */
const MACHINE_ORDER = `ORDER BY sort_order IS NULL, sort_order, created_at, id`;

function toRow(state: WorkflowState): WorkflowStateRow {
  return {
    id: state.id,
    workflow_id: state.workflowId,
    entity_type: state.entityType,
    label_id: state.labelId,
    title: state.title,
    description: state.description,
    category: state.category,
    sort_order: state.sortOrder,
    is_initial: state.isInitial ? 1 : 0,
    is_terminal: state.isTerminal ? 1 : 0,
    entry_criteria: state.entryCriteria,
    exit_criteria: state.exitCriteria,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
    archived_at: state.archivedAt,
  };
}

function toDomain(row: WorkflowStateRow): WorkflowState {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    entityType: row.entity_type as CoreEntityType,
    labelId: row.label_id,
    title: row.title,
    description: row.description,
    category: row.category,
    sortOrder: row.sort_order,
    isInitial: row.is_initial === 1,
    isTerminal: row.is_terminal === 1,
    entryCriteria: row.entry_criteria,
    exitCriteria: row.exit_criteria,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function machineOf(state: WorkflowState): WorkflowStateMachine {
  return {
    workflowId: state.workflowId,
    entityType: state.entityType,
    labelId: state.labelId,
  };
}

/**
 * Guard the write rules a `save` must enforce given the stored row: machine
 * identity and creation identity never change, and an archived template is
 * frozen (its definition and timestamps may not move again).
 */
function assertWorkflowStateUpdateAllowed(
  stored: WorkflowState,
  next: WorkflowState,
): void {
  if (
    next.workflowId !== stored.workflowId ||
    next.entityType !== stored.entityType ||
    next.labelId !== stored.labelId ||
    next.createdAt !== stored.createdAt
  ) {
    throw new Error(
      `WorkflowState ${stored.id} machine identity and creation identity are immutable`,
    );
  }
  if (stored.archivedAt !== null) {
    const frozen =
      next.title !== stored.title ||
      next.description !== stored.description ||
      next.category !== stored.category ||
      next.sortOrder !== stored.sortOrder ||
      next.isInitial !== stored.isInitial ||
      next.isTerminal !== stored.isTerminal ||
      next.entryCriteria !== stored.entryCriteria ||
      next.exitCriteria !== stored.exitCriteria ||
      next.archivedAt !== stored.archivedAt;
    if (frozen) {
      throw new Error(
        `WorkflowState ${stored.id} is archived and its definition is immutable`,
      );
    }
  }
}

/** WorkflowStateRepository over the SqliteDatabase port. */
export class SqliteWorkflowStateRepository implements WorkflowStateRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(state: WorkflowState): Promise<void> {
    validateWorkflowState(state);
    const row = toRow(state);
    if (row.archived_at !== null) {
      await this.db.runAsync(
      `INSERT INTO workflow_states (${COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        this.rowValues(row),
      );
      return;
    }
    const result = await this.db.runAsync(
      `INSERT INTO workflow_states (${COLUMNS})
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM workflow_states
         WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
           AND archived_at IS NULL AND lower(trim(title)) = ?
       )
       AND NOT (
         ? = 1 AND EXISTS (
           SELECT 1 FROM workflow_states
           WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
             AND archived_at IS NULL AND is_initial = 1
         )
       )`,
      [
        ...this.rowValues(row),
        row.workflow_id, row.entity_type, row.label_id,
        normalizeWorkflowStateTitle(row.title),
        row.is_initial,
        row.workflow_id, row.entity_type, row.label_id,
      ],
    );
    if (result.changes === 0) await this.throwConflictReason(state);
  }

  async getById(id: EntityId): Promise<WorkflowState | null> {
    const row = await this.db.getFirstAsync<WorkflowStateRow>(
      `SELECT ${COLUMNS} FROM workflow_states WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(state: WorkflowState): Promise<void> {
    validateWorkflowState(state);
    const stored = await this.getById(state.id);
    if (stored === null) {
      throw new Error(`Cannot save unknown WorkflowState ${state.id}`);
    }
    assertWorkflowStateUpdateAllowed(stored, state);
    const row = toRow(state);
    const assignments = `UPDATE workflow_states SET
         workflow_id = ?, entity_type = ?, label_id = ?,
         title = ?, description = ?, category = ?, sort_order = ?,
         is_initial = ?, is_terminal = ?,
         entry_criteria = ?, exit_criteria = ?,
         created_at = ?, updated_at = ?, archived_at = ?`;
    if (row.archived_at !== null) {
      const result = await this.db.runAsync(
        `${assignments} WHERE id = ?
         AND NOT EXISTS (
           SELECT 1 FROM workflow_state_transitions
           WHERE archived_at IS NULL
             AND (from_state_id = ? OR to_state_id = ?)
         )`,
        [...this.updateValues(row), row.id, row.id, row.id],
      );
      if (result.changes === 0) {
        throw new WorkflowStateHasActiveTransitionReferencesError(state.id);
      }
      return;
    }
    const result = await this.db.runAsync(
      `${assignments}
       WHERE id = ?
         AND NOT EXISTS (
           SELECT 1 FROM workflow_states
           WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
             AND archived_at IS NULL AND id <> ?
             AND lower(trim(title)) = ?
         )
         AND NOT (
           ? = 1 AND EXISTS (
             SELECT 1 FROM workflow_states
             WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
               AND archived_at IS NULL AND is_initial = 1 AND id <> ?
           )
         )`,
      [
        ...this.updateValues(row), row.id,
        row.workflow_id, row.entity_type, row.label_id, row.id,
        normalizeWorkflowStateTitle(row.title), row.is_initial,
        row.workflow_id, row.entity_type, row.label_id, row.id,
      ],
    );
    if (result.changes === 0) await this.throwConflictReason(state);
  }

  async findActiveInitialForMachine(machine: WorkflowStateMachine): Promise<WorkflowState | null> {
    const row = await this.db.getFirstAsync<WorkflowStateRow>(
      `SELECT ${COLUMNS} FROM workflow_states
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL AND is_initial = 1`,
      [machine.workflowId, machine.entityType, machine.labelId],
    );
    return row === null ? null : toDomain(row);
  }

  async findActiveByTitle(machine: WorkflowStateMachine, title: string): Promise<WorkflowState | null> {
    const row = await this.db.getFirstAsync<WorkflowStateRow>(
      `SELECT ${COLUMNS} FROM workflow_states
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL AND lower(trim(title)) = ?`,
      [machine.workflowId, machine.entityType, machine.labelId, normalizeWorkflowStateTitle(title)],
    );
    return row === null ? null : toDomain(row);
  }

  async listActiveTerminalsForMachine(machine: WorkflowStateMachine): Promise<WorkflowState[]> {
    const rows = await this.db.getAllAsync<WorkflowStateRow>(
      `SELECT ${COLUMNS} FROM workflow_states
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL AND is_terminal = 1
       ${MACHINE_ORDER}`,
      [machine.workflowId, machine.entityType, machine.labelId],
    );
    return rows.map(toDomain);
  }

  async reorderActiveForMachine(
    machine: WorkflowStateMachine,
    orderedStateIds: readonly EntityId[],
    updatedAt: string,
  ): Promise<void> {
    if (orderedStateIds.length === 0) {
      const active = await this.listActiveForMachine(machine);
      if (active.length === 0) return;
      throw new Error('reorderActiveForMachine must list every active state exactly once');
    }
    const cases = orderedStateIds.map(() => 'WHEN ? THEN ?').join(' ');
    const placeholders = orderedStateIds.map(() => '?').join(', ');
    const result = await this.db.runAsync(
      `UPDATE workflow_states
       SET sort_order = CASE id ${cases} END, updated_at = ?
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL AND id IN (${placeholders})
         AND (SELECT COUNT(*) FROM workflow_states
              WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
                AND archived_at IS NULL) = ?
         AND (SELECT COUNT(*) FROM workflow_states
              WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
                AND archived_at IS NULL AND id IN (${placeholders})) = ?`,
      [
        ...orderedStateIds.flatMap((id, index) => [id, index + 1]),
        updatedAt,
        machine.workflowId, machine.entityType, machine.labelId,
        ...orderedStateIds,
        machine.workflowId, machine.entityType, machine.labelId,
        orderedStateIds.length,
        machine.workflowId, machine.entityType, machine.labelId,
        ...orderedStateIds,
        orderedStateIds.length,
      ],
    );
    if (result.changes !== orderedStateIds.length) {
      throw new Error('reorderActiveForMachine must list every active state of the machine exactly once');
    }
  }

  async listActiveForMachine(
    machine: WorkflowStateMachine,
  ): Promise<WorkflowState[]> {
    const rows = await this.db.getAllAsync<WorkflowStateRow>(
      `SELECT ${COLUMNS} FROM workflow_states
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL
       ${MACHINE_ORDER}`,
      [machine.workflowId, machine.entityType, machine.labelId],
    );
    return rows.map(toDomain);
  }

  async listActiveForWorkflow(workflowId: EntityId): Promise<WorkflowState[]> {
    const rows = await this.db.getAllAsync<WorkflowStateRow>(
      `SELECT ${COLUMNS} FROM workflow_states
       WHERE workflow_id = ? AND archived_at IS NULL
       ORDER BY entity_type, label_id, sort_order IS NULL, sort_order, created_at, id`,
      [workflowId],
    );
    return rows.map(toDomain);
  }

  async listForMachine(
    machine: WorkflowStateMachine,
  ): Promise<WorkflowState[]> {
    const rows = await this.db.getAllAsync<WorkflowStateRow>(
      `SELECT ${COLUMNS} FROM workflow_states
       WHERE workflow_id = ? AND entity_type = ? AND label_id = ?
       ${MACHINE_ORDER}`,
      [machine.workflowId, machine.entityType, machine.labelId],
    );
    return rows.map(toDomain);
  }

  private rowValues(row: WorkflowStateRow): (string | number | null)[] {
    return [row.id, row.workflow_id, row.entity_type, row.label_id, row.title,
      row.description, row.category, row.sort_order, row.is_initial,
      row.is_terminal, row.entry_criteria, row.exit_criteria, row.created_at,
      row.updated_at, row.archived_at];
  }

  private updateValues(row: WorkflowStateRow): (string | number | null)[] {
    return this.rowValues(row).slice(1);
  }

  private async throwConflictReason(state: WorkflowState): Promise<never> {
    const machine = machineOf(state);
    const titleClash = await this.findActiveByTitle(machine, state.title);
    if (titleClash !== null && titleClash.id !== state.id) {
      throw new WorkflowStateTitleConflictError(machine, state.title);
    }
    const initial = await this.findActiveInitialForMachine(machine);
    if (state.isInitial && initial !== null && initial.id !== state.id) {
      throw new WorkflowStateInitialConflictError(machine);
    }
    throw new Error(`WorkflowState ${state.id} conflicts with the invariants of machine ${machine.workflowId}/${machine.entityType}/${machine.labelId}`);
  }
}

/**
 * Raised when archiving would leave an active template transition pointing at
 * an archived state. This is a logical-reference safeguard, not a foreign
 * key, and remains deliberately narrow until #40 owns transitions fully.
 */
export class WorkflowStateHasActiveTransitionReferencesError extends Error {
  constructor(stateId: EntityId) {
    super(`WorkflowState ${stateId} has active transition references and cannot be archived`);
    this.name = 'WorkflowStateHasActiveTransitionReferencesError';
  }
}
