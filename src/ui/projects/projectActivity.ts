import type { TimelineEvent } from '../../domain/timelineEvent';

/** One presentable activity row: a non-color icon plus a short sentence. */
export interface ProjectActivityDescription {
  icon: string;
  text: string;
}

/**
 * Translate a persisted Project timeline event into a short, readable
 * activity line. Presentation-only translation of the structured event
 * contract — the timeline query service remains the source of history.
 */
export function describeProjectActivity(event: TimelineEvent): ProjectActivityDescription {
  const payload = event.payload;
  if (payload.kind === 'mutation') {
    switch (payload.action) {
      case 'create':
        return { icon: '＋', text: 'Project created' };
      case 'update':
        return { icon: '✎', text: 'Project updated' };
      case 'archive':
        return { icon: '▣', text: 'Project archived' };
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
