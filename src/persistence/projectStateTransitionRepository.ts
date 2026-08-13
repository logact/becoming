import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId } from '../domain/ids';
import { validateProjectStateTransition } from '../domain/projectStateTransition';
import type { ProjectStateTransition, ProjectStateTransitionMachine } from '../domain/projectStateTransition';
import type { SqliteDatabase } from './database';

/** Raised when an active machine already owns the same directed edge. */
export class ProjectStateTransitionDuplicateError extends Error {
  constructor(transition: Pick<ProjectStateTransition, 'projectId' | 'entityType' | 'labelId' | 'fromStateId' | 'toStateId'>) {
    super(`ProjectStateTransition ${transition.projectId}/${transition.entityType}/${transition.labelId} already has active edge ${transition.fromStateId} -> ${transition.toStateId}`);
    this.name = 'ProjectStateTransitionDuplicateError';
  }
}

export interface ProjectStateTransitionRepository {
  add(transition: ProjectStateTransition): Promise<void>;
  getById(id: EntityId): Promise<ProjectStateTransition | null>;
  save(transition: ProjectStateTransition): Promise<void>;
  listActiveForMachine(machine: ProjectStateTransitionMachine): Promise<ProjectStateTransition[]>;
  listForMachine(machine: ProjectStateTransitionMachine): Promise<ProjectStateTransition[]>;
  listActiveOutgoingForState(machine: ProjectStateTransitionMachine, fromStateId: EntityId): Promise<ProjectStateTransition[]>;
  listOutgoingForState(machine: ProjectStateTransitionMachine, fromStateId: EntityId): Promise<ProjectStateTransition[]>;
  listActiveIncomingForState(machine: ProjectStateTransitionMachine, toStateId: EntityId): Promise<ProjectStateTransition[]>;
  listIncomingForState(machine: ProjectStateTransitionMachine, toStateId: EntityId): Promise<ProjectStateTransition[]>;
}

interface Row {
  id: string; project_id: string; entity_type: string; label_id: string;
  from_state_id: string; to_state_id: string; title: string | null;
  description: string | null; condition: string | null; action: string | null;
  requires_exit_criteria: number; source_workflow_transition_id: string | null;
  created_at: string; updated_at: string; archived_at: string | null;
}

const COLUMNS = `id, project_id, entity_type, label_id, from_state_id, to_state_id,
  title, description, condition, action, requires_exit_criteria,
  source_workflow_transition_id, created_at, updated_at, archived_at`;
const ORDER = 'ORDER BY created_at, id';

function toDomain(row: Row): ProjectStateTransition {
  return { id: row.id, projectId: row.project_id, entityType: row.entity_type as CoreEntityType,
    labelId: row.label_id, fromStateId: row.from_state_id, toStateId: row.to_state_id,
    title: row.title, description: row.description, condition: row.condition, action: row.action,
    requiresExitCriteria: row.requires_exit_criteria === 1,
    sourceWorkflowTransitionId: row.source_workflow_transition_id,
    createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at };
}

function values(t: ProjectStateTransition): (string | number | null)[] {
  return [t.id, t.projectId, t.entityType, t.labelId, t.fromStateId, t.toStateId,
    t.title, t.description, t.condition, t.action, t.requiresExitCriteria ? 1 : 0,
    t.sourceWorkflowTransitionId, t.createdAt, t.updatedAt, t.archivedAt];
}

function assertUpdateAllowed(stored: ProjectStateTransition, next: ProjectStateTransition): void {
  if (stored.projectId !== next.projectId || stored.entityType !== next.entityType ||
    stored.labelId !== next.labelId || stored.fromStateId !== next.fromStateId ||
    stored.toStateId !== next.toStateId || stored.sourceWorkflowTransitionId !== next.sourceWorkflowTransitionId ||
    stored.createdAt !== next.createdAt) {
    throw new Error(`ProjectStateTransition ${stored.id} machine, endpoint, creation identity, and source provenance are immutable`);
  }
  if (stored.archivedAt !== null && (next.archivedAt !== stored.archivedAt || next.title !== stored.title ||
    next.description !== stored.description || next.condition !== stored.condition || next.action !== stored.action ||
    next.requiresExitCriteria !== stored.requiresExitCriteria)) {
    throw new Error(`ProjectStateTransition ${stored.id} is archived and its definition is immutable`);
  }
}

/** SQLite storage with atomic active-edge uniqueness and stable historical queries. */
export class SqliteProjectStateTransitionRepository implements ProjectStateTransitionRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(transition: ProjectStateTransition): Promise<void> {
    validateProjectStateTransition(transition);
    if (transition.archivedAt !== null) {
      await this.db.runAsync(`INSERT INTO project_state_transitions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values(transition));
      return;
    }
    const result = await this.db.runAsync(
      `INSERT INTO project_state_transitions (${COLUMNS})
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM project_state_transitions
         WHERE project_id = ? AND entity_type = ? AND label_id = ?
           AND from_state_id = ? AND to_state_id = ? AND archived_at IS NULL)`,
      [...values(transition), transition.projectId, transition.entityType, transition.labelId, transition.fromStateId, transition.toStateId],
    );
    if (result.changes === 0) throw new ProjectStateTransitionDuplicateError(transition);
  }

  async getById(id: EntityId): Promise<ProjectStateTransition | null> {
    const row = await this.db.getFirstAsync<Row>(`SELECT ${COLUMNS} FROM project_state_transitions WHERE id = ?`, [id]);
    return row === null ? null : toDomain(row);
  }

  async save(transition: ProjectStateTransition): Promise<void> {
    validateProjectStateTransition(transition);
    const stored = await this.getById(transition.id);
    if (stored === null) throw new Error(`Cannot save unknown ProjectStateTransition ${transition.id}`);
    assertUpdateAllowed(stored, transition);
    const result = await this.db.runAsync(
      `UPDATE project_state_transitions SET project_id = ?, entity_type = ?, label_id = ?,
         from_state_id = ?, to_state_id = ?, title = ?, description = ?, condition = ?, action = ?,
         requires_exit_criteria = ?, source_workflow_transition_id = ?, created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`, [...values(transition).slice(1), transition.id],
    );
    if (result.changes === 0) throw new Error(`Cannot save unknown ProjectStateTransition ${transition.id}`);
  }

  async listActiveForMachine(machine: ProjectStateTransitionMachine): Promise<ProjectStateTransition[]> { return this.list(machine, 'archived_at IS NULL'); }
  async listForMachine(machine: ProjectStateTransitionMachine): Promise<ProjectStateTransition[]> { return this.list(machine); }
  async listActiveOutgoingForState(machine: ProjectStateTransitionMachine, id: EntityId): Promise<ProjectStateTransition[]> { return this.list(machine, 'archived_at IS NULL AND from_state_id = ?', [id]); }
  async listOutgoingForState(machine: ProjectStateTransitionMachine, id: EntityId): Promise<ProjectStateTransition[]> { return this.list(machine, 'from_state_id = ?', [id]); }
  async listActiveIncomingForState(machine: ProjectStateTransitionMachine, id: EntityId): Promise<ProjectStateTransition[]> { return this.list(machine, 'archived_at IS NULL AND to_state_id = ?', [id]); }
  async listIncomingForState(machine: ProjectStateTransitionMachine, id: EntityId): Promise<ProjectStateTransition[]> { return this.list(machine, 'to_state_id = ?', [id]); }

  private async list(machine: ProjectStateTransitionMachine, predicate?: string, params: EntityId[] = []): Promise<ProjectStateTransition[]> {
    const suffix = predicate === undefined ? '' : ` AND ${predicate}`;
    const rows = await this.db.getAllAsync<Row>(`SELECT ${COLUMNS} FROM project_state_transitions
      WHERE project_id = ? AND entity_type = ? AND label_id = ?${suffix} ${ORDER}`,
      [machine.projectId, machine.entityType, machine.labelId, ...params]);
    return rows.map(toDomain);
  }
}
