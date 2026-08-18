import { DomainError } from '../../domain/shared/errors';
import type { ProjectId, RecordId, RelationId, ResourceId } from '../../domain/shared/ids';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import { formatConsumptionDetail, sumConsumedAmount } from './consumption';

/**
 * Use case: a project consumes part of a quantity resource allocated to it.
 * The consumption is recorded as a `Record` plus a 'consumes' `Relation` from
 * that record to the resource; the relation's detail carries the JSON payload
 * `{ projectId, amount }`. Time resources are excluded by product decision.
 */
export class ConsumeResourceService {
  constructor(
    private readonly resources: ResourceRepository,
    private readonly relations: RelationRepository,
    private readonly records: RecordRepository,
  ) {}

  async consume(params: {
    recordId: RecordId;
    relationId: RelationId;
    resourceId: ResourceId;
    projectId: ProjectId;
    amount: number;
    now: Date;
  }): Promise<void> {
    const resource = await this.resources.findById(params.resourceId);
    if (resource === null) {
      throw new DomainError(`Unknown resource: ${params.resourceId}`);
    }
    if (resource.archived) {
      throw new DomainError('Cannot consume from an archived resource');
    }
    if (resource.kind !== 'quantity') {
      throw new DomainError('Only quantity resources can be consumed');
    }
    const allocation = resource.allocations.find((a) => a.projectId === params.projectId);
    if (allocation === undefined) {
      throw new DomainError(
        `Resource ${params.resourceId} is not allocated to project ${params.projectId}`,
      );
    }
    const consumed = await sumConsumedAmount(this.relations, resource.id, params.projectId);
    if (consumed + params.amount > allocation.amount) {
      throw new DomainError(
        `Consumption exceeds the allocation: ${consumed} consumed, ` +
          `${params.amount} requested, ${allocation.amount} allocated`,
      );
    }

    await this.records.append(
      Record.create({
        id: params.recordId,
        kind: 'resourceConsumed',
        detail: `Consumed ${params.amount} from “${resource.name}”`,
        occurredAt: params.now,
      }),
    );
    await this.relations.save(
      Relation.create({
        id: params.relationId,
        sourceType: 'record',
        sourceId: params.recordId,
        targetType: 'resource',
        targetId: resource.id,
        kind: 'consumes',
        now: params.now,
        detail: formatConsumptionDetail({
          projectId: params.projectId,
          amount: params.amount,
        }),
      }),
    );
  }
}
