import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';

/** Non-archived entry count behind each browsable Library hub row. */
export interface LibraryCounts {
  goals: number;
  tasks: number;
  projects: number;
  ideas: number;
  notes: number;
  resources: number;
}

/**
 * Read model for the Library hub: one non-archived count per collection the
 * hub links to. Records, labels and the archive carry no count.
 */
export class LibraryOverviewService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly ideas: IdeaRepository,
    private readonly notes: NoteRepository,
    private readonly resources: ResourceRepository,
  ) {}

  async getCounts(): Promise<LibraryCounts> {
    const [goals, tasks, projects, ideas, notes, resources] = await Promise.all([
      this.goals.list({ archived: false }),
      this.tasks.list({ archived: false }),
      this.projects.list({ archived: false }),
      this.ideas.list({ archived: false }),
      this.notes.list({ archived: false }),
      this.resources.list({ archived: false }),
    ]);
    return {
      goals: goals.length,
      tasks: tasks.length,
      projects: projects.length,
      ideas: ideas.length,
      notes: notes.length,
      resources: resources.length,
    };
  }
}
