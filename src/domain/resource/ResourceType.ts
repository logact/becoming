import { DomainError } from '../shared/errors';
import type { ResourceTypeId } from '../shared/ids';

export type ResourceTypeKind = 'quantity' | 'time';

/**
 * A user-defined kind of resource, e.g. 'budget' (quantity, unit 'USD') or
 * 'focus time' (time, unit 'minutes'). Resources reference a type; the type
 * owns the unit and the quantity/time discriminant.
 */
export class ResourceType {
  private constructor(
    /** Unique identifier of the resource type. */
    readonly id: ResourceTypeId,
    /** Display name of the type; must not be blank. */
    private _name: string,
    /** Whether resources of this type are measured by amount or by time spans. */
    readonly kind: ResourceTypeKind,
    /** Unit amounts are measured in, e.g. 'USD', 'tokens'; 'minutes' for time. */
    readonly unit: string,
    /** Independent archive flag; archiving never overwrites anything else. */
    private _archived: boolean,
    /** When the type was created. */
    readonly createdAt: Date,
    /** When the type was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: ResourceTypeId;
    name: string;
    kind: ResourceTypeKind;
    unit: string;
    now: Date;
  }): ResourceType {
    if (params.name.trim().length === 0) {
      throw new DomainError('ResourceType name must not be empty');
    }
    if (params.unit.trim().length === 0) {
      throw new DomainError('ResourceType unit must not be empty');
    }
    return new ResourceType(
      params.id,
      params.name,
      params.kind,
      params.unit,
      false,
      params.now,
      params.now,
    );
  }

  get name(): string {
    return this._name;
  }

  get archived(): boolean {
    return this._archived;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  rename(name: string, now: Date): void {
    if (name.trim().length === 0) {
      throw new DomainError('ResourceType name must not be empty');
    }
    this._name = name;
    this._updatedAt = now;
  }

  /** Archive is an independent flag and never overwrites anything else. */
  archive(now: Date): void {
    this._archived = true;
    this._updatedAt = now;
  }

  unarchive(now: Date): void {
    this._archived = false;
    this._updatedAt = now;
  }
}
