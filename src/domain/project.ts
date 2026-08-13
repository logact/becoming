import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * An intrinsic Project definition. Pursuit membership, workflows, lifecycle,
 * progress, relationships, and resources are deliberately modelled elsewhere.
 * An archived Project remains resolvable for historical records and relations.
 */
export interface Project {
  id: EntityId;
  title: string;
  description: string | null;
  purpose: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

export interface NewProject {
  title: string;
  description?: string;
  purpose?: string;
}

export interface ProjectChanges {
  title?: string;
  /** Omit to retain; pass null to clear. */
  description?: string | null;
  /** Omit to retain; pass null to clear. */
  purpose?: string | null;
}

export interface ProjectFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Project ${field} must not be blank`);
  }
  return value;
}

/** Validate the Project's own fields, without interpreting external links. */
export function validateProject(project: Project): void {
  requireNonBlank('title', project.title);
}

/** Create a Project, normalizing omitted optional text to persistence nulls. */
export function createProject(
  input: NewProject,
  deps: ProjectFactoryDeps = {},
): Project {
  const now = deps.now ?? nowIso();
  const project: Project = {
    id: deps.id ?? newId(),
    title: requireNonBlank('title', input.title),
    description: input.description ?? null,
    purpose: input.purpose ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateProject(project);
  return project;
}

/** Update an active Project while preserving its identity and creation time. */
export function updateProject(
  project: Project,
  changes: ProjectChanges,
  updatedAt: IsoTimestamp = nowIso(),
): Project {
  if (project.archivedAt !== null) {
    throw new Error(`Project ${project.id} is archived and cannot be updated`);
  }
  const updated: Project = {
    ...project,
    title: changes.title ?? project.title,
    description:
      changes.description === undefined ? project.description : changes.description,
    purpose: changes.purpose === undefined ? project.purpose : changes.purpose,
    updatedAt,
  };
  validateProject(updated);
  return updated;
}

/** Archive without deletion. A second archival is an invalid domain transition. */
export function archiveProject(
  project: Project,
  archivedAt: IsoTimestamp = nowIso(),
): Project {
  if (project.archivedAt !== null) {
    throw new Error(`Project ${project.id} is already archived`);
  }
  return { ...project, updatedAt: archivedAt, archivedAt };
}
