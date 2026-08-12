import { Decimal } from '../src/domain/decimal';
import { Quantity } from '../src/domain/quantity';

describe('Quantity value object', () => {
  it('pairs an exact amount with a unit', () => {
    const quantity = Quantity.of('2.5', 'hour');

    expect(quantity.amount.toString()).toBe('2.5');
    expect(quantity.unit).toBe('hour');
    expect(quantity.toString()).toBe('2.5 hour');
  });

  it('accepts a Decimal amount and preserves exactness', () => {
    const quantity = Quantity.of(Decimal.parse('0.1'), 'token');

    expect(quantity.add(Quantity.of('0.2', 'token')).amount.toString()).toBe(
      '0.3',
    );
  });

  it('rejects a blank unit', () => {
    expect(() => Quantity.of('1', '  ')).toThrow(/unit/);
  });

  it('rejects an invalid decimal amount', () => {
    expect(() => Quantity.of('1e3', 'token')).toThrow(/Invalid decimal/);
  });

  it('adds and subtracts quantities with the same unit exactly', () => {
    const budget = Quantity.of('12500', 'JPY');

    expect(budget.subtract(Quantity.of('0.01', 'JPY')).toString()).toBe(
      '12499.99 JPY',
    );
  });

  it('rejects arithmetic and comparison across different units', () => {
    const hours = Quantity.of('8', 'hour');
    const yen = Quantity.of('12500', 'JPY');

    expect(() => hours.add(yen)).toThrow(/different units/);
    expect(() => hours.subtract(yen)).toThrow(/different units/);
    expect(() => hours.compare(yen)).toThrow(/different units/);
    expect(hours.equals(Quantity.of('8', 'JPY'))).toBe(false);
  });

  it('compares and equates quantities within the same unit', () => {
    expect(Quantity.of('8', 'hour').compare(Quantity.of('2.5', 'hour'))).toBe(
      1,
    );
    expect(Quantity.of('8.0', 'hour').equals(Quantity.of('8', 'hour'))).toBe(
      true,
    );
  });

  it('detects negative amounts and builds zero for a unit', () => {
    expect(Quantity.of('-1', 'hour').isNegative()).toBe(true);
    expect(Quantity.zero('hour').isNegative()).toBe(false);
    expect(Quantity.zero('hour').amount.toString()).toBe('0');
  });
});
