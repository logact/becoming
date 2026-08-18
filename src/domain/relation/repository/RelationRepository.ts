import type { Relation, RelationEndType } from '../Relation';
import type { RelationId } from '../../shared/ids';

export interface RelationFilter {
  sourceType?: RelationEndType;
  sourceId?: string;
  targetType?: RelationEndType;
  targetId?: string;
  kind?: string;
}

export interface RelationRepository {
  /** Upserts the relation. */
  save(relation: Relation): Promise<void>;
  findById(id: RelationId): Promise<Relation | null>;
  list(filter?: RelationFilter): Promise<Relation[]>;
  delete(id: RelationId): Promise<void>;
}
