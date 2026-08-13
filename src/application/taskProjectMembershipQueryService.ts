import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Project } from '../domain/project';
import type { Relation } from '../domain/relation';
import { TASK_PROJECT_MEMBERSHIP_RELATION_TYPE } from '../domain/relationPolicy';
import type { Task } from '../domain/task';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { TaskRepository } from '../persistence/taskRepository';
import type { Clock } from './recordService';
import { systemClock } from './recordService';

/** The intrinsic Task data carried by a Project membership read result. */
export type MemberTaskSummary = Pick<Task,
  'id' | 'title' | 'description' | 'targetDescription' | 'exitCriteria' |
  'priority' | 'createdAt' | 'updatedAt' | 'archivedAt'>;

/** The intrinsic Project data carried by a Task membership read result. */
export type TaskProjectContextSummary = Pick<Project,
  'id' | 'title' | 'description' | 'purpose' |
  'createdAt' | 'updatedAt' | 'archivedAt'>;

/** A dangling or non-canonical membership endpoint is never silently omitted. */
export type TaskProjectMembershipIntegrityAnomaly =
  | {
      kind: 'malformed_relation_direction';
      relationId: EntityId;
      sourceType: string;
      targetType: string;
    }
  | {
      kind: 'missing_endpoint';
      relationId: EntityId;
      endpoint: 'task' | 'project';
      id: EntityId;
    };

/**
 * A canonical Task -> Project membership. The retained Relation means a
 * Project-side traversal never reverses the graph's direction.
 */
export interface TaskProjectMembershipView {
  relationId: EntityId;
  taskId: EntityId;
  projectId: EntityId;
  task: MemberTaskSummary | null;
  project: TaskProjectContextSummary | null;
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
  /** Relation's half-open validity interval: [createdAt, endedAt). */
  validFrom: IsoTimestamp;
  validUntil: IsoTimestamp | null;
  relation: Relation;
  anomalies: TaskProjectMembershipIntegrityAnomaly[];
}

export interface TaskProjectMembershipReadOptions {
  /**
   * Select relations valid at this instant. Start is inclusive; end is
   * exclusive. Omit for the present current-state query.
   */
  asOf?: IsoTimestamp;
  /**
   * Current queries hide relations with either archived endpoint. History is
   * archive-inclusive by default; set false to apply the current policy.
   */
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface TaskProjectMembershipHistoryOptions extends TaskProjectMembershipReadOptions {
  /** History includes ended relations unless an asOf instant narrows it. */
  includeEnded?: boolean;
}

export interface TaskProjectMembershipQueryServicePorts {
  tasks: TaskRepository;
  projects: ProjectRepository;
  relations: RelationRepository;
  clock?: Clock;
}

/**
 * Read-side traversal of Task -> belongs_to -> Project relations. Operational
 * views expose active relations whose Task and Project are both unarchived.
 * History preserves ended relations and archived summaries by default.
 */
export class TaskProjectMembershipQueryService {
  private readonly clock: Clock;

  constructor(private readonly ports: TaskProjectMembershipQueryServicePorts) {
    this.clock = ports.clock ?? systemClock;
  }

  async listActiveTasksForProject(
    projectId: EntityId,
    options: TaskProjectMembershipReadOptions = {},
  ): Promise<TaskProjectMembershipView[]> {
    return this.listForEndpoint('project', projectId, options, false);
  }

  async listActiveProjectsForTask(
    taskId: EntityId,
    options: TaskProjectMembershipReadOptions = {},
  ): Promise<TaskProjectMembershipView[]> {
    return this.listForEndpoint('task', taskId, options, false);
  }

  async listTaskMembershipHistoryForProject(
    projectId: EntityId,
    options: TaskProjectMembershipHistoryOptions = {},
  ): Promise<TaskProjectMembershipView[]> {
    return this.listForEndpoint('project', projectId, { includeArchived: true, ...options }, true);
  }

  async listTaskMembershipHistoryForTask(
    taskId: EntityId,
    options: TaskProjectMembershipHistoryOptions = {},
  ): Promise<TaskProjectMembershipView[]> {
    return this.listForEndpoint('task', taskId, { includeArchived: true, ...options }, true);
  }

  private async listForEndpoint(
    endpoint: 'task' | 'project',
    id: EntityId,
    options: TaskProjectMembershipReadOptions | TaskProjectMembershipHistoryOptions,
    history: boolean,
  ): Promise<TaskProjectMembershipView[]> {
    assertOptions(options);
    const asOf = options.asOf ?? (history ? undefined : this.clock.now());
    const historyOptions = options as TaskProjectMembershipHistoryOptions;
    const relationQuery = {
      relationType: TASK_PROJECT_MEMBERSHIP_RELATION_TYPE,
      [endpoint === 'task' ? 'source' : 'target']: { type: endpoint, id },
      ...(asOf === undefined ? {} : { at: asOf }),
      ...(history && historyOptions.includeEnded === false ? { status: 'active' as const } : {}),
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    };
    const relations = history
      ? await this.ports.relations.listHistory(relationQuery)
      : await this.ports.relations.listCurrent(relationQuery);
    const includeArchived = options.includeArchived ?? history;
    const views = await Promise.all(relations.map((relation) => this.toView(relation)));
    return views.filter((view) => includeArchived || bothEndpointsActive(view));
  }

  private async toView(relation: Relation): Promise<TaskProjectMembershipView> {
    const anomalies: TaskProjectMembershipIntegrityAnomaly[] = [];
    const canonical = relation.sourceType === 'task' && relation.targetType === 'project';
    if (!canonical) {
      anomalies.push({
        kind: 'malformed_relation_direction', relationId: relation.id,
        sourceType: relation.sourceType, targetType: relation.targetType,
      });
    }
    const taskId = relation.sourceId;
    const projectId = relation.targetId;
    const [task, project] = await Promise.all([
      canonical ? this.ports.tasks.getById(taskId) : Promise.resolve(null),
      canonical ? this.ports.projects.getById(projectId) : Promise.resolve(null),
    ]);
    if (canonical && task === null) {
      anomalies.push({ kind: 'missing_endpoint', relationId: relation.id, endpoint: 'task', id: taskId });
    }
    if (canonical && project === null) {
      anomalies.push({ kind: 'missing_endpoint', relationId: relation.id, endpoint: 'project', id: projectId });
    }
    return {
      relationId: relation.id, taskId, projectId, task, project,
      createdAt: relation.createdAt, endedAt: relation.endedAt,
      validFrom: relation.createdAt, validUntil: relation.endedAt,
      relation, anomalies,
    };
  }
}

function bothEndpointsActive(view: TaskProjectMembershipView): boolean {
  return view.task !== null && view.project !== null &&
    view.task.archivedAt === null && view.project.archivedAt === null;
}

function assertOptions(options: TaskProjectMembershipReadOptions): void {
  if (options.asOf !== undefined && (options.asOf.trim().length === 0 || Number.isNaN(Date.parse(options.asOf)))) {
    throw new Error(`Task membership query asOf must be a valid ISO 8601 timestamp, got ${JSON.stringify(options.asOf)}`);
  }
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Task membership query limit must be a positive integer');
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Task membership query offset must be a non-negative integer');
}
