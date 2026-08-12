import type { EntityId } from '../domain/ids';
import type { Workflow } from '../domain/workflow';
import { validateWorkflow } from '../domain/workflow';
import type { SqliteDatabase } from './database';

/**
 * Persistence boundary for the Workflow aggregate.
 *
 * The domain and application layers depend only on this interface. It works
 * over the `SqliteDatabase` port, so the same implementation serves the
 * production expo-sqlite adapter and the node:sqlite test adapter; no
 * framework imports appear here.
 *
 * The `workflows` table has no foreign keys; the repository validates the
 * aggregate's own invariants on every write. References *to* a Workflow
 * (from workflow-state templates, relations, etc.) are validated by the
 * services that own those tables, against this boundary.
 */
export interface WorkflowRepository {
  /** Insert a new Workflow. Throws if the id already exists. */
  add(workflow: Workflow): Promise<void>;

  /** Return the Workflow with this id (active or archived), or null. */
  getById(id: EntityId): Promise<Workflow | null>;

  /** Persist changes to an existing Workflow. Throws if the id is unknown. */
  save(workflow: Workflow): Promise<void>;
}

interface WorkflowRow {
  id: string;
  title: string;
  description: string | null;
  workflow_type: string;
  purpose: string | null;
  version: number;
  entry_criteria: string | null;
  exit_criteria: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toRow(workflow: Workflow): WorkflowRow {
  return {
    id: workflow.id,
    title: workflow.title,
    description: workflow.description,
    workflow_type: workflow.workflowType,
    purpose: workflow.purpose,
    version: workflow.version,
    entry_criteria: workflow.entryCriteria,
    exit_criteria: workflow.exitCriteria,
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
    archived_at: workflow.archivedAt,
  };
}

function toDomain(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    workflowType: row.workflow_type,
    purpose: row.purpose,
    version: row.version,
    entryCriteria: row.entry_criteria,
    exitCriteria: row.exit_criteria,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/** WorkflowRepository over the SqliteDatabase port. */
export class SqliteWorkflowRepository implements WorkflowRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(workflow: Workflow): Promise<void> {
    validateWorkflow(workflow);
    const row = toRow(workflow);
    await this.db.runAsync(
      `INSERT INTO workflows (
         id, title, description, workflow_type, purpose, version,
         entry_criteria, exit_criteria, created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.description,
        row.workflow_type,
        row.purpose,
        row.version,
        row.entry_criteria,
        row.exit_criteria,
        row.created_at,
        row.updated_at,
        row.archived_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Workflow | null> {
    const row = await this.db.getFirstAsync<WorkflowRow>(
      `SELECT id, title, description, workflow_type, purpose, version,
              entry_criteria, exit_criteria, created_at, updated_at, archived_at
       FROM workflows WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(workflow: Workflow): Promise<void> {
    validateWorkflow(workflow);
    const row = toRow(workflow);
    const result = await this.db.runAsync(
      `UPDATE workflows SET
         title = ?, description = ?, workflow_type = ?, purpose = ?,
         version = ?, entry_criteria = ?, exit_criteria = ?,
         created_at = ?, updated_at = ?, archived_at = ?
       WHERE id = ?`,
      [
        row.title,
        row.description,
        row.workflow_type,
        row.purpose,
        row.version,
        row.entry_criteria,
        row.exit_criteria,
        row.created_at,
        row.updated_at,
        row.archived_at,
        row.id,
      ],
    );
    if (result.changes === 0) {
      throw new Error(`Cannot save unknown Workflow ${workflow.id}`);
    }
  }
}
