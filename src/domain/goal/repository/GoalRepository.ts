import type { Goal, GoalStatus } from '../Goal';
import type { GoalId, LabelId, ProjectId } from '../../shared/ids';

export interface GoalFilter {
  status?: GoalStatus;
  archived?: boolean;
  labelId?: LabelId;
  /** Goals belonging to this project (sub-goals). */
  projectId?: ProjectId;
  /** Direct children of this goal in the goal tree. */
  parentGoalId?: GoalId;
}

export interface GoalRepository {
  /** Upserts the goal. */
  save(goal: Goal): Promise<void>;
  findById(id: GoalId): Promise<Goal | null>;
  list(filter?: GoalFilter): Promise<Goal[]>;
  delete(id: GoalId): Promise<void>;
}
