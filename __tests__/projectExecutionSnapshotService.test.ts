import { DecompositionHierarchyQueryService } from '../src/application/decompositionHierarchyQueryService';
import { ProjectExecutionSnapshotService } from '../src/application/projectExecutionSnapshotService';
import { ProjectGoalPursuitQueryService } from '../src/application/projectGoalPursuitQueryService';
import { TaskProjectMembershipQueryService } from '../src/application/taskProjectMembershipQueryService';
import { archiveGoal, createGoal } from '../src/domain/goal';
import { createEntityLabelAssignment } from '../src/domain/entityLabel';
import { createLabel } from '../src/domain/label';
import { createProjectEntityState } from '../src/domain/projectEntityState';
import { createProject } from '../src/domain/project';
import { createProjectState } from '../src/domain/projectState';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import { createTask } from '../src/domain/task';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectEntityStateRepository } from '../src/persistence/projectEntityStateRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';

describe('ProjectExecutionSnapshotService', () => {
  let db: SqliteDatabase;
  let snapshot: ProjectExecutionSnapshotService;
  let relations: SqliteRelationRepository;
  let goals: SqliteGoalRepository;
  let labels: SqliteLabelRepository;
  let assignments: SqliteEntityLabelRepository;
  let states: SqliteProjectStateRepository;
  let periods: SqliteProjectEntityStateRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    const projects = new SqliteProjectRepository(db); goals = new SqliteGoalRepository(db);
    const tasks = new SqliteTaskRepository(db); relations = new SqliteRelationRepository(db);
    labels = new SqliteLabelRepository(db); assignments = new SqliteEntityLabelRepository(db);
    states = new SqliteProjectStateRepository(db); periods = new SqliteProjectEntityStateRepository(db);
    await projects.add(createProject({ title: 'Project' }, { id: 'project', now: T0 }));
    for (const id of ['a', 'b', 'c']) await goals.add(createGoal({ title: id, targetState: 'done' }, { id, now: T0 }));
    for (const id of ['x', 'y']) await tasks.add({ ...createTask({ title: id, targetDescription: 'done' }), id, createdAt: T0, updatedAt: T0 });
    const clock = { now: () => T2 };
    snapshot = new ProjectExecutionSnapshotService({
      projects, goals, tasks,
      pursuits: new ProjectGoalPursuitQueryService({ projects, goals, relations, clock }),
      memberships: new TaskProjectMembershipQueryService({ projects, tasks, relations, clock }),
      hierarchy: new DecompositionHierarchyQueryService({ projects, goals, tasks, relations, clock }),
      entityLabels: assignments, labels, projectStates: states, entityStates: periods,
    });
  });
  afterEach(async () => closeQuietly(db));

  it('returns a defined empty current snapshot', async () => {
    await expect(snapshot.getSnapshot('project')).resolves.toMatchObject({
      projectId: 'project', pursuedRoots: [], activeTasks: [], nodes: [], edges: [], findings: [],
      progress: { scope: 'current', numerator: 0, denominator: 0, percentage: null, counts: { complete: 0, incomplete: 0, blocked: 0, unmanaged: 0, no_machine: 0, uninitialized: 0, invalid: 0 } },
    });
  });

  it('composes roots, nested hierarchy, and disconnected active tasks without intrinsic membership fields', async () => {
    await pursuit('p-a', 'a', T0); await pursuit('p-b', 'b', T0);
    await membership('m-x', 'x', T0); await membership('m-y', 'y', T0);
    await edge('a', 'b', T0); await edge('b', 'x', T1, 'goal', 'task');
    const result = await snapshot.getSnapshot('project');
    expect(result.pursuedRoots.map((view) => view.goalId)).toEqual(['a', 'b']);
    expect(result.activeTasks.map((view) => view.taskId)).toEqual(['x', 'y']);
    expect(result.nodes.map((entry) => `${entry.type}:${entry.id}`)).toEqual(['goal:a', 'goal:b', 'task:x', 'task:y']);
    expect(result.edges.map((edge) => edge.relationId)).toEqual(expect.arrayContaining(['e-a-b', 'e-b-x']));
    expect(result.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(['overlapping_root', 'disconnected_active_task']));
  });

  it('uses historical relation ports at asOf and retains archived endpoints only there', async () => {
    await pursuit('first', 'a', T0, T1); await pursuit('second', 'a', T1);
    await membership('ended-member', 'x', T0, T1); await membership('current-member', 'y', T1);
    await goals.save(archiveGoal((await goals.getById('a'))!, T2));
    expect((await snapshot.getSnapshot('project')).nodes).toEqual(expect.not.arrayContaining([expect.objectContaining({ id: 'a' })]));
    const historical = await snapshot.getSnapshot('project', { asOf: T1 });
    expect(historical.pursuedRoots.map((view) => view.relationId)).toEqual(['second']);
    expect(historical.activeTasks.map((view) => view.relationId)).toEqual(['current-member']);
    expect(historical.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'goal', id: 'a' })]));
  });

  it('reports duplicate relations, hierarchy anomalies, and traversal truncation in stable order', async () => {
    await pursuit('p-1', 'a', T0); await pursuit('p-2', 'a', T0);
    await membership('m-1', 'x', T0); await membership('m-2', 'x', T0);
    await edge('a', 'b', T0); await edge('b', 'c', T0); await edge('c', 'a', T0);
    const first = await snapshot.getSnapshot('project', { maxDepth: 1, maxNodes: 100 });
    const second = await snapshot.getSnapshot('project', { maxDepth: 1, maxNodes: 100 });
    expect(first.findings.map((finding) => finding.kind)).toEqual(second.findings.map((finding) => finding.kind));
    expect(first.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(['duplicate_pursuit', 'duplicate_membership', 'hierarchy', 'traversal_truncated']));
  });

  it('enriches every node by each applicable management label without conflating no-machine, uninitialized, and current', async () => {
    await pursuit('p-a', 'a', T0); await pursuit('p-b', 'b', T0); await membership('m-x', 'x', T0);
    await label('flow', 'Flow'); await label('risk', 'Risk');
    await assign('goal', 'a', 'flow'); await assign('goal', 'a', 'risk');
    await assign('task', 'x', 'flow');
    await machine('goal', 'flow', 'ready');
    await machine('task', 'flow', 'doing');
    await current('goal', 'a', 'flow', 'ready', 'goal-period');
    const result = await snapshot.getSnapshot('project');
    const goal = result.nodes.find((entry) => entry.type === 'goal' && entry.id === 'a')!;
    const task = result.nodes.find((entry) => entry.type === 'task' && entry.id === 'x')!;
    expect(goal.lifecycle).toEqual(expect.objectContaining({ kind: 'managed' }));
    expect(goal.lifecycle.kind === 'managed' && goal.lifecycle.labels.map(({ machine, status }) => [machine.labelId, status]))
      .toEqual([['flow', 'current'], ['risk', 'no_machine']]);
    expect(goal.lifecycle.kind === 'managed' && goal.lifecycle.labels[0].current)
      .toEqual(expect.objectContaining({ period: expect.objectContaining({ id: 'goal-period', enteredAt: T1 }), state: expect.objectContaining({ id: 'ready' }) }));
    expect(task.lifecycle.kind === 'managed' && task.lifecycle.labels.map(({ machine, status }) => [machine.labelId, status]))
      .toEqual([['flow', 'uninitialized']]);
    expect((await snapshot.getSnapshot('project')).nodes.find((entry) => entry.id === 'b')?.lifecycle)
      .toEqual({ kind: 'no_applicable_machine' });
  });

  it('surfaces corrupt lifecycle references and multiple current rows deterministically', async () => {
    await pursuit('p-a', 'a', T0); await label('flow', 'Flow'); await assign('goal', 'a', 'flow');
    await machine('goal', 'flow', 'ready');
    await db.execAsync('DROP INDEX project_entity_states_one_current_context');
    await db.runAsync(
      `INSERT INTO project_entity_states (id, project_id, entity_type, entity_id, label_id, project_state_id, entered_at, ended_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?), (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ['second', 'project', 'goal', 'a', 'flow', 'missing', T2, T2, 'first', 'project', 'goal', 'a', 'flow', 'ready', T1, T1],
    );
    const first = await snapshot.getSnapshot('project');
    const second = await snapshot.getSnapshot('project');
    const lifecycle = first.nodes.find((entry) => entry.id === 'a')!.lifecycle;
    expect(lifecycle).toEqual(second.nodes.find((entry) => entry.id === 'a')!.lifecycle);
    expect(lifecycle.kind === 'managed' && lifecycle.labels[0]).toEqual(expect.objectContaining({
      status: 'anomalous', current: null,
      anomalies: expect.arrayContaining([
        { kind: 'multiple_current_states', periodIds: ['first', 'second'] },
      ]),
    }));
  });

  it('reports missing states, mismatched machines, and orphan labels without modifying state history', async () => {
    await pursuit('p-a', 'a', T0); await label('flow', 'Flow'); await label('other', 'Other');
    await assign('goal', 'a', 'flow'); await machine('goal', 'flow', 'ready'); await machine('task', 'other', 'other-state');
    await current('goal', 'a', 'flow', 'other-state', 'mismatch-period');
    await db.runAsync(
      `INSERT INTO entity_labels (id, entity_type, entity_id, label_id, created_at, ended_at) VALUES (?, ?, ?, ?, ?, NULL)`,
      ['orphan-assignment', 'goal', 'a', 'missing-label', T0],
    );
    const before = await db.getAllAsync<{ id: string; ended_at: string | null }>('SELECT id, ended_at FROM project_entity_states ORDER BY id');
    const result = await snapshot.getSnapshot('project');
    const after = await db.getAllAsync<{ id: string; ended_at: string | null }>('SELECT id, ended_at FROM project_entity_states ORDER BY id');
    expect(after).toEqual(before);
    const entries = result.nodes.find((entry) => entry.id === 'a')!.lifecycle;
    expect(entries.kind === 'managed' && entries.labels.map(({ machine, status, anomalies }) => [machine.labelId, status, anomalies.map(({ kind }) => kind)]))
      .toEqual([['flow', 'anomalous', ['project_state_machine_mismatch']], ['missing-label', 'anomalous', ['orphan_label']]]);
  });

  it('derives each shared node once with terminal/category completion and a blocked denominator', async () => {
    await pursuit('p-a', 'a', T0); await pursuit('p-b', 'b', T0); await membership('m-x', 'x', T0);
    // x is visible through both direct Project membership and decomposition,
    // but must still be counted once.
    await edge('a', 'x', T0, 'goal', 'task');
    await label('flow', 'Flow');
    for (const [type, id] of [['goal', 'a'], ['goal', 'b'], ['task', 'x']] as const) await assign(type, id, 'flow');
    await machine('goal', 'flow', 'done', { isTerminal: true });
    await machine('goal', 'flow', 'complete-category', { category: ' completed ', isInitial: false });
    await machine('task', 'flow', 'blocked', { category: 'BLOCKED' });
    await current('goal', 'a', 'flow', 'done', 'a-period');
    await current('goal', 'b', 'flow', 'complete-category', 'b-period');
    await current('task', 'x', 'flow', 'blocked', 'x-period');
    const progress = (await snapshot.getSnapshot('project')).progress;
    expect(progress).toMatchObject({ numerator: 2, denominator: 3, counts: { complete: 2, blocked: 1 } });
    expect(progress.percentage).toBeCloseTo(100 * 2 / 3);
    expect(progress.findings.map(({ node, status }) => [`${node.type}:${node.id}`, status]))
      .toEqual([['goal:a', 'complete'], ['goal:b', 'complete'], ['task:x', 'blocked']]);
  });

  it('qualifies anomalous, unmanaged, no-machine, and uninitialized nodes without inventing completion', async () => {
    await pursuit('p-a', 'a', T0); await pursuit('p-b', 'b', T0); await membership('m-x', 'x', T0); await membership('m-y', 'y', T0);
    await label('flow', 'Flow'); await label('missing-machine', 'Missing');
    await assign('goal', 'a', 'flow'); await assign('goal', 'b', 'missing-machine'); await assign('task', 'x', 'flow');
    await machine('goal', 'flow', 'ready'); await machine('task', 'flow', 'ready-task');
    await db.runAsync(`INSERT INTO project_entity_states (id, project_id, entity_type, entity_id, label_id, project_state_id, entered_at, ended_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`, ['bad', 'project', 'goal', 'a', 'flow', 'missing-state', T1, T1]);
    const progress = (await snapshot.getSnapshot('project')).progress;
    expect(progress).toMatchObject({ numerator: 0, denominator: 0, percentage: null, counts: { invalid: 1, no_machine: 1, uninitialized: 1, unmanaged: 1 } });
    expect(progress.findings.map(({ node, status }) => [`${node.type}:${node.id}`, status]))
      .toEqual([['goal:a', 'invalid'], ['goal:b', 'no_machine'], ['task:x', 'uninitialized'], ['task:y', 'unmanaged']]);
  });

  it('uses the explicitly historical snapshot scope for ended/archive-inclusive progress', async () => {
    await pursuit('p-a', 'a', T0, T1); await label('flow', 'Flow'); await assign('goal', 'a', 'flow'); await machine('goal', 'flow', 'done', { isTerminal: true }); await current('goal', 'a', 'flow', 'done', 'period');
    const currentSnapshot = await snapshot.getSnapshot('project');
    const historical = await snapshot.getSnapshot('project', { includeEnded: true });
    expect(currentSnapshot.progress).toMatchObject({ scope: 'current', denominator: 0, percentage: null });
    expect(historical.progress).toMatchObject({ scope: 'historical', numerator: 1, denominator: 1, percentage: 100 });
  });

  async function pursuit(id: string, goalId: string, createdAt: string, endedAt: string | null = null) {
    await relations.add({ id, sourceType: 'project', sourceId: 'project', relationType: 'contributes_to', targetType: 'goal', targetId: goalId, metadata: null, createdAt, endedAt });
  }
  async function membership(id: string, taskId: string, createdAt: string, endedAt: string | null = null) {
    await relations.add({ id, sourceType: 'task', sourceId: taskId, relationType: 'belongs_to', targetType: 'project', targetId: 'project', metadata: null, createdAt, endedAt });
  }
  async function edge(sourceId: string, targetId: string, createdAt: string, sourceType: 'goal' | 'task' = 'goal', targetType: 'goal' | 'task' = 'goal') {
    await relations.add({ id: `e-${sourceId}-${targetId}`, sourceType, sourceId, relationType: 'decomposes', targetType, targetId, metadata: decompositionMetadata('project'), createdAt, endedAt: null });
  }
  async function label(id: string, name: string) { await labels.add({ ...createLabel({ name }), id, createdAt: T0, updatedAt: T0 }); }
  async function assign(entityType: 'goal' | 'task', entityId: string, labelId: string) { await assignments.add(createEntityLabelAssignment({ entityType, entityId, labelId }, { id: `${entityType}-${entityId}-${labelId}`, now: T0 })); }
  async function machine(entityType: 'goal' | 'task', labelId: string, stateId: string, settings: { isTerminal?: boolean; category?: string; isInitial?: boolean } = {}) { await states.add(createProjectState({ projectId: 'project', entityType, labelId, title: stateId, isInitial: settings.isInitial ?? !settings.isTerminal, ...settings }, { id: stateId, now: T0 })); }
  async function current(entityType: 'goal' | 'task', entityId: string, labelId: string, projectStateId: string, id: string) { await periods.add(createProjectEntityState({ projectId: 'project', entityType, entityId, labelId, projectStateId, enteredAt: T1 }, { id, now: T1 })); }
});
