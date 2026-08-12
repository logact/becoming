import { archiveGoal, createGoal, validateGoal } from '../src/domain/goal';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
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
});

describe('GoalRepository contract', () => {
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
