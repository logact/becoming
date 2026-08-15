import { DecompositionHierarchyQueryService } from '../src/application/decompositionHierarchyQueryService';
import { ProjectExecutionSnapshotService } from '../src/application/projectExecutionSnapshotService';
import { ProjectGoalPursuitQueryService } from '../src/application/projectGoalPursuitQueryService';
import { ProjectRoadmapQueryService } from '../src/application/projectRoadmapQueryService';
import { TaskProjectMembershipQueryService } from '../src/application/taskProjectMembershipQueryService';
import { createEntityLabelAssignment } from '../src/domain/entityLabel';
import { createGoal } from '../src/domain/goal';
import { createLabel } from '../src/domain/label';
import {
  archiveMilestone,
  createMilestone,
  createMilestoneGoalAssignment,
} from '../src/domain/milestone';
import { createProjectEntityState } from '../src/domain/projectEntityState';
import { createProject } from '../src/domain/project';
import { createProjectState } from '../src/domain/projectState';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import type { SqliteDatabase } from '../src/persistence/database';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteMilestoneGoalAssignmentRepository } from '../src/persistence/milestoneGoalAssignmentRepository';
import { SqliteMilestoneRepository } from '../src/persistence/milestoneRepository';
import { SqliteProjectEntityStateRepository } from '../src/persistence/projectEntityStateRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T1H = '2026-08-13T01:30:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';

describe('ProjectRoadmapQueryService', () => {
  let db: SqliteDatabase;
  let goals: SqliteGoalRepository;
  let relations: SqliteRelationRepository;
  let labels: SqliteLabelRepository;
  let entityLabels: SqliteEntityLabelRepository;
  let states: SqliteProjectStateRepository;
  let periods: SqliteProjectEntityStateRepository;
  let milestones: SqliteMilestoneRepository;
  let assignments: SqliteMilestoneGoalAssignmentRepository;
  let roadmaps: ProjectRoadmapQueryService;

  beforeEach(async () => {
    db = await createTestDatabase();
    const projects = new SqliteProjectRepository(db);
    goals = new SqliteGoalRepository(db);
    const tasks = new SqliteTaskRepository(db);
    relations = new SqliteRelationRepository(db);
    labels = new SqliteLabelRepository(db);
    entityLabels = new SqliteEntityLabelRepository(db);
    states = new SqliteProjectStateRepository(db);
    periods = new SqliteProjectEntityStateRepository(db);
    milestones = new SqliteMilestoneRepository(db);
    assignments = new SqliteMilestoneGoalAssignmentRepository(db);
    await projects.add(createProject({ title: 'Project' }, { id: 'project', now: T0 }));
    for (const id of ['a', 'b', 'c']) await goals.add(createGoal({ title: id, targetState: 'done' }, { id, now: T0 }));
    const pursuits = new ProjectGoalPursuitQueryService({ projects, goals, relations });
    roadmaps = new ProjectRoadmapQueryService({
      goals,
      pursuits,
      milestones,
      assignments,
      snapshots: new ProjectExecutionSnapshotService({
        projects, goals, tasks,
        pursuits,
        memberships: new TaskProjectMembershipQueryService({ projects, tasks, relations }),
        hierarchy: new DecompositionHierarchyQueryService({ projects, goals, tasks, relations }),
        entityLabels, labels, projectStates: states, entityStates: periods,
      }),
    });
  });
  afterEach(async () => closeQuietly(db));

  it('reaches a one-Goal Milestone only when the Goal is authoritatively complete', async () => {
    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await milestone('m1', 1, ['b']);
    const unmanaged = await roadmaps.getProjectRoadmap('project');
    expect(unmanaged.pursuit?.relationId).toBe('p-a');
    expect(unmanaged.milestones).toHaveLength(1);
    expect(unmanaged.milestones[0].reached).toBe(false);
    expect(unmanaged.milestones[0].goals[0]).toMatchObject({ status: 'unmanaged', complete: false });
    expect(unmanaged.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'goal_lifecycle_unsatisfied', milestoneId: 'm1', goalId: 'b', status: 'unmanaged' }),
    ]));
    expect(unmanaged.summary).toEqual({ reachedMilestones: 0, totalMilestones: 1, achievedGoals: 0, totalGoals: 1 });

    await label('flow', 'Flow'); await assign('goal', 'b', 'flow');
    await machine('goal', 'flow', 'done', { isTerminal: true });
    await current('goal', 'b', 'flow', 'done', 'b-period');
    const complete = await roadmaps.getProjectRoadmap('project');
    expect(complete.milestones[0].reached).toBe(true);
    expect(complete.milestones[0].goals[0]).toMatchObject({ status: 'complete', complete: true });
    expect(complete.summary).toEqual({ reachedMilestones: 1, totalMilestones: 1, achievedGoals: 1, totalGoals: 1 });
  });

  it('requires every Goal of a multi-Goal Milestone; reopening one Goal reopens the Milestone', async () => {
    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await edge('e-a-c', 'a', 'c');
    await milestone('m1', 1, ['b', 'c']);
    await label('flow', 'Flow');
    await assign('goal', 'b', 'flow'); await assign('goal', 'c', 'flow');
    await machine('goal', 'flow', 'done', { isTerminal: true });
    await machine('goal', 'flow', 'doing');
    await current('goal', 'b', 'flow', 'done', 'b-period');
    await current('goal', 'c', 'flow', 'done', 'c-period');
    expect((await roadmaps.getProjectRoadmap('project')).milestones[0].reached).toBe(true);

    const bPeriod = (await periods.getById('b-period'))!;
    await periods.end({ ...bPeriod, endedAt: T2 });
    await periods.add(createProjectEntityState(
      { projectId: 'project', entityType: 'goal', entityId: 'b', labelId: 'flow', projectStateId: 'doing', enteredAt: T2 },
      { id: 'b-reopened', now: T2 },
    ));
    const reopened = await roadmaps.getProjectRoadmap('project');
    expect(reopened.milestones[0].reached).toBe(false);
    expect(reopened.milestones[0].goals.map((goal) => [goal.assignment.goalId, goal.status]))
      .toEqual([['b', 'incomplete'], ['c', 'complete']]);
    expect(reopened.summary).toMatchObject({ reachedMilestones: 0, achievedGoals: 1, totalGoals: 2 });
  });

  it('never satisfies a Milestone with blocked, uninitialized, or invalid Goals', async () => {
    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await edge('e-a-c', 'a', 'c');
    await milestone('m1', 1, ['b', 'c']);
    await label('flow', 'Flow');
    await assign('goal', 'b', 'flow'); await assign('goal', 'c', 'flow');
    await machine('goal', 'flow', 'blocked', { category: 'blocked', isInitial: false });
    await current('goal', 'b', 'flow', 'blocked', 'b-period');
    // c has a machine but no current state: uninitialized.
    const roadmap = await roadmaps.getProjectRoadmap('project');
    expect(roadmap.milestones[0].reached).toBe(false);
    expect(roadmap.milestones[0].goals.map((goal) => [goal.assignment.goalId, goal.status]))
      .toEqual([['b', 'blocked'], ['c', 'uninitialized']]);
    expect(roadmap.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'goal_lifecycle_unsatisfied', goalId: 'b', status: 'blocked' }),
      expect.objectContaining({ kind: 'goal_lifecycle_unsatisfied', goalId: 'c', status: 'uninitialized' }),
    ]));
  });

  it('lists active descendant Goals not assigned to any Milestone', async () => {
    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await edge('e-a-c', 'a', 'c');
    await milestone('m1', 1, ['b']);
    const roadmap = await roadmaps.getProjectRoadmap('project');
    expect(roadmap.unassignedGoals.map((node) => node.id)).toEqual(['c']);
    expect(roadmap.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unassigned_goal', pursuitRelationId: 'p-a', goalId: 'c' }),
    ]));
  });

  it('reports a missing pursuit relation and empty Milestones explicitly', async () => {
    const noPursuit = await roadmaps.getProjectRoadmap('project');
    expect(noPursuit.pursuit).toBeNull();
    expect(noPursuit.milestones).toEqual([]);
    expect(noPursuit.findings).toEqual([{ kind: 'missing_pursuit_relation', projectId: 'project' }]);

    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await milestone('m1', 1, ['b']);
    await assignments.save({ ...(await assignments.getById('m1-b'))!, endedAt: T1 });
    const roadmap = await roadmaps.getProjectRoadmap('project');
    expect(roadmap.milestones[0]).toMatchObject({ reached: false, goals: [] });
    expect(roadmap.findings).toEqual(expect.arrayContaining([{ kind: 'empty_milestone', milestoneId: 'm1' }]));
    // The ended assignment is history; the Goal is now unassigned.
    expect(roadmap.unassignedGoals.map((node) => node.id)).toEqual(['b']);
  });

  it('excludes archived Milestones and ended pursuits from current reads but resolves them asOf', async () => {
    await pursuit('p-a', 'a', T1, T2); await edge('e-a-b', 'a', 'b', T1);
    await milestone('m1', 1, ['b'], { createdAt: T1, archivedAt: T2 });

    const current = await roadmaps.getProjectRoadmap('project');
    expect(current.pursuit).toBeNull();
    expect(current.findings).toEqual([{ kind: 'missing_pursuit_relation', projectId: 'project' }]);

    const historical = await roadmaps.getProjectRoadmap('project', { asOf: T1H });
    expect(historical.pursuit?.relationId).toBe('p-a');
    expect(historical.milestones.map((item) => item.milestone.id)).toEqual(['m1']);
    expect(historical.milestones[0].goals.map((goal) => goal.assignment.goalId)).toEqual(['b']);
    expect(historical.scope.asOf).toBe(T1H);
  });

  it('reports assigned Goals that left the hierarchy and duplicate active assignments', async () => {
    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await milestone('m1', 1, ['b']);
    await relations.save({ ...(await relations.getById('e-a-b'))!, endedAt: T2 });
    const outside = await roadmaps.getProjectRoadmap('project');
    expect(outside.milestones[0].reached).toBe(false);
    expect(outside.milestones[0].goals[0]).toMatchObject({ status: null, complete: false });
    expect(outside.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'goal_outside_hierarchy', milestoneId: 'm1', goalId: 'b' }),
    ]));

    // Corrupt storage: bypass the partial unique index to hold two active rows.
    await db.execAsync('DROP INDEX milestone_goal_active_pursuit_unique_idx');
    const other = createMilestone({ pursuitRelationId: 'p-a', title: 'm2', sortOrder: 2 }, { id: 'm2', now: T0 });
    await milestones.add(other);
    await assignments.add(createMilestoneGoalAssignment(other, { goalId: 'b', sortOrder: 1 }, { id: 'm2-b', now: T0 }));
    const duplicated = await roadmaps.getProjectRoadmap('project');
    expect(duplicated.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'duplicate_active_assignment', pursuitRelationId: 'p-a', goalId: 'b' }),
    ]));
  });

  it('reports malformed pursuit relations and hierarchy corruption as findings', async () => {
    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await milestone('m1', 1, ['b']);
    await relations.add({
      id: 'p-bad', sourceType: 'project', sourceId: 'project', relationType: 'contributes_to',
      targetType: 'project', targetId: 'project', metadata: null, createdAt: T0, endedAt: null,
    });
    await edge('e-b-a', 'b', 'a'); // cycle: a -> b -> a
    const roadmap = await roadmaps.getProjectRoadmap('project');
    expect(roadmap.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'malformed_pursuit_relation', relationId: 'p-bad' }),
      expect.objectContaining({ kind: 'hierarchy_integrity' }),
    ]));
  });

  it('reports missing Goal references and assignment pursuit mismatches', async () => {
    await pursuit('p-a', 'a'); await edge('e-a-b', 'a', 'b'); await milestone('m1', 1, ['b']);
    const m1 = (await milestones.getById('m1'))!;
    await assignments.add(createMilestoneGoalAssignment(m1, { goalId: 'ghost', sortOrder: 2 }, { id: 'm1-ghost', now: T0 }));
    const missing = await roadmaps.getProjectRoadmap('project');
    expect(missing.findings).toEqual(expect.arrayContaining([
      { kind: 'missing_goal_reference', milestoneId: 'm1', assignmentId: 'm1-ghost', goalId: 'ghost' },
    ]));

    // A stored assignment whose pursuit_relation_id disagrees with its Milestone.
    await assignments.save({ ...(await assignments.getById('m1-ghost'))!, endedAt: T1 });
    await db.runAsync(
      `INSERT INTO milestone_goal_assignments
         (id, pursuit_relation_id, milestone_id, goal_id, sort_order, created_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      ['m1-mismatch', 'p-other', 'm1', 'b', 3, T0],
    );
    const historical = await roadmaps.getProjectRoadmap('project', { asOf: T1H });
    expect(historical.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'assignment_pursuit_mismatch', assignmentId: 'm1-mismatch', milestoneId: 'm1',
        assignmentPursuitRelationId: 'p-other', milestonePursuitRelationId: 'p-a',
      }),
    ]));
  });

  async function pursuit(id: string, goalId: string, createdAt = T0, endedAt: string | null = null) {
    await relations.add({
      id, sourceType: 'project', sourceId: 'project', relationType: 'contributes_to',
      targetType: 'goal', targetId: goalId, metadata: null, createdAt, endedAt,
    });
  }
  async function edge(id: string, sourceId: string, targetId: string, createdAt = T0) {
    await relations.add({
      id, sourceType: 'goal', sourceId, relationType: 'decomposes',
      targetType: 'goal', targetId, metadata: decompositionMetadata('project'), createdAt, endedAt: null,
    });
  }
  async function milestone(id: string, sortOrder: number, goalIds: string[], options: { createdAt?: string; archivedAt?: string } = {}) {
    const createdAt = options.createdAt ?? T0;
    const stored = createMilestone({ pursuitRelationId: 'p-a', title: id, sortOrder }, { id, now: createdAt });
    await milestones.add(stored);
    for (const [index, goalId] of goalIds.entries()) {
      await assignments.add(createMilestoneGoalAssignment(stored, { goalId, sortOrder: index + 1 }, { id: `${id}-${goalId}`, now: createdAt }));
    }
    if (options.archivedAt !== undefined) await milestones.save(archiveMilestone(stored, options.archivedAt));
  }
  async function label(id: string, name: string) { await labels.add({ ...createLabel({ name }), id, createdAt: T0, updatedAt: T0 }); }
  async function assign(entityType: 'goal', entityId: string, labelId: string) { await entityLabels.add(createEntityLabelAssignment({ entityType, entityId, labelId }, { id: `${entityType}-${entityId}-${labelId}`, now: T0 })); }
  async function machine(entityType: 'goal', labelId: string, stateId: string, settings: { isTerminal?: boolean; category?: string; isInitial?: boolean } = {}) { await states.add(createProjectState({ projectId: 'project', entityType, labelId, title: stateId, isInitial: settings.isInitial ?? !settings.isTerminal, ...settings }, { id: stateId, now: T0 })); }
  async function current(entityType: 'goal', entityId: string, labelId: string, projectStateId: string, id: string) { await periods.add(createProjectEntityState({ projectId: 'project', entityType, entityId, labelId, projectStateId, enteredAt: T1 }, { id, now: T1 })); }
});
