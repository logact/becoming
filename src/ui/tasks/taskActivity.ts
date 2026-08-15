import type { TimelineEvent } from '../../domain/timelineEvent';

/** One presentable activity row: a non-color icon plus a short sentence. */
export interface TaskActivityDescription {
  icon: string;
  text: string;
}

/**
 * Translate a persisted timeline event into a short, readable activity line.
 * Membership events (`belongs_to` relations) name the Project association;
 * other relations keep the generic wording. This is presentation-only
 * translation of the structured event contract — the timeline query service
 * remains the source of history.
 */
export function describeTaskActivity(event: TimelineEvent): TaskActivityDescription {
  const payload = event.payload;
  if (payload.kind === 'mutation') {
    switch (payload.action) {
      case 'create':
        return { icon: '＋', text: 'Task created' };
      case 'update':
        return { icon: '✎', text: 'Task updated' };
      case 'archive':
        return { icon: '▣', text: 'Task archived' };
      default:
        return { icon: '•', text: event.summary };
    }
  }
  if (payload.kind === 'relation' || payload.kind === 'lineage') {
    const membership = event.relation?.type === 'belongs_to';
    if (payload.action === 'relation_created') {
      return membership
        ? { icon: '↗', text: 'Added to a Project' }
        : { icon: '↗', text: 'A relationship became active' };
    }
    return membership
      ? { icon: '−', text: 'Removed from a Project; the previous membership remains in history' }
      : { icon: '−', text: 'A relationship ended; the previous association remains in history' };
  }
  return { icon: '•', text: event.summary };
}

export { formatActivityTime } from '../goals/goalActivity';
