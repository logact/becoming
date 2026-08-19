import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { DomainError } from '../../domain/shared/errors';
import type { GoalId, MilestoneId, ProjectId, TaskId } from '../../domain/shared/ids';
import { Task } from '../../domain/task/Task';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';

/**
 * Use case: add a task to a project, optionally assigned to a goal of the
 * project's goal tree (the serving goal is the root; without a goal the task
 * sits at the root level).
 */
export class AddTaskService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async add(params: {
    id: TaskId;
    projectId: ProjectId;
    goalId?: GoalId;
    title: string;
    due?: Date;
    milestoneId?: MilestoneId;
    now: Date;
  }): Promise<void> {
    const project = await this.projects.findById(params.projectId);
    if (project === null) {
      throw new DomainError(`Unknown project: ${params.projectId}`);
    }
    if (params.title.trim().length === 0) {
      throw new DomainError('Task title must not be empty');
    }
    if (params.goalId !== undefined) {
      const goal = await this.goals.findById(params.goalId);
      const inTree =
        goal !== null && (goal.id === project.goalId || goal.projectId === project.id);
      if (!inTree) {
        throw new DomainError(
          `Goal ${params.goalId} does not belong to the goal tree of project ${params.projectId}`,
        );
      }
    }

    await this.tasks.save(
      Task.create({
        id: params.id,
        title: params.title,
        ...(params.due === undefined ? {} : { due: params.due }),
        projectId: params.projectId,
        ...(params.goalId === undefined ? {} : { goalId: params.goalId }),
        ...(params.milestoneId === undefined ? {} : { milestoneId: params.milestoneId }),
        now: params.now,
      }),
    );
  }
}
