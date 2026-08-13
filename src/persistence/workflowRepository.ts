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
 * services that own those tables, against this boundary. `supersedes_id` is
 * likewise a logical lineage reference; chain integrity is established by the
 * domain's `createWorkflowVersion` and the services composing it.
 *
 * Discovery queries are scoped by workflow type with an optional exact-match
 * purpose filter and are deterministically ordered: descending `version`,
 * ties broken by `created_at` then `id`. Unless `includeArchived` is set,
 * queries return only active versions (`archived_at IS NULL`); setting it
 * returns the full definition history — active and archived — so archived
 * versions stay resolvable in historical lookups.
 *
 * The repository also protects published-version immutability on `save`:
 * version, lineage, and creation identity never change, a published row's
 * definition fields are frozen (only `updated_at`/`archived_at` may move),
 * and `published_at` can only transition from null to set.
 */
export interface WorkflowQuery {
  workflowType: string;
  /** Exact-match filter on the purpose field; omitted means any purpose. */
  purpose?: string;
  /** When true, archived versions are included (historical lookups). */
  includeArchived?: boolean;
}

export interface WorkflowRepository {
  /** Insert a new Workflow. Throws if the id already exists. */
  add(workflow: Workflow): Promise<void>;

  /** Return the Workflow with this id (active or archived), or null. */
  getById(id: EntityId): Promise<Workflow | null>;

  /** Persist changes to an existing Workflow. Throws if the id is unknown. */
  save(workflow: Workflow): Promise<void>;

  /**
   * Return matching Workflow versions in deterministic order — descending
   * `version`, ties broken by `created_at` then `id`. Active versions only
   * unless the query sets `includeArchived`.
   */
  list(query: WorkflowQuery): Promise<Workflow[]>;
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
  supersedes_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const COLUMNS = `id, title, description, workflow_type, purpose, version,
       entry_criteria, exit_criteria, supersedes_id, published_at,
       created_at, updated_at, archived_at`;

/** Deterministic discovery ordering: highest version first, then created_at, then id. */
const DISCOVERY_ORDER = `ORDER BY version DESC, created_at, id`;

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
    supersedes_id: workflow.supersedesId,
    published_at: workflow.publishedAt,
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
    supersedesId: row.supersedes_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/**
 * Guard the write rules a `save` must enforce given the stored row:
 * identity/version/lineage never change, a published definition is frozen,
 * and `published_at` only transitions from null to set.
 */
function assertWorkflowUpdateAllowed(
  stored: Workflow,
  next: Workflow,
): void {
  if (
    next.version !== stored.version ||
    next.supersedesId !== stored.supersedesId ||
    next.createdAt !== stored.createdAt
  ) {
    throw new Error(
      `Workflow ${stored.id} version, lineage, and creation identity are immutable`,
    );
  }
  if (stored.publishedAt !== null) {
    const frozen =
      next.title !== stored.title ||
      next.description !== stored.description ||
      next.workflowType !== stored.workflowType ||
      next.purpose !== stored.purpose ||
      next.entryCriteria !== stored.entryCriteria ||
      next.exitCriteria !== stored.exitCriteria ||
      next.publishedAt !== stored.publishedAt;
    if (frozen) {
      throw new Error(
        `Workflow ${stored.id} is published and its definition is immutable`,
      );
    }
  } else if (next.publishedAt !== null && next.archivedAt !== null) {
    throw new Error(
      `Workflow ${stored.id} cannot be published and archived in one update`,
    );
  }
}

/** WorkflowRepository over the SqliteDatabase port. */
export class SqliteWorkflowRepository implements WorkflowRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async add(workflow: Workflow): Promise<void> {
    validateWorkflow(workflow);
    const row = toRow(workflow);
    await this.db.runAsync(
      `INSERT INTO workflows (${COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.description,
        row.workflow_type,
        row.purpose,
        row.version,
        row.entry_criteria,
        row.exit_criteria,
        row.supersedes_id,
        row.published_at,
        row.created_at,
        row.updated_at,
        row.archived_at,
      ],
    );
  }

  async getById(id: EntityId): Promise<Workflow | null> {
    const row = await this.db.getFirstAsync<WorkflowRow>(
      `SELECT ${COLUMNS} FROM workflows WHERE id = ?`,
      [id],
    );
    return row === null ? null : toDomain(row);
  }

  async save(workflow: Workflow): Promise<void> {
    validateWorkflow(workflow);
    const stored = await this.getById(workflow.id);
    if (stored === null) {
      throw new Error(`Cannot save unknown Workflow ${workflow.id}`);
    }
    assertWorkflowUpdateAllowed(stored, workflow);
    const row = toRow(workflow);
    await this.db.runAsync(
      `UPDATE workflows SET
         title = ?, description = ?, workflow_type = ?, purpose = ?,
         version = ?, entry_criteria = ?, exit_criteria = ?,
         supersedes_id = ?, published_at = ?,
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
        row.supersedes_id,
        row.published_at,
        row.created_at,
        row.updated_at,
        row.archived_at,
        row.id,
      ],
    );
  }

  async list(query: WorkflowQuery): Promise<Workflow[]> {
    const conditions = ['workflow_type = ?'];
    const params: (string | number | null)[] = [query.workflowType];
    if (query.purpose !== undefined) {
      conditions.push('purpose = ?');
      params.push(query.purpose);
    }
    if (query.includeArchived !== true) {
      conditions.push('archived_at IS NULL');
    }
    const rows = await this.db.getAllAsync<WorkflowRow>(
      `SELECT ${COLUMNS} FROM workflows
       WHERE ${conditions.join(' AND ')}
       ${DISCOVERY_ORDER}`,
      params,
    );
    return rows.map(toDomain);
  }
}
