import type { EntityId } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import {
  normalizeProjectStateTitle,
  ProjectStateInitialConflictError,
  ProjectStateTitleConflictError,
  validateProjectState,
} from '../domain/projectState';
import type {
  ProjectState,
  ProjectStateMachine,
} from '../domain/projectState';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the ProjectState aggregate (States actually used
 * within one Project, stored in `project_states`).
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `project_states` table has no foreign keys; the repository validates
 * the aggregate's own invariants on every write. The existence of the
 * referenced Project and Label is validated by the application service that
 * owns this boundary, never by the database. `source_workflow_state_id` is
 * provenance only: it is stored and returned but never validated against, or
 * written back to, the Workflow templates.
 *
 * Two machine-level invariants are enforced on every write of an active
 * state, in the same atomic statement as the write itself so concurrent
 * commands cannot slip past them:
 * - normalized title uniqueness among the machine's active states
 *   (`normalizeProjectStateTitle`: trimmed, case-insensitive), and
 * - at most one active initial state per machine.
 * Archived states do not participate in either rule, so archiving frees the
 * title and the initial flag for reuse.
 *
 * Machine queries are scoped by the exact machine identity
 * (`project_id + entity_type + label_id`) and are deterministically ordered:
 * ascending `sort_order` with NULLs last, ties broken by `created_at` then
 * `id`. `listActiveForMachine` returns only active states, while
 * `listForMachine` returns the full machine history — active and archived —
 * so archived states stay resolvable in historical queries.
 *
 * The repository also guards write rules on `save`: machine identity,
 * creation identity, and the source provenance id never change, and an
 * archived state is frozen — only the transition from active to archived may
 * move `archived_at`.
 */
export interface ProjectStateRepository {
  /**
   * Insert a new Project State. Throws if the id already exists, or — for an
   * active state — with `ProjectStateTitleConflictError` when the machine
   * already has an active state with the same normalized title, or
   * `ProjectStateInitialConflictError` when it already has an active initial
   * state.
   */
  add(state: ProjectState): Promise<void>;

  /** Return the Project State with this id (active or archived), or null. */
  getById(id: EntityId): Promise<ProjectState | null>;

  /**
   * Persist changes to an existing Project State. Throws if the id is
   * unknown, and enforces the same machine invariants as `add` when the
   * resulting state is active.
   */
  save(state: ProjectState): Promise<void>;

  /**
   * Return the currently active initial state of exactly one machine, or
   * null.
   */
  findActiveInitialForMachine(
    machine: ProjectStateMachine,
  ): Promise<ProjectState | null>;

  /**
   * Return the currently active state of exactly one machine whose
   * normalized title equals `title` (trimmed, case-insensitive), or null.
   */
  findActiveByTitle(
    machine: ProjectStateMachine,
    title: string,
  ): Promise<ProjectState | null>;

  /**
   * Return the active States of exactly one machine, ordered by
   * `sort_order` (NULLs last), then `created_at`, then `id`.
   */
  listActiveForMachine(machine: ProjectStateMachine): Promise<ProjectState[]>;

  /**
   * Return the full history of exactly one machine — active and archived —
   * with the same deterministic ordering as `listActiveForMachine`.
   */
  listForMachine(machine: ProjectStateMachine): Promise<ProjectState[]>;
}

interface ProjectStateRow {
  id: string;
  project_id: string;
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
  source_workflow_state_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const COLUMNS = `id, project_id, entity_type, label_id, title, description,
       category, sort_order, is_initial, is_terminal,
       entry_criteria, exit_criteria, source_workflow_state_id,
       created_at, updated_at, archived_at`;

/** Deterministic machine ordering: sort_order (NULLs last), created_at, id. */
const MACHINE_ORDER = `ORDER BY sort_order IS NULL, sort_order, created_at, id`;

function toRow(state: ProjectState): ProjectStateRow {
  return {
    id: state.id,
    project_id: state.projectId,
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
    source_workflow_state_id: state.sourceWorkflowStateId,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
    archived_at: state.archivedAt,
  };
}

function toDomain(row: ProjectStateRow): ProjectState {
  return {
    id: row.id,
    projectId: row.project_id,
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
    sourceWorkflowStateId: row.source_workflow_state_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function machineOf(state: ProjectState): ProjectStateMachine {
  return {
    projectId: state.projectId,
    entityType: state.entityType,
    labelId: state.labelId,
  };
}

/**
 * Guard the write rules a `save` must enforce given the stored row: machine
 * identity, creation identity, and source provenance never change, and an
 * archived state is frozen (its definition and timestamps may not move
 * again).
 */
function assertProjectStateUpdateAllowed(
  stored: ProjectState,
  next: ProjectState,
): void {
  if (
    next.projectId !== stored.projectId ||
    next.entityType !== stored.entityType ||
    next.labelId !== stored.labelId ||
    next.sourceWorkflowStateId !== stored.sourceWorkflowStateId ||
    next.createdAt !== stored.createdAt
  ) {
    throw new Error(
      `ProjectState ${stored.id} machine identity, creation identity, and source provenance are immutable`,
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
        `ProjectState ${stored.id} is archived and its definition is immutable`,
      );
    }
  }
}

/** ProjectStateRepository over the SqliteDatabase port. */
export class SqliteProjectStateRepository implements ProjectStateRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(state: ProjectState): Promise<void> {
    validateProjectState(state);
    const row = toRow(state);
    if (row.archived_at !== null) {
      // An already archived row cannot violate the active-state invariants.
      await this.db.runAsync(
        `INSERT INTO project_states (${COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        this.rowValues(row),
      );
      return;
    }
    // The invariant guards ride in the same statement as the INSERT, so the
    // check and the write are atomic even against concurrent commands.
    const result = await this.db.runAsync(
      `INSERT INTO project_states (${COLUMNS})
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM project_states
         WHERE project_id = ? AND entity_type = ? AND label_id = ?
           AND archived_at IS NULL
           AND lower(trim(title)) = ?
       )
       AND NOT (
         ? = 1 AND EXISTS (
           SELECT 1 FROM project_states
           WHERE project_id = ? AND entity_type = ? AND label_id = ?
             AND archived_at IS NULL AND is_initial = 1
         )
       )`,
      [
        ...this.rowValues(row),
        row.project_id,
        row.entity_type,
        row.label_id,
        normalizeProjectStateTitle(row.title),
        row.is_initial,
        row.project_id,
        row.entity_type,
        row.label_id,
      ],
    );
    if (result.changes === 0) {
      await this.throwConflictReason(state);
    }
  }

  async getById(id: EntityId): Promise<ProjectState | null> {
    const row = await this.db.getFirstAsync<ProjectStateRow>(
      `SELECT ${COLUMNS} FROM project_states WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(state: ProjectState): Promise<void> {
    validateProjectState(state);
    const stored = await this.getById(state.id);
    if (stored === null) {
      throw new Error(`Cannot save unknown ProjectState ${state.id}`);
    }
    assertProjectStateUpdateAllowed(stored, state);
    const row = toRow(state);
    const assignments = `UPDATE project_states SET
         project_id = ?, entity_type = ?, label_id = ?,
         title = ?, description = ?, category = ?, sort_order = ?,
         is_initial = ?, is_terminal = ?,
         entry_criteria = ?, exit_criteria = ?, source_workflow_state_id = ?,
         created_at = ?, updated_at = ?, archived_at = ?`;
    if (row.archived_at !== null) {
      // Archiving (or re-saving an archived row unchanged) cannot violate
      // the active-state invariants.
      await this.db.runAsync(`${assignments} WHERE id = ?`, [
        ...this.updateValues(row),
        row.id,
      ]);
      return;
    }
    const result = await this.db.runAsync(
      `${assignments}
       WHERE id = ?
         AND NOT EXISTS (
           SELECT 1 FROM project_states
           WHERE project_id = ? AND entity_type = ? AND label_id = ?
             AND archived_at IS NULL AND id <> ?
             AND lower(trim(title)) = ?
         )
         AND NOT (
           ? = 1 AND EXISTS (
             SELECT 1 FROM project_states
             WHERE project_id = ? AND entity_type = ? AND label_id = ?
               AND archived_at IS NULL AND is_initial = 1 AND id <> ?
           )
         )`,
      [
        ...this.updateValues(row),
        row.id,
        row.project_id,
        row.entity_type,
        row.label_id,
        row.id,
        normalizeProjectStateTitle(row.title),
        row.is_initial,
        row.project_id,
        row.entity_type,
        row.label_id,
        row.id,
      ],
    );
    if (result.changes === 0) {
      await this.throwConflictReason(state);
    }
  }

  async findActiveInitialForMachine(
    machine: ProjectStateMachine,
  ): Promise<ProjectState | null> {
    const row = await this.db.getFirstAsync<ProjectStateRow>(
      `SELECT ${COLUMNS} FROM project_states
       WHERE project_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL AND is_initial = 1`,
      [machine.projectId, machine.entityType, machine.labelId],
    );
    return row === null ? null : toDomain(row);
  }

  async findActiveByTitle(
    machine: ProjectStateMachine,
    title: string,
  ): Promise<ProjectState | null> {
    const row = await this.db.getFirstAsync<ProjectStateRow>(
      `SELECT ${COLUMNS} FROM project_states
       WHERE project_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL
         AND lower(trim(title)) = ?`,
      [
        machine.projectId,
        machine.entityType,
        machine.labelId,
        normalizeProjectStateTitle(title),
      ],
    );
    return row === null ? null : toDomain(row);
  }

  async listActiveForMachine(
    machine: ProjectStateMachine,
  ): Promise<ProjectState[]> {
    const rows = await this.db.getAllAsync<ProjectStateRow>(
      `SELECT ${COLUMNS} FROM project_states
       WHERE project_id = ? AND entity_type = ? AND label_id = ?
         AND archived_at IS NULL
       ${MACHINE_ORDER}`,
      [machine.projectId, machine.entityType, machine.labelId],
    );
    return rows.map(toDomain);
  }

  async listForMachine(machine: ProjectStateMachine): Promise<ProjectState[]> {
    const rows = await this.db.getAllAsync<ProjectStateRow>(
      `SELECT ${COLUMNS} FROM project_states
       WHERE project_id = ? AND entity_type = ? AND label_id = ?
       ${MACHINE_ORDER}`,
      [machine.projectId, machine.entityType, machine.labelId],
    );
    return rows.map(toDomain);
  }

  private rowValues(row: ProjectStateRow): (string | number | null)[] {
    return [
      row.id,
      row.project_id,
      row.entity_type,
      row.label_id,
      row.title,
      row.description,
      row.category,
      row.sort_order,
      row.is_initial,
      row.is_terminal,
      row.entry_criteria,
      row.exit_criteria,
      row.source_workflow_state_id,
      row.created_at,
      row.updated_at,
      row.archived_at,
    ];
  }

  private updateValues(row: ProjectStateRow): (string | number | null)[] {
    // Every column except id, which is bound by the WHERE clause.
    return this.rowValues(row).slice(1);
  }

  /**
   * A guarded write affected no rows, so an active-state invariant rejected
   * it. Re-read the machine to report the precise conflict.
   */
  private async throwConflictReason(state: ProjectState): Promise<never> {
    const machine = machineOf(state);
    const titleClash = await this.findActiveByTitle(machine, state.title);
    if (titleClash !== null && titleClash.id !== state.id) {
      throw new ProjectStateTitleConflictError(machine, state.title);
    }
    const initial = await this.findActiveInitialForMachine(machine);
    if (state.isInitial && initial !== null && initial.id !== state.id) {
      throw new ProjectStateInitialConflictError(machine);
    }
    throw new Error(
      `ProjectState ${state.id} conflicts with the invariants of machine ${machine.projectId}/${machine.entityType}/${machine.labelId}`,
    );
  }
}
