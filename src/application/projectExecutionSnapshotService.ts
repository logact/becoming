import type { Goal } from '../domain/goal';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Project } from '../domain/project';
import type { Task } from '../domain/task';
import type { GoalRepository } from '../persistence/goalRepository';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { TaskRepository } from '../persistence/taskRepository';
import {
  DecompositionHierarchyQueryService,
  type DecompositionHierarchyEdge,
  type DecompositionHierarchyIntegrityFinding,
  type DecompositionNode,
  type DecompositionTraversalTruncation,
} from './decompositionHierarchyQueryService';
import {
  ProjectGoalPursuitQueryService,
  type ProjectGoalPursuitView,
} from './projectGoalPursuitQueryService';
import {
  TaskProjectMembershipQueryService,
  type TaskProjectMembershipView,
} from './taskProjectMembershipQueryService';

/** A typed intrinsic endpoint carried by the execution projection. */
export type ProjectExecutionNode =
  | { type: 'goal'; id: EntityId; goal: Goal | null }
  | { type: 'task'; id: EntityId; task: Task | null };

export interface ProjectExecutionSnapshotOptions {
  /** Select the historical graph valid at this instant (half-open intervals). */
  asOf?: IsoTimestamp;
  /** Include all ended relation history. `asOf` takes precedence. */
  includeEnded?: boolean;
  /** Bounds are forwarded to the bounded hierarchy traversal port. */
  maxDepth?: number;
  maxNodes?: number;
}

export type ProjectExecutionIntegrityFinding =
  | { kind: 'missing_project'; projectId: EntityId }
  | { kind: 'archived_entity_excluded'; node: DecompositionNode }
  | { kind: 'duplicate_pursuit'; projectId: EntityId; goalId: EntityId; relationIds: EntityId[] }
  | { kind: 'duplicate_membership'; projectId: EntityId; taskId: EntityId; relationIds: EntityId[] }
  | { kind: 'overlapping_root'; projectId: EntityId; root: DecompositionNode; containingRoot: DecompositionNode }
  | { kind: 'disconnected_active_task'; projectId: EntityId; task: DecompositionNode }
  | { kind: 'traversal_truncated'; projectId: EntityId; root: DecompositionNode; truncation: DecompositionTraversalTruncation }
  | { kind: 'pursuit_relation_anomaly'; relationId: EntityId; anomaly: ProjectGoalPursuitView['anomalies'][number] }
  | { kind: 'membership_relation_anomaly'; relationId: EntityId; anomaly: TaskProjectMembershipView['anomalies'][number] }
  | { kind: 'hierarchy'; finding: DecompositionHierarchyIntegrityFinding };

/**
 * A read-only, framework-neutral composition of Project pursuit, Task
 * membership, and bounded decomposition queries. It does not own relation
 * validation or write any derived data back to Project.
 */
export interface ProjectExecutionSnapshot {
  projectId: EntityId;
  project: Project | null;
  scope: { asOf: IsoTimestamp | null; includeEnded: boolean; includeArchived: boolean };
  pursuedRoots: ProjectGoalPursuitView[];
  activeTasks: TaskProjectMembershipView[];
  nodes: ProjectExecutionNode[];
  edges: DecompositionHierarchyEdge[];
  findings: ProjectExecutionIntegrityFinding[];
}

export interface ProjectExecutionSnapshotServicePorts {
  projects: ProjectRepository;
  goals: GoalRepository;
  tasks: TaskRepository;
  pursuits: ProjectGoalPursuitQueryService;
  memberships: TaskProjectMembershipQueryService;
  hierarchy: DecompositionHierarchyQueryService;
}

export class ProjectExecutionSnapshotService {
  constructor(private readonly ports: ProjectExecutionSnapshotServicePorts) {}

  async getSnapshot(projectId: EntityId, options: ProjectExecutionSnapshotOptions = {}): Promise<ProjectExecutionSnapshot> {
    assertOptions(projectId, options);
    const historical = options.asOf !== undefined || options.includeEnded === true;
    const relationOptions = options.asOf === undefined ? { limit: 10_000 } : { asOf: options.asOf, limit: 10_000 };
    const [storedProject, pursuits, memberships] = await Promise.all([
      this.ports.projects.getById(projectId),
      historical
        ? this.ports.pursuits.listGoalPursuitHistoryForProject(projectId, { ...relationOptions, includeEnded: options.asOf === undefined ? true : undefined })
        : this.ports.pursuits.listGoalsPursuedByProject(projectId, relationOptions),
      historical
        ? this.ports.memberships.listTaskMembershipHistoryForProject(projectId, { ...relationOptions, includeEnded: options.asOf === undefined ? true : undefined })
        : this.ports.memberships.listActiveTasksForProject(projectId, relationOptions),
    ]);
    const includeArchived = historical;
    const project = includeArchived || storedProject?.archivedAt === null ? storedProject : null;
    const roots = uniquePursuits(pursuits);
    const activeTasks = uniqueMemberships(memberships);
    const traversalOptions = {
      ...(options.asOf === undefined ? { includeEnded: historical } : { asOf: options.asOf }),
      ...(options.maxDepth === undefined ? {} : { maxDepth: options.maxDepth }),
      ...(options.maxNodes === undefined ? {} : { maxNodes: options.maxNodes }),
    };
    const traversals = await Promise.all(roots.filter((view) => view.goal !== null).map(async (root) => ({
      root: node('goal', root.goalId), result: await this.ports.hierarchy.findDescendants(projectId, node('goal', root.goalId), traversalOptions),
    })));
    const rawEdges = uniqueEdges(traversals.flatMap(({ result }) => result.edges));
    const allNodes = uniqueNodes([
      ...roots.map((view) => node('goal', view.goalId)),
      ...activeTasks.map((view) => node('task', view.taskId)),
      ...rawEdges.flatMap((edge) => [edge.parent, edge.child]),
    ]);
    const resolved = await Promise.all(allNodes.map((value) => this.resolveNode(value)));
    const visible = new Set(resolved.filter((value) => includeArchived || !isArchived(value)).map(nodeKey));
    const nodes = resolved.filter((value) => visible.has(nodeKey(value)));
    const edges = rawEdges.filter((edge) => visible.has(nodeKey(edge.parent)) && visible.has(nodeKey(edge.child)));
    const connected = new Set(edges.flatMap((edge) => [nodeKey(edge.parent), nodeKey(edge.child)]));
    const findings: ProjectExecutionIntegrityFinding[] = [];
    if (storedProject === null) findings.push({ kind: 'missing_project', projectId });
    for (const value of resolved) if (!includeArchived && isArchived(value)) findings.push({ kind: 'archived_entity_excluded', node: { type: value.type, id: value.id } });
    for (const view of pursuits) for (const anomaly of view.anomalies) findings.push({ kind: 'pursuit_relation_anomaly', relationId: view.relationId, anomaly });
    for (const view of memberships) for (const anomaly of view.anomalies) findings.push({ kind: 'membership_relation_anomaly', relationId: view.relationId, anomaly });
    for (const finding of duplicateFindings(projectId, roots, activeTasks)) findings.push(finding);
    for (const { root, result } of traversals) {
      for (const finding of result.findings) findings.push({ kind: 'hierarchy', finding });
      if (result.truncation.truncated) findings.push({ kind: 'traversal_truncated', projectId, root, truncation: result.truncation });
    }
    for (const root of uniqueNodes(roots.map((view) => node('goal', view.goalId)))) {
      if (traversals.some(({ root: candidate, result }) => !sameNode(root, candidate) && result.nodes.some(({ node: descendant }) => sameNode(root, descendant)))) {
        const containingRoot = traversals.find(({ root: candidate, result }) => !sameNode(root, candidate) && result.nodes.some(({ node: descendant }) => sameNode(root, descendant)))!.root;
        findings.push({ kind: 'overlapping_root', projectId, root, containingRoot });
      }
    }
    for (const view of activeTasks) {
      const task = node('task', view.taskId);
      if (visible.has(nodeKey(task)) && !connected.has(nodeKey(task))) findings.push({ kind: 'disconnected_active_task', projectId, task });
    }
    return { projectId, project, scope: { asOf: options.asOf ?? null, includeEnded: historical, includeArchived }, pursuedRoots: roots, activeTasks, nodes, edges, findings: sortFindings(findings) };
  }

  private async resolveNode(value: DecompositionNode): Promise<ProjectExecutionNode> {
    return value.type === 'goal'
      ? { type: 'goal', id: value.id, goal: await this.ports.goals.getById(value.id) }
      : { type: 'task', id: value.id, task: await this.ports.tasks.getById(value.id) };
  }
}

function node(type: 'goal' | 'task', id: EntityId): DecompositionNode { return { type, id }; }
function nodeKey(value: DecompositionNode): string { return `${value.type}:${value.id}`; }
function sameNode(a: DecompositionNode, b: DecompositionNode): boolean { return a.type === b.type && a.id === b.id; }
function uniqueNodes(values: readonly DecompositionNode[]): DecompositionNode[] { return [...new Map(values.map((value) => [nodeKey(value), value])).values()].sort((a, b) => nodeKey(a).localeCompare(nodeKey(b))); }
function uniqueEdges(values: readonly DecompositionHierarchyEdge[]): DecompositionHierarchyEdge[] { return [...new Map(values.map((value) => [value.relationId, value])).values()].sort((a, b) => a.relation.createdAt.localeCompare(b.relation.createdAt) || a.relationId.localeCompare(b.relationId)); }
function uniquePursuits(values: readonly ProjectGoalPursuitView[]): ProjectGoalPursuitView[] { return [...new Map(values.map((value) => [value.relationId, value])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.relationId.localeCompare(b.relationId)); }
function uniqueMemberships(values: readonly TaskProjectMembershipView[]): TaskProjectMembershipView[] { return [...new Map(values.map((value) => [value.relationId, value])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.relationId.localeCompare(b.relationId)); }
function isArchived(value: ProjectExecutionNode): boolean { return value.type === 'goal' ? value.goal?.archivedAt !== null : value.task?.archivedAt !== null; }
function duplicateFindings(projectId: EntityId, pursuits: readonly ProjectGoalPursuitView[], memberships: readonly TaskProjectMembershipView[]): ProjectExecutionIntegrityFinding[] {
  const findings: ProjectExecutionIntegrityFinding[] = [];
  for (const [goalId, views] of groupBy(pursuits, (view) => view.goalId)) if (views.length > 1) findings.push({ kind: 'duplicate_pursuit', projectId, goalId, relationIds: views.map((view) => view.relationId) });
  for (const [taskId, views] of groupBy(memberships, (view) => view.taskId)) if (views.length > 1) findings.push({ kind: 'duplicate_membership', projectId, taskId, relationIds: views.map((view) => view.relationId) });
  return findings;
}
function groupBy<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> { const groups = new Map<string, T[]>(); for (const value of values) { const group = groups.get(key(value)) ?? []; group.push(value); groups.set(key(value), group); } return groups; }
function sortFindings(values: ProjectExecutionIntegrityFinding[]): ProjectExecutionIntegrityFinding[] { return values.sort((a, b) => findingKey(a).localeCompare(findingKey(b))); }
function findingKey(value: ProjectExecutionIntegrityFinding): string { return `${value.kind}:${'relationId' in value ? value.relationId : ''}:${'root' in value ? nodeKey(value.root) : ''}:${'task' in value ? nodeKey(value.task) : ''}:${'finding' in value ? JSON.stringify(value.finding) : ''}`; }
function assertOptions(projectId: EntityId, options: ProjectExecutionSnapshotOptions): void { if (projectId.trim().length === 0) throw new Error('Project execution snapshot projectId must not be blank'); if (options.asOf !== undefined && (options.asOf.trim().length === 0 || Number.isNaN(Date.parse(options.asOf)))) throw new Error('Project execution snapshot asOf must be a valid ISO 8601 timestamp'); if (options.maxDepth !== undefined && (!Number.isInteger(options.maxDepth) || options.maxDepth < 0)) throw new Error('Project execution snapshot maxDepth must be a non-negative integer'); if (options.maxNodes !== undefined && (!Number.isInteger(options.maxNodes) || options.maxNodes < 1)) throw new Error('Project execution snapshot maxNodes must be a positive integer'); }
