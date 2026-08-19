import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import type { TimeSpan } from '../../domain/resource/ResourceAllocation';
import { DomainError } from '../../domain/shared/errors';
import type { AllocationId, ProjectId, ResourceId } from '../../domain/shared/ids';

/**
 * Use case: allocate part of a resource pool to a project. Quantity
 * resources take an `amount`, time resources take a `span`; the domain
 * enforces that the pool is not exceeded and that spans do not overlap.
 */
export class AllocateResourceService {
  constructor(private readonly resources: ResourceRepository) {}

  async allocate(params: {
    allocationId: AllocationId;
    resourceId: ResourceId;
    projectId: ProjectId;
    amount?: number;
    span?: TimeSpan;
    now: Date;
  }): Promise<void> {
    const resource = await this.resources.findById(params.resourceId);
    if (resource === null) {
      throw new DomainError(`Unknown resource: ${params.resourceId}`);
    }

    resource.allocate(
      {
        id: params.allocationId,
        projectId: params.projectId,
        ...(params.amount === undefined ? {} : { amount: params.amount }),
        ...(params.span === undefined ? {} : { span: params.span }),
      },
      params.now,
    );
    await this.resources.save(resource);
  }
}
