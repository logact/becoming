import {
  archiveGoal,
  createGoal,
  updateGoal,
  validateGoal,
} from '../src/domain/goal';
import { GoalNotFoundError, GoalService } from '../src/application/goalService';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { Record } from '../src/domain/record';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

describe('goal domain model', () => {
  it('creates a Goal with fresh id, timestamps, and null optional fields by default', () => {
    const goal = createGoal({
      title: 'Ship M1',
      targetState: 'Milestone M1 is accepted',
    });

    expect(goal.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(goal.title).toBe('Ship M1');
    expect(goal.targetState).toBe('Milestone M1 is accepted');
    expect(goal.description).toBeNull();
    expect(goal.successCriteria).toBeNull();
    expect(goal.createdAt).toBe(goal.updatedAt);
    expect(goal.archivedAt).toBeNull();
    expect(() => validateGoal(goal)).not.toThrow();
  });

  it('keeps explicit description and success criteria', () => {
    const goal = createGoal({
      title: 'Learn Spanish',
      targetState: 'Hold a 30-minute conversation',
      description: 'Personal growth goal',
      successCriteria: 'Conversation partner confirms fluency',
    });

    expect(goal.description).toBe('Personal growth goal');
    expect(goal.successCriteria).toBe('Conversation partner confirms fluency');
  });

  it('rejects a blank title', () => {
    expect(() =>
      createGoal({ title: '   ', targetState: 'Done' }),
    ).toThrow(/title/);
  });

  it('rejects a blank target state', () => {
    expect(() => createGoal({ title: 'Goal', targetState: '  ' })).toThrow(
      /targetState/,
    );
  });

  it('archives without mutating the original and bumps updatedAt', () => {
    const goal = createGoal({ title: 'Retire early', targetState: 'FI reached' });
    const archived = archiveGoal(goal, '2026-08-12T12:00:00.000Z');

    expect(goal.archivedAt).toBeNull();
    expect(archived.id).toBe(goal.id);
    expect(archived.archivedAt).toBe('2026-08-12T12:00:00.000Z');
    expect(archived.updatedAt).toBe('2026-08-12T12:00:00.000Z');
  });

  it('rejects archiving an already archived Goal', () => {
    const archived = archiveGoal(
      createGoal({ title: 'Old goal', targetState: 'Past state' }),
    );
    expect(() => archiveGoal(archived)).toThrow(/already archived/);
  });

  it('updates active intrinsic fields without changing createdAt', () => {
    const goal = createGoal({ title: 'Original', targetState: 'Initial' });
    const updated = updateGoal(goal, {
      title: 'Refined', targetState: 'Accepted', description: 'Scope', successCriteria: 'Verified',
    }, '2026-08-12T12:00:00.000Z');

    expect(updated).toMatchObject({
      title: 'Refined', targetState: 'Accepted', description: 'Scope', successCriteria: 'Verified',
      createdAt: goal.createdAt, updatedAt: '2026-08-12T12:00:00.000Z',
    });
    expect(updateGoal(updated, { description: null, successCriteria: null }, '2026-08-12T12:01:00.000Z'))
      .toMatchObject({ description: null, successCriteria: null });
  });

  it('rejects updates to an archived Goal', () => {
    const archived = archiveGoal(createGoal({ title: 'Old', targetState: 'Past' }));
    expect(() => updateGoal(archived, { title: 'Nope' })).toThrow(/archived/);
  });
});

describe('GoalRepository contract', () => {
  it('projects all intrinsic fields while separating active, archived, and all Goal views', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const minimal = {
      ...createGoal({ title: 'Active', targetState: 'Current result' }),
      id: 'goal-active', createdAt: '2026-08-13T07:00:00.000Z', updatedAt: '2026-08-13T07:00:00.000Z',
    };
    const full = {
      ...createGoal({
        title: 'Archived', targetState: 'Historical result', description: 'Context',
        successCriteria: 'Evidence retained',
      }),
      id: 'goal-archived', createdAt: '2026-08-13T07:00:00.000Z', updatedAt: '2026-08-13T07:00:00.000Z',
    };
    await repository.add(minimal);
    await repository.add(full);
    const archived = archiveGoal(full, '2026-08-13T08:00:00.000Z');
    await repository.save(archived);

    expect(await repository.getById(archived.id)).toEqual(archived);
    expect(await repository.getById('missing-goal')).toBeNull();
    expect(await repository.list()).toEqual([minimal]);
    expect(await repository.list({ status: 'archived' })).toEqual([archived]);
    expect(await repository.list({ status: 'all' })).toEqual([archived, minimal]);
    expect(Object.keys(archived).sort()).toEqual([
      'archivedAt', 'createdAt', 'description', 'id', 'successCriteria',
      'targetState', 'title', 'updatedAt',
    ]);
    await closeQuietly(db);
  });

  it('uses a total ordering and stable offset pagination when timestamps tie', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const timestamp = '2026-08-13T07:00:00.000Z';
    const first = { ...createGoal({ title: 'First', targetState: 'Result' }), id: 'goal-a', createdAt: timestamp, updatedAt: timestamp };
    const second = { ...createGoal({ title: 'Second', targetState: 'Result' }), id: 'goal-b', createdAt: timestamp, updatedAt: timestamp };
    const third = { ...createGoal({ title: 'Third', targetState: 'Result' }), id: 'goal-c', createdAt: timestamp, updatedAt: timestamp };
    await repository.add(first);
    await repository.add(second);
    await repository.add(third);
    await repository.save(archiveGoal(second, '2026-08-13T08:00:00.000Z'));

    expect((await repository.list({ status: 'all' })).map((goal) => goal.id))
      .toEqual(['goal-b', 'goal-a', 'goal-c']);
    expect((await repository.list({ status: 'all', limit: 1, offset: 1 })).map((goal) => goal.id))
      .toEqual(['goal-a']);
    await expect(repository.list({ limit: 0 })).rejects.toThrow(/limit/);
    await expect(repository.list({ offset: -1 })).rejects.toThrow(/offset/);
    await closeQuietly(db);
  });

  it('round-trips a Goal with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const goal = createGoal({
      title: 'Ship M1',
      targetState: 'Milestone M1 is accepted',
      description: 'Domain foundation milestone',
      successCriteria: 'All gates pass',
    });

    await repository.add(goal);
    const loaded = await repository.getById(goal.id);

    expect(loaded).toEqual(goal);
    await closeQuietly(db);
  });

  it('round-trips omitted optional fields as null', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const goal = createGoal({ title: 'Run a marathon', targetState: 'Finish 42k' });

    await repository.add(goal);
    const loaded = await repository.getById(goal.id);

    expect(loaded).toEqual(goal);
    expect(loaded?.description).toBeNull();
    expect(loaded?.successCriteria).toBeNull();
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);

    expect(await repository.getById('no-such-goal')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const goal = createGoal({ title: 'Ship M1', targetState: 'Accepted' });

    await repository.add(goal);
    await expect(repository.add(goal)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const invalid = {
      ...createGoal({ title: 'Ship M1', targetState: 'Accepted' }),
      targetState: '  ',
    };

    await expect(repository.add(invalid)).rejects.toThrow(/targetState/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('persists edits through save', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const goal = createGoal({ title: 'Ship M1', targetState: 'Accepted' });
    await repository.add(goal);

    const updated = {
      ...goal,
      description: 'Refined scope',
      successCriteria: 'Gate F passes',
      updatedAt: '2026-08-12T12:00:00.000Z',
    };
    await repository.save(updated);

    expect(await repository.getById(goal.id)).toEqual(updated);
    await closeQuietly(db);
  });

  it('persists archival through save and keeps the Goal resolvable by id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);
    const goal = createGoal({ title: 'Ship M1', targetState: 'Accepted' });
    await repository.add(goal);

    const archived = archiveGoal(goal, '2026-08-12T12:00:00.000Z');
    await repository.save(archived);

    expect(await repository.getById(goal.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('rejects saving an unknown Goal', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteGoalRepository(db);

    await expect(
      repository.save(createGoal({ title: 'Ghost', targetState: 'None' })),
    ).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });
});

describe('GoalService', () => {
  const NOW = '2026-08-13T00:00:00.000Z';
  const LATER = '2026-08-13T01:00:00.000Z';
  let db: SqliteDatabase;
  let service: GoalService<SqliteDatabase>;
  let id = 0;

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new GoalService({
      unitOfWork: sqliteUnitOfWork(db),
      goals: (context) => new SqliteGoalRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      readGoals: new SqliteGoalRepository(db),
      clock: { now: () => LATER },
      ids: { newId: () => `goal-or-provenance-${++id}` },
    });
  });

  afterEach(async () => db.closeAsync());

  async function count(table: 'goals' | 'records'): Promise<number> {
    return (await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0;
  }

  async function provenance(): Promise<Record[]> {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM records WHERE record_type = ? ORDER BY created_at, id',
      [PROVENANCE_RECORD_TYPE],
    );
    const repository = new SqliteRecordRepository(db);
    return Promise.all(rows.map(({ id: recordId }) => repository.getById(recordId) as Promise<Record>));
  }

  it('creates, updates, and archives Goals with atomic allowlisted provenance', async () => {
    const created = await service.createGoal({
      actor: 'creator', title: 'Launch', targetState: 'Accepted', description: 'M1',
      successCriteria: 'Users succeed', occurredAt: NOW,
    });
    const updated = await service.updateGoal(
      created.id, { title: 'Launch M1', description: null, successCriteria: null }, 'editor', LATER,
    );
    const archived = await service.archiveGoal(created.id, 'archivist', LATER);

    expect(created).toMatchObject({ createdAt: LATER, updatedAt: LATER, archivedAt: null });
    expect(updated).toMatchObject({ createdAt: LATER, updatedAt: LATER, description: null, successCriteria: null });
    expect(archived).toMatchObject({ archivedAt: LATER, updatedAt: LATER });
    expect(await service.getGoal(created.id)).toEqual(archived);
    const audit = await provenance();
    expect(audit.map((record) => (record.payload as { action: string }).action))
      .toEqual(['create', 'update', 'archive']);
    expect(audit[0].payload).toMatchObject({
      entityType: 'goal', entityId: created.id, actor: 'creator',
      after: { title: 'Launch', targetState: 'Accepted', successCriteria: 'Users succeed' },
    });
    expect(audit[1].payload).toMatchObject({
      before: { title: 'Launch', description: 'M1', successCriteria: 'Users succeed' },
      after: { title: 'Launch M1', description: null, successCriteria: null },
    });
    expect(audit[2].payload).toMatchObject({ after: { archivedAt: LATER } });
  });

  it('makes archived visibility explicit in listings while get remains archive-safe', async () => {
    const active = await service.createGoal({ actor: 'user', title: 'Current', targetState: 'Done' });
    const archived = await service.createGoal({ actor: 'user', title: 'Historical', targetState: 'Done' });
    await service.archiveGoal(archived.id, 'user');

    expect(await service.getGoal(archived.id)).toMatchObject({ id: archived.id, archivedAt: LATER });
    expect(await service.getGoal('missing')).toBeNull();
    expect((await service.listActiveGoals()).map((goal) => goal.id)).toEqual([active.id]);
    expect((await service.listArchivedGoals()).map((goal) => goal.id)).toEqual([archived.id]);
    expect((await service.listGoalHistory()).map((goal) => goal.id)).toEqual([archived.id, active.id]);
  });

  it('rejects invalid or missing mutations without writing a Goal or provenance', async () => {
    await expect(service.createGoal({ actor: 'user', title: ' ', targetState: 'Done' })).rejects.toThrow(/title/);
    expect(await count('goals')).toBe(0);
    expect(await count('records')).toBe(0);
    await expect(service.updateGoal('missing', { title: 'No' }, 'user')).rejects.toBeInstanceOf(GoalNotFoundError);
  });

  it('rejects repeated archival without rewriting the Goal or adding provenance', async () => {
    const goal = await service.createGoal({ actor: 'user', title: 'Archive', targetState: 'Keep' });
    await service.archiveGoal(goal.id, 'user');
    await expect(service.archiveGoal(goal.id, 'user')).rejects.toThrow(/already archived/);
    expect(await count('records')).toBe(2);
  });

  it('rolls back the Goal write if provenance append fails', async () => {
    const failing = new GoalService({
      unitOfWork: sqliteUnitOfWork(db),
      goals: (context) => new SqliteGoalRepository(context),
      records: () => ({ add: async () => { throw new Error('record write failed'); }, getById: async () => null }),
      readGoals: new SqliteGoalRepository(db),
      clock: { now: () => LATER },
    });
    await expect(failing.createGoal({ actor: 'user', title: 'Atomic', targetState: 'No partial row' }))
      .rejects.toThrow(/Provenance append/);
    expect(await count('goals')).toBe(0);
    expect(await count('records')).toBe(0);
  });
});
