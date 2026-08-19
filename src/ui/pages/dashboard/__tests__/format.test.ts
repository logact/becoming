import { eyebrowDate, relativeTime } from '../format';

describe('eyebrowDate', () => {
  it('formats long weekday, long month and numeric day in en-US', () => {
    expect(eyebrowDate(new Date(2026, 7, 18))).toBe('Tuesday, August 18');
  });
});

describe('relativeTime', () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);
  const ago = (ms: number): Date => new Date(now.getTime() - ms);
  const ahead = (ms: number): Date => new Date(now.getTime() + ms);

  it('shows whole minutes below one hour, at least 1', () => {
    expect(relativeTime(ago(30 * 1000), now)).toBe('1 min');
    expect(relativeTime(ago(59 * 60 * 1000), now)).toBe('59 min');
  });

  it('shows hours below 48', () => {
    expect(relativeTime(ago(60 * 60 * 1000), now)).toBe('1 h');
    expect(relativeTime(ago(47 * 60 * 60 * 1000), now)).toBe('47 h');
  });

  it('shows days below 14', () => {
    expect(relativeTime(ago(48 * 60 * 60 * 1000), now)).toBe('2 d');
    expect(relativeTime(ago(13 * 24 * 60 * 60 * 1000), now)).toBe('13 d');
  });

  it('shows weeks from 14 days up', () => {
    expect(relativeTime(ago(14 * 24 * 60 * 60 * 1000), now)).toBe('2 w');
  });

  it('uses the absolute delta, so future dates format like past ones', () => {
    expect(relativeTime(ahead(22 * 60 * 60 * 1000), now)).toBe('22 h');
    expect(relativeTime(ahead(3 * 60 * 1000), now)).toBe('3 min');
  });
});
