import type { ResourceTypeKind } from '../../domain/resource/ResourceType';
import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import type { ResourceId } from '../../domain/shared/ids';

/** A global resource pool as listed on the allocate-resource screen. */
export interface ResourcePoolItem {
  id: ResourceId;
  name: string;
  kind: ResourceTypeKind;
  /** Total pool size (minutes for time resources). */
  amount: number;
  /** Pool amount not allocated to any project (minutes for time resources). */
  available: number;
}

/**
 * Read model for the allocate-resource screen: the non-archived global
 * resource pools with their available (unallocated) amounts.
 */
export class ResourcePoolsService {
  constructor(private readonly resources: ResourceRepository) {}

  async list(): Promise<ResourcePoolItem[]> {
    const pools = await this.resources.list({ archived: false });
    return pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      kind: pool.kind,
      amount: pool.amount,
      available: pool.available,
    }));
  }
}
