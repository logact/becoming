import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * The Workflow aggregate: a reusable process describing how something should
 * be performed or managed (e.g. task_execution, project_management).
 *
 * A Workflow is an independent core entity stored in its own `workflows`
 * table. State machines it defines live in the workflow-state template
 * tables; this aggregate owns only the intrinsic Workflow definition:
 * identity, categorization, purpose, criteria, and definition version.
 *
 * Archival is the only lifecycle transition on the definition itself:
 * `archived_at` IS NULL means active. Archived Workflows stay stored so
 * history built on them remains resolvable.
 */
export interface Workflow {
  id: EntityId;
  title: string;
  description: string | null;
  workflowType: string;
  purpose: string | null;
  version: number;
  entryCriteria: string | null;
  exitCriteria: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/** Input for defining a new Workflow. `version` defaults to 1. */
export interface NewWorkflow {
  title: string;
  workflowType: string;
  description?: string;
  purpose?: string;
  version?: number;
  entryCriteria?: string;
  exitCriteria?: string;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Workflow ${field} must not be blank`);
  }
  return value;
}

function requireValidVersion(version: number): number {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(
      `Workflow version must be a positive integer, got ${version}`,
    );
  }
  return version;
}

/** Validate the invariants every Workflow must satisfy. */
export function validateWorkflow(workflow: Workflow): void {
  requireNonBlank('title', workflow.title);
  requireNonBlank('workflowType', workflow.workflowType);
  requireValidVersion(workflow.version);
}

/**
 * Define a new Workflow with a fresh id and current timestamps. Optional
 * detail fields normalize to null when omitted, matching the TEXT columns.
 */
export function createWorkflow(input: NewWorkflow): Workflow {
  const now = nowIso();
  const workflow: Workflow = {
    id: newId(),
    title: requireNonBlank('title', input.title),
    description: input.description ?? null,
    workflowType: requireNonBlank('workflowType', input.workflowType),
    purpose: input.purpose ?? null,
    version: requireValidVersion(input.version ?? 1),
    entryCriteria: input.entryCriteria ?? null,
    exitCriteria: input.exitCriteria ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  return workflow;
}

/**
 * Archive a Workflow definition. Returns a new aggregate; the input is not
 * mutated. Archiving an already archived Workflow is rejected as an invalid
 * state change.
 */
export function archiveWorkflow(
  workflow: Workflow,
  archivedAt: IsoTimestamp = nowIso(),
): Workflow {
  if (workflow.archivedAt !== null) {
    throw new Error(`Workflow ${workflow.id} is already archived`);
  }
  return { ...workflow, archivedAt, updatedAt: archivedAt };
}
