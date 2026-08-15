import type { EntityId } from '../../domain/ids';
import type { ProjectExecutionSnapshot } from '../../application/projectExecutionSnapshotService';
import type { ProjectProgressNodeStatus } from '../../application/projectProgress';
import type { StatusBadgeTone } from '../shared/StatusBadge';

/**
 * The lifecycle presentation for one Task: a compact badge plus a longer fact
 * line for the detail. Lifecycle is inspect-only in M2 — this module only
 * translates the authoritative Project execution snapshot; it never derives
 * lifecycle categories itself.
 */
export interface TaskLifecyclePresentation {
  badgeLabel: string;
  badgeIcon: string;
  badgeTone: StatusBadgeTone;
  /** Longer line for the detail's Lifecycle fact. */
  factText: string;
}

/** A Task without an active Project membership has no lifecycle context. */
export const STANDALONE_TASK_LIFECYCLE: TaskLifecyclePresentation = {
  badgeLabel: 'Standalone',
  badgeIcon: '◌',
  badgeTone: 'neutral',
  factText: 'No active Project membership, so no lifecycle context yet.',
};

const STATUS_PRESENTATION: Record<
  ProjectProgressNodeStatus,
  { label: string; icon: string; tone: StatusBadgeTone; fact: string }
> = {
  complete: { label: 'Complete', icon: '✓', tone: 'success', fact: 'Complete' },
  incomplete: { label: 'Incomplete', icon: '◐', tone: 'info', fact: 'Incomplete' },
  blocked: { label: 'Blocked', icon: '!', tone: 'danger', fact: 'Blocked' },
  unmanaged: {
    label: 'Unmanaged',
    icon: '◌',
    tone: 'neutral',
    fact: 'Unmanaged — no lifecycle machine manages this Task yet',
  },
  no_machine: {
    label: 'No machine',
    icon: '◌',
    tone: 'neutral',
    fact: 'No lifecycle machine is defined for this Task yet',
  },
  uninitialized: {
    label: 'Uninitialized',
    icon: '○',
    tone: 'warning',
    fact: 'The lifecycle machine has no current state for this Task yet',
  },
  invalid: {
    label: 'Needs inspection',
    icon: '!',
    tone: 'danger',
    fact: 'Needs inspection — the execution snapshot reports an integrity finding',
  },
};

/**
 * Translate a Project execution snapshot into this Task's lifecycle badge and
 * fact. The snapshot's progress findings classify the node; when a managed
 * label reports a current state, its title leads (matching the prototype's
 * state-name badge). Returns null when the Task is not a snapshot node — the
 * caller then shows no lifecycle badge rather than inventing one.
 */
export function taskLifecycleFromSnapshot(
  snapshot: ProjectExecutionSnapshot,
  taskId: EntityId,
): TaskLifecyclePresentation | null {
  const node = snapshot.nodes.find(
    (candidate) => candidate.type === 'task' && candidate.id === taskId,
  );
  if (node === undefined) return null;
  const finding = snapshot.progress.findings.find(
    (candidate) => candidate.node.type === 'task' && candidate.node.id === taskId,
  );
  const presentation = STATUS_PRESENTATION[finding?.status ?? 'unmanaged'];
  const stateTitle =
    node.lifecycle.kind === 'managed'
      ? node.lifecycle.labels.find((label) => label.current !== null)?.current?.state.title ?? null
      : null;
  return {
    badgeLabel: stateTitle ?? presentation.label,
    badgeIcon: presentation.icon,
    badgeTone: presentation.tone,
    factText: stateTitle ?? presentation.fact,
  };
}
