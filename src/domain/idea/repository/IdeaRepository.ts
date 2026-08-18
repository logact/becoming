import type { Idea, IdeaStatus } from '../Idea';
import type { IdeaId, LabelId } from '../../shared/ids';

export interface IdeaFilter {
  status?: IdeaStatus;
  archived?: boolean;
  labelId?: LabelId;
}

export interface IdeaRepository {
  /** Upserts the idea. */
  save(idea: Idea): Promise<void>;
  findById(id: IdeaId): Promise<Idea | null>;
  list(filter?: IdeaFilter): Promise<Idea[]>;
  delete(id: IdeaId): Promise<void>;
}
