import type { AttentionEntryRepository } from '../../domain/attention/repository/AttentionEntryRepository';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { MilestoneRepository } from '../../domain/milestone/repository/MilestoneRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import { NodeSqliteDatabase } from '../../infrastructure/sqliteRepository/NodeSqliteDatabase';
import { SqliteAttentionEntryRepository } from '../../infrastructure/sqliteRepository/SqliteAttentionEntryRepository';
import { SqliteGoalRepository } from '../../infrastructure/sqliteRepository/SqliteGoalRepository';
import { SqliteIdeaRepository } from '../../infrastructure/sqliteRepository/SqliteIdeaRepository';
import { SqliteLabelRepository } from '../../infrastructure/sqliteRepository/SqliteLabelRepository';
import { SqliteMilestoneRepository } from '../../infrastructure/sqliteRepository/SqliteMilestoneRepository';
import { SqliteProjectRepository } from '../../infrastructure/sqliteRepository/SqliteProjectRepository';
import { SqliteRecordRepository } from '../../infrastructure/sqliteRepository/SqliteRecordRepository';
import { SqliteRelationRepository } from '../../infrastructure/sqliteRepository/SqliteRelationRepository';
import { SqliteResourceRepository } from '../../infrastructure/sqliteRepository/SqliteResourceRepository';
import { SqliteTaskRepository } from '../../infrastructure/sqliteRepository/SqliteTaskRepository';
import { SqliteTransactionRunner } from '../../infrastructure/sqliteRepository/SqliteTransactionRunner';
import { migrate } from '../../infrastructure/sqliteRepository/schema';
import type { TransactionRunner } from '../shared/TransactionRunner';

/** Lightweight runner for unit tests that do not need rollback semantics. */
export const immediateTransactionRunner: TransactionRunner = {
  run: <T>(work: () => Promise<T>): Promise<T> => work(),
};

export interface TestRepositories {
  attentionEntryRepo: AttentionEntryRepository;
  goalRepo: GoalRepository;
  ideaRepo: IdeaRepository;
  labelRepo: LabelRepository;
  milestoneRepo: MilestoneRepository;
  projectRepo: ProjectRepository;
  recordRepo: RecordRepository;
  relationRepo: RelationRepository;
  resourceRepo: ResourceRepository;
  taskRepo: TaskRepository;
  transactionRunner: TransactionRunner;
}

/**
 * Creates isolated application-test repositories backed by the production
 * SQLite implementations. The in-memory database keeps tests independent
 * without duplicating repository behavior in handwritten fakes.
 */
export async function makeFakeRepos(): Promise<TestRepositories> {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);

  return {
    attentionEntryRepo: new SqliteAttentionEntryRepository(db),
    goalRepo: new SqliteGoalRepository(db),
    ideaRepo: new SqliteIdeaRepository(db),
    labelRepo: new SqliteLabelRepository(db),
    milestoneRepo: new SqliteMilestoneRepository(db),
    projectRepo: new SqliteProjectRepository(db),
    recordRepo: new SqliteRecordRepository(db),
    relationRepo: new SqliteRelationRepository(db),
    resourceRepo: new SqliteResourceRepository(db),
    taskRepo: new SqliteTaskRepository(db),
    transactionRunner: new SqliteTransactionRunner(db),
  };
}
