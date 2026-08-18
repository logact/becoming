import type { Goal, GoalStatus } from '../Goal';
import type { GoalId, LabelId } from '../../shared/ids';

export interface GoalFilter {
  status?: GoalStatus;
  archived?: boolean;
  labelId?: LabelId;
}

export interface GoalRepository {
  /** Upserts the goal. */
  save(goal: Goal): Promise<void>;
  findById(id: GoalId): Promise<Goal | null>;
  list(filter?: GoalFilter): Promise<Goal[]>;
  delete(id: GoalId): Promise<void>;
}
