import type { TimelineEvent } from '../../domain/timelineEvent';

/** One presentable activity row: a non-color icon plus a short sentence. */
export interface GoalActivityDescription {
  icon: string;
  text: string;
}

/**
 * Translate a persisted timeline event into a short, readable activity line.
 * This is presentation-only translation of the structured event contract —
 * the timeline query service remains the source of history.
 */
export function describeGoalActivity(event: TimelineEvent): GoalActivityDescription {
  const payload = event.payload;
  if (payload.kind === 'mutation') {
    switch (payload.action) {
      case 'create':
        return { icon: '＋', text: 'Goal created' };
      case 'update':
        return { icon: '✎', text: 'Goal updated' };
      case 'archive':
        return { icon: '▣', text: 'Goal archived' };
      default:
        return { icon: '•', text: event.summary };
    }
  }
  if (payload.kind === 'relation' || payload.kind === 'lineage') {
    return payload.action === 'relation_created'
      ? { icon: '↗', text: 'A relationship became active' }
      : { icon: '−', text: 'A relationship ended; the previous association remains in history' };
  }
  return { icon: '•', text: event.summary };
}

/** Compact, deterministic timestamp for activity rows. */
export function formatActivityTime(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 16).replace('T', ' ');
}
