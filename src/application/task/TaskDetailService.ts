import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { TaskId } from '../../domain/shared/ids';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import type { Task } from '../../domain/task/Task';
import { RECENT_ACTIVITY_LIMIT, type ActivityItem } from '../dashboard/DashboardService';

export interface TaskDetailView {
  task: Task | null;
  projectName?: string;
  goalTitle?: string;
  goalParentTitle?: string;
  records: ActivityItem[];
}

/** Read model for task context and immutable execution records. */
export class TaskDetailService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly goals: GoalRepository,
    private readonly records: RecordRepository,
  ) {}

  async getDetail(taskId: TaskId): Promise<TaskDetailView> {
    const task = await this.tasks.findById(taskId);
    if (task === null) return { task: null, records: [] };

    const [project, goal, records] = await Promise.all([
      this.projects.findById(task.projectId),
      task.goalId === undefined ? Promise.resolve(null) : this.goals.findById(task.goalId),
      this.records.listByTarget('task', RECENT_ACTIVITY_LIMIT, taskId),
    ]);
    const parent = goal?.parentGoalId === undefined
      ? null
      : await this.goals.findById(goal.parentGoalId);

    return {
      task,
      ...(project === null ? {} : { projectName: project.name }),
      ...(goal === null ? {} : { goalTitle: goal.title }),
      ...(parent === null ? {} : { goalParentTitle: parent.title }),
      records: records.slice(0, RECENT_ACTIVITY_LIMIT).map((record) => ({
        id: record.id,
        kind: record.kind,
        ...(record.detail === undefined ? {} : { detail: record.detail }),
        occurredAt: record.occurredAt,
      })),
    };
  }
}
