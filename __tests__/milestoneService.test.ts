import {
  ActivePursuitNotFoundError,
  AmbiguousActivePursuitError,
  DuplicateMilestoneGoalError,
  EmptyMilestoneGoalListError,
  MilestoneArchivedError,
  MilestoneAssignmentNotFoundError,
  MilestoneGoalAlreadyAssignedError,
  MilestoneGoalArchivedError,
  MilestoneGoalNotFoundError,
  MilestoneGoalOutsidePursuitError,
  MilestoneHierarchyIntegrityError,
  MilestoneService,
  MilestoneWithoutGoalsError,
  UnusablePursuitRelationError,
} from '../src/application/milestoneService';
import {
  RecordMilestoneProvenancePort,
  type MilestoneProvenancePort,
} from '../src/application/milestoneProvenanceService';
import { DecompositionHierarchyQueryService } from '../src/application/decompositionHierarchyQueryService';
import { archiveGoal, createGoal } from '../src/domain/goal';
import { createProject } from '../src/domain/project';
import { createTask } from '../src/domain/task';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import type { SqliteDatabase } from '../src/persistence/database';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteMilestoneGoalAssignmentRepository } from '../src/persistence/milestoneGoalAssignmentRepository';
import { SqliteMilestoneRepository } from '../src/persistence/milestoneRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T09:00:00.000Z';
const T1 = '2026-08-13T10:00:00.000Z';
const T2 = '2026-08-13T11:00:00.000Z';
let sequence = 0;

function service(
  db: SqliteDatabase,
  prefix = 'milestone',
  provenance?: MilestoneProvenancePort<SqliteDatabase>,
): MilestoneService<SqliteDatabase> {
  return new MilestoneService<SqliteDatabase>({
    unitOfWork: sqliteUnitOfWork(db),
    projects: (context) => new SqliteProjectRepository(context),
    goals: (context) => new SqliteGoalRepository(context),
    relations: (context) => new SqliteRelationRepository(context),
    milestones: (context) => new SqliteMilestoneRepository(context),
    assignments: (context) => new SqliteMilestoneGoalAssignmentRepository(context),
    hierarchy: (context) => new DecompositionHierarchyQueryService({
      projects: new SqliteProjectRepository(context),
      goals: new SqliteGoalRepository(context),
      tasks: new SqliteTaskRepository(context),
      relations: new SqliteRelationRepository(context),
    }),
    provenance: provenance ?? new RecordMilestoneProvenancePort<SqliteDatabase>({
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => T0 },
      ids: { newId: () => `${prefix}-audit-${++sequence}` },
    }),
    clock: { now: () => T1 },
    ids: { newId: () => `${prefix}-${++sequence}` },
  });
}

/**
 * Project 'project' pursues root Goal 'root'. Its hierarchy decomposes into
 * Goals sub-a, sub-b, sub-c (nested under sub-a) and Task task-x. Goal
 * 'other' is unrelated, 'archived' is a descendant but archived, and
 * 'foreign' belongs to project-2's own pursuit hierarchy.
 */
async function seed(db: SqliteDatabase) {
  const projects = new SqliteProjectRepository(db);
  const goals = new SqliteGoalRepository(db);
  const relations = new SqliteRelationRepository(db);
  await projects.add(createProject({ title: 'Project' }, { id: 'project', now: T0 }));
  await projects.add(createProject({ title: 'Other project' }, { id: 'project-2', now: T0 }));
  for (const id of ['root', 'sub-a', 'sub-b', 'sub-c', 'other', 'foreign-root', 'foreign']) {
    await goals.add(createGoal({ title: id, targetState: 'Done' }, { id, now: T0 }));
  }
  const archived = createGoal({ title: 'archived', targetState: 'Done' }, { id: 'archived', now: T0 });
  await goals.add(archiveGoal(archived, T1));
  await new SqliteTaskRepository(db).add({
    ...createTask({ title: 'task-x', targetDescription: 'Done' }),
    id: 'task-x', createdAt: T0, updatedAt: T0,
  });
  await relations.add({
    id: 'pursuit', sourceType: 'project', sourceId: 'project', relationType: 'contributes_to',
    targetType: 'goal', targetId: 'root', metadata: null, createdAt: T0, endedAt: null,
  });
  await relations.add({
    id: 'pursuit-2', sourceType: 'project', sourceId: 'project-2', relationType: 'contributes_to',
    targetType: 'goal', targetId: 'foreign-root', metadata: null, createdAt: T0, endedAt: null,
  });
  const edge = (id: string, sourceId: string, targetId: string, projectId = 'project', targetType: 'goal' | 'task' = 'goal') =>
    relations.add({
      id, sourceType: 'goal', sourceId, relationType: 'decomposes',
      targetType, targetId: targetId, metadata: decompositionMetadata(projectId), createdAt: T0, endedAt: null,
    });
  await edge('e-root-a', 'root', 'sub-a');
  await edge('e-root-b', 'root', 'sub-b');
  await edge('e-a-c', 'sub-a', 'sub-c');
  await edge('e-root-task', 'root', 'task-x', 'project', 'task');
  await edge('e-root-archived', 'root', 'archived');
  await edge('e-foreign', 'foreign-root', 'foreign', 'project-2');
  return { relations };
}

async function recordPayloads(db: SqliteDatabase): Promise<Array<Record<string, unknown>>> {
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM records ORDER BY created_at, id');
  return rows.map((row) => JSON.parse(row.payload) as Record<string, unknown>);
}

describe('MilestoneService.createMilestone', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('creates a Milestone with contiguous ordering, assignments, and provenance atomically', async () => {
    const milestones = service(db);
    const first = await milestones.createMilestone({
      projectId: 'project', title: 'Alpha', description: 'first', goalIds: ['sub-a', 'sub-b'], actor: 'planner',
    });
    expect(first.milestone).toMatchObject({ pursuitRelationId: 'pursuit', title: 'Alpha', sortOrder: 1, archivedAt: null });
    expect(first.assignments.map((assignment) => [assignment.goalId, assignment.sortOrder]))
      .toEqual([['sub-a', 1], ['sub-b', 2]]);
    const second = await milestones.createMilestone({ projectId: 'project', title: 'Beta', goalIds: ['sub-c'], actor: 'planner' });
    expect(second.milestone.sortOrder).toBe(2);
    const payloads = await recordPayloads(db);
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({
      action: 'milestone_created', milestoneId: first.milestone.id, pursuitRelationId: 'pursuit',
      projectId: 'project', rootGoalId: 'root', goalIds: ['sub-a', 'sub-b'], actor: 'planner',
      before: null, after: { title: 'Alpha', description: 'first', sortOrder: 1 },
    });
  });

  it('rejects the root Goal, Tasks, unrelated, archived, cross-Project, and unknown Goals', async () => {
    const milestones = service(db);
    const create = (goalIds: string[]) =>
      milestones.createMilestone({ projectId: 'project', title: 'X', goalIds, actor: 'planner' });
    await expect(create(['root'])).rejects.toBeInstanceOf(MilestoneGoalOutsidePursuitError);
    await expect(create(['task-x'])).rejects.toBeInstanceOf(MilestoneGoalNotFoundError);
    await expect(create(['other'])).rejects.toBeInstanceOf(MilestoneGoalOutsidePursuitError);
    await expect(create(['archived'])).rejects.toBeInstanceOf(MilestoneGoalArchivedError);
    await expect(create(['foreign'])).rejects.toBeInstanceOf(MilestoneGoalOutsidePursuitError);
    await expect(create(['missing'])).rejects.toBeInstanceOf(MilestoneGoalNotFoundError);
    expect(await db.getAllAsync('SELECT id FROM milestones')).toEqual([]);
  });

  it('rejects empty and duplicate Goal lists', async () => {
    const milestones = service(db);
    await expect(milestones.createMilestone({ projectId: 'project', title: 'X', goalIds: [], actor: 'planner' }))
      .rejects.toBeInstanceOf(EmptyMilestoneGoalListError);
    await expect(milestones.createMilestone({ projectId: 'project', title: 'X', goalIds: ['sub-a', 'sub-a'], actor: 'planner' }))
      .rejects.toBeInstanceOf(DuplicateMilestoneGoalError);
  });

  it('rejects Goals already actively assigned in this pursuit', async () => {
    const milestones = service(db);
    await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a'], actor: 'planner' });
    await expect(milestones.createMilestone({ projectId: 'project', title: 'Beta', goalIds: ['sub-a'], actor: 'planner' }))
      .rejects.toBeInstanceOf(MilestoneGoalAlreadyAssignedError);
  });

  it('rejects Projects without exactly one active canonical pursuit', async () => {
    const milestones = service(db);
    await new SqliteProjectRepository(db).add(createProject({ title: 'Idle' }, { id: 'project-3', now: T0 }));
    await expect(milestones.createMilestone({ projectId: 'project-3', title: 'X', goalIds: ['sub-a'], actor: 'planner' }))
      .rejects.toBeInstanceOf(ActivePursuitNotFoundError);
    const relations = new SqliteRelationRepository(db);
    // A malformed pursuit direction is not the canonical project -> goal relation.
    await relations.add({
      id: 'pursuit-malformed', sourceType: 'project', sourceId: 'project-3', relationType: 'contributes_to',
      targetType: 'project', targetId: 'project', metadata: null, createdAt: T0, endedAt: null,
    });
    await expect(milestones.createMilestone({ projectId: 'project-3', title: 'X', goalIds: ['sub-a'], actor: 'planner' }))
      .rejects.toBeInstanceOf(ActivePursuitNotFoundError);
    // A second canonical active pursuit is corrupt data; mutations fail closed.
    await relations.add({
      id: 'pursuit-extra', sourceType: 'project', sourceId: 'project', relationType: 'contributes_to',
      targetType: 'goal', targetId: 'other', metadata: null, createdAt: T0, endedAt: null,
    });
    await expect(milestones.createMilestone({ projectId: 'project', title: 'X', goalIds: ['sub-a'], actor: 'planner' }))
      .rejects.toBeInstanceOf(AmbiguousActivePursuitError);
  });

  it('fails closed on hierarchy integrity findings', async () => {
    await new SqliteRelationRepository(db).add({
      id: 'e-cycle', sourceType: 'goal', sourceId: 'sub-c', relationType: 'decomposes',
      targetType: 'goal', targetId: 'sub-a', metadata: decompositionMetadata('project'), createdAt: T0, endedAt: null,
    });
    await expect(service(db).createMilestone({ projectId: 'project', title: 'X', goalIds: ['sub-a'], actor: 'planner' }))
      .rejects.toBeInstanceOf(MilestoneHierarchyIntegrityError);
    expect(await db.getAllAsync('SELECT id FROM milestones')).toEqual([]);
  });
});

describe('MilestoneService.updateMilestone', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('updates editable fields with before/after provenance; no-op updates write nothing', async () => {
    const milestones = service(db);
    const { milestone } = await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a'], actor: 'planner' });
    const updated = await milestones.updateMilestone({
      milestoneId: milestone.id, title: 'Alpha 2', targetAt: T2, actor: 'planner', occurredAt: T2,
    });
    expect(updated).toMatchObject({ title: 'Alpha 2', targetAt: T2, updatedAt: T2 });
    const noop = await milestones.updateMilestone({ milestoneId: milestone.id, title: 'Alpha 2', actor: 'planner' });
    expect(noop).toEqual(updated);
    const payloads = await recordPayloads(db);
    expect(payloads.map((payload) => payload.action)).toEqual(['milestone_created', 'milestone_updated']);
    expect(payloads[1]).toMatchObject({
      milestoneId: milestone.id, actor: 'planner', occurredAt: T2,
      before: { title: 'Alpha', targetAt: null }, after: { title: 'Alpha 2', targetAt: T2 },
    });
  });

  it('rejects updates on archived Milestones and on ended pursuits', async () => {
    const milestones = service(db);
    const { milestone } = await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a'], actor: 'planner' });
    await milestones.archiveMilestone({ milestoneId: milestone.id, actor: 'planner', occurredAt: T2 });
    await expect(milestones.updateMilestone({ milestoneId: milestone.id, title: 'Nope', actor: 'planner' }))
      .rejects.toBeInstanceOf(MilestoneArchivedError);
    const second = await service(db, 'second').createMilestone({ projectId: 'project', title: 'Beta', goalIds: ['sub-b'], actor: 'planner' });
    const relations = new SqliteRelationRepository(db);
    const pursuit = (await relations.getById('pursuit'))!;
    await relations.save({ ...pursuit, endedAt: T2 });
    await expect(service(db, 'third').updateMilestone({ milestoneId: second.milestone.id, title: 'Nope', actor: 'planner' }))
      .rejects.toBeInstanceOf(UnusablePursuitRelationError);
  });
});

describe('MilestoneService.reorderMilestones', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('reorders active Milestones with provenance and validates the exact set', async () => {
    const milestones = service(db);
    const first = await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a'], actor: 'planner' });
    const second = await milestones.createMilestone({ projectId: 'project', title: 'Beta', goalIds: ['sub-b'], actor: 'planner' });
    const same = await milestones.reorderMilestones({
      projectId: 'project', orderedMilestoneIds: [first.milestone.id, second.milestone.id], actor: 'planner',
    });
    expect(same.map((milestone) => milestone.sortOrder)).toEqual([1, 2]);
    const reordered = await milestones.reorderMilestones({
      projectId: 'project', orderedMilestoneIds: [second.milestone.id, first.milestone.id], actor: 'planner', occurredAt: T2,
    });
    expect(reordered.map((milestone) => [milestone.id, milestone.sortOrder]))
      .toEqual([[second.milestone.id, 1], [first.milestone.id, 2]]);
    await expect(milestones.reorderMilestones({ projectId: 'project', orderedMilestoneIds: [first.milestone.id], actor: 'planner' }))
      .rejects.toThrow('every active id');
    const payloads = await recordPayloads(db);
    expect(payloads.map((payload) => payload.action)).toEqual([
      'milestone_created', 'milestone_created', 'milestone_reordered',
    ]);
    expect(payloads[2]).toMatchObject({
      pursuitRelationId: 'pursuit', projectId: 'project', rootGoalId: 'root', occurredAt: T2,
      before: { orderedMilestoneIds: [first.milestone.id, second.milestone.id] },
      after: { orderedMilestoneIds: [second.milestone.id, first.milestone.id] },
    });
  });
});

describe('MilestoneService.assignGoal', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('edits membership as a diff: retained keep identity, removed end, added insert', async () => {
    const milestones = service(db);
    const { milestone, assignments } = await milestones.createMilestone({
      projectId: 'project', title: 'Alpha', goalIds: ['sub-a', 'sub-b'], actor: 'planner',
    });
    const [aAssignment, bAssignment] = assignments;
    const result = await milestones.assignGoal({ milestoneId: milestone.id, goalIds: ['sub-b', 'sub-c'], actor: 'planner', occurredAt: T2 });
    expect(result.removed.map((assignment) => assignment.id)).toEqual([aAssignment.id]);
    expect(result.added).toHaveLength(1);
    expect(result.current.map((assignment) => [assignment.id, assignment.goalId, assignment.sortOrder]))
      .toEqual([[bAssignment.id, 'sub-b', 1], [result.added[0].id, 'sub-c', 2]]);
    const history = await new SqliteMilestoneGoalAssignmentRepository(db).listHistoryForMilestone(milestone.id);
    expect(history).toHaveLength(3);
    expect(history.find((assignment) => assignment.id === aAssignment.id)?.endedAt).toBe(T2);
    const payloads = await recordPayloads(db);
    expect(payloads.map((payload) => payload.action)).toEqual([
      'milestone_created', 'milestone_goal_removed', 'milestone_goal_assigned',
    ]);
    expect(payloads[1]).toMatchObject({ goalIds: ['sub-a'], before: { orderedGoalIds: ['sub-a', 'sub-b'] } });
    expect(payloads[2]).toMatchObject({ goalIds: ['sub-c'], after: { orderedGoalIds: ['sub-b', 'sub-c'] } });
  });

  it('rejects invalid, duplicate, empty, and elsewhere-assigned Goal edits', async () => {
    const milestones = service(db);
    const { milestone } = await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a'], actor: 'planner' });
    await milestones.createMilestone({ projectId: 'project', title: 'Beta', goalIds: ['sub-b'], actor: 'planner' });
    const assign = (goalIds: string[]) => milestones.assignGoal({ milestoneId: milestone.id, goalIds, actor: 'planner' });
    await expect(assign([])).rejects.toBeInstanceOf(EmptyMilestoneGoalListError);
    await expect(assign(['sub-c', 'sub-c'])).rejects.toBeInstanceOf(DuplicateMilestoneGoalError);
    await expect(assign(['sub-b'])).rejects.toBeInstanceOf(MilestoneGoalAlreadyAssignedError);
    await expect(assign(['root'])).rejects.toBeInstanceOf(MilestoneGoalOutsidePursuitError);
    await expect(assign(['archived'])).rejects.toBeInstanceOf(MilestoneGoalArchivedError);
    const current = await new SqliteMilestoneGoalAssignmentRepository(db).listCurrentForMilestone(milestone.id);
    expect(current.map((assignment) => assignment.goalId)).toEqual(['sub-a']);
  });

  it('records a pure reorder through assignGoal as milestone_goals_reordered', async () => {
    const milestones = service(db);
    const { milestone } = await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a', 'sub-b'], actor: 'planner' });
    await milestones.assignGoal({ milestoneId: milestone.id, goalIds: ['sub-b', 'sub-a'], actor: 'planner', occurredAt: T2 });
    const payloads = await recordPayloads(db);
    expect(payloads.map((payload) => payload.action)).toEqual(['milestone_created', 'milestone_goals_reordered']);
    expect(payloads[1]).toMatchObject({
      before: { orderedGoalIds: ['sub-a', 'sub-b'] }, after: { orderedGoalIds: ['sub-b', 'sub-a'] },
    });
  });
});

describe('MilestoneService.removeGoalAssignment', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('ends one assignment, closes ordering, and is idempotent on repeat', async () => {
    const milestones = service(db);
    const { milestone, assignments } = await milestones.createMilestone({
      projectId: 'project', title: 'Alpha', goalIds: ['sub-a', 'sub-b'], actor: 'planner',
    });
    const ended = await milestones.removeGoalAssignment({ assignmentId: assignments[0].id, actor: 'planner', occurredAt: T2 });
    expect(ended.endedAt).toBe(T2);
    const repeated = await milestones.removeGoalAssignment({ assignmentId: assignments[0].id, actor: 'planner' });
    expect(repeated).toEqual(ended);
    const current = await new SqliteMilestoneGoalAssignmentRepository(db).listCurrentForMilestone(milestone.id);
    expect(current.map((assignment) => [assignment.goalId, assignment.sortOrder])).toEqual([['sub-b', 1]]);
    const payloads = await recordPayloads(db);
    expect(payloads.map((payload) => payload.action)).toEqual(['milestone_created', 'milestone_goal_removed']);
  });

  it('rejects removing the last active Goal and unknown assignments', async () => {
    const milestones = service(db);
    const { assignments } = await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a'], actor: 'planner' });
    await expect(milestones.removeGoalAssignment({ assignmentId: assignments[0].id, actor: 'planner' }))
      .rejects.toBeInstanceOf(MilestoneWithoutGoalsError);
    await expect(milestones.removeGoalAssignment({ assignmentId: 'missing', actor: 'planner' }))
      .rejects.toBeInstanceOf(MilestoneAssignmentNotFoundError);
  });
});

describe('MilestoneService.reorderMilestoneGoals', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('reorders current assignments with provenance and validates the exact set', async () => {
    const milestones = service(db);
    const { milestone, assignments } = await milestones.createMilestone({
      projectId: 'project', title: 'Alpha', goalIds: ['sub-a', 'sub-b'], actor: 'planner',
    });
    const reordered = await milestones.reorderMilestoneGoals({
      milestoneId: milestone.id, orderedAssignmentIds: [assignments[1].id, assignments[0].id], actor: 'planner', occurredAt: T2,
    });
    expect(reordered.map((assignment) => [assignment.goalId, assignment.sortOrder]))
      .toEqual([['sub-b', 1], ['sub-a', 2]]);
    await expect(milestones.reorderMilestoneGoals({ milestoneId: milestone.id, orderedAssignmentIds: [assignments[0].id], actor: 'planner' }))
      .rejects.toThrow('every active id');
    const payloads = await recordPayloads(db);
    expect(payloads.map((payload) => payload.action)).toEqual(['milestone_created', 'milestone_goals_reordered']);
  });
});

describe('MilestoneService.archiveMilestone', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('archives atomically: ends all assignments and is idempotent on repeat', async () => {
    const milestones = service(db);
    const { milestone } = await milestones.createMilestone({ projectId: 'project', title: 'Alpha', goalIds: ['sub-a', 'sub-b'], actor: 'planner' });
    const archived = await milestones.archiveMilestone({ milestoneId: milestone.id, actor: 'planner', occurredAt: T2 });
    expect(archived.archivedAt).toBe(T2);
    const repeated = await milestones.archiveMilestone({ milestoneId: milestone.id, actor: 'planner' });
    expect(repeated).toEqual(archived);
    const assignments = await new SqliteMilestoneGoalAssignmentRepository(db).listHistoryForMilestone(milestone.id);
    expect(assignments.map((assignment) => assignment.endedAt)).toEqual([T2, T2]);
    const payloads = await recordPayloads(db);
    expect(payloads.map((payload) => payload.action)).toEqual(['milestone_created', 'milestone_archived']);
    expect(payloads[1]).toMatchObject({
      milestoneId: milestone.id, goalIds: ['sub-a', 'sub-b'],
      before: { archivedAt: null }, after: { archivedAt: T2 },
    });
    // Archiving frees the sort order and the Goals for a new active Milestone.
    const next = await service(db, 'next').createMilestone({ projectId: 'project', title: 'Beta', goalIds: ['sub-a'], actor: 'planner' });
    expect(next.milestone.sortOrder).toBe(1);
  });
});

describe('MilestoneService provenance rollback', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('rolls back the Milestone and its assignments when provenance fails', async () => {
    const failing: MilestoneProvenancePort<SqliteDatabase> = {
      append: async () => { throw new Error('audit unavailable'); },
    };
    await expect(service(db, 'rolled-back', failing).createMilestone({
      projectId: 'project', title: 'Alpha', goalIds: ['sub-a'], actor: 'planner',
    })).rejects.toThrow('audit unavailable');
    expect(await db.getAllAsync('SELECT id FROM milestones')).toEqual([]);
    expect(await db.getAllAsync('SELECT id FROM milestone_goal_assignments')).toEqual([]);
    expect(await db.getAllAsync('SELECT id FROM records')).toEqual([]);
  });
});
