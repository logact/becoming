/**
 * Pure presentation model for the Project detail Progress segment (#136).
 *
 * Translates the authoritative Project execution snapshot
 * (`ProjectExecutionSnapshotService` + `deriveProjectProgress`) into display
 * rows: category labels/icons, affected-work finding descriptions, and
 * integrity-finding sentences. The snapshot is the screen authority — this
 * module only orders, formats, and describes what it supplies. It never
 * derives membership, lifecycle category, integrity state, numerator,
 * denominator, or percentage itself.
 */
import type {
  ProjectExecutionIntegrityFinding,
  ProjectExecutionNode,
  ProjectExecutionSnapshot,
} from '../../../application/projectExecutionSnapshotService';
import type {
  ProjectProgressFinding,
  ProjectProgressNodeStatus,
} from '../../../application/projectProgress';
import type { StatusBadgeTone } from '../../shared/StatusBadge';
import { describeStructureFinding } from '../structure/structureTree';

export interface WorkCategoryPresentation {
  status: ProjectProgressNodeStatus;
  label: string;
  icon: string;
  tone: StatusBadgeTone;
}

const CATEGORY_PRESENTATION: Record<
  ProjectProgressNodeStatus,
  { label: string; icon: string; tone: StatusBadgeTone }
> = {
  complete: { label: 'Complete', icon: '✓', tone: 'success' },
  incomplete: { label: 'Incomplete', icon: '◐', tone: 'info' },
  blocked: { label: 'Blocked', icon: '!', tone: 'danger' },
  unmanaged: { label: 'Unmanaged', icon: '◌', tone: 'neutral' },
  no_machine: { label: 'No machine', icon: '◌', tone: 'neutral' },
  uninitialized: { label: 'Uninitialized', icon: '○', tone: 'warning' },
  invalid: { label: 'Invalid', icon: '!', tone: 'danger' },
};

function category(status: ProjectProgressNodeStatus): WorkCategoryPresentation {
  return { status, ...CATEGORY_PRESENTATION[status] };
}

/** Categories that form the measurable denominator, in fixed display order. */
export const MEASURABLE_CATEGORIES: readonly WorkCategoryPresentation[] = [
  category('complete'),
  category('incomplete'),
  category('blocked'),
];

/** Categories the snapshot keeps visibly outside the measurable denominator. */
export const NON_MEASURABLE_CATEGORIES: readonly WorkCategoryPresentation[] = [
  category('unmanaged'),
  category('no_machine'),
  category('uninitialized'),
  category('invalid'),
];

/**
 * Progress-finding statuses that become actionable affected-work rows (the
 * prototype surfaces invalid and uninitialized work). Blocked, complete, and
 * incomplete are ordinary measurable states, not findings.
 */
const ACTIONABLE_STATUSES: readonly ProjectProgressNodeStatus[] = ['invalid', 'uninitialized'];

/**
 * The snapshot's affected-work findings worth acting on, in the snapshot's
 * own deterministic (typed node key) order.
 */
export function actionableWorkFindings(
  snapshot: ProjectExecutionSnapshot,
): ProjectProgressFinding[] {
  return snapshot.progress.findings.filter((finding) =>
    ACTIONABLE_STATUSES.includes(finding.status),
  );
}

/** The snapshot node a progress finding refers to, when it is still visible. */
export function findSnapshotNode(
  snapshot: ProjectExecutionSnapshot,
  ref: { type: 'goal' | 'task'; id: string },
): ProjectExecutionNode | null {
  return (
    snapshot.nodes.find((node) => node.type === ref.type && node.id === ref.id) ?? null
  );
}

/** The entity title carried by the snapshot node; null for a missing endpoint. */
export function nodeTitle(node: ProjectExecutionNode | null): string | null {
  if (node === null) return null;
  return node.type === 'goal' ? (node.goal?.title ?? null) : (node.task?.title ?? null);
}

/**
 * The current lifecycle state title carried by the snapshot node, when one is
 * supplied. Returned verbatim — presentation never interprets its category.
 */
export function nodeCurrentStateTitle(node: ProjectExecutionNode | null): string | null {
  if (node === null || node.lifecycle.kind !== 'managed') return null;
  return (
    node.lifecycle.labels.find((label) => label.current !== null)?.current?.state.title ?? null
  );
}

/** Badge presentation for an affected-work finding's snapshot status. */
export function findingStatusPresentation(status: ProjectProgressNodeStatus): {
  label: string;
  icon: string;
  tone: StatusBadgeTone;
} {
  return CATEGORY_PRESENTATION[status];
}

const REASON_TEXT: Record<string, string> = {
  no_applicable_machine: 'No lifecycle machine manages this work',
  no_machine: 'A label has no machine defined in this Project',
  uninitialized: 'The machine has no current state for this work yet',
  blocked_category: 'A current state is in a blocked category',
  terminal_or_complete_category: 'Every current state is terminal or complete',
  nonterminal_current_state: 'A current state is not terminal',
  overlapping_root: 'This pursued Goal is also reachable inside another root',
  traversal_truncated: 'Traversal was truncated before reaching this work',
  orphan_label: 'A lifecycle assignment references a missing label',
  multiple_current_states: 'More than one current lifecycle state is stored',
  missing_project_state: 'A current lifecycle state references a missing state definition',
  project_state_machine_mismatch: 'A stored lifecycle state belongs to a different machine',
  'hierarchy:missing_endpoint': 'A decomposition edge endpoint is missing',
  'hierarchy:duplicate_edge': 'Duplicate decomposition edges are stored',
  'hierarchy:cycle': 'The decomposition structure contains a cycle',
  'hierarchy:parent_cardinality': 'This work has more than one active parent',
};

/**
 * A concise sentence for one snapshot-supplied finding reason. Unknown codes
 * fall back to the raw reason so the structured identity is never hidden.
 */
export function describeFindingReason(reason: string): string {
  return REASON_TEXT[reason] ?? `Integrity reason: ${reason}`;
}

/** One presentable snapshot integrity-finding row: a non-color icon plus a short sentence. */
export function describeIntegrityFinding(
  finding: ProjectExecutionIntegrityFinding,
): { icon: string; text: string } {
  switch (finding.kind) {
    case 'missing_project':
      return { icon: '!', text: 'This Project could not be loaded; the snapshot is incomplete.' };
    case 'archived_entity_excluded':
      return {
        icon: '○',
        text: `An archived ${finding.node.type} is excluded from the current snapshot.`,
      };
    case 'duplicate_pursuit':
      return {
        icon: '!',
        text: 'Duplicate active Goal pursuits are stored; the Goal is counted once.',
      };
    case 'duplicate_membership':
      return {
        icon: '!',
        text: 'Duplicate active Task memberships are stored; the Task is counted once.',
      };
    case 'overlapping_root':
      return {
        icon: '!',
        text: 'A pursued Goal is also reachable inside another pursued root; it is counted once.',
      };
    case 'disconnected_active_task':
      return {
        icon: '○',
        text: 'A member Task is not connected to the decomposition structure; it still counts as Project work.',
      };
    case 'traversal_truncated': {
      const truncation = finding.truncation;
      const reasons = [
        truncation.nodeLimitReached ? `node limit ${truncation.maxNodes}` : null,
        truncation.depthLimitReached ? `depth limit ${truncation.maxDepth}` : null,
      ]
        .filter((reason): reason is string => reason !== null)
        .join(' and ');
      return {
        icon: '✂',
        text: `Traversal reached the display limit (${reasons}). Progress may reflect a partial structure.`,
      };
    }
    case 'pursuit_relation_anomaly':
      return {
        icon: '!',
        text: `A Goal-pursuit relation needs inspection (${finding.anomaly.kind}).`,
      };
    case 'membership_relation_anomaly':
      return {
        icon: '!',
        text: `A Task-membership relation needs inspection (${finding.anomaly.kind}).`,
      };
    case 'hierarchy':
      return describeStructureFinding(finding.finding);
  }
}

/**
 * Display formatting for the snapshot-supplied percentage: whole percentages
 * render without decimals, others with one. This never recomputes the value —
 * a null percentage (zero denominator) is handled by the caller and never
 * reaches this function.
 */
export function formatPercentage(percentage: number): string {
  const rounded = Math.round(percentage * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
