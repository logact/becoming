import type {
  DecompositionHierarchyEdge,
  DecompositionHierarchyIntegrityFinding,
  DecompositionTraversalResult,
  DecompositionTraversalTruncation,
} from '../src/application/decompositionHierarchyQueryService';
import type { Relation } from '../src/domain/relation';
import {
  buildStructureRows,
  childCandidateRejection,
  childDirectionNote,
  collectStructureEdges,
  collectStructureFindings,
  describeStructureFinding,
  describeTruncation,
  structureNodeKey,
  summarizeTruncation,
} from '../src/ui/projects/structure/structureTree';
import type {
  StructureNodeRef,
  StructureRootTraversal,
} from '../src/ui/projects/structure/structureTree';

function node(type: 'goal' | 'task', id: string): StructureNodeRef {
  return { type, id };
}

function edge(
  id: string,
  parentType: 'goal' | 'task',
  parentId: string,
  childType: 'goal' | 'task',
  childId: string,
  createdAt: string,
): DecompositionHierarchyEdge {
  const relation: Relation = {
    id,
    sourceType: parentType,
    sourceId: parentId,
    relationType: 'decomposes',
    targetType: childType,
    targetId: childId,
    metadata: { schema_version: 1, project_id: 'project' },
    createdAt,
    endedAt: null,
  };
  return {
    relationId: id,
    projectId: 'project',
    parent: node(parentType, parentId),
    child: node(childType, childId),
    relation,
    validFrom: createdAt,
    validUntil: null,
  };
}

const NO_TRUNCATION: DecompositionTraversalTruncation = {
  truncated: false,
  depthLimitReached: false,
  nodeLimitReached: false,
  maxDepth: 100,
  maxNodes: 1000,
  visitedNodeCount: 0,
};

function root(
  id: string,
  edges: DecompositionHierarchyEdge[],
  options: { findings?: DecompositionHierarchyIntegrityFinding[]; truncation?: DecompositionTraversalTruncation } = {},
): StructureRootTraversal {
  const traversal: DecompositionTraversalResult = {
    edges,
    findings: options.findings ?? [],
    nodes: [],
    truncation: options.truncation ?? NO_TRUNCATION,
  };
  return { root: node('goal', id), traversal };
}

describe('buildStructureRows', () => {
  it('renders roots in order and children in deterministic edge order, depth-first', () => {
    const roots = [
      root('R', [
        // The query service pre-sorts edges (creation time, then relation id);
        // the row builder preserves that order exactly.
        edge('e2', 'goal', 'R', 'task', 'T1', '2026-08-14T00:01:00.000Z'),
        edge('e1', 'goal', 'R', 'goal', 'A', '2026-08-14T00:02:00.000Z'),
        edge('e3', 'goal', 'A', 'goal', 'C', '2026-08-14T00:03:00.000Z'),
      ]),
      root('S', []),
    ];
    const rows = buildStructureRows(roots, new Set());
    expect(rows.map((row) => structureNodeKey(row.node))).toEqual([
      'goal:R',
      'task:T1',
      'goal:A',
      'goal:C',
      'goal:S',
    ]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 2, 0]);
    expect(rows.map((row) => row.via?.relationId ?? null)).toEqual([null, 'e2', 'e1', 'e3', null]);
    expect(rows.map((row) => row.hasChildren)).toEqual([true, false, true, false, false]);
  });

  it('prunes collapsed branches by stable typed node identity while keeping the node', () => {
    const roots = [
      root('R', [
        edge('e1', 'goal', 'R', 'goal', 'A', '2026-08-14T00:01:00.000Z'),
        edge('e2', 'goal', 'A', 'goal', 'C', '2026-08-14T00:02:00.000Z'),
      ]),
    ];
    const rows = buildStructureRows(roots, new Set(['goal:A']));
    expect(rows.map((row) => structureNodeKey(row.node))).toEqual(['goal:R', 'goal:A']);
    expect(rows[1].hasChildren).toBe(true);
  });

  it('never re-emits a node, so a corrupt cycle cannot loop the render', () => {
    const roots = [
      root('R', [
        edge('e1', 'goal', 'R', 'goal', 'A', '2026-08-14T00:01:00.000Z'),
        edge('e2', 'goal', 'A', 'goal', 'R', '2026-08-14T00:02:00.000Z'),
      ]),
    ];
    const rows = buildStructureRows(roots, new Set());
    expect(rows.map((row) => structureNodeKey(row.node))).toEqual(['goal:R', 'goal:A']);
    expect(rows[1].hasChildren).toBe(false);
  });
});

describe('collectStructureEdges', () => {
  it('deduplicates edges shared across root traversals', () => {
    const shared = edge('e1', 'goal', 'R', 'goal', 'A', '2026-08-14T00:01:00.000Z');
    const roots = [root('R', [shared]), root('A', [shared])];
    expect(collectStructureEdges(roots)).toEqual([shared]);
  });
});

describe('collectStructureFindings', () => {
  it('deduplicates the same finding reported by several traversals', () => {
    const finding: DecompositionHierarchyIntegrityFinding = {
      kind: 'missing_endpoint',
      relationId: 'e1',
      endpoint: 'child',
      node: node('goal', 'ghost'),
    };
    const roots = [root('R', [], { findings: [finding] }), root('S', [], { findings: [finding] })];
    expect(collectStructureFindings(roots)).toEqual([finding]);
  });
});

describe('summarizeTruncation', () => {
  it('is null unless a traversal reports truncation', () => {
    expect(summarizeTruncation([root('R', [])])).toBeNull();
  });

  it('merges reported truncations across roots', () => {
    const roots = [
      root('R', [], {
        truncation: { truncated: true, depthLimitReached: true, nodeLimitReached: false, maxDepth: 6, maxNodes: 1000, visitedNodeCount: 9 },
      }),
      root('S', [], {
        truncation: { truncated: true, depthLimitReached: false, nodeLimitReached: true, maxDepth: 100, maxNodes: 500, visitedNodeCount: 500 },
      }),
    ];
    expect(summarizeTruncation(roots)).toEqual({
      depthLimitReached: true,
      nodeLimitReached: true,
      maxDepth: 6,
      maxNodes: 500,
    });
  });
});

describe('describeTruncation', () => {
  it('states the limit and that the tree is incomplete', () => {
    expect(
      describeTruncation({ depthLimitReached: false, nodeLimitReached: true, maxDepth: 100, maxNodes: 500 }),
    ).toBe(
      'Traversal reached the display limit (node limit 500). Some branches are not shown — the tree below is incomplete.',
    );
  });
});

describe('describeStructureFinding', () => {
  it('describes every finding kind with a non-color icon', () => {
    const findings: DecompositionHierarchyIntegrityFinding[] = [
      { kind: 'malformed_project_context', relationId: 'e1', reason: 'bad metadata' },
      { kind: 'cross_project_edge', relationId: 'e2', requestedProjectId: 'p1', relationProjectId: 'p2' },
      { kind: 'mistyped_endpoint', relationId: 'e3', sourceType: 'project', targetType: 'goal' },
      { kind: 'missing_endpoint', relationId: 'e4', endpoint: 'child', node: node('task', 'ghost') },
      { kind: 'duplicate_edge', projectId: 'p1', relationIds: ['e5', 'e6'], parent: node('goal', 'R'), child: node('goal', 'A') },
      { kind: 'parent_cardinality', projectId: 'p1', relationIds: ['e7', 'e8'], child: node('goal', 'A') },
      { kind: 'cycle', projectId: 'p1', relationId: 'e9', parent: node('goal', 'A'), child: node('goal', 'R') },
    ];
    for (const finding of findings) {
      const item = describeStructureFinding(finding);
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.text.length).toBeGreaterThan(0);
    }
    expect(describeStructureFinding(findings[3]).text).toContain('missing child (task)');
    expect(describeStructureFinding(findings[2]).text).toContain('project → goal');
  });
});

describe('childDirectionNote', () => {
  it('explains the valid directions in context', () => {
    expect(childDirectionNote(node('goal', 'R'))).toBe('A Goal may contain a Goal or a Task.');
    expect(childDirectionNote(node('task', 'T'))).toBe('A Task may only contain another Task.');
  });
});

describe('childCandidateRejection', () => {
  const edges = [
    edge('e1', 'goal', 'R', 'goal', 'A', '2026-08-14T00:01:00.000Z'),
    edge('e2', 'goal', 'A', 'goal', 'C', '2026-08-14T00:02:00.000Z'),
  ];
  const base = { parent: node('goal', 'R'), edges, candidateArchived: false, candidateHasProjectContext: true };

  it('rejects a Goal child under a Task parent as an invalid direction', () => {
    expect(childCandidateRejection({ ...base, parent: node('task', 'T'), candidate: node('goal', 'G') }))
      .toEqual({ kind: 'invalid-direction' });
  });

  it('rejects the parent itself', () => {
    expect(childCandidateRejection({ ...base, candidate: node('goal', 'R') }))
      .toEqual({ kind: 'cycle', reason: 'An item cannot contain itself' });
  });

  it('rejects an existing direct child as a duplicate placement', () => {
    expect(childCandidateRejection({ ...base, candidate: node('goal', 'A') }))
      .toEqual({ kind: 'duplicate-active-relation' });
  });

  it('rejects an item that already has a parent elsewhere in the structure', () => {
    expect(childCandidateRejection({ ...base, candidate: node('goal', 'C') }))
      .toEqual({ kind: 'cardinality-violation' });
  });

  it('rejects archived endpoints', () => {
    expect(childCandidateRejection({ ...base, candidate: node('goal', 'G'), candidateArchived: true }))
      .toEqual({ kind: 'archived-endpoint' });
  });

  it('rejects items without an active context in this Project', () => {
    expect(childCandidateRejection({ ...base, candidate: node('task', 'T'), candidateHasProjectContext: false }))
      .toEqual({ kind: 'cross-project-structure' });
  });

  it('leaves eligible candidates selectable', () => {
    expect(childCandidateRejection({ ...base, candidate: node('task', 'T') })).toBeUndefined();
    expect(childCandidateRejection({ ...base, candidate: node('goal', 'G') })).toBeUndefined();
  });
});
