import type { IconName } from '../components/Icon';

/** Shared activity glyph mapping for dashboard and entity timelines. */
export function activityIcon(kind: string): IconName {
  if (kind.endsWith('Completed')) return 'check';
  if (kind.endsWith('Created') || kind.endsWith('Reopened')) return 'plus';
  if (kind === 'resourceConsumed') return 'banknote';
  if (kind.endsWith('Failed')) return 'alert';
  if (kind.endsWith('Started') || kind.endsWith('Resumed')) return 'play';
  if (kind.endsWith('Captured')) return 'bulb';
  if (kind.endsWith('Paused')) return 'pauseCircle';
  return 'doc';
}
