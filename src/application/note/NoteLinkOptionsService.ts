import type { GoalStatus } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { ProjectStatus } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { GoalId, ProjectId } from '../../domain/shared/ids';

export interface NoteGoalLinkOption {
  type: 'goal';
  id: GoalId;
  title: string;
  status: GoalStatus;
}

export interface NoteProjectLinkOption {
  type: 'project';
  id: ProjectId;
  title: string;
  status: ProjectStatus;
}

export type NoteLinkOption = NoteGoalLinkOption | NoteProjectLinkOption;

/** Lightweight read boundary for the Note detail link picker. */
export class NoteLinkOptionsService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async getOptions(): Promise<NoteLinkOption[]> {
    const [goals, projects] = await Promise.all([
      this.goals.list({ archived: false }),
      this.projects.list({ archived: false }),
    ]);
    return [
      ...goals.map((goal): NoteGoalLinkOption => ({
        type: 'goal', id: goal.id, title: goal.title, status: goal.status,
      })),
      ...projects.map((project): NoteProjectLinkOption => ({
        type: 'project', id: project.id, title: project.name, status: project.status,
      })),
    ].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  }
}
