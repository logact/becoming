import {
  ProjectTransitionAuditService,
} from '../src/application/projectTransitionAuditService';
import { LifecycleAuditPersistenceError } from '../src/application/lifecycleAuditService';
import {
  ProjectTransitionExecutionService,
  ProjectTransitionRejectedError,
} from '../src/application/projectTransitionExecutionService';
import { ProjectTransitionValidationService } from '../src/application/projectTransitionValidationService';
import { createProjectEntityState } from '../src/domain/projectEntityState';
import { createProjectState } from '../src/domain/projectState';
import { createProjectStateTransition } from '../src/domain/projectStateTransition';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectEntityStateRepository } from '../src/persistence/projectEntityStateRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteProjectStateTransitionRepository } from '../src/persistence/projectStateTransitionRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import type { RecordRepository } from '../src/persistence/recordRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-13T10:00:00.000Z';
const MOVED = '2026-08-13T11:00:00.000Z';
const machine = { projectId: 'project-1', entityType: 'goal' as const, labelId: 'label-1' };
const context = { ...machine, entityId: 'goal-1' };

async function fixture(records?: (db: SqliteDatabase) => RecordRepository) {
  const db = await createTestDatabase();
  await db.runAsync(
    `INSERT INTO projects (id, title, description, purpose, created_at, updated_at, archived_at)
     VALUES ('project-1', 'Project', NULL, NULL, ?, ?, NULL)`, [NOW, NOW],
  );
  await db.runAsync(
    `INSERT INTO labels (id, name, description, created_at, updated_at, archived_at)
     VALUES ('label-1', 'Feature', NULL, ?, ?, NULL)`, [NOW, NOW],
  );
  await db.runAsync(
    `INSERT INTO goals (id, title, target_state, created_at, updated_at)
     VALUES ('goal-1', 'Goal', 'Done', ?, ?)`, [NOW, NOW],
  );
  const states = new SqliteProjectStateRepository(db);
  const periods = new SqliteProjectEntityStateRepository(db);
  const transitions = new SqliteProjectStateTransitionRepository(db);
  await states.add(createProjectState({ ...machine, title: 'Ready', category: 'active' }, { id: 'ready', now: NOW }));
  await states.add(createProjectState({ ...machine, title: 'Done', category: 'completed' }, { id: 'done', now: NOW }));
  await transitions.add(createProjectStateTransition({ ...machine, fromStateId: 'ready', toStateId: 'done', title: 'Complete', condition: 'reviewed', requiresExitCriteria: true }, { id: 'ready-done', now: NOW }));
  await periods.add(createProjectEntityState({ ...context, projectStateId: 'ready', enteredAt: NOW }, { id: 'period-ready', now: NOW }));
  let ids = 0;
  const execution = new ProjectTransitionExecutionService({
    db,
    validation: (transaction) => new ProjectTransitionValidationService({
      entityStates: new SqliteProjectEntityStateRepository(transaction),
      states: new SqliteProjectStateRepository(transaction),
      transitions: new SqliteProjectStateTransitionRepository(transaction),
      conditionEvaluator: { evaluate: async () => ({ passed: true, evidence: { secret: 'never persisted' } }) },
      exitCriteriaEvaluator: { evaluate: async () => ({ passed: true, evidence: { secret: 'never persisted' } }) },
    }),
    clock: { now: () => MOVED }, ids: { newId: () => `period-${++ids}` },
  });
  const service = new ProjectTransitionAuditService({
    db, execution,
    records: records ?? ((transaction) => new SqliteRecordRepository(transaction)),
    projects: (transaction) => ({ getById: async (id) => transaction.getFirstAsync<{ id: string; archived_at: string | null }>('SELECT id, archived_at FROM projects WHERE id = ?', [id]).then((row) => row === null ? null : { id: row.id, archivedAt: row.archived_at }) }),
    labels: (transaction) => new SqliteLabelRepository(transaction),
    entities: (transaction) => ({ exists: async (_type, id) => (await transaction.getFirstAsync('SELECT id FROM goals WHERE id = ?', [id])) !== null }),
    clock: { now: () => MOVED }, ids: { newId: () => `record-${++ids}` },
  });
  return { db, periods, service };
}

describe('ProjectTransitionAuditService', () => {
  const command = { ...context, toProjectStateId: 'done', actor: 'user-1', occurredAt: MOVED };

  it('uses #55 validation to atomically close/open state history and append one matching audit', async () => {
    const { db, periods, service } = await fixture();
    const result = await service.transition(command);
    expect(await periods.listHistory(context)).toMatchObject([
      { id: 'period-ready', projectStateId: 'ready', endedAt: MOVED },
      { projectStateId: 'done', enteredAt: MOVED, endedAt: null },
    ]);
    const records = await db.getAllAsync<{ id: string }>("SELECT id FROM records WHERE record_type = 'state_transition'");
    expect(records).toEqual([{ id: result.audit.id }]);
    expect(result.audit.payload).toMatchObject({
      projectId: 'project-1', entityType: 'goal', entityId: 'goal-1', labelId: 'label-1',
      fromProjectStateId: 'ready', toProjectStateId: 'done', projectTransitionId: 'ready-done', actor: 'user-1', occurredAt: MOVED,
      snapshot: { fromState: { title: 'Ready' }, toState: { title: 'Done' }, transition: { title: 'Complete' }, label: { name: 'Feature' } },
      evaluation: { conditions: [{ outcome: 'satisfied' }], exitCriteria: [{ outcome: 'satisfied' }] },
    });
    expect(JSON.stringify(result.audit.payload)).not.toContain('secret');
    await closeQuietly(db);
  });

  it('leaves no write and no audit for a rejected concurrent/stale command', async () => {
    const { db, periods, service } = await fixture();
    await service.transition(command);
    await expect(service.transition(command)).rejects.toBeInstanceOf(ProjectTransitionRejectedError);
    expect(await periods.listHistory(context)).toHaveLength(2);
    expect(await db.getAllAsync("SELECT id FROM records WHERE record_type = 'state_transition'")).toHaveLength(1);
    await closeQuietly(db);
  });

  it('rolls back the closed/opened periods when audit storage fails', async () => {
    const { db, periods, service } = await fixture(() => ({ add: async () => { throw new Error('record failed'); }, getById: async () => null }));
    await expect(service.transition(command)).rejects.toBeInstanceOf(LifecycleAuditPersistenceError);
    expect(await periods.listHistory(context)).toMatchObject([{ id: 'period-ready', endedAt: null }]);
    expect(await db.getAllAsync("SELECT id FROM records WHERE record_type = 'state_transition'")).toHaveLength(0);
    await closeQuietly(db);
  });
});
