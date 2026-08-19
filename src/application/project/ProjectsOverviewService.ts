import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { Project, ProjectStatus } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { GoalId, LabelId, ProjectId } from '../../domain/shared/ids';
import { GOAL_DUE_WINDOW_MS } from '../dashboard/DashboardService';

export interface ProjectListItem {
  id: ProjectId;
  name: string;
  status: ProjectStatus;
  labelIds: LabelId[];
  goalId: GoalId;
  /** Title of the goal the project serves; falls back to the goal id. */
  goalTitle: string;
  due?: Date;
}

/** Projects-only counterpart of the goals overview's `GoalAttentionItem`. */
export interface ProjectAttentionItem {
  id: ProjectId;
  name: string;
  reason: 'failed' | 'overdue';
  due?: Date;
}

export interface ProjectsOverviewStats {
  /** Projects with status `active` (non-archived). */
  activeProjects: number;
  /** All non-archived projects. */
  totalProjects: number;
}

export interface LabelProjectCount {
  labelId: LabelId;
  /** Resolved label name; falls back to the id when the label is unknown. */
  name: string;
  count: number;
}

export type ProjectsByStatus = Record<ProjectStatus, ProjectListItem[]>;

export interface ProjectsOverviewView {
  stats: ProjectsOverviewStats;
  attention: ProjectAttentionItem[];
  /** Active projects, each with its labels and due. */
  focus: ProjectListItem[];
  /** Non-archived project count per status. */
  byStatus: Record<ProjectStatus, number>;
  /** Non-archived project count per label, most-used first. */
  byLabel: LabelProjectCount[];
  /** Non-archived projects grouped by status. */
  allProjects: ProjectsByStatus;
}

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'paused', 'failed', 'done'];

/**
 * Read model for the projects screen (Library → Projects): headline stats,
 * projects needing attention (failed or due-imminent), the active projects
 * in focus, counts per status and per label, and every non-archived project
 * grouped by status. Mirrors GoalsOverviewService for the project model.
 */
export class ProjectsOverviewService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly goals: GoalRepository,
    private readonly labels: LabelRepository,
  ) {}

  async getOverview(now: Date): Promise<ProjectsOverviewView> {
    const all = await this.projects.list({ archived: false });
    const goalTitles = await this.resolveGoalTitles(all);
    const toListItem = (project: Project): ProjectListItem => ({
      id: project.id,
      name: project.name,
      status: project.status,
      labelIds: [...project.labelIds],
      goalId: project.goalId,
      goalTitle: goalTitles.get(project.goalId) ?? project.goalId,
      ...(project.due === undefined ? {} : { due: project.due }),
    });
    const allProjects = this.groupByStatus(all, toListItem);
    return {
      stats: { activeProjects: allProjects.active.length, totalProjects: all.length },
      attention: this.listAttention(all, now),
      focus: allProjects.active,
      byStatus: this.countByStatus(allProjects),
      byLabel: await this.countByLabel(all),
      allProjects,
    };
  }

  /** One goal lookup per distinct serving goal, by listing the goals once. */
  private async resolveGoalTitles(projects: Project[]): Promise<Map<GoalId, string>> {
    const titles = new Map<GoalId, string>();
    const wanted = new Set(projects.map((project) => project.goalId));
    for (const goal of await this.goals.list()) {
      if (wanted.has(goal.id)) {
        titles.set(goal.id, goal.title);
      }
    }
    return titles;
  }

  /** Failed projects first, then due-imminent ones ordered by soonest due. */
  private listAttention(projects: Project[], now: Date): ProjectAttentionItem[] {
    const attention: ProjectAttentionItem[] = [];
    for (const project of projects) {
      if (project.status === 'failed') {
        attention.push({
          id: project.id,
          name: project.name,
          reason: 'failed',
          ...(project.due === undefined ? {} : { due: project.due }),
        });
      }
    }
    const overdue = projects
      .filter((project) => project.isDueImminent(GOAL_DUE_WINDOW_MS, now))
      .map((project) => ({
        id: project.id,
        name: project.name,
        reason: 'overdue' as const,
        // `isDueImminent` guarantees a due.
        due: project.due as Date,
      }))
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    return [...attention, ...overdue];
  }

  private groupByStatus(
    projects: Project[],
    toListItem: (project: Project) => ProjectListItem,
  ): ProjectsByStatus {
    const grouped: ProjectsByStatus = { planning: [], active: [], paused: [], failed: [], done: [] };
    for (const project of projects) {
      grouped[project.status].push(toListItem(project));
    }
    return grouped;
  }

  private countByStatus(grouped: ProjectsByStatus): Record<ProjectStatus, number> {
    const counts = {} as Record<ProjectStatus, number>;
    for (const status of PROJECT_STATUSES) {
      counts[status] = grouped[status].length;
    }
    return counts;
  }

  /** A project counts once towards each of its labels. */
  private async countByLabel(projects: Project[]): Promise<LabelProjectCount[]> {
    const counts = new Map<LabelId, number>();
    for (const project of projects) {
      for (const labelId of project.labelIds) {
        counts.set(labelId, (counts.get(labelId) ?? 0) + 1);
      }
    }
    const entries: LabelProjectCount[] = [];
    for (const [labelId, count] of counts) {
      const label = await this.labels.findById(labelId);
      entries.push({ labelId, name: label?.name ?? labelId, count });
    }
    entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return entries;
  }
}
