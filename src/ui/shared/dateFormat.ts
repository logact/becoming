/**
 * Formats picker values for people, not persistence. The Date is passed to
 * Intl directly so its local calendar fields are displayed without a UTC
 * conversion that could move a date-only value to an adjacent day.
 */
export function formatLocalDate(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(value);
}

/** Locale-aware local date and time used by shared date-time picker rows. */
export function formatLocalDateTime(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}
