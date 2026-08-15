import type { Goal } from '../domain/goal';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Milestone, MilestoneGoalAssignment } from '../domain/milestone';
import type { GoalRepository } from '../persistence/goalRepository';
import type { MilestoneGoalAssignmentRepository } from '../persistence/milestoneGoalAssignmentRepository';
import type { MilestoneRepository } from '../persistence/milestoneRepository';
import type { DecompositionNode } from './decompositionHierarchyQueryService';
import type {
  GoalPursuitIntegrityAnomaly,
  ProjectGoalPursuitQueryService,
  ProjectGoalPursuitView,
} from './projectGoalPursuitQueryService';
import type {
  ProjectExecutionIntegrityFinding,
  ProjectExecutionNode,
  ProjectExecutionSnapshotService,
} from './projectExecutionSnapshotService';
import type { ProjectProgressNodeStatus } from './projectProgress';

/** One assigned Goal with its authoritative execution classification. */
export interface MilestoneGoalView {
  assignment: MilestoneGoalAssignment;
  /** The stored Goal aggregate, resolved archive-safely; null when missing. */
  goal: Goal | null;
  /** The execution snapshot node when the Goal is visible in it. */
  node: ProjectExecutionNode | null;
  /**
   * The snapshot's authoritative progress classification; null when the Goal
   * cannot be classified (missing, archived, or outside the hierarchy).
   */
  status: ProjectProgressNodeStatus | null;
  /** True only when the snapshot classifies the Goal `complete`. */
  complete: boolean;
}

export interface MilestoneRoadmapItem {
  milestone: Milestone;
  goals: MilestoneGoalView[];
  /** Derived: every currently assigned Goal is authoritatively complete. */
  reached: boolean;
}

export type ProjectRoadmapFinding =
  | { kind: 'missing_pursuit_relation'; projectId: EntityId }
  | { kind: 'duplicate_pursuit_relation'; projectId: EntityId; relationIds: EntityId[] }
  | { kind: 'malformed_pursuit_relation'; relationId: EntityId; anomaly: GoalPursuitIntegrityAnomaly }
  | { kind: 'missing_milestone_reference'; milestoneId: EntityId; assignmentId: EntityId }
  | { kind: 'archived_milestone_reference'; milestoneId: EntityId; assignmentId: EntityId }
  | {
      kind: 'assignment_pursuit_mismatch';
      assignmentId: EntityId;
      milestoneId: EntityId;
      assignmentPursuitRelationId: EntityId;
      milestonePursuitRelationId: EntityId;
    }
  | { kind: 'duplicate_active_assignment'; pursuitRelationId: EntityId; goalId: EntityId; assignmentIds: EntityId[] }
  | { kind: 'empty_milestone'; milestoneId: EntityId }
  | { kind: 'missing_goal_reference'; milestoneId: EntityId; assignmentId: EntityId; goalId: EntityId }
  | { kind: 'archived_goal_reference'; milestoneId: EntityId; assignmentId: EntityId; goalId: EntityId }
  | { kind: 'goal_outside_hierarchy'; milestoneId: EntityId; assignmentId: EntityId; goalId: EntityId }
  | { kind: 'goal_lifecycle_unsatisfied'; milestoneId: EntityId; goalId: EntityId; status: ProjectProgressNodeStatus }
  | { kind: 'unassigned_goal'; pursuitRelationId: EntityId; goalId: EntityId }
  | { kind: 'hierarchy_integrity'; finding: ProjectExecutionIntegrityFinding };

export interface ProjectRoadmap {
  projectId: EntityId;
  /** The Project's exact active pursuit; null when none is usable. */
  pursuit: ProjectGoalPursuitView | null;
  milestones: MilestoneRoadmapItem[];
  /** Active descendant Goals not assigned to any visible Milestone. */
  unassignedGoals: ProjectExecutionNode[];
  findings: ProjectRoadmapFinding[];
  summary: {
    reachedMilestones: number;
    totalMilestones: number;
    achievedGoals: number;
    totalGoals: number;
  };
  scope: { asOf: IsoTimestamp | null };
}

export interface ProjectRoadmapReadOptions {
  /**
   * Select the pursuit, Milestones, assignments, decomposition edges, and
   * lifecycle periods valid at this instant (half-open intervals). Omit for
   * the present current-state read, which excludes archived Milestones and
   * ended assignments.
   */
  asOf?: IsoTimestamp;
}

export interface ProjectRoadmapQueryServicePorts {
  goals: GoalRepository;
  pursuits: ProjectGoalPursuitQueryService;
  milestones: MilestoneRepository;
  assignments: MilestoneGoalAssignmentRepository;
  snapshots: ProjectExecutionSnapshotService;
}

/**
 * Read-side projection of a Project's Roadmap: the ordered Milestones of the
 * Project's exact active Goal pursuit, each grouping its assigned descendant
 * Goals. Completion is derived exclusively from the authoritative Project
 * execution snapshot classification — this service never interprets raw
 * State titles and never persists a derived value. Integrity problems
 * (missing or malformed pursuits, dangling or mismatched references,
 * duplicate assignments, empty Milestones, Goals outside the hierarchy,
 * unsatisfied lifecycle states, hierarchy truncation/corruption, and
 * unassigned descendant Goals) are reported as explicit findings; the read
 * never mutates, repairs, or hides stored data.
 */
export class ProjectRoadmapQueryService {
  constructor(private readonly ports: ProjectRoadmapQueryServicePorts) {}

  async getProjectRoadmap(
    projectId: EntityId,
    options: ProjectRoadmapReadOptions = {},
  ): Promise<ProjectRoadmap> {
    assertOptions(projectId, options);
    const asOf = options.asOf ?? null;
    const findings: ProjectRoadmapFinding[] = [];
    const views = asOf === null
      ? await this.ports.pursuits.listGoalPursuitHistoryForProject(projectId, { includeEnded: false, limit: 100 })
      : await this.ports.pursuits.listGoalPursuitHistoryForProject(projectId, { asOf, limit: 100 });
    const usable = views.filter((view) =>
      view.anomalies.length === 0 && view.project !== null && view.goal !== null &&
      (asOf !== null || (view.project.archivedAt === null && view.goal.archivedAt === null)));
    for (const view of views) {
      for (const anomaly of view.anomalies) {
        findings.push({ kind: 'malformed_pursuit_relation', relationId: view.relationId, anomaly });
      }
    }
    if (usable.length === 0) findings.push({ kind: 'missing_pursuit_relation', projectId });
    if (usable.length > 1) {
      findings.push({ kind: 'duplicate_pursuit_relation', projectId, relationIds: usable.map((view) => view.relationId) });
    }
    const pursuit = usable[0] ?? null;
    if (pursuit === null) {
      return {
        projectId, pursuit: null, milestones: [], unassignedGoals: [],
        findings: sortFindings(findings),
        summary: { reachedMilestones: 0, totalMilestones: 0, achievedGoals: 0, totalGoals: 0 },
        scope: { asOf },
      };
    }

    const snapshot = await this.ports.snapshots.getSnapshot(
      projectId,
      asOf === null ? {} : { asOf },
    );
    for (const finding of snapshot.findings) {
      if (finding.kind === 'hierarchy' || finding.kind === 'traversal_truncated') {
        findings.push({ kind: 'hierarchy_integrity', finding });
      }
    }

    const allMilestones = await this.ports.milestones.listForPursuit(pursuit.relationId, { includeArchived: true });
    const visible = allMilestones.filter((milestone) =>
      asOf === null ? milestone.archivedAt === null : validAt(milestone.createdAt, milestone.archivedAt, asOf));
    const visibleById = new Map(visible.map((milestone) => [milestone.id, milestone]));
    const allById = new Map(allMilestones.map((milestone) => [milestone.id, milestone]));

    const rows = asOf === null
      ? await this.ports.assignments.listCurrentForPursuit(pursuit.relationId)
      : (await Promise.all(visible.map((milestone) => this.ports.assignments.listHistoryForMilestone(milestone.id))))
        .flat()
        .filter((assignment) => validAt(assignment.createdAt, assignment.endedAt, asOf));

    const rowsByMilestone = new Map<EntityId, MilestoneGoalAssignment[]>();
    for (const row of rows) {
      const milestone = visibleById.get(row.milestoneId);
      if (milestone === undefined) {
        const stored = allById.get(row.milestoneId);
        findings.push(stored !== undefined && stored.archivedAt !== null && asOf === null
          ? { kind: 'archived_milestone_reference', milestoneId: row.milestoneId, assignmentId: row.id }
          : { kind: 'missing_milestone_reference', milestoneId: row.milestoneId, assignmentId: row.id });
        continue;
      }
      if (row.pursuitRelationId !== milestone.pursuitRelationId) {
        findings.push({
          kind: 'assignment_pursuit_mismatch',
          assignmentId: row.id,
          milestoneId: milestone.id,
          assignmentPursuitRelationId: row.pursuitRelationId,
          milestonePursuitRelationId: milestone.pursuitRelationId,
        });
        continue;
      }
      const group = rowsByMilestone.get(milestone.id) ?? [];
      group.push(row);
      rowsByMilestone.set(milestone.id, group);
    }
    const assignedRows = [...rowsByMilestone.values()].flat();
    for (const [goalId, group] of groupBy(assignedRows, (row) => row.goalId)) {
      if (group.length > 1) {
        findings.push({
          kind: 'duplicate_active_assignment',
          pursuitRelationId: pursuit.relationId,
          goalId,
          assignmentIds: group.map((row) => row.id),
        });
      }
    }

    const nodeByKey = new Map(snapshot.nodes.map((node) => [nodeKey(node), node]));
    const statusByKey = new Map(
      snapshot.progress.findings.map((finding) => [`${finding.node.type}:${finding.node.id}`, finding.status]),
    );
    const descendantGoalIds = descendantsOf(snapshot.edges, pursuit.goalId);

    const milestones: MilestoneRoadmapItem[] = [];
    for (const milestone of visible) {
      const assignments = (rowsByMilestone.get(milestone.id) ?? [])
        .slice()
        .sort(compareAssignments);
      const goals: MilestoneGoalView[] = [];
      for (const assignment of assignments) {
        goals.push(await this.toGoalView(milestone, assignment, nodeByKey, statusByKey, descendantGoalIds, asOf, findings));
      }
      if (goals.length === 0) findings.push({ kind: 'empty_milestone', milestoneId: milestone.id });
      milestones.push({
        milestone,
        goals,
        reached: goals.length > 0 && goals.every((goal) => goal.complete),
      });
    }

    const assignedGoalIds = new Set(assignedRows.map((row) => row.goalId));
    const unassignedGoals: ProjectExecutionNode[] = [];
    for (const goalId of [...descendantGoalIds].sort()) {
      if (assignedGoalIds.has(goalId)) continue;
      const node = nodeByKey.get(`goal:${goalId}`);
      if (node === undefined) continue;
      unassignedGoals.push(node);
      findings.push({ kind: 'unassigned_goal', pursuitRelationId: pursuit.relationId, goalId });
    }

    const goalViews = milestones.flatMap((item) => item.goals);
    return {
      projectId,
      pursuit,
      milestones,
      unassignedGoals,
      findings: sortFindings(findings),
      summary: {
        reachedMilestones: milestones.filter((item) => item.reached).length,
        totalMilestones: milestones.length,
        achievedGoals: goalViews.filter((goal) => goal.complete).length,
        totalGoals: goalViews.length,
      },
      scope: { asOf },
    };
  }

  /**
   * Resolve one assigned Goal against the execution snapshot. The snapshot's
   * progress classification is the only source of completion; a Goal that is
   * missing, archived (on current reads), or outside the active pursued
   * hierarchy is an explicit finding and never satisfies its Milestone.
   */
  private async toGoalView(
    milestone: Milestone,
    assignment: MilestoneGoalAssignment,
    nodeByKey: Map<string, ProjectExecutionNode>,
    statusByKey: Map<string, ProjectProgressNodeStatus>,
    descendantGoalIds: Set<EntityId>,
    asOf: IsoTimestamp | null,
    findings: ProjectRoadmapFinding[],
  ): Promise<MilestoneGoalView> {
    const key = `goal:${assignment.goalId}`;
    const node = nodeByKey.get(key) ?? null;
    const nodeGoal = node !== null && node.type === 'goal' ? node.goal : null;
    const goal = nodeGoal ?? (await this.ports.goals.getById(assignment.goalId));
    const base = { milestoneId: milestone.id, assignmentId: assignment.id, goalId: assignment.goalId };
    if (goal === null) {
      findings.push({ kind: 'missing_goal_reference', ...base });
      return { assignment, goal: null, node, status: null, complete: false };
    }
    if (asOf === null && goal.archivedAt !== null) {
      findings.push({ kind: 'archived_goal_reference', ...base });
      return { assignment, goal, node, status: null, complete: false };
    }
    if (node === null || !descendantGoalIds.has(assignment.goalId)) {
      findings.push({ kind: 'goal_outside_hierarchy', ...base });
      return { assignment, goal, node, status: null, complete: false };
    }
    const status = statusByKey.get(key) ?? null;
    if (status !== 'complete') {
      findings.push({ kind: 'goal_lifecycle_unsatisfied', milestoneId: milestone.id, goalId: assignment.goalId, status: status ?? 'invalid' });
    }
    return { assignment, goal, node, status, complete: status === 'complete' };
  }
}

/** Half-open interval check matching the relation repositories' `at` semantics. */
function validAt(createdAt: IsoTimestamp, endedAt: IsoTimestamp | null, at: IsoTimestamp): boolean {
  return createdAt <= at && (endedAt === null || endedAt > at);
}

/** Ids of every Goal reachable from the pursuit root over snapshot edges. */
function descendantsOf(
  edges: readonly { parent: DecompositionNode; child: DecompositionNode }[],
  rootGoalId: EntityId,
): Set<EntityId> {
  const children = new Map<string, DecompositionNode[]>();
  for (const edge of edges) {
    const key = nodeKey(edge.parent);
    const entries = children.get(key) ?? [];
    entries.push(edge.child);
    children.set(key, entries);
  }
  const goals = new Set<EntityId>();
  const visited = new Set([`goal:${rootGoalId}`]);
  const queue: DecompositionNode[] = [{ type: 'goal', id: rootGoalId }];
  for (let index = 0; index < queue.length; index += 1) {
    for (const child of children.get(nodeKey(queue[index])) ?? []) {
      const key = nodeKey(child);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(child);
      if (child.type === 'goal') goals.add(child.id);
    }
  }
  return goals;
}

function compareAssignments(a: MilestoneGoalAssignment, b: MilestoneGoalAssignment): number {
  return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function groupBy<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const group = groups.get(key(value)) ?? [];
    group.push(value);
    groups.set(key(value), group);
  }
  return groups;
}

function nodeKey(node: DecompositionNode): string {
  return `${node.type}:${node.id}`;
}

function sortFindings(findings: ProjectRoadmapFinding[]): ProjectRoadmapFinding[] {
  return findings.sort((a, b) => findingKey(a).localeCompare(findingKey(b)));
}

function findingKey(finding: ProjectRoadmapFinding): string {
  const ids = [
    'relationId' in finding ? finding.relationId : '',
    'milestoneId' in finding ? finding.milestoneId : '',
    'assignmentId' in finding ? finding.assignmentId : '',
    'goalId' in finding ? finding.goalId : '',
  ].join(':');
  return `${finding.kind}:${ids}`;
}

function assertOptions(projectId: EntityId, options: ProjectRoadmapReadOptions): void {
  if (projectId.trim().length === 0) {
    throw new Error('Project roadmap projectId must not be blank');
  }
  if (options.asOf !== undefined && (options.asOf.trim().length === 0 || Number.isNaN(Date.parse(options.asOf)))) {
    throw new Error(`Project roadmap asOf must be a valid ISO 8601 timestamp, got ${JSON.stringify(options.asOf)}`);
  }
}
