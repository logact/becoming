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
 * Each row is one version of a definition. Publishing freezes a version:
 * a published row's definition is immutable, so history built on it is never
 * silently rewritten. The next version is a new row created with
 * `createWorkflowVersion`, which records explicit lineage through
 * `supersedesId` (the previous published version's id). Rows created with
 * `createWorkflow` are unpublished root drafts (`supersedesId` and
 * `publishedAt` are null).
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
  /** Id of the published version this one supersedes; null for root drafts. */
  supersedesId: EntityId | null;
  /** When this version was published and frozen; null while still a draft. */
  publishedAt: IsoTimestamp | null;
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
    supersedesId: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  return workflow;
}

/** Definition fields a draft Workflow may change; identity fields may not. */
export interface WorkflowDraftChanges {
  title?: string;
  description?: string | null;
  workflowType?: string;
  purpose?: string | null;
  entryCriteria?: string | null;
  exitCriteria?: string | null;
}

/**
 * Edit an unpublished draft. Returns a new aggregate; the input is not
 * mutated. Published versions are immutable and archived Workflows are no
 * longer edited, so both are rejected. Version and lineage never change.
 */
export function updateWorkflowDraft(
  workflow: Workflow,
  changes: WorkflowDraftChanges,
  updatedAt: IsoTimestamp = nowIso(),
): Workflow {
  if (workflow.publishedAt !== null) {
    throw new Error(
      `Workflow ${workflow.id} is published and its definition is immutable`,
    );
  }
  if (workflow.archivedAt !== null) {
    throw new Error(`Workflow ${workflow.id} is archived`);
  }
  const updated: Workflow = {
    ...workflow,
    title: changes.title ?? workflow.title,
    description:
      changes.description === undefined
        ? workflow.description
        : changes.description,
    workflowType: changes.workflowType ?? workflow.workflowType,
    purpose: changes.purpose === undefined ? workflow.purpose : changes.purpose,
    entryCriteria:
      changes.entryCriteria === undefined
        ? workflow.entryCriteria
        : changes.entryCriteria,
    exitCriteria:
      changes.exitCriteria === undefined
        ? workflow.exitCriteria
        : changes.exitCriteria,
    updatedAt,
  };
  validateWorkflow(updated);
  return updated;
}

/**
 * Publish a draft, freezing its definition as an immutable version. Returns a
 * new aggregate; the input is not mutated. Re-publishing and publishing an
 * archived Workflow are rejected as invalid state changes.
 */
export function publishWorkflow(
  workflow: Workflow,
  publishedAt: IsoTimestamp = nowIso(),
): Workflow {
  if (workflow.publishedAt !== null) {
    throw new Error(`Workflow ${workflow.id} is already published`);
  }
  if (workflow.archivedAt !== null) {
    throw new Error(`Workflow ${workflow.id} is archived`);
  }
  return { ...workflow, publishedAt, updatedAt: publishedAt };
}

/**
 * Create the next version of a published Workflow as an unpublished draft.
 * The successor copies the predecessor's definition (with optional overrides),
 * increments the version, and records explicit lineage through
 * `supersedesId`. Lineage chains published versions only, so an unpublished
 * predecessor is rejected.
 */
export function createWorkflowVersion(
  predecessor: Workflow,
  overrides: WorkflowDraftChanges = {},
): Workflow {
  if (predecessor.publishedAt === null) {
    throw new Error(
      `Workflow ${predecessor.id} is not published; ` +
        'a new version must supersede a published version',
    );
  }
  const now = nowIso();
  const successor: Workflow = {
    id: newId(),
    title: overrides.title ?? predecessor.title,
    description:
      overrides.description === undefined
        ? predecessor.description
        : overrides.description,
    workflowType: overrides.workflowType ?? predecessor.workflowType,
    purpose:
      overrides.purpose === undefined
        ? predecessor.purpose
        : overrides.purpose,
    version: predecessor.version + 1,
    entryCriteria:
      overrides.entryCriteria === undefined
        ? predecessor.entryCriteria
        : overrides.entryCriteria,
    exitCriteria:
      overrides.exitCriteria === undefined
        ? predecessor.exitCriteria
        : overrides.exitCriteria,
    supersedesId: predecessor.id,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateWorkflow(successor);
  return successor;
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
