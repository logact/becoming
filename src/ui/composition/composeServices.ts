import { AttentionService } from '../../application/attention/AttentionService';
import { PinCandidatesService } from '../../application/attention/PinCandidatesService';
import { DashboardService } from '../../application/dashboard/DashboardService';
import { ConsumeResourceService } from '../../application/resource/ConsumeResourceService';
import { openExpoDatabase } from '../../infrastructure/sqliteRepository/ExpoSqliteDatabase';
import { migrate } from '../../infrastructure/sqliteRepository/schema';
import { SqliteAttentionEntryRepository } from '../../infrastructure/sqliteRepository/SqliteAttentionEntryRepository';
import { SqliteGoalRepository } from '../../infrastructure/sqliteRepository/SqliteGoalRepository';
import { SqliteIdeaRepository } from '../../infrastructure/sqliteRepository/SqliteIdeaRepository';
import { SqliteProjectRepository } from '../../infrastructure/sqliteRepository/SqliteProjectRepository';
import { SqliteRecordRepository } from '../../infrastructure/sqliteRepository/SqliteRecordRepository';
import { SqliteRelationRepository } from '../../infrastructure/sqliteRepository/SqliteRelationRepository';
import { SqliteResourceRepository } from '../../infrastructure/sqliteRepository/SqliteResourceRepository';
import { SqliteTaskRepository } from '../../infrastructure/sqliteRepository/SqliteTaskRepository';
import type { AppServices } from './AppServicesProvider';
import { seedDevData } from './devSeed';

export interface ComposeServicesOptions {
  /**
   * DEV ONLY: when true and the database holds no goals yet, a
   * prototype-like dataset is seeded so the dashboard is visibly alive on
   * first launch.
   */
  seed?: boolean;
}

/**
 * Composition root: opens (and migrates) the on-device SQLite database,
 * builds the repositories and application services on top of it, and returns
 * the services the UI consumes. Rejects when the database cannot be opened
 * or migrated; the caller renders the error state.
 */
export async function composeServices(options: ComposeServicesOptions = {}): Promise<AppServices> {
  const db = await openExpoDatabase('becoming.db');
  await migrate(db);

  const goals = new SqliteGoalRepository(db);
  const tasks = new SqliteTaskRepository(db);
  const ideas = new SqliteIdeaRepository(db);
  const projects = new SqliteProjectRepository(db);
  const resources = new SqliteResourceRepository(db);
  const relations = new SqliteRelationRepository(db);
  const records = new SqliteRecordRepository(db);
  const attentionEntries = new SqliteAttentionEntryRepository(db);

  if (options.seed === true && (await goals.list()).length === 0) {
    await seedDevData({
      goals,
      tasks,
      ideas,
      projects,
      resources,
      records,
      consumeResource: new ConsumeResourceService(resources, relations, records),
    });
  }

  return {
    dashboard: new DashboardService(
      goals,
      tasks,
      ideas,
      projects,
      resources,
      relations,
      records,
      attentionEntries,
    ),
    attention: new AttentionService(attentionEntries),
    pinCandidates: new PinCandidatesService(goals, tasks, ideas, attentionEntries),
  };
}
