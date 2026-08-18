import type { Resource } from '../Resource';
import type { ResourceTypeKind } from '../ResourceType';
import type {
  LabelId,
  ProjectId,
  ResourceId,
  ResourceTypeId,
} from '../../shared/ids';

export interface ResourceFilter {
  typeId?: ResourceTypeId;
  kind?: ResourceTypeKind;
  /** Matches resources that have an allocation to this project. */
  projectId?: ProjectId;
  archived?: boolean;
  labelId?: LabelId;
}

export interface ResourceRepository {
  /** Upserts the resource, including its allocations. */
  save(resource: Resource): Promise<void>;
  findById(id: ResourceId): Promise<Resource | null>;
  list(filter?: ResourceFilter): Promise<Resource[]>;
  /** Removes the resource and its allocations. */
  delete(id: ResourceId): Promise<void>;
}
