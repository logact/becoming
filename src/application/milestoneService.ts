import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  archiveMilestone,
  createMilestone,
  createMilestoneGoalAssignment,
  endMilestoneGoalAssignment,
  updateMilestone,
} from '../domain/milestone';
import type {
  Milestone,
  MilestoneChanges,
  MilestoneGoalAssignment,
} from '../domain/milestone';
import type { MilestoneChangeFieldMap } from '../domain/milestoneProvenance';
import type { Relation } from '../domain/relation';
import { PROJECT_GOAL_PURSUIT_RELATION_TYPE } from '../domain/relationPolicy';
import type { GoalRepository } from '../persistence/goalRepository';
import type { MilestoneGoalAssignmentRepository } from '../persistence/milestoneGoalAssignmentRepository';
import type { MilestoneRepository } from '../persistence/milestoneRepository';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { DecompositionHierarchyQueryService } from './decompositionHierarchyQueryService';
import type { MilestoneProvenancePort } from './milestoneProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/** Thrown when a Milestone command names no stored Milestone. */
export class MilestoneNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Milestone ${id} not found`);
    this.name = 'MilestoneNotFoundError';
  }
}

/** Thrown when an archived Milestone is edited or receives membership changes. */
export class MilestoneArchivedError extends Error {
  constructor(id: EntityId) {
    super(`Milestone ${id} is archived and cannot be changed`);
    this.name = 'MilestoneArchivedError';
  }
}

/** Thrown when a Project has no active canonical Goal pursuit to plan against. */
export class ActivePursuitNotFoundError extends Error {
  constructor(readonly projectId: EntityId) {
    super(`Project ${projectId} has no active canonical goal pursuit`);
    this.name = 'ActivePursuitNotFoundError';
  }
}

/** Thrown when corrupt data gives a Project several active canonical pursuits. */
export class AmbiguousActivePursuitError extends Error {
  constructor(readonly projectId: EntityId, readonly relationIds: readonly EntityId[]) {
    super(`Project ${projectId} has several active goal pursuits: ${relationIds.join(', ')}`);
    this.name = 'AmbiguousActivePursuitError';
  }
}

/** Thrown when a Milestone's pursuit relation is missing, malformed, or ended. */
export class UnusablePursuitRelationError extends Error {
  constructor(
    readonly pursuitRelationId: EntityId,
    readonly reason: 'missing' | 'malformed' | 'ended',
  ) {
    super(`Goal pursuit relation ${pursuitRelationId} is ${reason}`);
    this.name = 'UnusablePursuitRelationError';
  }
}

/** Thrown when a pursuit endpoint does not exist. */
export class MilestoneEndpointNotFoundError extends Error {
  constructor(readonly endpoint: 'project' | 'goal', readonly id: EntityId) {
    super(`Goal pursuit ${endpoint} ${id} not found`);
    this.name = 'MilestoneEndpointNotFoundError';
  }
}

/** Thrown when an archived pursuit endpoint cannot receive new roadmap work. */
export class MilestoneEndpointArchivedError extends Error {
  constructor(readonly endpoint: 'project' | 'goal', readonly id: EntityId) {
    super(`Archived ${endpoint} ${id} cannot receive Milestone changes`);
    this.name = 'MilestoneEndpointArchivedError';
  }
}

/** The hierarchy was malformed or too large to validate safely; mutations fail closed. */
export class MilestoneHierarchyIntegrityError extends Error {
  constructor(reason: string) {
    super(`Pursuit hierarchy integrity cannot be established: ${reason}`);
    this.name = 'MilestoneHierarchyIntegrityError';
  }
}

/** Thrown when a Milestone is created or edited with no Goals. */
export class EmptyMilestoneGoalListError extends Error {
  constructor() {
    super('A Milestone must name at least one Goal');
    this.name = 'EmptyMilestoneGoalListError';
  }
}

/** Thrown when a Goal list names the same Goal twice. */
export class DuplicateMilestoneGoalError extends Error {
  constructor(readonly goalId: EntityId) {
    super(`Milestone Goal list contains ${goalId} more than once`);
    this.name = 'DuplicateMilestoneGoalError';
  }
}

/** Thrown when a selected Goal does not exist. */
export class MilestoneGoalNotFoundError extends Error {
  constructor(readonly goalId: EntityId) {
    super(`Milestone Goal ${goalId} not found`);
    this.name = 'MilestoneGoalNotFoundError';
  }
}

/** Thrown when an archived Goal is selected for a Milestone. */
export class MilestoneGoalArchivedError extends Error {
  constructor(readonly goalId: EntityId) {
    super(`Archived Goal ${goalId} cannot be assigned to a Milestone`);
    this.name = 'MilestoneGoalArchivedError';
  }
}

/**
 * Thrown when a selected Goal is not an active descendant Goal of the
 * pursuit's root Goal — this rejects the root Goal itself, Tasks, unrelated
 * Goals, and Goals decomposed under another Project's hierarchy.
 */
export class MilestoneGoalOutsidePursuitError extends Error {
  constructor(readonly goalId: EntityId, readonly pursuitRelationId: EntityId) {
    super(`Goal ${goalId} is not a descendant of the pursued root Goal in pursuit ${pursuitRelationId}`);
    this.name = 'MilestoneGoalOutsidePursuitError';
  }
}

/** Thrown when a Goal is already actively assigned to a Milestone in this pursuit. */
export class MilestoneGoalAlreadyAssignedError extends Error {
  constructor(readonly goalId: EntityId, readonly milestoneId: EntityId) {
    super(`Goal ${goalId} is already actively assigned to Milestone ${milestoneId} in this pursuit`);
    this.name = 'MilestoneGoalAlreadyAssignedError';
  }
}

/** Thrown when a removal names no stored assignment. */
export class MilestoneAssignmentNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Milestone Goal assignment ${id} not found`);
    this.name = 'MilestoneAssignmentNotFoundError';
  }
}

/** A Milestone must keep at least one active Goal; archive it instead. */
export class MilestoneWithoutGoalsError extends Error {
  constructor(readonly milestoneId: EntityId) {
    super(`Milestone ${milestoneId} must keep at least one active Goal assignment; archive the Milestone instead`);
    this.name = 'MilestoneWithoutGoalsError';
  }
}

export interface CreateMilestoneCommand {
  projectId: EntityId;
  title: string;
  description?: string;
  targetAt?: IsoTimestamp | null;
  goalIds: readonly EntityId[];
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface CreateMilestoneResult {
  milestone: Milestone;
  assignments: MilestoneGoalAssignment[];
}

export interface UpdateMilestoneCommand extends MilestoneChanges {
  milestoneId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface ReorderMilestonesCommand {
  projectId: EntityId;
  orderedMilestoneIds: readonly EntityId[];
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface ArchiveMilestoneCommand {
  milestoneId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
}

/**
 * Replace a Milestone's active Goal membership with exactly `goalIds`. The
 * edit is a diff: retained Goals keep their assignment identity, removed
 * Goals receive `ended_at`, added Goals receive new assignment rows, and the
 * list order becomes the new contiguous assignment order. No historical row
 * is deleted or repointed.
 */
export interface AssignMilestoneGoalCommand {
  milestoneId: EntityId;
  goalIds: readonly EntityId[];
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface AssignMilestoneGoalResult {
  current: MilestoneGoalAssignment[];
  added: MilestoneGoalAssignment[];
  removed: MilestoneGoalAssignment[];
}

export interface RemoveMilestoneGoalAssignmentCommand {
  assignmentId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface ReorderMilestoneGoalsCommand {
  milestoneId: EntityId;
  orderedAssignmentIds: readonly EntityId[];
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface MilestoneServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  projects: (context: TContext) => ProjectRepository;
  goals: (context: TContext) => GoalRepository;
  relations: (context: TContext) => RelationRepository;
  milestones: (context: TContext) => MilestoneRepository;
  assignments: (context: TContext) => MilestoneGoalAssignmentRepository;
  /**
   * Bind the bounded hierarchy read to the unit-of-work context so
   * eligibility checks observe the same transactional state as the writes.
   */
  hierarchy: (
    context: TContext,
  ) => Pick<DecompositionHierarchyQueryService, 'findDescendants'>;
  provenance: MilestoneProvenancePort<TContext>;
  clock?: Clock;
  ids?: IdGenerator;
}

/** A resolved canonical pursuit relation and its endpoints. */
interface ResolvedPursuit {
  relation: Relation;
  projectId: EntityId;
  rootGoalId: EntityId;
}

/**
 * Owns Project Roadmap Milestone mutations. Every command runs through one
 * write unit of work and repeats all eligibility checks inside the
 * transaction: the pursuit relation must be the canonical active
 * `project -> contributes_to -> goal` relation, endpoints must be active,
 * and every selected Goal must be an active descendant Goal of the pursuit's
 * root in the same Project-scoped decomposition hierarchy (mutations fail
 * closed on traversal truncation or hierarchy integrity findings). Milestone
 * writes, assignment writes, and their provenance Records commit or roll
 * back atomically.
 */
export class MilestoneService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: MilestoneServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async createMilestone(command: CreateMilestoneCommand): Promise<CreateMilestoneResult> {
    const actor = requireActor(command.actor);
    assertGoalList(command.goalIds);
    const now = command.occurredAt ?? this.clock.now();
    return this.ports.unitOfWork.run(async (context) => {
      const pursuit = await this.resolveActivePursuit(context, command.projectId);
      await this.requireActiveEndpoints(context, pursuit);
      await this.requireAssignableGoals(context, pursuit, command.goalIds);
      const milestones = this.ports.milestones(context);
      const assignments = this.ports.assignments(context);
      for (const goalId of command.goalIds) {
        const existing = await assignments.findCurrentForGoal(pursuit.relation.id, goalId);
        if (existing !== null) {
          throw new MilestoneGoalAlreadyAssignedError(goalId, existing.milestoneId);
        }
      }
      const active = await milestones.listForPursuit(pursuit.relation.id);
      const milestone = createMilestone(
        {
          pursuitRelationId: pursuit.relation.id,
          title: command.title,
          description: command.description,
          targetAt: command.targetAt,
          sortOrder: active.length + 1,
        },
        { id: this.ids.newId(), now },
      );
      await milestones.add(milestone);
      const created: MilestoneGoalAssignment[] = [];
      for (const [index, goalId] of command.goalIds.entries()) {
        const assignment = createMilestoneGoalAssignment(
          milestone,
          { goalId, sortOrder: index + 1 },
          { id: this.ids.newId(), now },
        );
        await assignments.add(assignment);
        created.push(assignment);
      }
      await this.ports.provenance.append(context, {
        action: 'milestone_created',
        ...pursuitIds(milestone, pursuit),
        goalIds: command.goalIds,
        actor,
        occurredAt: now,
        after: milestoneFields(milestone),
      });
      return { milestone, assignments: created };
    });
  }

  async updateMilestone(command: UpdateMilestoneCommand): Promise<Milestone> {
    const actor = requireActor(command.actor);
    return this.ports.unitOfWork.run(async (context) => {
      const milestones = this.ports.milestones(context);
      const before = await this.requireMilestone(milestones, command.milestoneId);
      if (before.archivedAt !== null) throw new MilestoneArchivedError(before.id);
      const pursuit = await this.requireUsablePursuit(context, before.pursuitRelationId, true);
      const now = command.occurredAt ?? this.clock.now();
      const after = updateMilestone(before, command, now);
      const changed = diffMilestoneFields(before, after);
      if (changed === null) return before;
      await milestones.save(after);
      await this.ports.provenance.append(context, {
        action: 'milestone_updated',
        ...pursuitIds(after, pursuit),
        actor,
        occurredAt: now,
        before: changed.before,
        after: changed.after,
      });
      return after;
    });
  }

  async reorderMilestones(command: ReorderMilestonesCommand): Promise<Milestone[]> {
    const actor = requireActor(command.actor);
    const now = command.occurredAt ?? this.clock.now();
    return this.ports.unitOfWork.run(async (context) => {
      const pursuit = await this.resolveActivePursuit(context, command.projectId);
      const milestones = this.ports.milestones(context);
      const before = await milestones.listForPursuit(pursuit.relation.id);
      const beforeOrder = before.map((milestone) => milestone.id);
      if (sameOrder(beforeOrder, command.orderedMilestoneIds)) return before;
      await milestones.reorderActiveForPursuit(pursuit.relation.id, command.orderedMilestoneIds, now);
      const sample = before[0];
      await this.ports.provenance.append(context, {
        action: 'milestone_reordered',
        milestoneId: sample?.id ?? command.orderedMilestoneIds[0],
        pursuitRelationId: pursuit.relation.id,
        projectId: pursuit.projectId,
        rootGoalId: pursuit.rootGoalId,
        actor,
        occurredAt: now,
        before: { orderedMilestoneIds: beforeOrder },
        after: { orderedMilestoneIds: [...command.orderedMilestoneIds] },
      });
      return milestones.listForPursuit(pursuit.relation.id);
    });
  }

  /**
   * Archive a Milestone and end all its active assignments in the same unit
   * of work. Repeated archival is idempotent at this service level: it
   * returns the originally archived aggregate without a second audit fact
   * (the domain `archiveMilestone` itself throws on a repeated archive).
   */
  async archiveMilestone(command: ArchiveMilestoneCommand): Promise<Milestone> {
    const actor = requireActor(command.actor);
    return this.ports.unitOfWork.run(async (context) => {
      const milestones = this.ports.milestones(context);
      const before = await this.requireMilestone(milestones, command.milestoneId);
      if (before.archivedAt !== null) return before;
      const pursuit = await this.requireUsablePursuit(context, before.pursuitRelationId, false);
      const now = command.occurredAt ?? this.clock.now();
      const archived = archiveMilestone(before, now);
      await milestones.save(archived);
      const assignments = this.ports.assignments(context);
      const current = await assignments.listCurrentForMilestone(before.id);
      for (const assignment of current) {
        await assignments.save(endMilestoneGoalAssignment(assignment, now));
      }
      await this.ports.provenance.append(context, {
        action: 'milestone_archived',
        ...pursuitIds(archived, pursuit),
        goalIds: current.map((assignment) => assignment.goalId),
        actor,
        occurredAt: now,
        before: { archivedAt: null },
        after: { archivedAt: archived.archivedAt },
      });
      return archived;
    });
  }

  /** Replace a Milestone's active Goal membership as an atomic diff. */
  async assignGoal(command: AssignMilestoneGoalCommand): Promise<AssignMilestoneGoalResult> {
    const actor = requireActor(command.actor);
    assertGoalList(command.goalIds);
    const now = command.occurredAt ?? this.clock.now();
    return this.ports.unitOfWork.run(async (context) => {
      const milestones = this.ports.milestones(context);
      const milestone = await this.requireMilestone(milestones, command.milestoneId);
      if (milestone.archivedAt !== null) throw new MilestoneArchivedError(milestone.id);
      const pursuit = await this.requireUsablePursuit(context, milestone.pursuitRelationId, true);
      await this.requireActiveEndpoints(context, pursuit);
      await this.requireAssignableGoals(context, pursuit, command.goalIds);
      const assignments = this.ports.assignments(context);
      const current = await assignments.listCurrentForMilestone(milestone.id);
      const currentByGoal = new Map(current.map((assignment) => [assignment.goalId, assignment]));
      for (const goalId of command.goalIds) {
        const elsewhere = await assignments.findCurrentForGoal(pursuit.relation.id, goalId);
        if (elsewhere !== null && elsewhere.milestoneId !== milestone.id) {
          throw new MilestoneGoalAlreadyAssignedError(goalId, elsewhere.milestoneId);
        }
      }
      const removed = current.filter((assignment) => !command.goalIds.includes(assignment.goalId));
      const addedGoalIds = command.goalIds.filter((goalId) => !currentByGoal.has(goalId));
      const added: MilestoneGoalAssignment[] = [];
      for (const assignment of removed) {
        await assignments.save(endMilestoneGoalAssignment(assignment, now));
      }
      for (const goalId of addedGoalIds) {
        const assignment = createMilestoneGoalAssignment(
          milestone,
          { goalId, sortOrder: command.goalIds.indexOf(goalId) + 1 },
          { id: this.ids.newId(), now },
        );
        await assignments.add(assignment);
        added.push(assignment);
      }
      const byGoal = new Map(
        [...current.filter((assignment) => !removed.includes(assignment)), ...added]
          .map((assignment) => [assignment.goalId, assignment]),
      );
      await assignments.reorderCurrentForMilestone(
        milestone.id,
        command.goalIds.map((goalId) => byGoal.get(goalId)!.id),
      );
      const provenanceBase = { ...pursuitIds(milestone, pursuit), actor, occurredAt: now };
      if (removed.length > 0) {
        await this.ports.provenance.append(context, {
          ...provenanceBase,
          action: 'milestone_goal_removed',
          goalIds: removed.map((assignment) => assignment.goalId),
          before: { orderedGoalIds: current.map((assignment) => assignment.goalId) },
        });
      }
      if (added.length > 0) {
        await this.ports.provenance.append(context, {
          ...provenanceBase,
          action: 'milestone_goal_assigned',
          goalIds: addedGoalIds,
          after: { orderedGoalIds: [...command.goalIds] },
        });
      }
      if (removed.length === 0 && added.length === 0 &&
        !sameOrder(current.map((assignment) => assignment.goalId), command.goalIds)) {
        await this.ports.provenance.append(context, {
          ...provenanceBase,
          action: 'milestone_goals_reordered',
          goalIds: [...command.goalIds],
          before: { orderedGoalIds: current.map((assignment) => assignment.goalId) },
          after: { orderedGoalIds: [...command.goalIds] },
        });
      }
      return { current: await assignments.listCurrentForMilestone(milestone.id), added, removed };
    });
  }

  /**
   * End one active assignment; the Goal leaves its Milestone without deleting
   * history. Repeated removal is idempotent. Removing a Milestone's last
   * active Goal is rejected — archive the Milestone instead.
   */
  async removeGoalAssignment(
    command: RemoveMilestoneGoalAssignmentCommand,
  ): Promise<MilestoneGoalAssignment> {
    const actor = requireActor(command.actor);
    return this.ports.unitOfWork.run(async (context) => {
      const assignments = this.ports.assignments(context);
      const assignment = await assignments.getById(command.assignmentId);
      if (assignment === null) throw new MilestoneAssignmentNotFoundError(command.assignmentId);
      if (assignment.endedAt !== null) return assignment;
      const milestone = await this.requireMilestone(
        this.ports.milestones(context),
        assignment.milestoneId,
      );
      const pursuit = await this.requireUsablePursuit(context, milestone.pursuitRelationId, false);
      const current = await assignments.listCurrentForMilestone(milestone.id);
      if (current.length <= 1) throw new MilestoneWithoutGoalsError(milestone.id);
      const now = command.occurredAt ?? this.clock.now();
      const ended = endMilestoneGoalAssignment(assignment, now);
      await assignments.save(ended);
      const remaining = current.filter((candidate) => candidate.id !== assignment.id);
      await assignments.reorderCurrentForMilestone(
        milestone.id,
        remaining.map((candidate) => candidate.id),
      );
      await this.ports.provenance.append(context, {
        action: 'milestone_goal_removed',
        ...pursuitIds(milestone, pursuit),
        goalIds: [assignment.goalId],
        actor,
        occurredAt: now,
        before: { orderedGoalIds: current.map((candidate) => candidate.goalId) },
      });
      return ended;
    });
  }

  async reorderMilestoneGoals(
    command: ReorderMilestoneGoalsCommand,
  ): Promise<MilestoneGoalAssignment[]> {
    const actor = requireActor(command.actor);
    return this.ports.unitOfWork.run(async (context) => {
      const milestone = await this.requireMilestone(
        this.ports.milestones(context),
        command.milestoneId,
      );
      if (milestone.archivedAt !== null) throw new MilestoneArchivedError(milestone.id);
      const pursuit = await this.requireUsablePursuit(context, milestone.pursuitRelationId, true);
      const assignments = this.ports.assignments(context);
      const current = await assignments.listCurrentForMilestone(milestone.id);
      if (sameOrder(current.map((assignment) => assignment.id), command.orderedAssignmentIds)) {
        return current;
      }
      await assignments.reorderCurrentForMilestone(milestone.id, command.orderedAssignmentIds);
      const byId = new Map(current.map((assignment) => [assignment.id, assignment]));
      const now = command.occurredAt ?? this.clock.now();
      await this.ports.provenance.append(context, {
        action: 'milestone_goals_reordered',
        ...pursuitIds(milestone, pursuit),
        goalIds: command.orderedAssignmentIds.map((id) => byId.get(id)?.goalId ?? id),
        actor,
        occurredAt: now,
        before: { orderedGoalIds: current.map((assignment) => assignment.goalId) },
        after: {
          orderedGoalIds: command.orderedAssignmentIds.map((id) => byId.get(id)?.goalId ?? id),
        },
      });
      return assignments.listCurrentForMilestone(milestone.id);
    });
  }

  private async requireMilestone(
    milestones: MilestoneRepository,
    id: EntityId,
  ): Promise<Milestone> {
    const milestone = await milestones.getById(id);
    if (milestone === null) throw new MilestoneNotFoundError(id);
    return milestone;
  }

  /** Resolve the Project's single active canonical pursuit, failing closed. */
  private async resolveActivePursuit(
    context: TContext,
    projectId: EntityId,
  ): Promise<ResolvedPursuit> {
    const pursuits = (
      await this.ports.relations(context).listCurrent({
        relationType: PROJECT_GOAL_PURSUIT_RELATION_TYPE,
        source: { type: 'project', id: projectId },
        limit: 100,
      })
    ).filter(isCanonicalPursuit);
    if (pursuits.length === 0) throw new ActivePursuitNotFoundError(projectId);
    if (pursuits.length > 1) {
      throw new AmbiguousActivePursuitError(projectId, pursuits.map((relation) => relation.id));
    }
    return toPursuit(pursuits[0]);
  }

  /**
   * Resolve the pursuit relation an existing Milestone belongs to. It must
   * exist with the canonical direction; `requireActive` additionally rejects
   * ended pursuits for commands that plan new current work, while archival
   * and removal remain possible on an ended pursuit's retained Roadmap.
   */
  private async requireUsablePursuit(
    context: TContext,
    pursuitRelationId: EntityId,
    requireActive: boolean,
  ): Promise<ResolvedPursuit> {
    const relation = await this.ports.relations(context).getById(pursuitRelationId);
    if (relation === null) throw new UnusablePursuitRelationError(pursuitRelationId, 'missing');
    if (relation.relationType !== PROJECT_GOAL_PURSUIT_RELATION_TYPE || !isCanonicalPursuit(relation)) {
      throw new UnusablePursuitRelationError(pursuitRelationId, 'malformed');
    }
    if (requireActive && relation.endedAt !== null) {
      throw new UnusablePursuitRelationError(pursuitRelationId, 'ended');
    }
    return toPursuit(relation);
  }

  private async requireActiveEndpoints(
    context: TContext,
    pursuit: ResolvedPursuit,
  ): Promise<void> {
    const project = await this.ports.projects(context).getById(pursuit.projectId);
    if (project === null) throw new MilestoneEndpointNotFoundError('project', pursuit.projectId);
    if (project.archivedAt !== null) throw new MilestoneEndpointArchivedError('project', pursuit.projectId);
    const goal = await this.ports.goals(context).getById(pursuit.rootGoalId);
    if (goal === null) throw new MilestoneEndpointNotFoundError('goal', pursuit.rootGoalId);
    if (goal.archivedAt !== null) throw new MilestoneEndpointArchivedError('goal', pursuit.rootGoalId);
  }

  /**
   * Require every selected Goal to exist, be active, and appear among the
   * valid descendant Goal nodes of the pursuit's Project-scoped hierarchy.
   * Traversal truncation and hierarchy integrity findings fail closed. The
   * hierarchy read lists the global decomposition table, so its
   * `cross_project_edge` findings describe *other* Projects' valid edges
   * (excluded from this traversal); they cannot corrupt this pursuit's
   * descendant set and do not fail the mutation.
   */
  private async requireAssignableGoals(
    context: TContext,
    pursuit: ResolvedPursuit,
    goalIds: readonly EntityId[],
  ): Promise<void> {
    const traversal = await this.ports
      .hierarchy(context)
      .findDescendants(pursuit.projectId, { type: 'goal', id: pursuit.rootGoalId });
    if (traversal.truncation.truncated) {
      throw new MilestoneHierarchyIntegrityError(
        `traversal truncated (depth limit reached: ${traversal.truncation.depthLimitReached}, node limit reached: ${traversal.truncation.nodeLimitReached})`,
      );
    }
    const findings = traversal.findings.filter((finding) => finding.kind !== 'cross_project_edge');
    if (findings.length > 0) {
      throw new MilestoneHierarchyIntegrityError(
        `hierarchy findings: ${[...new Set(findings.map((finding) => finding.kind))].join(', ')}`,
      );
    }
    const descendants = new Set(
      traversal.nodes
        .filter(({ node }) => node.type === 'goal')
        .map(({ node }) => node.id),
    );
    const goals = this.ports.goals(context);
    for (const goalId of goalIds) {
      const goal = await goals.getById(goalId);
      if (goal === null) throw new MilestoneGoalNotFoundError(goalId);
      if (goal.archivedAt !== null) throw new MilestoneGoalArchivedError(goalId);
      if (!descendants.has(goalId)) {
        throw new MilestoneGoalOutsidePursuitError(goalId, pursuit.relation.id);
      }
    }
  }
}

function isCanonicalPursuit(relation: Relation): boolean {
  return relation.sourceType === 'project' && relation.targetType === 'goal';
}

function toPursuit(relation: Relation): ResolvedPursuit {
  return { relation, projectId: relation.sourceId, rootGoalId: relation.targetId };
}

function pursuitIds(milestone: Milestone, pursuit: ResolvedPursuit) {
  return {
    milestoneId: milestone.id,
    pursuitRelationId: pursuit.relation.id,
    projectId: pursuit.projectId,
    rootGoalId: pursuit.rootGoalId,
  };
}

function milestoneFields(milestone: Milestone): MilestoneChangeFieldMap {
  return {
    title: milestone.title,
    description: milestone.description,
    targetAt: milestone.targetAt,
    sortOrder: milestone.sortOrder,
  };
}

/** Reduce two Milestones to the editable fields that actually changed. */
function diffMilestoneFields(
  before: Milestone,
  after: Milestone,
): { before: MilestoneChangeFieldMap; after: MilestoneChangeFieldMap } | null {
  const changedBefore: MilestoneChangeFieldMap = {};
  const changedAfter: MilestoneChangeFieldMap = {};
  const fields = milestoneFields(before);
  const updated = milestoneFields(after);
  for (const field of Object.keys(fields)) {
    if (JSON.stringify(fields[field]) !== JSON.stringify(updated[field])) {
      changedBefore[field] = fields[field];
      changedAfter[field] = updated[field];
    }
  }
  return Object.keys(changedAfter).length === 0 ? null : { before: changedBefore, after: changedAfter };
}

function sameOrder(a: readonly EntityId[], b: readonly EntityId[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function assertGoalList(goalIds: readonly EntityId[]): void {
  if (goalIds.length === 0) throw new EmptyMilestoneGoalListError();
  const seen = new Set<EntityId>();
  for (const goalId of goalIds) {
    if (seen.has(goalId)) throw new DuplicateMilestoneGoalError(goalId);
    seen.add(goalId);
  }
}

function requireActor(actor: string): string {
  if (actor.trim().length === 0) throw new Error('Milestone actor must not be blank');
  return actor;
}
