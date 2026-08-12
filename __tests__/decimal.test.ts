import { Decimal } from '../src/domain/decimal';

describe('Decimal', () => {
  it('canonicalizes equivalent spellings to one exact form', () => {
    expect(Decimal.parse('0.10').toString()).toBe('0.1');
    expect(Decimal.parse('00012.500').toString()).toBe('12.5');
    expect(Decimal.parse('-0').toString()).toBe('0');
    expect(Decimal.parse('+7').toString()).toBe('7');
    expect(Decimal.parse('-0.000').toString()).toBe('0');
  });

  it('round-trips values that binary floats cannot represent', () => {
    const cases = [
      '0.1',
      '0.2',
      '123456789.123456789',
      '999999999999999999.000000001',
      '-0.00000001',
      '1000000000000000000000',
    ];
    for (const value of cases) {
      expect(Decimal.parse(value).toString()).toBe(value);
    }
  });

  it('adds exactly where 0.1 + 0.2 would break in floats', () => {
    expect(
      Decimal.parse('0.1').add(Decimal.parse('0.2')).toString(),
    ).toBe('0.3');
    expect(
      Decimal.parse('999999999999999999.999999999')
        .add(Decimal.parse('0.000000001'))
        .toString(),
    ).toBe('1000000000000000000');
  });

  it('subtracts and compares exactly', () => {
    expect(
      Decimal.parse('8').subtract(Decimal.parse('2.5')).toString(),
    ).toBe('5.5');
    expect(Decimal.parse('2.50').equals(Decimal.parse('2.5'))).toBe(true);
    expect(Decimal.parse('-1').compare(Decimal.parse('0.5'))).toBe(-1);
  });

  it('rejects non-decimal input', () => {
    for (const bad of ['', 'abc', '1.2.3', '1e5', '0x10', '.5', '1.', 'NaN']) {
      expect(() => Decimal.parse(bad)).toThrow('Invalid decimal');
    }
  });
});
