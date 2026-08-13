import { DecompositionHierarchyQueryService } from '../src/application/decompositionHierarchyQueryService';
import { ProjectExecutionSnapshotService } from '../src/application/projectExecutionSnapshotService';
import { ProjectGoalPursuitQueryService } from '../src/application/projectGoalPursuitQueryService';
import { TaskProjectMembershipQueryService } from '../src/application/taskProjectMembershipQueryService';
import { archiveGoal, createGoal } from '../src/domain/goal';
import { createProject } from '../src/domain/project';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import { createTask } from '../src/domain/task';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
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

  beforeEach(async () => {
    db = await createTestDatabase();
    const projects = new SqliteProjectRepository(db); goals = new SqliteGoalRepository(db);
    const tasks = new SqliteTaskRepository(db); relations = new SqliteRelationRepository(db);
    await projects.add(createProject({ title: 'Project' }, { id: 'project', now: T0 }));
    for (const id of ['a', 'b', 'c']) await goals.add(createGoal({ title: id, targetState: 'done' }, { id, now: T0 }));
    for (const id of ['x', 'y']) await tasks.add({ ...createTask({ title: id, targetDescription: 'done' }), id, createdAt: T0, updatedAt: T0 });
    const clock = { now: () => T2 };
    snapshot = new ProjectExecutionSnapshotService({
      projects, goals, tasks,
      pursuits: new ProjectGoalPursuitQueryService({ projects, goals, relations, clock }),
      memberships: new TaskProjectMembershipQueryService({ projects, tasks, relations, clock }),
      hierarchy: new DecompositionHierarchyQueryService({ projects, goals, tasks, relations, clock }),
    });
  });
  afterEach(async () => closeQuietly(db));

  it('returns a defined empty current snapshot', async () => {
    await expect(snapshot.getSnapshot('project')).resolves.toMatchObject({ projectId: 'project', pursuedRoots: [], activeTasks: [], nodes: [], edges: [], findings: [] });
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

  async function pursuit(id: string, goalId: string, createdAt: string, endedAt: string | null = null) {
    await relations.add({ id, sourceType: 'project', sourceId: 'project', relationType: 'contributes_to', targetType: 'goal', targetId: goalId, metadata: null, createdAt, endedAt });
  }
  async function membership(id: string, taskId: string, createdAt: string, endedAt: string | null = null) {
    await relations.add({ id, sourceType: 'task', sourceId: taskId, relationType: 'belongs_to', targetType: 'project', targetId: 'project', metadata: null, createdAt, endedAt });
  }
  async function edge(sourceId: string, targetId: string, createdAt: string, sourceType: 'goal' | 'task' = 'goal', targetType: 'goal' | 'task' = 'goal') {
    await relations.add({ id: `e-${sourceId}-${targetId}`, sourceType, sourceId, relationType: 'decomposes', targetType, targetId, metadata: decompositionMetadata('project'), createdAt, endedAt: null });
  }
});
