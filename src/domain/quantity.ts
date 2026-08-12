import { Decimal } from './decimal';

/**
 * A resource quantity: an exact `Decimal` amount paired with a measurement
 * unit (e.g. 8 hour, 12500 JPY, 3000 token).
 *
 * Quantities are the building block for everything the resource model counts:
 * catalog capacity, project budgets, task allocations, and recorded
 * consumption. Two rules keep them safe to combine:
 *
 * - The amount is always a `Decimal`, never a binary float; constructing
 *   from a `number` is rejected so precision cannot leak in.
 * - Arithmetic and comparison require matching units; mixing units is a
 *   domain error, not an implicit conversion. Unit conversion is an
 *   application concern and stays out of this value object.
 */
export class Quantity {
  private constructor(
    readonly amount: Decimal,
    readonly unit: string,
  ) {}

  /** Create a Quantity from an exact amount and a non-blank unit. */
  static of(amount: Decimal | string, unit: string): Quantity {
    const decimal =
      typeof amount === 'string' ? Decimal.parse(amount) : amount;
    if (unit.trim().length === 0) {
      throw new Error('Quantity unit must not be blank');
    }
    return new Quantity(decimal, unit);
  }

  static zero(unit: string): Quantity {
    return Quantity.of(Decimal.zero(), unit);
  }

  isNegative(): boolean {
    return this.amount.compare(Decimal.zero()) < 0;
  }

  add(other: Quantity): Quantity {
    this.requireSameUnit(other);
    return new Quantity(this.amount.add(other.amount), this.unit);
  }

  subtract(other: Quantity): Quantity {
    this.requireSameUnit(other);
    return new Quantity(this.amount.subtract(other.amount), this.unit);
  }

  compare(other: Quantity): number {
    this.requireSameUnit(other);
    return this.amount.compare(other.amount);
  }

  equals(other: Quantity): boolean {
    return this.unit === other.unit && this.amount.equals(other.amount);
  }

  /** Canonical display/persistence form, e.g. `2.5 hour`. */
  toString(): string {
    return `${this.amount.toString()} ${this.unit}`;
  }

  private requireSameUnit(other: Quantity): void {
    if (this.unit !== other.unit) {
      throw new Error(
        `Cannot combine quantities with different units: "${this.unit}" and "${other.unit}"`,
      );
    }
  }
}
