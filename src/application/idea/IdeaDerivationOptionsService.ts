import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { GoalId, ProjectId } from '../../domain/shared/ids';

export interface IdeaDerivationGoalOption {
  id: GoalId;
  title: string;
}

export interface IdeaDerivationProjectOption {
  id: ProjectId;
  name: string;
  goals: IdeaDerivationGoalOption[];
}

/** Read model used by the Create-from-Idea Task project and goal pickers. */
export class IdeaDerivationOptionsService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly goals: GoalRepository,
  ) {}

  async getOptions(): Promise<IdeaDerivationProjectOption[]> {
    const [projects, goals] = await Promise.all([
      this.projects.list({ archived: false }),
      this.goals.list({ archived: false }),
    ]);

    return projects
      .map((project) => ({
        id: project.id,
        name: project.name,
        goals: goals
          .filter((goal) => goal.id === project.goalId || goal.projectId === project.id)
          .map((goal) => ({ id: goal.id, title: goal.title }))
          .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
}
