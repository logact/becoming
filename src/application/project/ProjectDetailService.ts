import type { Goal, GoalStatus } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { Milestone } from '../../domain/milestone/Milestone';
import type { MilestoneRepository } from '../../domain/milestone/repository/MilestoneRepository';
import type { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { TimeSpan } from '../../domain/resource/ResourceAllocation';
import type { ResourceTypeKind } from '../../domain/resource/ResourceType';
import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import type { GoalId, MilestoneId, ProjectId, ResourceId, TaskId } from '../../domain/shared/ids';
import type { Task, TaskStatus } from '../../domain/task/Task';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import { RECENT_ACTIVITY_LIMIT, type ActivityItem } from '../dashboard/DashboardService';

/** A goal node of the plan tree: the serving goal plus nested sub-goals. */
export interface ProjectGoalNode {
  id: GoalId;
  title: string;
  status: GoalStatus;
  startAt?: Date;
  due?: Date;
  milestoneId?: MilestoneId;
  /**
   * Tasks targeting this goal; the root node also holds tasks without a
   * goal (or whose goal is unknown).
   */
  tasks: ProjectTaskItem[];
  children: ProjectGoalNode[];
}

export interface ProjectTaskItem {
  id: TaskId;
  title: string;
  status: TaskStatus;
  startAt?: Date;
  due?: Date;
  /** Title of the goal the task targets; undefined for root-level tasks. */
  goalTitle?: string;
}

export interface ProjectResourceItem {
  id: ResourceId;
  name: string;
  kind: ResourceTypeKind;
  /** Amount allocated to this project (minutes for time resources). */
  amount: number;
  /** The allocated time span; present only for allocations of time resources. */
  span?: TimeSpan;
}

/** Progress across the plan: done units over total units of sub-goals and tasks. */
export interface ProjectProgress {
  doneSubGoals: number;
  totalSubGoals: number;
  doneTasks: number;
  totalTasks: number;
  /** Done (sub-goals + tasks) over total, rounded to 0–100; 0 when there is nothing to do. */
  percent: number;
}

/** A goal or task linked to a milestone. */
export interface ProjectMilestoneItem {
  kind: 'goal' | 'task';
  id: GoalId | TaskId;
  title: string;
  status: GoalStatus | TaskStatus;
  /** Parent goal title for goals; target goal title for tasks. */
  context?: string;
}

export interface ProjectMilestone {
  id: MilestoneId;
  title: string;
  date: Date;
  /** Reached once the milestone date is not in the future (`date <= now`). */
  reached: boolean;
  /** Goals and tasks linked to the milestone, goals first. */
  items: ProjectMilestoneItem[];
}

export interface ProjectDetailView {
  /** The project itself; null when unknown (the caller renders "unknown project"). */
  project: Project | null;
  /**
   * Plan tree rooted at the goal this project serves, with sub-goals nested
   * under their parent goal and tasks attached to their goal node; null when
   * the project or its goal is unknown.
   */
  plan: ProjectGoalNode | null;
  /** Progress across sub-goals and tasks; null when the plan is unknown. */
  progress: ProjectProgress | null;
  /** 1-based current week of the createdAt → due span; null when the project has no due. */
  weeks: { current: number; total: number } | null;
  /** Project milestones sorted by date, each with its linked goals and tasks. */
  milestones: ProjectMilestone[];
  /** Non-archived tasks of the project. */
  tasks: ProjectTaskItem[];
  /** Non-archived resources with an allocation to this project. */
  resources: ProjectResourceItem[];
  /** Records linked to the project in either relation direction, newest first. */
  recentActivity: ActivityItem[];
}

const EMPTY_VIEW: ProjectDetailView = {
  project: null,
  plan: null,
  progress: null,
  weeks: null,
  milestones: [],
  tasks: [],
  resources: [],
  recentActivity: [],
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Read model for the project-detail screen: the project itself, its plan
 * tree (the goal it serves plus nested sub-goals, with tasks attached to
 * their goal node), progress stats, the current week, milestones, the flat
 * task list, the resources allocated to it, and the project-scoped recent
 * activity.
 */
export class ProjectDetailService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly resources: ResourceRepository,
    private readonly records: RecordRepository,
    /** Optional until the composition root wires the milestone repository. */
    private readonly milestones?: MilestoneRepository,
  ) {}

  async getDetail(projectId: ProjectId, now: Date = new Date()): Promise<ProjectDetailView> {
    const project = await this.projects.findById(projectId);
    if (project === null) {
      return EMPTY_VIEW;
    }

    const [servingGoal, subGoals, tasks, resources, records, milestones] = await Promise.all([
      this.goals.findById(project.goalId),
      this.goals.list({ projectId, archived: false }),
      this.tasks.list({ projectId, archived: false }),
      this.resources.list({ projectId, archived: false }),
      this.records.listByTarget('project', RECENT_ACTIVITY_LIMIT, projectId),
      this.milestones?.list({ projectId }) ?? Promise.resolve([]),
    ]);

    const goalTitleById = new Map<GoalId, string>();
    if (servingGoal !== null) {
      goalTitleById.set(servingGoal.id, servingGoal.title);
    }
    for (const subGoal of subGoals) {
      goalTitleById.set(subGoal.id, subGoal.title);
    }
    const toTaskItem = (task: Task): ProjectTaskItem => {
      const goalTitle = task.goalId === undefined ? undefined : goalTitleById.get(task.goalId);
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        ...(task.startAt === undefined ? {} : { startAt: task.startAt }),
        ...(task.due === undefined ? {} : { due: task.due }),
        ...(goalTitle === undefined ? {} : { goalTitle }),
      };
    };

    return {
      project,
      plan: servingGoal === null ? null : this.buildPlanTree(servingGoal, subGoals, tasks, toTaskItem),
      progress: servingGoal === null ? null : this.computeProgress(subGoals, tasks),
      weeks: this.computeWeeks(project, now),
      milestones: this.buildMilestones(milestones, servingGoal, subGoals, tasks, goalTitleById, now),
      tasks: tasks.map(toTaskItem),
      resources: resources.map((resource) => {
        // The projectId filter guarantees an allocation to this project.
        const allocation = resource.allocations.find((a) => a.projectId === projectId);
        return {
          id: resource.id,
          name: resource.name,
          kind: resource.kind,
          amount: allocation?.amount ?? 0,
          ...(allocation?.span === undefined ? {} : { span: allocation.span }),
        };
      }),
      recentActivity: records.slice(0, RECENT_ACTIVITY_LIMIT).map((record) => ({
        id: record.id,
        kind: record.kind,
        ...(record.detail === undefined ? {} : { detail: record.detail }),
        occurredAt: record.occurredAt,
      })),
    };
  }

  /**
   * Roots the tree at the serving goal; sub-goals without a parent (or whose
   * parent is the serving goal itself) attach directly under the root. Tasks
   * attach to their goal node; tasks without a goal (or whose goal is
   * unknown) attach to the root.
   */
  private buildPlanTree(
    servingGoal: Goal,
    subGoals: Goal[],
    tasks: Task[],
    toTaskItem: (task: Task) => ProjectTaskItem,
  ): ProjectGoalNode {
    const childrenByParent = new Map<GoalId | undefined, Goal[]>();
    for (const subGoal of subGoals) {
      const siblings = childrenByParent.get(subGoal.parentGoalId) ?? [];
      siblings.push(subGoal);
      childrenByParent.set(subGoal.parentGoalId, siblings);
    }
    const knownGoalIds = new Set<GoalId>([servingGoal.id, ...subGoals.map((goal) => goal.id)]);
    const tasksByGoal = new Map<GoalId, Task[]>();
    const rootTasks: Task[] = [];
    for (const task of tasks) {
      if (task.goalId !== undefined && knownGoalIds.has(task.goalId)) {
        const siblings = tasksByGoal.get(task.goalId) ?? [];
        siblings.push(task);
        tasksByGoal.set(task.goalId, siblings);
      } else {
        rootTasks.push(task);
      }
    }
    const toNode = (goal: Goal): ProjectGoalNode => ({
      id: goal.id,
      title: goal.title,
      status: goal.status,
      ...(goal.startAt === undefined ? {} : { startAt: goal.startAt }),
      ...(goal.due === undefined ? {} : { due: goal.due }),
      ...(goal.milestoneId === undefined ? {} : { milestoneId: goal.milestoneId }),
      tasks: (tasksByGoal.get(goal.id) ?? []).map(toTaskItem),
      children: (childrenByParent.get(goal.id) ?? []).map(toNode),
    });
    const root = toNode(servingGoal);
    root.tasks.push(...rootTasks.map(toTaskItem));
    root.children.unshift(...(childrenByParent.get(undefined) ?? []).map(toNode));
    return root;
  }

  /** Sub-goals and tasks each count as one unit; percent is done over total. */
  private computeProgress(subGoals: Goal[], tasks: Task[]): ProjectProgress {
    const doneSubGoals = subGoals.filter((goal) => goal.status === 'done').length;
    const doneTasks = tasks.filter((task) => task.status === 'done').length;
    const total = subGoals.length + tasks.length;
    return {
      doneSubGoals,
      totalSubGoals: subGoals.length,
      doneTasks,
      totalTasks: tasks.length,
      percent: total === 0 ? 0 : Math.round(((doneSubGoals + doneTasks) / total) * 100),
    };
  }

  /** 1-based current week over createdAt → due; null when the project has no due. */
  private computeWeeks(project: Project, now: Date): { current: number; total: number } | null {
    if (project.due === undefined) {
      return null;
    }
    const total = Math.max(
      1,
      Math.ceil((project.due.getTime() - project.createdAt.getTime()) / WEEK_MS),
    );
    const elapsed = Math.floor((now.getTime() - project.createdAt.getTime()) / WEEK_MS) + 1;
    return { current: Math.min(total, Math.max(1, elapsed)), total };
  }

  /**
   * Milestones sorted by date; reached when the date is not in the future.
   * Items are the goals and tasks linked to the milestone, goals first;
   * `context` is the parent goal title for goals and the target goal title
   * for tasks.
   */
  private buildMilestones(
    milestones: Milestone[],
    servingGoal: Goal | null,
    subGoals: Goal[],
    tasks: Task[],
    goalTitleById: Map<GoalId, string>,
    now: Date,
  ): ProjectMilestone[] {
    const itemsByMilestone = new Map<MilestoneId, ProjectMilestoneItem[]>();
    const push = (milestoneId: MilestoneId, item: ProjectMilestoneItem): void => {
      const items = itemsByMilestone.get(milestoneId) ?? [];
      items.push(item);
      itemsByMilestone.set(milestoneId, items);
    };
    const goals = servingGoal === null ? subGoals : [servingGoal, ...subGoals];
    for (const goal of goals) {
      if (goal.milestoneId !== undefined) {
        const context =
          goal.parentGoalId === undefined ? undefined : goalTitleById.get(goal.parentGoalId);
        push(goal.milestoneId, {
          kind: 'goal',
          id: goal.id,
          title: goal.title,
          status: goal.status,
          ...(context === undefined ? {} : { context }),
        });
      }
    }
    for (const task of tasks) {
      if (task.milestoneId !== undefined) {
        const context = task.goalId === undefined ? undefined : goalTitleById.get(task.goalId);
        push(task.milestoneId, {
          kind: 'task',
          id: task.id,
          title: task.title,
          status: task.status,
          ...(context === undefined ? {} : { context }),
        });
      }
    }
    return milestones
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id))
      .map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        date: milestone.date,
        reached: milestone.date.getTime() <= now.getTime(),
        items: itemsByMilestone.get(milestone.id) ?? [],
      }));
  }
}
