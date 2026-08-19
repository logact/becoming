import type { Milestone } from '../Milestone';
import type { MilestoneId, ProjectId } from '../../shared/ids';

export interface MilestoneFilter {
  /** Milestones belonging to this project. */
  projectId?: ProjectId;
}

export interface MilestoneRepository {
  /** Upserts the milestone. */
  save(milestone: Milestone): Promise<void>;
  findById(id: MilestoneId): Promise<Milestone | null>;
  list(filter?: MilestoneFilter): Promise<Milestone[]>;
  delete(id: MilestoneId): Promise<void>;
}
