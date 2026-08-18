import { DomainError } from '../shared/errors';
import type { LabelId, ProjectId, ResourceId } from '../shared/ids';

export type ResourceKind = 'time' | 'money' | 'aiToken';

/** A resource a project can allocate: time, money, or AI tokens. */
export class Resource {
  private constructor(
    /** Unique identifier of the resource. */
    readonly id: ResourceId,
    /** Display name of the resource, e.g. 'weekly focus time'. */
    private _name: string,
    /** Category of the resource: time, money, or AI tokens. */
    readonly kind: ResourceKind,
    /** Current available amount; never negative, changed via adjust(). */
    private _amount: number,
    /** Unit the amount is measured in, e.g. 'hours', 'USD', 'tokens'. */
    readonly unit: string,
    /** The project this resource is allocated to, if any. */
    readonly projectId: ProjectId | undefined,
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
    name: string;
    kind: ResourceKind;
    amount: number;
    unit: string;
    projectId?: ProjectId;
    now: Date;
  }): Resource {
    return new Resource(
      params.id,
      params.name,
      params.kind,
      params.amount,
      params.unit,
      params.projectId,
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

  get archived(): boolean {
    return this._archived;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Applies a signed delta; rejects non-finite results and negative totals. */
  adjust(delta: number, now: Date): void {
    const next = this._amount + delta;
    if (!Number.isFinite(next) || next < 0) {
      throw new DomainError(`Invalid resource amount: ${next}`);
    }
    this._amount = next;
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
