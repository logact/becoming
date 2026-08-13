import {
  allowsDecompositionDirection,
  DECOMPOSITION_RELATION_TYPE,
  isDecompositionEndpointType,
  readDecompositionMetadata,
} from '../domain/decompositionPolicy';
import type { DecompositionEndpointType } from '../domain/decompositionPolicy';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Relation } from '../domain/relation';
import type { GoalRepository } from '../persistence/goalRepository';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { TaskRepository } from '../persistence/taskRepository';
import type { Clock } from './recordService';
import { systemClock } from './recordService';

/** A Goal or Task identity. It never reverses the stored Relation direction. */
export interface DecompositionNode {
  type: DecompositionEndpointType;
  id: EntityId;
}

/** A project-qualified, canonical parent -> child decomposition edge. */
export interface DecompositionHierarchyEdge {
  relationId: EntityId;
  projectId: EntityId;
  parent: DecompositionNode;
  child: DecompositionNode;
  relation: Relation;
  validFrom: IsoTimestamp;
  validUntil: IsoTimestamp | null;
}

export type DecompositionHierarchyIntegrityFinding =
  | { kind: 'malformed_project_context'; relationId: EntityId; reason: string }
  | { kind: 'cross_project_edge'; relationId: EntityId; requestedProjectId: EntityId; relationProjectId: EntityId }
  | { kind: 'mistyped_endpoint'; relationId: EntityId; sourceType: string; targetType: string }
  | { kind: 'missing_endpoint'; relationId: EntityId; endpoint: 'parent' | 'child'; node: DecompositionNode }
  | { kind: 'duplicate_edge'; projectId: EntityId; relationIds: EntityId[]; parent: DecompositionNode; child: DecompositionNode }
  | { kind: 'parent_cardinality'; projectId: EntityId; relationIds: EntityId[]; child: DecompositionNode }
  | { kind: 'cycle'; projectId: EntityId; relationId: EntityId; parent: DecompositionNode; child: DecompositionNode };

export interface DecompositionHierarchyReadOptions {
  /** Relations valid at this instant; it takes precedence over includeEnded. */
  asOf?: IsoTimestamp;
  /** Include all current and ended edge history. Default is the current view. */
  includeEnded?: boolean;
}

export interface DecompositionTraversalOptions extends DecompositionHierarchyReadOptions {
  maxDepth?: number;
  maxNodes?: number;
}

export interface DecompositionTraversalNode {
  node: DecompositionNode;
  depth: number;
  /** The canonical edge used to reach this node from the requested direction. */
  via: DecompositionHierarchyEdge;
}

export interface DecompositionTraversalTruncation {
  truncated: boolean;
  depthLimitReached: boolean;
  nodeLimitReached: boolean;
  maxDepth: number;
  maxNodes: number;
  visitedNodeCount: number;
}

export interface DecompositionHierarchyQueryResult {
  edges: DecompositionHierarchyEdge[];
  findings: DecompositionHierarchyIntegrityFinding[];
}

export interface DecompositionTraversalResult extends DecompositionHierarchyQueryResult {
  nodes: DecompositionTraversalNode[];
  truncation: DecompositionTraversalTruncation;
}

export interface DecompositionHierarchyQueryServicePorts {
  projects: ProjectRepository;
  goals: GoalRepository;
  tasks: TaskRepository;
  relations: RelationRepository;
  clock?: Clock;
  traversal?: { maxDepth?: number; maxNodes?: number };
}

/**
 * Read-only projection of the Project-scoped Goal/Task hierarchy. This service
 * deliberately treats Relation rows as potentially corrupt legacy data: it
 * reports anomalies and never mutates, normalizes, or hides a valid edge.
 */
export class DecompositionHierarchyQueryService {
  private readonly clock: Clock;
  private readonly defaultMaxDepth: number;
  private readonly defaultMaxNodes: number;

  constructor(private readonly ports: DecompositionHierarchyQueryServicePorts) {
    this.clock = ports.clock ?? systemClock;
    this.defaultMaxDepth = ports.traversal?.maxDepth ?? 100;
    this.defaultMaxNodes = ports.traversal?.maxNodes ?? 1_000;
    assertBounds(this.defaultMaxDepth, this.defaultMaxNodes);
  }

  async listDirectChildren(projectId: EntityId, parent: DecompositionNode, options: DecompositionHierarchyReadOptions = {}): Promise<DecompositionHierarchyQueryResult> {
    return this.direct(projectId, parent, 'children', options);
  }

  async listDirectParents(projectId: EntityId, child: DecompositionNode, options: DecompositionHierarchyReadOptions = {}): Promise<DecompositionHierarchyQueryResult> {
    return this.direct(projectId, child, 'parents', options);
  }

  /** Alias for callers that describe direct hierarchy queries as get operations. */
  async getChildren(projectId: EntityId, parent: DecompositionNode, options: DecompositionHierarchyReadOptions = {}): Promise<DecompositionHierarchyQueryResult> {
    return this.listDirectChildren(projectId, parent, options);
  }

  async getDirectChildren(projectId: EntityId, parent: DecompositionNode, options: DecompositionHierarchyReadOptions = {}): Promise<DecompositionHierarchyQueryResult> {
    return this.listDirectChildren(projectId, parent, options);
  }

  async getParents(projectId: EntityId, child: DecompositionNode, options: DecompositionHierarchyReadOptions = {}): Promise<DecompositionHierarchyQueryResult> {
    return this.listDirectParents(projectId, child, options);
  }

  async getDirectParents(projectId: EntityId, child: DecompositionNode, options: DecompositionHierarchyReadOptions = {}): Promise<DecompositionHierarchyQueryResult> {
    return this.listDirectParents(projectId, child, options);
  }

  async findDescendants(projectId: EntityId, root: DecompositionNode, options: DecompositionTraversalOptions = {}): Promise<DecompositionTraversalResult> {
    return this.traverse(projectId, root, 'descendants', options);
  }

  async findAncestors(projectId: EntityId, root: DecompositionNode, options: DecompositionTraversalOptions = {}): Promise<DecompositionTraversalResult> {
    return this.traverse(projectId, root, 'ancestors', options);
  }

  async listDescendants(projectId: EntityId, root: DecompositionNode, options: DecompositionTraversalOptions = {}): Promise<DecompositionTraversalResult> {
    return this.findDescendants(projectId, root, options);
  }

  async listAncestors(projectId: EntityId, root: DecompositionNode, options: DecompositionTraversalOptions = {}): Promise<DecompositionTraversalResult> {
    return this.findAncestors(projectId, root, options);
  }

  private async direct(projectId: EntityId, node: DecompositionNode, direction: 'children' | 'parents', options: DecompositionHierarchyReadOptions): Promise<DecompositionHierarchyQueryResult> {
    assertNode(node); const graph = await this.load(projectId, options);
    const edges = graph.edges.filter((edge) => sameNode(direction === 'children' ? edge.parent : edge.child, node));
    return { edges, findings: graph.findings };
  }

  private async traverse(projectId: EntityId, root: DecompositionNode, direction: 'descendants' | 'ancestors', options: DecompositionTraversalOptions): Promise<DecompositionTraversalResult> {
    assertNode(root); const maxDepth = options.maxDepth ?? this.defaultMaxDepth; const maxNodes = options.maxNodes ?? this.defaultMaxNodes;
    assertBounds(maxDepth, maxNodes);
    const graph = await this.load(projectId, options);
    const byNode = new Map<string, DecompositionHierarchyEdge[]>();
    for (const edge of graph.edges) {
      const key = nodeKey(direction === 'descendants' ? edge.parent : edge.child);
      const neighbors = byNode.get(key) ?? []; neighbors.push(edge); byNode.set(key, neighbors);
    }
    const visited = new Set([nodeKey(root)]); const queue: Array<{ node: DecompositionNode; depth: number }> = [{ node: root, depth: 0 }];
    const nodes: DecompositionTraversalNode[] = []; const usedEdges: DecompositionHierarchyEdge[] = [];
    let depthLimitReached = false; let nodeLimitReached = false;
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]; const neighbors = byNode.get(nodeKey(current.node)) ?? [];
      if (neighbors.length > 0 && current.depth >= maxDepth) { depthLimitReached = true; continue; }
      for (const edge of neighbors) {
        const next = direction === 'descendants' ? edge.child : edge.parent;
        usedEdges.push(edge);
        const key = nodeKey(next); if (visited.has(key)) continue;
        if (visited.size >= maxNodes) { nodeLimitReached = true; continue; }
        visited.add(key); queue.push({ node: next, depth: current.depth + 1 }); nodes.push({ node: next, depth: current.depth + 1, via: edge });
      }
    }
    return {
      edges: uniqueEdges(usedEdges), findings: graph.findings, nodes,
      truncation: { truncated: depthLimitReached || nodeLimitReached, depthLimitReached, nodeLimitReached, maxDepth, maxNodes, visitedNodeCount: visited.size },
    };
  }

  private async load(projectId: EntityId, options: DecompositionHierarchyReadOptions): Promise<{ edges: DecompositionHierarchyEdge[]; findings: DecompositionHierarchyIntegrityFinding[] }> {
    assertProjectId(projectId); assertReadOptions(options);
    const relations = await this.listAll(options); const edges: DecompositionHierarchyEdge[] = []; const findings: DecompositionHierarchyIntegrityFinding[] = [];
    for (const relation of relations) {
      let relationProjectId: EntityId;
      try { relationProjectId = readDecompositionMetadata(relation.metadata).project_id; }
      catch (error) { findings.push({ kind: 'malformed_project_context', relationId: relation.id, reason: error instanceof Error ? error.message : String(error) }); continue; }
      if (relationProjectId !== projectId) { findings.push({ kind: 'cross_project_edge', relationId: relation.id, requestedProjectId: projectId, relationProjectId }); continue; }
      if (!isDecompositionEndpointType(relation.sourceType) || !isDecompositionEndpointType(relation.targetType) || !allowsDecompositionDirection(relation.sourceType, relation.targetType)) {
        findings.push({ kind: 'mistyped_endpoint', relationId: relation.id, sourceType: relation.sourceType, targetType: relation.targetType }); continue;
      }
      const edge: DecompositionHierarchyEdge = { relationId: relation.id, projectId, parent: { type: relation.sourceType, id: relation.sourceId }, child: { type: relation.targetType, id: relation.targetId }, relation, validFrom: relation.createdAt, validUntil: relation.endedAt };
      edges.push(edge);
      const [parentExists, childExists] = await Promise.all([this.nodeExists(edge.parent), this.nodeExists(edge.child)]);
      if (!parentExists) findings.push({ kind: 'missing_endpoint', relationId: relation.id, endpoint: 'parent', node: edge.parent });
      if (!childExists) findings.push({ kind: 'missing_endpoint', relationId: relation.id, endpoint: 'child', node: edge.child });
    }
    edges.sort(compareEdge); findings.push(...integrityFindings(projectId, edges));
    return { edges, findings: sortFindings(findings) };
  }

  private async listAll(options: DecompositionHierarchyReadOptions): Promise<Relation[]> {
    const all: Relation[] = []; const pageSize = 100;
    const query = { relationType: DECOMPOSITION_RELATION_TYPE, ...(options.asOf === undefined ? {} : { at: options.asOf }), ...(options.asOf === undefined && options.includeEnded !== true ? { status: 'active' as const } : {}) };
    for (let offset = 0;; offset += pageSize) {
      const page = await this.ports.relations.list({ ...query, limit: pageSize, offset }); all.push(...page); if (page.length < pageSize) return all;
    }
  }

  private async nodeExists(node: DecompositionNode): Promise<boolean> {
    return node.type === 'goal' ? (await this.ports.goals.getById(node.id)) !== null : (await this.ports.tasks.getById(node.id)) !== null;
  }
}

function integrityFindings(projectId: EntityId, edges: readonly DecompositionHierarchyEdge[]): DecompositionHierarchyIntegrityFinding[] {
  const findings: DecompositionHierarchyIntegrityFinding[] = [];
  const duplicates = new Map<string, DecompositionHierarchyEdge[]>(); const parents = new Map<string, DecompositionHierarchyEdge[]>();
  for (const edge of edges) { const duplicateKey = `${nodeKey(edge.parent)}>${nodeKey(edge.child)}`; push(duplicates, duplicateKey, edge); push(parents, nodeKey(edge.child), edge); }
  for (const group of duplicates.values()) if (group.length > 1 && hasOverlappingValidity(group)) findings.push({ kind: 'duplicate_edge', projectId, relationIds: group.map((edge) => edge.relationId), parent: group[0].parent, child: group[0].child });
  for (const group of parents.values()) if (new Set(group.map((edge) => nodeKey(edge.parent))).size > 1 && hasOverlappingValidity(group)) findings.push({ kind: 'parent_cardinality', projectId, relationIds: group.map((edge) => edge.relationId), child: group[0].child });
  for (const edge of edges) if (pathExists(edges, edge.child, edge.parent)) findings.push({ kind: 'cycle', projectId, relationId: edge.relationId, parent: edge.parent, child: edge.child });
  return findings;
}

function pathExists(edges: readonly DecompositionHierarchyEdge[], start: DecompositionNode, target: DecompositionNode): boolean {
  const pending = [start]; const visited = new Set<string>();
  while (pending.length > 0) { const node = pending.shift()!; const key = nodeKey(node); if (key === nodeKey(target)) return true; if (visited.has(key)) continue; visited.add(key); for (const edge of edges) if (sameNode(edge.parent, node)) pending.push(edge.child); }
  return false;
}
function hasOverlappingValidity(edges: readonly DecompositionHierarchyEdge[]): boolean { for (let a = 0; a < edges.length; a += 1) for (let b = a + 1; b < edges.length; b += 1) if (edges[a].validFrom < (edges[b].validUntil ?? '\uffff') && edges[b].validFrom < (edges[a].validUntil ?? '\uffff')) return true; return false; }
function push(map: Map<string, DecompositionHierarchyEdge[]>, key: string, edge: DecompositionHierarchyEdge): void { const entries = map.get(key) ?? []; entries.push(edge); map.set(key, entries); }
function uniqueEdges(edges: readonly DecompositionHierarchyEdge[]): DecompositionHierarchyEdge[] { return [...new Map(edges.map((edge) => [edge.relationId, edge])).values()].sort(compareEdge); }
function compareEdge(a: DecompositionHierarchyEdge, b: DecompositionHierarchyEdge): number { return a.relation.createdAt.localeCompare(b.relation.createdAt) || a.relation.id.localeCompare(b.relation.id); }
function nodeKey(node: DecompositionNode): string { return `${node.type}:${node.id}`; }
function sameNode(a: DecompositionNode, b: DecompositionNode): boolean { return a.type === b.type && a.id === b.id; }
function assertProjectId(projectId: EntityId): void { if (projectId.trim().length === 0) throw new Error('Decomposition hierarchy projectId must not be blank'); }
function assertNode(node: DecompositionNode): void { if (!isDecompositionEndpointType(node.type) || node.id.trim().length === 0) throw new Error('Decomposition hierarchy node must be a Goal or Task with a non-blank id'); }
function assertReadOptions(options: DecompositionHierarchyReadOptions): void { if (options.asOf !== undefined && (options.asOf.trim().length === 0 || Number.isNaN(Date.parse(options.asOf)))) throw new Error('Decomposition hierarchy asOf must be a valid ISO 8601 timestamp'); }
function assertBounds(maxDepth: number, maxNodes: number): void { if (!Number.isInteger(maxDepth) || maxDepth < 0 || !Number.isInteger(maxNodes) || maxNodes < 1) throw new Error('Decomposition hierarchy traversal bounds must be maxDepth >= 0 and maxNodes >= 1'); }
function sortFindings(findings: DecompositionHierarchyIntegrityFinding[]): DecompositionHierarchyIntegrityFinding[] { return findings.sort((a, b) => `${a.kind}:${'relationId' in a ? a.relationId : ''}:${'relationIds' in a ? a.relationIds.join(',') : ''}`.localeCompare(`${b.kind}:${'relationId' in b ? b.relationId : ''}:${'relationIds' in b ? b.relationIds.join(',') : ''}`)); }
