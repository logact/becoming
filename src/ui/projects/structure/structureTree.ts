/**
 * Pure presentation model for the Project detail Structure segment (#135).
 *
 * Translates the bounded decomposition traversal read model
 * (`DecompositionHierarchyQueryService`) into a deterministic indented row
 * list, and derives picker-candidate rejections from application query
 * results. Every validity decision stays in the domain/application services —
 * this module only orders, nests, deduplicates, and describes what they
 * return. It never fabricates a hierarchy root: roots are the Project's
 * actively pursued Goals, the same read model the execution snapshot uses.
 */
import type {
  DecompositionHierarchyEdge,
  DecompositionHierarchyIntegrityFinding,
  DecompositionNode,
  DecompositionTraversalResult,
} from '../../../application/decompositionHierarchyQueryService';
import type { CandidateRejection } from '../../relations';

/**
 * The management-label context the app passes when resolving decomposition
 * workflow guidance. When no applicability is configured for it, the
 * decomposition service rejects the commit and the #133 workflow-guidance
 * feedback is shown — presentation never bypasses guidance.
 */
export const DECOMPOSITION_MANAGEMENT_LABEL_ID = 'management';

export type StructureNodeRef = DecompositionNode;

/** Stable typed node identity; expansion state is keyed by this. */
export function structureNodeKey(node: StructureNodeRef): string {
  return `${node.type}:${node.id}`;
}

export function sameStructureNode(a: StructureNodeRef, b: StructureNodeRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/** One pursued-Goal root plus its bounded descendant traversal. */
export interface StructureRootTraversal {
  root: StructureNodeRef;
  traversal: DecompositionTraversalResult;
}

/** One visible tree row. */
export interface StructureRow {
  node: StructureNodeRef;
  depth: number;
  /** The active edge connecting this row to its parent; null on roots. */
  via: DecompositionHierarchyEdge | null;
  hasChildren: boolean;
}

/**
 * Flatten the traversals into indented rows: roots in pursuit order, children
 * in the query's deterministic edge order (creation time, then relation id),
 * depth-first. Collapsed branches (by stable typed node key) are pruned; a
 * node already emitted under one root is never re-emitted, so corrupt cycles
 * cannot loop the render.
 */
export function buildStructureRows(
  roots: readonly StructureRootTraversal[],
  collapsed: ReadonlySet<string>,
): StructureRow[] {
  const rows: StructureRow[] = [];
  for (const { root, traversal } of roots) {
    const childrenByParent = new Map<string, DecompositionHierarchyEdge[]>();
    for (const edge of traversal.edges) {
      const key = structureNodeKey(edge.parent);
      const list = childrenByParent.get(key) ?? [];
      list.push(edge);
      childrenByParent.set(key, list);
    }
    const emitted = new Set<string>([structureNodeKey(root)]);
    const visit = (node: StructureNodeRef, depth: number, via: DecompositionHierarchyEdge | null): void => {
      const children = (childrenByParent.get(structureNodeKey(node)) ?? []).filter(
        (edge) => !emitted.has(structureNodeKey(edge.child)),
      );
      rows.push({ node, depth, via, hasChildren: children.length > 0 });
      if (collapsed.has(structureNodeKey(node))) return;
      for (const edge of children) {
        emitted.add(structureNodeKey(edge.child));
        visit(edge.child, depth + 1, edge);
      }
    };
    visit(root, 0, null);
  }
  return rows;
}

/** Every distinct active edge across the root traversals, in deterministic order. */
export function collectStructureEdges(
  roots: readonly StructureRootTraversal[],
): DecompositionHierarchyEdge[] {
  return [
    ...new Map(
      roots.flatMap(({ traversal }) => traversal.edges).map((edge) => [edge.relationId, edge]),
    ).values(),
  ];
}

/** Distinct integrity findings across the root traversals, first occurrence wins. */
export function collectStructureFindings(
  roots: readonly StructureRootTraversal[],
): DecompositionHierarchyIntegrityFinding[] {
  const seen = new Set<string>();
  const findings: DecompositionHierarchyIntegrityFinding[] = [];
  for (const { traversal } of roots) {
    for (const finding of traversal.findings) {
      const key = findingKey(finding);
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(finding);
    }
  }
  return findings;
}

function findingKey(finding: DecompositionHierarchyIntegrityFinding): string {
  const base = finding.kind;
  if ('relationId' in finding) return `${base}:${finding.relationId}`;
  if ('relationIds' in finding) return `${base}:${finding.relationIds.join(',')}`;
  return base;
}

export interface StructureTruncationSummary {
  depthLimitReached: boolean;
  nodeLimitReached: boolean;
  maxDepth: number;
  maxNodes: number;
}

/**
 * Traversal-truncation summary, or null when no root traversal reports
 * truncation. The segment shows partial-tree guidance only when this is
 * non-null — a complete tree never carries the warning.
 */
export function summarizeTruncation(
  roots: readonly StructureRootTraversal[],
): StructureTruncationSummary | null {
  const truncated = roots
    .map(({ traversal }) => traversal.truncation)
    .filter((truncation) => truncation.truncated);
  if (truncated.length === 0) return null;
  return {
    depthLimitReached: truncated.some((truncation) => truncation.depthLimitReached),
    nodeLimitReached: truncated.some((truncation) => truncation.nodeLimitReached),
    maxDepth: Math.min(...truncated.map((truncation) => truncation.maxDepth)),
    maxNodes: Math.min(...truncated.map((truncation) => truncation.maxNodes)),
  };
}

/** The warning copy for a reported truncation, with enough context that a partial tree cannot look complete. */
export function describeTruncation(summary: StructureTruncationSummary): string {
  const reasons = [
    summary.nodeLimitReached ? `node limit ${summary.maxNodes}` : null,
    summary.depthLimitReached ? `depth limit ${summary.maxDepth}` : null,
  ]
    .filter((reason) => reason !== null)
    .join(' and ');
  return `Traversal reached the display limit (${reasons}). Some branches are not shown — the tree below is incomplete.`;
}

/** One presentable integrity-finding row: a non-color icon plus a short sentence. */
export function describeStructureFinding(
  finding: DecompositionHierarchyIntegrityFinding,
): { icon: string; text: string } {
  switch (finding.kind) {
    case 'malformed_project_context':
      return { icon: '!', text: 'A stored decomposition edge has unreadable Project context and was left out of the tree.' };
    case 'cross_project_edge':
      return { icon: '!', text: 'A stored decomposition edge belongs to a different Project and was left out of the tree.' };
    case 'mistyped_endpoint':
      return { icon: '!', text: `A stored decomposition edge connects unsupported types (${finding.sourceType} → ${finding.targetType}) and was left out of the tree.` };
    case 'missing_endpoint':
      return { icon: '!', text: `An edge references a missing ${finding.endpoint} (${finding.node.type}). Its row stays visible but cannot be opened.` };
    case 'duplicate_edge':
      return { icon: '!', text: 'Duplicate active edges connect the same parent and child; the first is shown.' };
    case 'parent_cardinality':
      return { icon: '!', text: 'An item has more than one active parent in this Project; the first parent is shown.' };
    case 'cycle':
      return { icon: '!', text: 'A cycle was detected in the stored structure; the loop is not expanded.' };
  }
}

/** The in-context explanation of the valid child directions for a parent. */
export function childDirectionNote(parent: StructureNodeRef): string {
  return parent.type === 'task'
    ? 'A Task may only contain another Task.'
    : 'A Goal may contain a Goal or a Task.';
}

export interface ChildCandidateContext {
  parent: StructureNodeRef;
  candidate: StructureNodeRef;
  candidateArchived: boolean;
  /** Active pursuit (Goal) or active membership (Task) in this Project. */
  candidateHasProjectContext: boolean;
  /** The Project's active decomposition edges, from the hierarchy query. */
  edges: readonly DecompositionHierarchyEdge[];
}

/**
 * Derive a picker-row rejection for one candidate from application query
 * results. Picker-time hints never replace commit-time validation — the
 * decomposition service stays authoritative; these reasons only keep
 * unavailable choices visibly explained (#133).
 */
export function childCandidateRejection(context: ChildCandidateContext): CandidateRejection | undefined {
  const { parent, candidate, edges } = context;
  if (parent.type === 'task' && candidate.type === 'goal') {
    return { kind: 'invalid-direction' };
  }
  if (sameStructureNode(parent, candidate)) {
    return { kind: 'cycle', reason: 'An item cannot contain itself' };
  }
  if (edges.some((edge) => sameStructureNode(edge.parent, parent) && sameStructureNode(edge.child, candidate))) {
    return { kind: 'duplicate-active-relation' };
  }
  if (edges.some((edge) => sameStructureNode(edge.child, candidate))) {
    return { kind: 'cardinality-violation' };
  }
  if (context.candidateArchived) {
    return { kind: 'archived-endpoint' };
  }
  if (!context.candidateHasProjectContext) {
    return { kind: 'cross-project-structure' };
  }
  return undefined;
}
