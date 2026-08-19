const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** Eyebrow date above the dashboard header, e.g. "Tuesday, August 18". */
export function eyebrowDate(now: Date): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Compact absolute delta in the prototype's style ("2 h", "3 d").
 * Direction is composed by callers ("Due in 22 h", "Overdue 3 h"), so past
 * and future deltas format identically.
 */
export function relativeTime(date: Date, now: Date): string {
  const ms = Math.abs(date.getTime() - now.getTime());
  if (ms < HOUR_MS) {
    return `${Math.max(1, Math.floor(ms / MINUTE_MS))} min`;
  }
  if (ms < 48 * HOUR_MS) {
    return `${Math.floor(ms / HOUR_MS)} h`;
  }
  if (ms < 14 * DAY_MS) {
    return `${Math.floor(ms / DAY_MS)} d`;
  }
  return `${Math.floor(ms / WEEK_MS)} w`;
}
