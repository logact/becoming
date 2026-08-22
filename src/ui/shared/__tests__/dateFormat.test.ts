import { formatLocalDate, formatLocalDateTime } from '../dateFormat';

describe('local date display formatting', () => {
  it('formats date-only values through local calendar fields', () => {
    expect(formatLocalDate(new Date(2026, 7, 22), 'en-US')).toBe('Aug 22, 2026');
  });

  it('includes the locally selected hour and minute for date-times', () => {
    const formatted = formatLocalDateTime(new Date(2026, 7, 22, 7, 5), 'en-US');
    expect(formatted).toContain('Aug 22, 2026');
    expect(formatted).toContain('7:05');
  });
});
