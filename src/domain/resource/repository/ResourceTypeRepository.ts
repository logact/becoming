import type { ResourceType, ResourceTypeKind } from '../ResourceType';
import type { ResourceTypeId } from '../../shared/ids';

export interface ResourceTypeFilter {
  kind?: ResourceTypeKind;
  archived?: boolean;
}

export interface ResourceTypeRepository {
  /** Upserts the resource type. */
  save(resourceType: ResourceType): Promise<void>;
  findById(id: ResourceTypeId): Promise<ResourceType | null>;
  list(filter?: ResourceTypeFilter): Promise<ResourceType[]>;
  delete(id: ResourceTypeId): Promise<void>;
}
