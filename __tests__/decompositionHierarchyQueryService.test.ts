import { DecompositionHierarchyQueryService } from '../src/application/decompositionHierarchyQueryService';
import { createGoal } from '../src/domain/goal';
import { createProject } from '../src/domain/project';
import { createTask } from '../src/domain/task';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteTaskRepository } from '../src/persistence/taskRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T09:00:00.000Z';
const T1 = '2026-08-13T10:00:00.000Z';
const T2 = '2026-08-13T11:00:00.000Z';

describe('DecompositionHierarchyQueryService', () => {
  let db: SqliteDatabase;
  let queries: DecompositionHierarchyQueryService;
  let relations: SqliteRelationRepository;

  beforeEach(async () => {
    db = await createTestDatabase(); relations = new SqliteRelationRepository(db);
    await new SqliteProjectRepository(db).add(createProject({ title: 'Project' }, { id: 'project', now: T0 }));
    for (const id of ['a', 'b', 'c', 'd']) await new SqliteGoalRepository(db).add(createGoal({ title: id, targetState: 'done' }, { id, now: T0 }));
    for (const id of ['x', 'y']) await new SqliteTaskRepository(db).add({ ...createTask({ title: id, targetDescription: 'done' }), id, createdAt: T0, updatedAt: T0 });
    queries = new DecompositionHierarchyQueryService({ projects: new SqliteProjectRepository(db), goals: new SqliteGoalRepository(db), tasks: new SqliteTaskRepository(db), relations, clock: { now: () => T2 } });
  });
  afterEach(async () => closeQuietly(db));

  it('projects direct canonical Goal/Task hierarchy edges in both directions', async () => {
    await edge('a', 'b', T0); await edge('a', 'x', T1, 'goal', 'task'); await edge('x', 'y', T1, 'task', 'task');
    const children = await queries.getDirectChildren('project', { type: 'goal', id: 'a' });
    const parents = await queries.getDirectParents('project', { type: 'task', id: 'x' });
    expect(children.edges.map((edge) => [edge.parent.type, edge.parent.id, edge.child.type, edge.child.id])).toEqual([['goal', 'a', 'goal', 'b'], ['goal', 'a', 'task', 'x']]);
    expect(parents.edges[0].relation.sourceType).toBe('goal');
    expect(parents.edges[0].relation.targetType).toBe('task');
  });

  it('walks DAGs deterministically with visited nodes and explicit depth/node bounds', async () => {
    await edge('a', 'c', T1); await edge('a', 'b', T0); await edge('b', 'd', T1); await edge('c', 'd', T1);
    const all = await queries.findDescendants('project', { type: 'goal', id: 'a' });
    expect(all.nodes.map((entry) => entry.node.id)).toEqual(['b', 'c', 'd']);
    expect((await queries.findAncestors('project', { type: 'goal', id: 'd' })).nodes.map((entry) => entry.node.id)).toEqual(['b', 'c', 'a']);
    const bounded = await queries.findDescendants('project', { type: 'goal', id: 'a' }, { maxDepth: 1, maxNodes: 2 });
    expect(bounded.nodes.map((entry) => entry.node.id)).toEqual(['b']);
    expect(bounded.truncation).toMatchObject({ truncated: true, depthLimitReached: true, nodeLimitReached: true, maxDepth: 1, maxNodes: 2 });
  });

  it('keeps ended edges historical and resolves half-open as-of validity', async () => {
    await edge('a', 'b', T0, 'goal', 'goal', T1);
    expect((await queries.getChildren('project', { type: 'goal', id: 'a' })).edges).toEqual([]);
    expect((await queries.getChildren('project', { type: 'goal', id: 'a' }, { includeEnded: true })).edges).toHaveLength(1);
    expect((await queries.getChildren('project', { type: 'goal', id: 'a' }, { asOf: T0 })).edges).toHaveLength(1);
    expect((await queries.getChildren('project', { type: 'goal', id: 'a' }, { asOf: T1 })).edges).toEqual([]);
  });

  it('reports legacy integrity anomalies without traversing cycles or cross-project edges', async () => {
    await edge('a', 'b', T0); await edge('b', 'a', T1); await edge('a', 'c', T1); await edge('d', 'c', T1);
    await relations.add({ id: 'other-project', sourceType: 'goal', sourceId: 'a', relationType: 'decomposes', targetType: 'goal', targetId: 'd', metadata: decompositionMetadata('other'), createdAt: T0, endedAt: null });
    await db.runAsync("INSERT INTO relations (id, source_type, source_id, relation_type, target_type, target_id, metadata, created_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ['missing', 'goal', 'missing-goal', 'decomposes', 'goal', 'a', JSON.stringify(decompositionMetadata('project')), T0, null]);
    const result = await queries.findDescendants('project', { type: 'goal', id: 'a' });
    expect(result.nodes.map((entry) => entry.node.id)).toEqual(['b', 'c']);
    expect(result.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(['cycle', 'cross_project_edge', 'missing_endpoint', 'parent_cardinality']));
  });

  async function edge(sourceId: string, targetId: string, createdAt: string, sourceType: 'goal' | 'task' = 'goal', targetType: 'goal' | 'task' = 'goal', endedAt: string | null = null): Promise<void> {
    await relations.add({ id: `${sourceType}-${sourceId}-${targetType}-${targetId}-${createdAt}`, sourceType, sourceId, relationType: 'decomposes', targetType, targetId, metadata: decompositionMetadata('project'), createdAt, endedAt });
  }
});
