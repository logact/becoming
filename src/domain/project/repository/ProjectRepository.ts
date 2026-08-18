import type { Project, ProjectStatus } from '../Project';
import type { GoalId, LabelId, ProjectId } from '../../shared/ids';

export interface ProjectFilter {
  status?: ProjectStatus;
  archived?: boolean;
  labelId?: LabelId;
  goalId?: GoalId;
}

export interface ProjectRepository {
  /** Upserts the project. */
  save(project: Project): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  list(filter?: ProjectFilter): Promise<Project[]>;
  delete(id: ProjectId): Promise<void>;
}
