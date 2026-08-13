import {
  ProjectEntityStateIdentityAnomalyError,
  ProjectEntityStateQueryService,
  ProjectTransitionExecutionService,
  ProjectTransitionRejectedError,
} from '../src/application/projectTransitionExecutionService';
import { ProjectTransitionValidationService } from '../src/application/projectTransitionValidationService';
import { createProjectEntityState } from '../src/domain/projectEntityState';
import { createProjectState } from '../src/domain/projectState';
import { createProjectStateTransition } from '../src/domain/projectStateTransition';
import { SqliteProjectEntityStateRepository } from '../src/persistence/projectEntityStateRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteProjectStateTransitionRepository } from '../src/persistence/projectStateTransitionRepository';
import { withTransaction } from '../src/persistence/transactions';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const MACHINE = { projectId: 'project-1', entityType: 'task' as const, labelId: 'label-1' };
const CONTEXT = { ...MACHINE, entityId: 'task-1' };
const START = '2026-08-13T00:00:00.000Z';
const MOVED = '2026-08-13T01:00:00.000Z';

async function fixture() {
  const db = await createTestDatabase();
  const states = new SqliteProjectStateRepository(db);
  const transitions = new SqliteProjectStateTransitionRepository(db);
  const periods = new SqliteProjectEntityStateRepository(db);
  const ready = createProjectState({ ...MACHINE, title: 'Ready' }, { id: 'ready', now: START });
  const done = createProjectState({ ...MACHINE, title: 'Done' }, { id: 'done', now: START });
  await states.add(ready);
  await states.add(done);
  await transitions.add(createProjectStateTransition({ ...MACHINE, fromStateId: ready.id, toStateId: done.id }, { id: 'ready-done', now: START }));
  await periods.add(createProjectEntityState({ ...CONTEXT, projectStateId: ready.id }, { id: 'period-ready', now: START }));
  let ids = 0;
  const service = new ProjectTransitionExecutionService({
    db,
    validation: (context) => new ProjectTransitionValidationService({
      entityStates: new SqliteProjectEntityStateRepository(context),
      states: new SqliteProjectStateRepository(context),
      transitions: new SqliteProjectStateTransitionRepository(context),
    }),
    clock: { now: () => MOVED },
    ids: { newId: () => `period-${++ids}` },
  });
  const command = { ...CONTEXT, toProjectStateId: done.id, occurredAt: MOVED };
  return { db, states, periods, service, command };
}

describe('ProjectTransitionExecutionService', () => {
  it('revalidates, closes and opens one period at one authoritative timestamp', async () => {
    const { db, periods, service, command } = await fixture();
    const result = await service.transition(command);

    expect(result.previous).toMatchObject({ id: 'period-ready', endedAt: MOVED });
    expect(result.current).toMatchObject({ projectStateId: 'done', enteredAt: MOVED, createdAt: MOVED, endedAt: null });
    expect(await periods.listHistory(CONTEXT)).toMatchObject([
      { id: 'period-ready', projectStateId: 'ready', endedAt: MOVED },
      { projectStateId: 'done', enteredAt: MOVED, endedAt: null },
    ]);
    await closeQuietly(db);
  });

  it('preserves the winning transition and history when a stale command retries', async () => {
    const { db, periods, service, command } = await fixture();
    await service.transition(command);
    await expect(service.transition(command)).rejects.toEqual(
      expect.objectContaining({ name: 'ProjectTransitionRejectedError', rejection: { authorized: false, reason: 'transition_missing' } }),
    );
    const history = await periods.listHistory(CONTEXT);
    expect(history).toHaveLength(2);
    expect(history.filter((period) => period.endedAt === null)).toHaveLength(1);
    expect(history[1].projectStateId).toBe('done');
    await closeQuietly(db);
  });

  it('rolls back the close/open pair when a caller-owned audit transaction fails', async () => {
    const { db, periods, service, command } = await fixture();
    await expect(withTransaction(db, async (context) => {
      await service.transitionInTransaction(context, command);
      throw new Error('audit append failed');
    })).rejects.toThrow('audit append failed');
    expect(await periods.listHistory(CONTEXT)).toMatchObject([
      { id: 'period-ready', projectStateId: 'ready', endedAt: null },
    ]);
    await closeQuietly(db);
  });

  it('rejects state-history identity anomalies instead of returning a silent answer', async () => {
    const { db, states } = await fixture();
    const other = createProjectState({ projectId: 'other-project', entityType: 'task', labelId: 'other-label', title: 'Other' }, { id: 'other-state', now: START });
    await states.add(other);
    await db.runAsync('UPDATE project_entity_states SET project_state_id = ? WHERE id = ?', ['other-state', 'period-ready']);
    const queries = new ProjectEntityStateQueryService({ db, states });
    await expect(queries.getCurrent(CONTEXT)).rejects.toBeInstanceOf(ProjectEntityStateIdentityAnomalyError);
    await expect(queries.listHistory(CONTEXT)).rejects.toBeInstanceOf(ProjectEntityStateIdentityAnomalyError);
    await closeQuietly(db);
  });

  it('surfaces corrupt multiple-current rows rather than choosing one', async () => {
    const { db, service } = await fixture();
    await db.execAsync('DROP INDEX project_entity_states_one_current_context');
    await db.runAsync(
      `INSERT INTO project_entity_states (id, project_id, entity_type, entity_id, label_id, project_state_id, entered_at, ended_at, created_at)
       VALUES ('period-corrupt', ?, ?, ?, ?, 'ready', ?, NULL, ?)`,
      [CONTEXT.projectId, CONTEXT.entityType, CONTEXT.entityId, CONTEXT.labelId, MOVED, MOVED],
    );
    await expect(service.transition({ ...CONTEXT, toProjectStateId: 'done' })).rejects.toThrow(/multiple current/i);
    await closeQuietly(db);
  });
});
