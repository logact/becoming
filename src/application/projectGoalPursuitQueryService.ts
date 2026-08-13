import type { Goal } from '../domain/goal';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Project } from '../domain/project';
import type { Relation } from '../domain/relation';
import { PROJECT_GOAL_PURSUIT_RELATION_TYPE } from '../domain/relationPolicy';
import type { GoalRepository } from '../persistence/goalRepository';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { Clock } from './recordService';
import { systemClock } from './recordService';

/** The intrinsic Goal data carried by a Project pursuit read result. */
export type PursuedGoalSummary = Pick<Goal,
  'id' | 'title' | 'description' | 'targetState' | 'successCriteria' |
  'createdAt' | 'updatedAt' | 'archivedAt'>;

/** The intrinsic Project data carried by a Goal pursuit read result. */
export type PursuingProjectSummary = Pick<Project,
  'id' | 'title' | 'description' | 'purpose' |
  'createdAt' | 'updatedAt' | 'archivedAt'>;

/** A dangling, mistyped, or otherwise non-canonical endpoint is never hidden. */
export type GoalPursuitIntegrityAnomaly =
  | {
      kind: 'malformed_relation_direction';
      relationId: EntityId;
      sourceType: string;
      targetType: string;
    }
  | {
      kind: 'missing_endpoint';
      relationId: EntityId;
      endpoint: 'project' | 'goal';
      id: EntityId;
    };

/**
 * A Project -> Goal pursuit. The unaltered Relation is retained deliberately:
 * querying from the Goal never inverts source and target.
 */
export interface ProjectGoalPursuitView {
  relationId: EntityId;
  projectId: EntityId;
  goalId: EntityId;
  project: PursuingProjectSummary | null;
  goal: PursuedGoalSummary | null;
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
  /** Relation's half-open validity interval: [createdAt, endedAt). */
  validFrom: IsoTimestamp;
  validUntil: IsoTimestamp | null;
  relation: Relation;
  anomalies: GoalPursuitIntegrityAnomaly[];
}

export interface GoalPursuitReadOptions {
  /**
   * Select relations valid at this instant. Start is inclusive; end is
   * exclusive. Omit for the present current-state query.
   */
  asOf?: IsoTimestamp;
  /**
   * Current queries hide a relation when either endpoint is archived. History
   * is archive-inclusive by default; set false to apply the current policy.
   */
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface GoalPursuitHistoryOptions extends GoalPursuitReadOptions {
  /** History includes ended relations unless an asOf instant narrows it. */
  includeEnded?: boolean;
}

export interface ProjectGoalPursuitQueryServicePorts {
  projects: ProjectRepository;
  goals: GoalRepository;
  relations: RelationRepository;
  clock?: Clock;
}

/**
 * Read-side boundary for typed Project -> Goal pursuit traversal. It does not
 * mutate, repair, or discard historical relations. Current reads expose only
 * active relations with two active endpoints; history retains ended relations
 * and archived endpoint summaries so past execution remains inspectable.
 */
export class ProjectGoalPursuitQueryService {
  private readonly clock: Clock;

  constructor(private readonly ports: ProjectGoalPursuitQueryServicePorts) {
    this.clock = ports.clock ?? systemClock;
  }

  async listGoalsPursuedByProject(
    projectId: EntityId,
    options: GoalPursuitReadOptions = {},
  ): Promise<ProjectGoalPursuitView[]> {
    return this.listForEndpoint('project', projectId, options, false);
  }

  async listProjectsPursuingGoal(
    goalId: EntityId,
    options: GoalPursuitReadOptions = {},
  ): Promise<ProjectGoalPursuitView[]> {
    return this.listForEndpoint('goal', goalId, options, false);
  }

  async listGoalPursuitHistoryForProject(
    projectId: EntityId,
    options: GoalPursuitHistoryOptions = {},
  ): Promise<ProjectGoalPursuitView[]> {
    return this.listForEndpoint('project', projectId, { includeArchived: true, ...options }, true);
  }

  async listGoalPursuitHistoryForGoal(
    goalId: EntityId,
    options: GoalPursuitHistoryOptions = {},
  ): Promise<ProjectGoalPursuitView[]> {
    return this.listForEndpoint('goal', goalId, { includeArchived: true, ...options }, true);
  }

  private async listForEndpoint(
    endpoint: 'project' | 'goal',
    id: EntityId,
    options: GoalPursuitReadOptions | GoalPursuitHistoryOptions,
    history: boolean,
  ): Promise<ProjectGoalPursuitView[]> {
    assertOptions(options);
    const asOf = options.asOf ?? (history ? undefined : this.clock.now());
    const historyOptions = options as GoalPursuitHistoryOptions;
    const relationQuery = {
      relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE,
      [endpoint === 'project' ? 'source' : 'target']: { type: endpoint, id },
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

  private async toView(relation: Relation): Promise<ProjectGoalPursuitView> {
    const anomalies: GoalPursuitIntegrityAnomaly[] = [];
    const canonical = relation.sourceType === 'project' && relation.targetType === 'goal';
    if (!canonical) {
      anomalies.push({
        kind: 'malformed_relation_direction', relationId: relation.id,
        sourceType: relation.sourceType, targetType: relation.targetType,
      });
    }
    const projectId = relation.sourceId;
    const goalId = relation.targetId;
    const [project, goal] = await Promise.all([
      canonical ? this.ports.projects.getById(projectId) : Promise.resolve(null),
      canonical ? this.ports.goals.getById(goalId) : Promise.resolve(null),
    ]);
    if (canonical && project === null) {
      anomalies.push({ kind: 'missing_endpoint', relationId: relation.id, endpoint: 'project', id: projectId });
    }
    if (canonical && goal === null) {
      anomalies.push({ kind: 'missing_endpoint', relationId: relation.id, endpoint: 'goal', id: goalId });
    }
    return {
      relationId: relation.id, projectId, goalId, project, goal,
      createdAt: relation.createdAt, endedAt: relation.endedAt,
      validFrom: relation.createdAt, validUntil: relation.endedAt,
      relation, anomalies,
    };
  }
}

function bothEndpointsActive(view: ProjectGoalPursuitView): boolean {
  return view.project !== null && view.goal !== null &&
    view.project.archivedAt === null && view.goal.archivedAt === null;
}

function assertOptions(options: GoalPursuitReadOptions): void {
  if (options.asOf !== undefined && (options.asOf.trim().length === 0 || Number.isNaN(Date.parse(options.asOf)))) {
    throw new Error(`Goal pursuit query asOf must be a valid ISO 8601 timestamp, got ${JSON.stringify(options.asOf)}`);
  }
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Goal pursuit query limit must be a positive integer');
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Goal pursuit query offset must be a non-negative integer');
}
