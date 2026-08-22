import { Goal } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { DomainError } from '../../domain/shared/errors';
import type { GoalId, MilestoneId, ProjectId } from '../../domain/shared/ids';

/**
 * Use case: add a sub-goal to a project's plan tree. The parent goal, when
 * given, must belong to the project's goal tree (the serving goal is the
 * root); a given due must be earlier than the project's due.
 */
export class AddSubGoalService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly goals: GoalRepository,
  ) {}

  async add(params: {
    id: GoalId;
    projectId: ProjectId;
    parentGoalId?: GoalId;
    title: string;
    startAt?: Date;
    due?: Date;
    milestoneId?: MilestoneId;
    now: Date;
  }): Promise<void> {
    const project = await this.projects.findById(params.projectId);
    if (project === null) {
      throw new DomainError(`Unknown project: ${params.projectId}`);
    }
    if (params.title.trim().length === 0) {
      throw new DomainError('Goal title must not be empty');
    }
    if (params.parentGoalId !== undefined) {
      const parent = await this.goals.findById(params.parentGoalId);
      const inTree =
        parent !== null && (parent.id === project.goalId || parent.projectId === project.id);
      if (!inTree) {
        throw new DomainError(
          `Goal ${params.parentGoalId} does not belong to the goal tree of project ${params.projectId}`,
        );
      }
    }
    if (
      params.due !== undefined &&
      project.due !== undefined &&
      params.due.getTime() >= project.due.getTime()
    ) {
      throw new DomainError('Sub-goal due must be earlier than the project due');
    }

    await this.goals.save(
      Goal.create({
        id: params.id,
        title: params.title,
        ...(params.startAt === undefined ? {} : { startAt: params.startAt }),
        ...(params.due === undefined ? {} : { due: params.due }),
        projectId: params.projectId,
        ...(params.parentGoalId === undefined ? {} : { parentGoalId: params.parentGoalId }),
        ...(params.milestoneId === undefined ? {} : { milestoneId: params.milestoneId }),
        now: params.now,
      }),
    );
  }
}
