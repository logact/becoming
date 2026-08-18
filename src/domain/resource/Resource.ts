import { DomainError } from '../shared/errors';
import type {
  AllocationId,
  LabelId,
  ProjectId,
  ResourceId,
  ResourceTypeId,
} from '../shared/ids';
import { ResourceAllocation, type TimeSpan } from './ResourceAllocation';
import type { ResourceTypeKind } from './ResourceType';

/**
 * A global pool of one ResourceType with a total amount (minutes for time
 * resources). Not owned by any project; projects receive portions of the pool
 * through allocations. The total allocated never exceeds the pool amount.
 */
export class Resource {
  private constructor(
    /** Unique identifier of the resource. */
    readonly id: ResourceId,
    /** The type this resource is a pool of. */
    readonly typeId: ResourceTypeId,
    /** Quantity or time; denormalized from the type at creation. */
    readonly kind: ResourceTypeKind,
    /** Display name of the resource, e.g. 'weekly focus time'. */
    private _name: string,
    /** Total pool size; never negative and never below the total allocated. */
    private _amount: number,
    /** Portions of the pool assigned to projects; mutated only via methods. */
    readonly allocations: ResourceAllocation[],
    /** Independent archive flag; archiving never overwrites anything else. */
    private _archived: boolean,
    /** Labels attached to the resource for classification. */
    readonly labelIds: LabelId[],
    /** When the resource was created. */
    readonly createdAt: Date,
    /** When the resource was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: ResourceId;
    typeId: ResourceTypeId;
    kind: ResourceTypeKind;
    name: string;
    amount: number;
    now: Date;
  }): Resource {
    if (!Number.isFinite(params.amount) || params.amount < 0) {
      throw new DomainError(`Invalid resource amount: ${params.amount}`);
    }
    return new Resource(
      params.id,
      params.typeId,
      params.kind,
      params.name,
      params.amount,
      [],
      false,
      [],
      params.now,
      params.now,
    );
  }

  get name(): string {
    return this._name;
  }

  get amount(): number {
    return this._amount;
  }

  /** Pool amount not currently allocated to any project. */
  get available(): number {
    return (
      this._amount -
      this.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    );
  }

  get archived(): boolean {
    return this._archived;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Applies a signed delta; rejects non-finite results, negative totals, and results below the total allocated. */
  adjust(delta: number, now: Date): void {
    const next = this._amount + delta;
    if (!Number.isFinite(next) || next < 0) {
      throw new DomainError(`Invalid resource amount: ${next}`);
    }
    if (next < this._amount - this.available) {
      throw new DomainError('Resource amount cannot be below the total allocated');
    }
    this._amount = next;
    this._updatedAt = now;
  }

  /**
   * Unified allocation: time resources take a `span` (the amount is derived as
   * its duration), quantity resources take an `amount`.
   */
  allocate(
    params: {
      id: AllocationId;
      projectId: ProjectId;
      amount?: number;
      span?: TimeSpan;
    },
    now: Date,
  ): ResourceAllocation {
    if (this._archived) {
      throw new DomainError('Cannot allocate from an archived resource');
    }
    if (this.kind === 'time' && params.span === undefined) {
      throw new DomainError('Time resources are allocated with a span');
    }
    if (this.kind === 'quantity' && params.amount === undefined) {
      throw new DomainError('Quantity resources are allocated with an amount');
    }
    if (params.amount !== undefined && params.span !== undefined) {
      throw new DomainError('Allocate with either an amount or a span, not both');
    }
    const allocation = ResourceAllocation.create({
      id: params.id,
      projectId: params.projectId,
      amount: params.amount,
      span: params.span,
      now,
    });
    if (allocation.amount > this.available) {
      throw new DomainError('Allocation exceeds the available amount');
    }
    ResourceAllocation.assertNoOverlap(this.allocations, allocation);
    this.allocations.push(allocation);
    this._updatedAt = now;
    return allocation;
  }

  /**
   * Unified adjust of an existing allocation: `amount` for quantity
   * allocations, `span` for time allocations (amount follows the duration).
   */
  adjustAllocation(
    allocationId: AllocationId,
    params: { amount?: number; span?: TimeSpan },
    now: Date,
  ): void {
    const allocation = this.allocations.find((a) => a.id === allocationId);
    if (allocation === undefined) {
      throw new DomainError(`Unknown allocation: ${allocationId}`);
    }
    if (params.span !== undefined) {
      const candidate = ResourceAllocation.create({
        id: allocation.id,
        projectId: allocation.projectId,
        span: params.span,
        now,
      });
      if (candidate.amount > this.available + allocation.amount) {
        throw new DomainError('Allocation exceeds the available amount');
      }
      ResourceAllocation.assertNoOverlap(
        this.allocations,
        candidate,
        allocationId,
      );
      allocation.adjust({ span: params.span }, now);
    } else {
      if (params.amount === undefined) {
        throw new DomainError('Adjust with either an amount or a span');
      }
      if (params.amount > this.available + allocation.amount) {
        throw new DomainError('Allocation exceeds the available amount');
      }
      allocation.adjust({ amount: params.amount }, now);
    }
    this._updatedAt = now;
  }

  /** Removes an allocation, returning its amount to the pool. */
  releaseAllocation(allocationId: AllocationId, now: Date): void {
    const index = this.allocations.findIndex((a) => a.id === allocationId);
    if (index < 0) {
      throw new DomainError(`Unknown allocation: ${allocationId}`);
    }
    this.allocations.splice(index, 1);
    this._updatedAt = now;
  }

  rename(name: string, now: Date): void {
    if (name.trim().length === 0) {
      throw new DomainError('Resource name must not be empty');
    }
    this._name = name;
    this._updatedAt = now;
  }

  /** Archive is an independent flag and never overwrites status. */
  archive(now: Date): void {
    this._archived = true;
    this._updatedAt = now;
  }

  unarchive(now: Date): void {
    this._archived = false;
    this._updatedAt = now;
  }

  addLabel(labelId: LabelId): void {
    if (!this.labelIds.includes(labelId)) {
      this.labelIds.push(labelId);
    }
  }

  removeLabel(labelId: LabelId): void {
    const index = this.labelIds.indexOf(labelId);
    if (index >= 0) {
      this.labelIds.splice(index, 1);
    }
  }
}
