import type {
  ProjectExecutionIntegrityFinding,
  ProjectExecutionNode,
  ProjectExecutionSnapshot,
} from './projectExecutionSnapshotService';

type ProgressSnapshot = Omit<ProjectExecutionSnapshot, 'progress'>;

/**
 * V1 Project progress policy.
 *
 * This is a pure interpretation of a `ProjectExecutionSnapshot`; it never
 * writes a lifecycle-derived value to Project or persistence.  The snapshot
 * is the authority for temporal scope: a current snapshot has already
 * excluded archived endpoints and ended relations, while a historical
 * snapshot (`asOf` or `includeEnded`) may include them.
 *
 * Each unique `type:id` snapshot node is considered once, so shared hierarchy
 * nodes and duplicate relation paths cannot inflate any count.  A node enters
 * the denominator only when it has at least one applicable machine, every
 * applicable label has one valid current state, and no hierarchy/lifecycle
 * integrity finding qualifies that node.  Eligible nodes are complete when
 * every current state is terminal or uses a complete category; otherwise they
 * are incomplete or blocked.  Blocked nodes remain eligible denominator work
 * but never enter the numerator.
 *
 * V1 recognizes normalized categories `complete` and `completed` as complete,
 * and `blocked` as blocked. State titles are deliberately not interpreted.
 * `isTerminal` always counts as complete regardless of category. Nodes with no
 * labels (`unmanaged`), labels without a machine (`no_machine`), or machines
 * without a current state (`uninitialized`) are reported separately and do not
 * invent denominator work. Invalid nodes are likewise excluded. Therefore an
 * empty Project and a zero denominator are valid non-error results with
 * `percentage: null`, not 100% completion.
 */
export const PROJECT_PROGRESS_V1_POLICY = {
  version: 'v1',
  completion: {
    terminalStateCountsComplete: true,
    normalizedCategories: ['complete', 'completed'],
  },
  blocked: { normalizedCategories: ['blocked'] },
  archivedAndEnded: {
    current: 'excluded by the current execution snapshot',
    historical: 'included only when explicitly represented by a historical execution snapshot',
  },
  zeroDenominatorPercentage: null,
} as const;

export type ProjectProgressNodeStatus =
  | 'complete'
  | 'incomplete'
  | 'blocked'
  | 'unmanaged'
  | 'no_machine'
  | 'uninitialized'
  | 'invalid';

export interface ProjectProgressFinding {
  node: { type: 'goal' | 'task'; id: string };
  status: ProjectProgressNodeStatus;
  reasons: readonly string[];
}

export interface ProjectProgress {
  /** The fixed V1 rule set used to derive this result. */
  policy: typeof PROJECT_PROGRESS_V1_POLICY;
  /** Current snapshots exclude ended/archive data; historical snapshots opt in explicitly. */
  scope: 'current' | 'historical';
  numerator: number;
  denominator: number;
  /** Null is intentional for a zero denominator; it is never an invented completion. */
  percentage: number | null;
  counts: Record<ProjectProgressNodeStatus, number>;
  findings: readonly ProjectProgressFinding[];
}

/** Derive explainable progress without mutating the snapshot or any aggregate. */
export function deriveProjectProgress(snapshot: ProgressSnapshot): ProjectProgress {
  const invalidByNode = invalidReasons(snapshot.findings);
  const nodes = [...new Map(snapshot.nodes.map((node) => [nodeKey(node), node])).values()]
    .sort((a, b) => nodeKey(a).localeCompare(nodeKey(b)));
  const findings = nodes.map((node) => classify(node, invalidByNode.get(nodeKey(node)) ?? []));
  const counts: Record<ProjectProgressNodeStatus, number> = {
    complete: 0, incomplete: 0, blocked: 0, unmanaged: 0, no_machine: 0, uninitialized: 0, invalid: 0,
  };
  for (const finding of findings) counts[finding.status] += 1;
  const numerator = counts.complete;
  const denominator = counts.complete + counts.incomplete + counts.blocked;
  return {
    policy: PROJECT_PROGRESS_V1_POLICY,
    scope: snapshot.scope.includeEnded || snapshot.scope.asOf !== null ? 'historical' : 'current',
    numerator,
    denominator,
    percentage: denominator === 0 ? null : (numerator / denominator) * 100,
    counts,
    findings,
  };
}

function classify(node: ProjectExecutionNode, invalidReasons: readonly string[]): ProjectProgressFinding {
  const identity = { type: node.type, id: node.id } as const;
  if (invalidReasons.length > 0) return { node: identity, status: 'invalid', reasons: invalidReasons };
  if (node.lifecycle.kind === 'no_applicable_machine') return { node: identity, status: 'unmanaged', reasons: ['no_applicable_machine'] };
  const labels = node.lifecycle.labels;
  const anomalous = labels.filter((label) => label.status === 'anomalous');
  if (anomalous.length > 0) return { node: identity, status: 'invalid', reasons: anomalous.flatMap((label) => label.anomalies.map((anomaly) => anomaly.kind)) };
  if (labels.some((label) => label.status === 'no_machine')) return { node: identity, status: 'no_machine', reasons: ['no_machine'] };
  if (labels.some((label) => label.status === 'uninitialized')) return { node: identity, status: 'uninitialized', reasons: ['uninitialized'] };
  const states = labels.flatMap((label) => label.current === null ? [] : [label.current.state]);
  if (states.some((state) => normalizedCategory(state.category) === 'blocked')) return { node: identity, status: 'blocked', reasons: ['blocked_category'] };
  if (states.every((state) => state.isTerminal || isCompleteCategory(state.category))) return { node: identity, status: 'complete', reasons: ['terminal_or_complete_category'] };
  return { node: identity, status: 'incomplete', reasons: ['nonterminal_current_state'] };
}

function invalidReasons(findings: readonly ProjectExecutionIntegrityFinding[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const add = (type: 'goal' | 'task', id: string, reason: string) => {
    const key = `${type}:${id}`; const reasons = result.get(key) ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    result.set(key, reasons);
  };
  for (const finding of findings) {
    if (finding.kind === 'hierarchy') {
      const detail = finding.finding;
      if (detail.kind === 'missing_endpoint') add(detail.node.type, detail.node.id, `hierarchy:${detail.kind}`);
      if (detail.kind === 'duplicate_edge' || detail.kind === 'cycle') {
        add(detail.parent.type, detail.parent.id, `hierarchy:${detail.kind}`);
        add(detail.child.type, detail.child.id, `hierarchy:${detail.kind}`);
      }
      if (detail.kind === 'parent_cardinality') add(detail.child.type, detail.child.id, `hierarchy:${detail.kind}`);
    }
    if (finding.kind === 'overlapping_root') add(finding.root.type, finding.root.id, 'overlapping_root');
    if (finding.kind === 'traversal_truncated') add(finding.root.type, finding.root.id, 'traversal_truncated');
  }
  return result;
}

function nodeKey(node: Pick<ProjectExecutionNode, 'type' | 'id'>): string { return `${node.type}:${node.id}`; }
function normalizedCategory(value: string | null): string { return value?.trim().toLowerCase() ?? ''; }
function isCompleteCategory(value: string | null): boolean { return (PROJECT_PROGRESS_V1_POLICY.completion.normalizedCategories as readonly string[]).includes(normalizedCategory(value)); }
