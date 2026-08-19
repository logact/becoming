/**
 * Strict text-input date parsing (no date-picker dependency): `YYYY-MM-DD`
 * for dates, `YYYY-MM-DD HH:mm` for span endpoints. Both return a local-time
 * Date or null when the text does not match the pattern or is not a real
 * calendar date.
 */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

/** Parses a strict `YYYY-MM-DD` date into local midnight; null when invalid. */
export function parseDateText(text: string): Date | null {
  const match = DATE_PATTERN.exec(text.trim());
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // The Date constructor rolls overflow dates (e.g. Feb 30) into the next
  // month; reject anything that does not round-trip.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Parses a strict `YYYY-MM-DD HH:mm` local date-time; null when invalid. */
export function parseDateTimeText(text: string): Date | null {
  const match = DATE_TIME_PATTERN.exec(text.trim());
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return date;
}
