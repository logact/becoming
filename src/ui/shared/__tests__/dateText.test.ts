import { parseDateText, parseDateTimeText } from '../dateText';

describe('parseDateText', () => {
  it('parses a valid YYYY-MM-DD date at local midnight', () => {
    const date = parseDateText('2026-10-18');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(18);
    expect(date?.getHours()).toBe(0);
    expect(date?.getMinutes()).toBe(0);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDateText('  2026-10-18 ')).not.toBeNull();
  });

  it('rejects malformed and impossible dates', () => {
    expect(parseDateText('')).toBeNull();
    expect(parseDateText('2026-1-8')).toBeNull();
    expect(parseDateText('2026/10/18')).toBeNull();
    expect(parseDateText('2026-13-01')).toBeNull();
    expect(parseDateText('2026-02-30')).toBeNull();
    expect(parseDateText('not-a-date')).toBeNull();
  });
});

describe('parseDateTimeText', () => {
  it('parses a valid YYYY-MM-DD HH:mm date-time', () => {
    const date = parseDateTimeText('2026-09-06 07:30');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(6);
    expect(date?.getHours()).toBe(7);
    expect(date?.getMinutes()).toBe(30);
  });

  it('rejects malformed and impossible date-times', () => {
    expect(parseDateTimeText('')).toBeNull();
    expect(parseDateTimeText('2026-09-06')).toBeNull();
    expect(parseDateTimeText('2026-09-06T07:30')).toBeNull();
    expect(parseDateTimeText('2026-09-06 24:00')).toBeNull();
    expect(parseDateTimeText('2026-09-06 07:60')).toBeNull();
    expect(parseDateTimeText('2026-02-30 07:30')).toBeNull();
  });
});
