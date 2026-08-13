import type { EntityId, IsoTimestamp } from '../domain/ids';
import { archiveProject, createProject, updateProject } from '../domain/project';
import type { NewProject, Project, ProjectChanges } from '../domain/project';
import type { RecordRepository } from '../persistence/recordRepository';
import type { ProjectFilter, ProjectRepository } from '../persistence/projectRepository';
import { MutationProvenanceService } from './mutationProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

export class ProjectNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Project ${id} not found`);
    this.name = 'ProjectNotFoundError';
  }
}

export interface CreateProjectCommand extends NewProject {
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface UpdateProjectCommand {
  id: EntityId;
  changes: ProjectChanges;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface ArchiveProjectCommand {
  id: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface ProjectServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  projects: (context: TContext) => ProjectRepository;
  records: (context: TContext) => RecordRepository;
  readProjects: ProjectRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Application boundary for intrinsic Project mutations and query visibility.
 * It deliberately knows nothing about pursuit, workflow, state, progress,
 * relations, budgets, allocations, or resources.
 */
export class ProjectService<TContext> {
  private readonly projects: (context: TContext) => ProjectRepository;
  private readonly readProjects: ProjectRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly provenance: MutationProvenanceService<TContext>;

  constructor(ports: ProjectServicePorts<TContext>) {
    this.projects = ports.projects;
    this.readProjects = ports.readProjects;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.provenance = new MutationProvenanceService({
      unitOfWork: ports.unitOfWork,
      records: ports.records,
      clock: this.clock,
      ids: this.ids,
    });
  }

  async createProject(command: CreateProjectCommand): Promise<Project> {
    const project = createProject(command, {
      id: this.ids.newId(), now: this.clock.now(),
    });
    return this.provenance.mutateWithProvenance({
      entityType: 'project', entityId: project.id, action: 'create',
      actor: command.actor, occurredAt: command.occurredAt, after: snapshot(project),
      mutate: async (context) => {
        await this.projects(context).add(project);
        return project;
      },
    });
  }

  async updateProject(command: UpdateProjectCommand): Promise<Project> {
    const before = await this.requireProject(command.id);
    const after = updateProject(before, command.changes, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'project', entityId: command.id, action: 'update',
      actor: command.actor, occurredAt: command.occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.projects(context).save(after);
        return after;
      },
    });
  }

  /** Repeated archival is idempotent and does not append a duplicate record. */
  async archiveProject(command: ArchiveProjectCommand): Promise<Project> {
    const before = await this.requireProject(command.id);
    if (before.archivedAt !== null) return before;
    const after = archiveProject(before, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'project', entityId: command.id, action: 'archive',
      actor: command.actor, occurredAt: command.occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.projects(context).save(after);
        return after;
      },
    });
  }

  async getProject(id: EntityId): Promise<Project | null> {
    return this.readProjects.getById(id);
  }

  async listProjects(filter?: ProjectFilter): Promise<Project[]> {
    return this.readProjects.list(filter);
  }

  async listActiveProjects(): Promise<Project[]> {
    return this.readProjects.list({ status: 'active' });
  }

  async listProjectHistory(): Promise<Project[]> {
    return this.readProjects.list({ status: 'all' });
  }

  private async requireProject(id: EntityId): Promise<Project> {
    const project = await this.readProjects.getById(id);
    if (project === null) throw new ProjectNotFoundError(id);
    return project;
  }
}

function snapshot(project: Project): { [field: string]: unknown } {
  return { ...project };
}
