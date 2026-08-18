import type { Task, TaskStatus } from '../Task';
import type { GoalId, LabelId, ProjectId, TaskId } from '../../shared/ids';

export interface TaskFilter {
  status?: TaskStatus;
  archived?: boolean;
  labelId?: LabelId;
  goalId?: GoalId;
  projectId?: ProjectId;
}

export interface TaskRepository {
  /** Upserts the task. */
  save(task: Task): Promise<void>;
  findById(id: TaskId): Promise<Task | null>;
  list(filter?: TaskFilter): Promise<Task[]>;
  delete(id: TaskId): Promise<void>;
}
