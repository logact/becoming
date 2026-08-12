/**
 * Exact decimal quantities (resource capacity, budget amounts, allocations,
 * consumption) must never pass through binary floating point. `Decimal` is an
 * exact base-10 value backed by a bigint mantissa and a scale, and its
 * canonical string form is what gets persisted in TEXT columns.
 *
 * Canonical form: optional leading `-`, no leading zeros (except `0` itself),
 * no trailing fractional zeros. `-0` normalizes to `0`.
 */
export class Decimal {
  private constructor(
    private readonly mantissa: bigint,
    private readonly scale: number,
  ) {}

  static parse(input: string): Decimal {
    if (!/^[+-]?\d+(\.\d+)?$/.test(input)) {
      throw new Error(`Invalid decimal: ${JSON.stringify(input)}`);
    }
    const negative = input.startsWith('-');
    const unsigned = input.replace(/^[+-]/, '');
    const [integerPart, fractionPart = ''] = unsigned.split('.');
    const digits = (integerPart + fractionPart).replace(/^0+(?=\d)/, '');
    let mantissa = BigInt(digits);
    if (negative && mantissa !== 0n) {
      mantissa = -mantissa;
    }
    return new Decimal(mantissa, fractionPart.length);
  }

  static zero(): Decimal {
    return new Decimal(0n, 0);
  }

  toString(): string {
    const negative = this.mantissa < 0n;
    let digits = (negative ? -this.mantissa : this.mantissa).toString();
    if (this.scale > 0) {
      digits = digits.padStart(this.scale + 1, '0');
      const split = digits.length - this.scale;
      digits = `${digits.slice(0, split)}.${digits.slice(split)}`;
    }
    let [integerPart, fractionPart = ''] = digits.split('.');
    integerPart = integerPart.replace(/^0+(?=\d)/, '');
    fractionPart = fractionPart.replace(/0+$/, '');
    const body =
      fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;
    return negative ? `-${body}` : body;
  }

  private align(other: Decimal): [bigint, bigint, number] {
    const scale = Math.max(this.scale, other.scale);
    return [
      this.mantissa * 10n ** BigInt(scale - this.scale),
      other.mantissa * 10n ** BigInt(scale - other.scale),
      scale,
    ];
  }

  add(other: Decimal): Decimal {
    const [a, b, scale] = this.align(other);
    return new Decimal(a + b, scale);
  }

  negate(): Decimal {
    return new Decimal(-this.mantissa, this.scale);
  }

  subtract(other: Decimal): Decimal {
    return this.add(other.negate());
  }

  compare(other: Decimal): number {
    const [a, b] = this.align(other);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  equals(other: Decimal): boolean {
    return this.compare(other) === 0;
  }
}
