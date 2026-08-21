import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { LabelId, TaskId } from '../../domain/shared/ids';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import type { Task, TaskStatus } from '../../domain/task/Task';
import {
  RECENT_ACTIVITY_LIMIT,
  TASK_DUE_WINDOW_MS,
  type ActivityItem,
} from '../dashboard/DashboardService';

export interface TaskListItem {
  id: TaskId;
  title: string;
  status: TaskStatus;
  projectName: string;
  due?: Date;
  labelIds: LabelId[];
}

export interface TaskAttentionItem {
  id: TaskId;
  title: string;
  projectName: string;
  reason: 'failed' | 'overdue' | 'dueSoon';
  due?: Date;
}

export interface LabelTaskCount {
  labelId: LabelId;
  name: string;
  count: number;
}

export type TasksByStatus = Record<TaskStatus, TaskListItem[]>;

export interface TasksOverviewView {
  stats: { doing: number; todo: number; done: number; overdue: number };
  attention: TaskAttentionItem[];
  doingNow: TaskListItem[];
  byStatus: Record<TaskStatus, number>;
  byLabel: LabelTaskCount[];
  allTasks: TasksByStatus;
  recentActivity: ActivityItem[];
}

const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'paused', 'failed', 'done'];

function dueTime(item: { due?: Date }): number {
  return item.due?.getTime() ?? Number.POSITIVE_INFINITY;
}

/** Read model for the all-tasks dashboard and its recent activity. */
export class TasksOverviewService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly labels: LabelRepository,
    private readonly records: RecordRepository,
  ) {}

  async getOverview(now: Date): Promise<TasksOverviewView> {
    const [tasks, projects, labels, records] = await Promise.all([
      this.tasks.list({ archived: false }),
      this.projects.list(),
      this.labels.list(),
      this.records.listRecent(100),
    ]);
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const items = tasks.map((task) => this.toListItem(task, projectNames.get(task.projectId)));
    const allTasks = this.groupByStatus(items);

    return {
      stats: {
        doing: allTasks.doing.length,
        todo: allTasks.todo.length,
        done: allTasks.done.length,
        overdue: tasks.filter((task) => task.isOverdue(now)).length,
      },
      attention: this.attention(tasks, projectNames, now),
      doingNow: items.filter((item) => item.status === 'doing' || item.status === 'paused'),
      byStatus: this.countByStatus(allTasks),
      byLabel: this.countByLabel(tasks, new Map(labels.map((label) => [label.id, label.name]))),
      allTasks,
      recentActivity: records
        .filter((record) => record.kind.startsWith('task'))
        .slice(0, RECENT_ACTIVITY_LIMIT)
        .map((record) => ({
          id: record.id,
          kind: record.kind,
          ...(record.detail === undefined ? {} : { detail: record.detail }),
          occurredAt: record.occurredAt,
        })),
    };
  }

  private toListItem(task: Task, projectName: string | undefined): TaskListItem {
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      projectName: projectName ?? task.projectId,
      labelIds: [...task.labelIds],
      ...(task.due === undefined ? {} : { due: task.due }),
    };
  }

  private groupByStatus(items: TaskListItem[]): TasksByStatus {
    const grouped: TasksByStatus = { todo: [], doing: [], paused: [], failed: [], done: [] };
    for (const item of items) grouped[item.status].push(item);
    return grouped;
  }

  private countByStatus(grouped: TasksByStatus): Record<TaskStatus, number> {
    const counts = {} as Record<TaskStatus, number>;
    for (const status of TASK_STATUSES) counts[status] = grouped[status].length;
    return counts;
  }

  private countByLabel(tasks: Task[], names: Map<LabelId, string>): LabelTaskCount[] {
    const counts = new Map<LabelId, number>();
    for (const task of tasks) {
      for (const labelId of task.labelIds) counts.set(labelId, (counts.get(labelId) ?? 0) + 1);
    }
    return [...counts].map(([labelId, count]) => ({
      labelId,
      name: names.get(labelId) ?? labelId,
      count,
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  private attention(
    tasks: Task[],
    projectNames: Map<string, string>,
    now: Date,
  ): TaskAttentionItem[] {
    const groups: Record<TaskAttentionItem['reason'], TaskAttentionItem[]> = {
      failed: [], overdue: [], dueSoon: [],
    };
    for (const task of tasks) {
      let reason: TaskAttentionItem['reason'] | null = null;
      if (task.status === 'failed') reason = 'failed';
      else if (task.isOverdue(now)) reason = 'overdue';
      else if (task.isDueImminent(TASK_DUE_WINDOW_MS, now)) reason = 'dueSoon';
      if (reason !== null) {
        groups[reason].push({
          id: task.id,
          title: task.title,
          projectName: projectNames.get(task.projectId) ?? task.projectId,
          reason,
          ...(task.due === undefined ? {} : { due: task.due }),
        });
      }
    }
    for (const group of Object.values(groups)) group.sort((a, b) => dueTime(a) - dueTime(b));
    return [...groups.failed, ...groups.overdue, ...groups.dueSoon];
  }
}
