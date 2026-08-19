import type { Goal } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { ProjectStatus } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { GoalId, ProjectId } from '../../domain/shared/ids';
import { RECENT_ACTIVITY_LIMIT, type ActivityItem } from '../dashboard/DashboardService';

export interface GoalDetailProject {
  id: ProjectId;
  name: string;
  status: ProjectStatus;
  /** Sub-goals decomposed inside this project. */
  subGoalCount: number;
}

export interface GoalDetailView {
  /** The goal itself; null when unknown (the caller renders "unknown goal"). */
  goal: Goal | null;
  /** Non-archived projects serving the goal. */
  projects: GoalDetailProject[];
  /**
   * The project with status `active` — the goal's current plan (derived, at
   * most one); null when none is active.
   */
  activeProjectId: ProjectId | null;
  /** Records linked to the goal in either relation direction, newest first. */
  recentActivity: ActivityItem[];
}

/**
 * Read model for the goal-detail screen: the goal itself, its projects with
 * their status and sub-goal count (the active one is the current plan), and
 * the goal-scoped recent activity.
 */
export class GoalDetailService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly projects: ProjectRepository,
    private readonly records: RecordRepository,
  ) {}

  async getDetail(goalId: GoalId): Promise<GoalDetailView> {
    const [goal, projects, records] = await Promise.all([
      this.goals.findById(goalId),
      this.projects.list({ goalId, archived: false }),
      this.records.listByTarget('goal', goalId),
    ]);

    const detailProjects: GoalDetailProject[] = [];
    for (const project of projects) {
      const subGoals = await this.goals.list({ projectId: project.id });
      detailProjects.push({
        id: project.id,
        name: project.name,
        status: project.status,
        subGoalCount: subGoals.length,
      });
    }

    return {
      goal,
      projects: detailProjects,
      activeProjectId: projects.find((project) => project.status === 'active')?.id ?? null,
      recentActivity: records.slice(0, RECENT_ACTIVITY_LIMIT).map((record) => ({
        id: record.id,
        kind: record.kind,
        ...(record.detail === undefined ? {} : { detail: record.detail }),
        occurredAt: record.occurredAt,
      })),
    };
  }
}
