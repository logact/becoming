import { DomainError } from '../shared/errors';
import type { AllocationId, ProjectId } from '../shared/ids';

/** A concrete time span at minute precision; may span multiple days. */
export interface TimeSpan {
  readonly startAt: Date;
  readonly endAt: Date;
}

const MINUTE_MS = 60_000;

function isMinutePrecision(date: Date): boolean {
  return date.getSeconds() === 0 && date.getMilliseconds() === 0;
}

function spanDurationMinutes(span: TimeSpan): number {
  return (span.endAt.getTime() - span.startAt.getTime()) / MINUTE_MS;
}

function assertValidSpan(span: TimeSpan): void {
  if (!isMinutePrecision(span.startAt) || !isMinutePrecision(span.endAt)) {
    throw new DomainError('Time span must be at minute precision');
  }
  if (span.endAt.getTime() <= span.startAt.getTime()) {
    throw new DomainError('Time span end must be after its start');
  }
}

/**
 * A portion of a Resource's pool assigned to a project. Quantity allocations
 * carry only an amount; time allocations additionally carry a span and their
 * amount always equals the span's duration in minutes.
 */
export class ResourceAllocation {
  private constructor(
    /** Unique identifier of the allocation. */
    readonly id: AllocationId,
    /** The project this allocation serves. */
    readonly projectId: ProjectId,
    /** Allocated amount; for time allocations, the span's duration in minutes. */
    private _amount: number,
    /** The allocated time span; present only for allocations of time resources. */
    private _span: TimeSpan | undefined,
    /** When the allocation was created. */
    readonly createdAt: Date,
    /** When the allocation was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: AllocationId;
    projectId: ProjectId;
    amount?: number;
    span?: TimeSpan;
    now: Date;
  }): ResourceAllocation {
    if (params.span !== undefined) {
      assertValidSpan(params.span);
      const duration = spanDurationMinutes(params.span);
      if (params.amount !== undefined && params.amount !== duration) {
        throw new DomainError(
          `Time allocation amount ${params.amount} does not match span duration ${duration}`,
        );
      }
      return new ResourceAllocation(
        params.id,
        params.projectId,
        duration,
        params.span,
        params.now,
        params.now,
      );
    }
    if (params.amount === undefined) {
      throw new DomainError('Allocation requires an amount or a span');
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new DomainError(`Invalid allocation amount: ${params.amount}`);
    }
    return new ResourceAllocation(
      params.id,
      params.projectId,
      params.amount,
      undefined,
      params.now,
      params.now,
    );
  }

  /** Rebuilds from persistence; no invariants enforced beyond construction. */
  static restore(params: {
    id: AllocationId;
    projectId: ProjectId;
    amount: number;
    span?: TimeSpan;
    createdAt: Date;
    updatedAt: Date;
  }): ResourceAllocation {
    return new ResourceAllocation(
      params.id,
      params.projectId,
      params.amount,
      params.span,
      params.createdAt,
      params.updatedAt,
    );
  }

  get amount(): number {
    return this._amount;
  }

  get span(): TimeSpan | undefined {
    return this._span;
  }

  /** Duration of the span in minutes; undefined for quantity allocations. */
  get durationMinutes(): number | undefined {
    return this._span === undefined ? undefined : spanDurationMinutes(this._span);
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Unified adjust: pass `amount` for quantity allocations or `span` for time
   * allocations (the amount is recomputed from the new duration).
   */
  adjust(params: { amount?: number; span?: TimeSpan }, now: Date): void {
    if (this._span !== undefined) {
      if (params.span === undefined || params.amount !== undefined) {
        throw new DomainError('Time allocations are adjusted with a span');
      }
      assertValidSpan(params.span);
      this._span = params.span;
      this._amount = spanDurationMinutes(params.span);
    } else {
      if (params.amount === undefined || params.span !== undefined) {
        throw new DomainError('Quantity allocations are adjusted with an amount');
      }
      if (!Number.isFinite(params.amount) || params.amount <= 0) {
        throw new DomainError(`Invalid allocation amount: ${params.amount}`);
      }
      this._amount = params.amount;
    }
    this._updatedAt = now;
  }

  /** Half-open interval check; back-to-back spans do not overlap. */
  overlaps(other: ResourceAllocation): boolean {
    if (this._span === undefined || other._span === undefined) {
      return false;
    }
    return (
      this._span.startAt.getTime() < other._span.endAt.getTime() &&
      other._span.startAt.getTime() < this._span.endAt.getTime()
    );
  }

  /**
   * Throws if candidate's span overlaps any existing allocation's span.
   * `ignoreId` skips the allocation being adjusted. The global non-overlap
   * rule is applied by calling this with all time allocations across resources.
   */
  static assertNoOverlap(
    existing: ResourceAllocation[],
    candidate: ResourceAllocation,
    ignoreId?: AllocationId,
  ): void {
    if (candidate.span === undefined) {
      return;
    }
    for (const other of existing) {
      if (other.id !== ignoreId && other.overlaps(candidate)) {
        throw new DomainError(`Time span overlaps allocation ${other.id}`);
      }
    }
  }
}
