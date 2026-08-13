import type { EntityId, IsoTimestamp } from '../domain/ids';
import type {
  ProjectEntityState,
  ProjectEntityStateContext,
} from '../domain/projectEntityState';
import { validateProjectEntityState } from '../domain/projectEntityState';
import type { SqliteDatabase } from './database';

/** Raised when a context already has a state period with no end time. */
export class ProjectEntityStateCurrentConflictError extends Error {
  constructor(context: ProjectEntityStateContext) {
    super(
      `Entity ${context.entityType} ${context.entityId} already has a current Project state in ${context.projectId}/${context.labelId}`,
    );
    this.name = 'ProjectEntityStateCurrentConflictError';
  }
}

/** Stored history is corrupt when a context has more than one open period. */
export class ProjectEntityStateMultipleCurrentError extends Error {
  constructor(context: ProjectEntityStateContext, ids: readonly EntityId[]) {
    super(
      `Entity ${context.entityType} ${context.entityId} has multiple current Project states in ${context.projectId}/${context.labelId}: ${ids.join(', ')}`,
    );
    this.name = 'ProjectEntityStateMultipleCurrentError';
  }
}

/** Read/write port for immutable runtime Project state periods. */
export interface ProjectEntityStateRepository {
  add(state: ProjectEntityState): Promise<void>;
  getById(id: EntityId): Promise<ProjectEntityState | null>;
  findCurrent(context: ProjectEntityStateContext): Promise<ProjectEntityState | null>;
  /** Alias for the lifecycle-audit lookup port. */
  getCurrent(context: ProjectEntityStateContext): Promise<ProjectEntityState | null>;
  listHistory(context: ProjectEntityStateContext): Promise<ProjectEntityState[]>;
  /** Open runtime periods currently occupying a particular Project State. */
  listCurrentForProjectState(projectStateId: EntityId): Promise<ProjectEntityState[]>;
  /** Only changes `endedAt` from null to a valid final value. */
  end(state: ProjectEntityState): Promise<void>;
}

interface ProjectEntityStateRow {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  label_id: string;
  project_state_id: string;
  entered_at: string;
  ended_at: string | null;
  created_at: string;
}

const COLUMNS = `id, project_id, entity_type, entity_id, label_id,
  project_state_id, entered_at, ended_at, created_at`;

function contextOf(state: ProjectEntityState): ProjectEntityStateContext {
  return {
    projectId: state.projectId,
    entityType: state.entityType,
    entityId: state.entityId,
    labelId: state.labelId,
  };
}

function toDomain(row: ProjectEntityStateRow): ProjectEntityState {
  return {
    id: row.id,
    projectId: row.project_id,
    entityType: row.entity_type as ProjectEntityState['entityType'],
    entityId: row.entity_id,
    labelId: row.label_id,
    projectStateId: row.project_state_id,
    enteredAt: row.entered_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

function values(state: ProjectEntityState): (string | null)[] {
  return [
    state.id,
    state.projectId,
    state.entityType,
    state.entityId,
    state.labelId,
    state.projectStateId,
    state.enteredAt,
    state.endedAt,
    state.createdAt,
  ];
}

/** SQLite implementation. It never deletes rows or rewrites a closed period. */
export class SqliteProjectEntityStateRepository
  implements ProjectEntityStateRepository
{
  constructor(private readonly db: SqliteDatabase) {}

  async add(state: ProjectEntityState): Promise<void> {
    validateProjectEntityState(state);
    const context = contextOf(state);
    // The NOT EXISTS guard gives an explicit conflict on all supported SQLite
    // builds; migration 3's partial unique index additionally protects this
    // invariant across independent connections.
    let result;
    try {
      result = await this.db.runAsync(
        `INSERT INTO project_entity_states (${COLUMNS})
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM project_entity_states
           WHERE project_id = ? AND entity_type = ? AND entity_id = ?
             AND label_id = ? AND ended_at IS NULL
         )`,
        [
          ...values(state),
          context.projectId,
          context.entityType,
          context.entityId,
          context.labelId,
        ],
      );
    } catch (error) {
      // The unique partial index is the final protection when two separate
      // connections race. Translate its database-level signal to the same
      // explicit domain conflict used by the guarded insert above.
      if ((await this.findCurrent(context)) !== null) {
        throw new ProjectEntityStateCurrentConflictError(context);
      }
      throw error;
    }
    if (result.changes === 0) {
      if ((await this.findCurrent(context)) !== null) {
        throw new ProjectEntityStateCurrentConflictError(context);
      }
      throw new Error(`Cannot add ProjectEntityState ${state.id}`);
    }
  }

  async getById(id: EntityId): Promise<ProjectEntityState | null> {
    const row = await this.db.getFirstAsync<ProjectEntityStateRow>(
      `SELECT ${COLUMNS} FROM project_entity_states WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async findCurrent(
    context: ProjectEntityStateContext,
  ): Promise<ProjectEntityState | null> {
    // Although the partial unique index prevents this in normal operation,
    // detect legacy/corrupt data rather than silently choosing a winner.
    const rows = await this.db.getAllAsync<ProjectEntityStateRow>(
      `SELECT ${COLUMNS} FROM project_entity_states
       WHERE project_id = ? AND entity_type = ? AND entity_id = ?
         AND label_id = ? AND ended_at IS NULL
       ORDER BY entered_at, created_at, id`,
      [
        context.projectId,
        context.entityType,
        context.entityId,
        context.labelId,
      ],
    );
    if (rows.length > 1) {
      throw new ProjectEntityStateMultipleCurrentError(
        context,
        rows.map((row) => row.id),
      );
    }
    return rows.length === 0 ? null : toDomain(rows[0]);
  }

  async getCurrent(
    context: ProjectEntityStateContext,
  ): Promise<ProjectEntityState | null> {
    return this.findCurrent(context);
  }

  async listHistory(
    context: ProjectEntityStateContext,
  ): Promise<ProjectEntityState[]> {
    const rows = await this.db.getAllAsync<ProjectEntityStateRow>(
      `SELECT ${COLUMNS} FROM project_entity_states
       WHERE project_id = ? AND entity_type = ? AND entity_id = ? AND label_id = ?
       ORDER BY entered_at, created_at, id`,
      [
        context.projectId,
        context.entityType,
        context.entityId,
        context.labelId,
      ],
    );
    return rows.map(toDomain);
  }

  async listCurrentForProjectState(
    projectStateId: EntityId,
  ): Promise<ProjectEntityState[]> {
    const rows = await this.db.getAllAsync<ProjectEntityStateRow>(
      `SELECT ${COLUMNS} FROM project_entity_states
       WHERE project_state_id = ? AND ended_at IS NULL
       ORDER BY entered_at, created_at, id`,
      [projectStateId],
    );
    return rows.map(toDomain);
  }

  async end(state: ProjectEntityState): Promise<void> {
    validateProjectEntityState(state);
    if (state.endedAt === null) {
      throw new Error(`ProjectEntityState ${state.id} must have endedAt to end it`);
    }
    const result = await this.db.runAsync(
      `UPDATE project_entity_states SET ended_at = ?
       WHERE id = ? AND ended_at IS NULL
         AND project_id = ? AND entity_type = ? AND entity_id = ? AND label_id = ?
         AND project_state_id = ? AND entered_at = ? AND created_at = ?`,
      [
        state.endedAt,
        state.id,
        state.projectId,
        state.entityType,
        state.entityId,
        state.labelId,
        state.projectStateId,
        state.enteredAt,
        state.createdAt,
      ],
    );
    if (result.changes === 0) {
      const stored = await this.getById(state.id);
      if (stored === null) {
        throw new Error(`Cannot end unknown ProjectEntityState ${state.id}`);
      }
      if (stored.endedAt !== null) {
        throw new Error(`ProjectEntityState ${state.id} is already ended`);
      }
      throw new Error(`ProjectEntityState ${state.id} is immutable apart from ending`);
    }
  }
}
