import type { Resource, ResourceKind } from '../Resource';
import type { LabelId, ProjectId, ResourceId } from '../../shared/ids';

export interface ResourceFilter {
  kind?: ResourceKind;
  archived?: boolean;
  labelId?: LabelId;
  projectId?: ProjectId;
}

export interface ResourceRepository {
  /** Upserts the resource. */
  save(resource: Resource): Promise<void>;
  findById(id: ResourceId): Promise<Resource | null>;
  list(filter?: ResourceFilter): Promise<Resource[]>;
  delete(id: ResourceId): Promise<void>;
}
