import {
  DecompositionEndOrphansMilestoneGoalError,
  DecompositionService,
} from '../src/application/decompositionService';
import { RecordDecompositionProvenancePort } from '../src/application/decompositionProvenanceService';
import { createMilestone, createMilestoneGoalAssignment } from '../src/domain/milestone';
import { createGoal } from '../src/domain/goal';
import { createProject } from '../src/domain/project';
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
let sequence = 0;

function service(db: SqliteDatabase, withMilestoneGuard: boolean) {
  return new DecompositionService<SqliteDatabase>({
    unitOfWork: sqliteUnitOfWork(db),
    projects: (context) => new SqliteProjectRepository(context),
    goals: (context) => new SqliteGoalRepository(context),
    tasks: (context) => new SqliteTaskRepository(context),
    relations: (context) => new SqliteRelationRepository(context),
    workflowGuidance: { resolve: async () => ({ status: 'resolved' as const, workflowId: 'workflow', version: 1 }) },
    provenance: new RecordDecompositionProvenancePort({
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => T0 },
      ids: { newId: () => `orphan-audit-${++sequence}` },
    }),
    ...(withMilestoneGuard
      ? { milestoneAssignments: (context: SqliteDatabase) => new SqliteMilestoneGoalAssignmentRepository(context) }
      : {}),
    clock: { now: () => T1 },
    ids: { newId: () => `orphan-${++sequence}` },
  });
}

/**
 * Project 'project' pursues root Goal 'root', decomposed root -> g1 -> g3 and
 * root -> g2. Milestone 'm1' actively assigns 'g3'.
 */
async function seed(db: SqliteDatabase) {
  await new SqliteProjectRepository(db).add(createProject({ title: 'Project' }, { id: 'project', now: T0 }));
  const goals = new SqliteGoalRepository(db);
  for (const id of ['root', 'g1', 'g2', 'g3']) {
    await goals.add(createGoal({ title: id, targetState: 'Done' }, { id, now: T0 }));
  }
  const relations = new SqliteRelationRepository(db);
  await relations.add({
    id: 'pursuit', sourceType: 'project', sourceId: 'project', relationType: 'contributes_to',
    targetType: 'goal', targetId: 'root', metadata: null, createdAt: T0, endedAt: null,
  });
  const edge = (id: string, sourceId: string, targetId: string) =>
    relations.add({
      id, sourceType: 'goal', sourceId, relationType: 'decomposes',
      targetType: 'goal', targetId, metadata: decompositionMetadata('project'), createdAt: T0, endedAt: null,
    });
  await edge('e-root-g1', 'root', 'g1');
  await edge('e-root-g2', 'root', 'g2');
  await edge('e-g1-g3', 'g1', 'g3');
  const milestone = createMilestone(
    { pursuitRelationId: 'pursuit', title: 'M1', sortOrder: 1 },
    { id: 'm1', now: T0 },
  );
  await new SqliteMilestoneRepository(db).add(milestone);
  await new SqliteMilestoneGoalAssignmentRepository(db).add(
    createMilestoneGoalAssignment(milestone, { goalId: 'g3', sortOrder: 1 }, { id: 'a-g3', now: T0 }),
  );
}

describe('DecompositionService Milestone orphan protection', () => {
  let db: SqliteDatabase;
  beforeEach(async () => { db = await createTestDatabase(); await seed(db); });
  afterEach(async () => closeQuietly(db));

  it('rejects ending an edge that would detach an actively assigned Goal', async () => {
    const decompositions = service(db, true);
    const failure = await decompositions
      .end({ relationId: 'e-root-g1', actor: 'planner' })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DecompositionEndOrphansMilestoneGoalError);
    const orphanError = failure as DecompositionEndOrphansMilestoneGoalError;
    expect(orphanError.message).toContain('remove or move the Milestone Goal assignment(s) first');
    expect(orphanError.orphans).toEqual([
      { assignmentId: 'a-g3', milestoneId: 'm1', pursuitRelationId: 'pursuit', goalId: 'g3' },
    ]);
    // The rejected end rolls back: the edge stays active and nothing is audited.
    expect((await new SqliteRelationRepository(db).getById('e-root-g1'))?.endedAt).toBeNull();
    expect(await db.getAllAsync('SELECT id FROM records')).toEqual([]);
  });

  it('also rejects ending the direct parent edge of an assigned Goal', async () => {
    await expect(service(db, true).end({ relationId: 'e-g1-g3', actor: 'planner' }))
      .rejects.toBeInstanceOf(DecompositionEndOrphansMilestoneGoalError);
  });

  it('allows the end once the assignment has been removed from the Milestone', async () => {
    const assignments = new SqliteMilestoneGoalAssignmentRepository(db);
    const assignment = (await assignments.getById('a-g3'))!;
    await assignments.save({ ...assignment, endedAt: T1 });
    const ended = await service(db, true).end({ relationId: 'e-root-g1', actor: 'planner' });
    expect(ended.endedAt).toBe(T1);
  });

  it('allows ending edges that do not detach any assigned Goal', async () => {
    const ended = await service(db, true).end({ relationId: 'e-root-g2', actor: 'planner' });
    expect(ended.endedAt).toBe(T1);
    expect((await new SqliteMilestoneGoalAssignmentRepository(db).getById('a-g3'))?.endedAt).toBeNull();
  });

  it('keeps prior end behavior when the Milestone guard port is not composed', async () => {
    const ended = await service(db, false).end({ relationId: 'e-root-g1', actor: 'planner' });
    expect(ended.endedAt).toBe(T1);
  });
});
