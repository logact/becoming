import {
  archiveMilestone,
  createMilestone,
  createMilestoneGoalAssignment,
  endMilestoneGoalAssignment,
  updateMilestone,
  validateMilestone,
  validateMilestoneGoalAssignment,
} from '../src/domain/milestone';
import type { Milestone } from '../src/domain/milestone';
import { SqliteMilestoneRepository } from '../src/persistence/milestoneRepository';
import { SqliteMilestoneGoalAssignmentRepository } from '../src/persistence/milestoneGoalAssignmentRepository';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED_AT = '2026-08-12T14:00:00.000Z';
const UPDATED_AT = '2026-08-12T15:00:00.000Z';
const ENDED_AT = '2026-08-12T16:00:00.000Z';
const PURSUIT_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_PURSUIT_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const GOAL_ID = '9b1c2d3e-4f5a-4b6c-8d9e-0f1a2b3c4d5e';
const OTHER_GOAL_ID = '6d9f8b2c-3e4a-4f5b-8c1d-2e3f4a5b6c7d';

function validMilestoneInput(sortOrder = 1) {
  return {
    pursuitRelationId: PURSUIT_ID,
    title: 'Foundation complete',
    sortOrder,
  };
}

function makeMilestone(sortOrder = 1, now = CREATED_AT) {
  return createMilestone(validMilestoneInput(sortOrder), { now });
}

describe('milestone domain model', () => {
  it('creates an active Milestone with fresh id and null optionals', () => {
    const milestone = createMilestone(validMilestoneInput());

    expect(milestone.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(milestone.description).toBeNull();
    expect(milestone.targetAt).toBeNull();
    expect(milestone.archivedAt).toBeNull();
    expect(milestone.createdAt).toBe(milestone.updatedAt);
    expect(() => validateMilestone(milestone)).not.toThrow();
  });

  it('rejects blank title and ids', () => {
    expect(() =>
      createMilestone({ ...validMilestoneInput(), title: '  ' }),
    ).toThrow(/title/);
    expect(() =>
      createMilestone({ ...validMilestoneInput(), pursuitRelationId: '' }),
    ).toThrow(/pursuitRelationId/);
    const milestone = makeMilestone();
    expect(() => validateMilestone({ ...milestone, id: ' ' })).toThrow(/id/);
  });

  it('rejects a non-positive or non-integer sort order', () => {
    for (const sortOrder of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        createMilestone({ ...validMilestoneInput(), sortOrder }),
      ).toThrow(/sortOrder/);
    }
  });

  it('rejects malformed timestamps', () => {
    const milestone = makeMilestone();

    expect(() =>
      validateMilestone({ ...milestone, createdAt: 'soon' }),
    ).toThrow(/createdAt/);
    expect(() =>
      validateMilestone({ ...milestone, updatedAt: '' }),
    ).toThrow(/updatedAt/);
    expect(() =>
      validateMilestone({ ...milestone, targetAt: 'eventually' }),
    ).toThrow(/targetAt/);
    expect(() =>
      validateMilestone({ ...milestone, archivedAt: 'later' }),
    ).toThrow(/archivedAt/);
  });

  it('rejects an archival earlier than creation', () => {
    const milestone = makeMilestone();

    expect(() =>
      archiveMilestone(milestone, '2026-08-12T13:00:00.000Z'),
    ).toThrow(/archivedAt/);
  });

  it('updates an active Milestone without mutating the original', () => {
    const milestone = makeMilestone();
    const updated = updateMilestone(
      milestone,
      {
        title: 'Foundation and framing complete',
        description: null,
        targetAt: '2026-09-01T00:00:00.000Z',
        sortOrder: 2,
      },
      UPDATED_AT,
    );

    expect(milestone.title).toBe('Foundation complete');
    expect(updated.id).toBe(milestone.id);
    expect(updated.createdAt).toBe(CREATED_AT);
    expect(updated.updatedAt).toBe(UPDATED_AT);
    expect(updated.title).toBe('Foundation and framing complete');
    expect(updated.sortOrder).toBe(2);
    expect(() => validateMilestone(updated)).not.toThrow();
  });

  it('rejects edits to an archived Milestone', () => {
    const archived = archiveMilestone(makeMilestone(), ENDED_AT);

    expect(() => updateMilestone(archived, { title: 'New title' })).toThrow(
      /archived/,
    );
  });

  it('archives a Milestone and rejects a repeated archival', () => {
    const milestone = makeMilestone();
    const archived = archiveMilestone(milestone, ENDED_AT);

    expect(milestone.archivedAt).toBeNull();
    expect(archived.archivedAt).toBe(ENDED_AT);
    expect(archived.updatedAt).toBe(ENDED_AT);
    expect(() => archiveMilestone(archived)).toThrow(/already archived/);
  });
});

describe('milestone goal assignment domain model', () => {
  it('derives the pursuit relation from the owning Milestone', () => {
    const milestone = makeMilestone();
    const assignment = createMilestoneGoalAssignment(
      milestone,
      { goalId: GOAL_ID, sortOrder: 1 },
      { now: CREATED_AT },
    );

    expect(assignment.pursuitRelationId).toBe(milestone.pursuitRelationId);
    expect(assignment.milestoneId).toBe(milestone.id);
    expect(assignment.goalId).toBe(GOAL_ID);
    expect(assignment.endedAt).toBeNull();
    expect(() => validateMilestoneGoalAssignment(assignment)).not.toThrow();
  });

  it('rejects blank ids and invalid sort orders', () => {
    const milestone = makeMilestone();

    expect(() =>
      createMilestoneGoalAssignment(milestone, { goalId: ' ', sortOrder: 1 }),
    ).toThrow(/goalId/);
    expect(() =>
      createMilestoneGoalAssignment(milestone, { goalId: GOAL_ID, sortOrder: 0 }),
    ).toThrow(/sortOrder/);
  });

  it('rejects assignments on an archived Milestone', () => {
    const archived = archiveMilestone(makeMilestone(), ENDED_AT);

    expect(() =>
      createMilestoneGoalAssignment(archived, { goalId: GOAL_ID, sortOrder: 1 }),
    ).toThrow(/archived/);
  });

  it('ends an assignment without mutating the original', () => {
    const assignment = createMilestoneGoalAssignment(
      makeMilestone(),
      { goalId: GOAL_ID, sortOrder: 1 },
      { now: CREATED_AT },
    );
    const ended = endMilestoneGoalAssignment(assignment, ENDED_AT);

    expect(assignment.endedAt).toBeNull();
    expect(ended.id).toBe(assignment.id);
    expect(ended.endedAt).toBe(ENDED_AT);
    expect(() => validateMilestoneGoalAssignment(ended)).not.toThrow();
  });

  it('treats ended assignments as immutable', () => {
    const ended = endMilestoneGoalAssignment(
      createMilestoneGoalAssignment(
        makeMilestone(),
        { goalId: GOAL_ID, sortOrder: 1 },
        { now: CREATED_AT },
      ),
      ENDED_AT,
    );

    expect(() => endMilestoneGoalAssignment(ended)).toThrow(/already ended/);
  });

  it('rejects an end earlier than the assignment start', () => {
    const assignment = createMilestoneGoalAssignment(
      makeMilestone(),
      { goalId: GOAL_ID, sortOrder: 1 },
      { now: CREATED_AT },
    );

    expect(() =>
      endMilestoneGoalAssignment(assignment, '2026-08-12T13:00:00.000Z'),
    ).toThrow(/endedAt/);
  });
});

describe('MilestoneRepository contract', () => {
  it('round-trips a Milestone with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const milestone = createMilestone(
      {
        ...validMilestoneInput(),
        description: 'All foundation Goals done',
        targetAt: '2026-09-01T00:00:00.000Z',
      },
      { now: CREATED_AT },
    );

    await repository.add(milestone);
    const loaded = await repository.getById(milestone.id);

    expect(loaded).toEqual(milestone);
    await closeQuietly(db);
  });

  it('resolves an archived Milestone so history stays resolvable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const milestone = makeMilestone();
    await repository.add(milestone);
    const archived = archiveMilestone(milestone, ENDED_AT);
    await repository.save(archived);

    expect(await repository.getById(milestone.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);

    expect(await repository.getById('no-such-milestone')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const milestone = makeMilestone();

    await repository.add(milestone);
    await expect(repository.add(milestone)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate before persistence', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const invalid = { ...makeMilestone(), sortOrder: 0 } as Milestone;

    await expect(repository.add(invalid)).rejects.toThrow(/sortOrder/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('rejects saving an unknown Milestone', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);

    await expect(repository.save(makeMilestone())).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });

  it('keeps active sort orders unique per pursuit under competing writes', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    await repository.add(makeMilestone(1));

    await expect(repository.add(makeMilestone(1))).rejects.toThrow();
    // A different pursuit may reuse the same sort order.
    await expect(
      repository.add(
        createMilestone(
          { ...validMilestoneInput(1), pursuitRelationId: OTHER_PURSUIT_ID },
          { now: CREATED_AT },
        ),
      ),
    ).resolves.toBeUndefined();
    // Archiving frees the sort order for reuse.
    const first = (await repository.listForPursuit(PURSUIT_ID))[0];
    await repository.save(archiveMilestone(first, ENDED_AT));
    await expect(repository.add(makeMilestone(1))).resolves.toBeUndefined();
    await closeQuietly(db);
  });

  it('lists active Milestones in total deterministic order', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const second = makeMilestone(2, UPDATED_AT);
    const first = makeMilestone(1, CREATED_AT);
    const archived = makeMilestone(3, ENDED_AT);
    await repository.add(second);
    await repository.add(first);
    await repository.add(archived);
    await repository.save(archiveMilestone(archived, ENDED_AT));

    const active = await repository.listForPursuit(PURSUIT_ID);
    expect(active.map((m) => m.id)).toEqual([first.id, second.id]);

    const history = await repository.listForPursuit(PURSUIT_ID, {
      includeArchived: true,
    });
    expect(history.map((m) => m.id)).toEqual([
      first.id,
      second.id,
      archived.id,
    ]);
    expect(await repository.listForPursuit(OTHER_PURSUIT_ID)).toEqual([]);
    await closeQuietly(db);
  });

  it('reorders the active Milestones of one pursuit to contiguous positions', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const first = makeMilestone(1);
    const second = makeMilestone(2);
    const third = makeMilestone(3);
    await repository.add(first);
    await repository.add(second);
    await repository.add(third);

    await repository.reorderActiveForPursuit(
      PURSUIT_ID,
      [third.id, first.id, second.id],
      ENDED_AT,
    );

    const ordered = await repository.listForPursuit(PURSUIT_ID);
    expect(ordered.map((m) => m.id)).toEqual([third.id, first.id, second.id]);
    expect(ordered.map((m) => m.sortOrder)).toEqual([1, 2, 3]);
    expect(ordered.every((m) => m.updatedAt === ENDED_AT)).toBe(true);
    await closeQuietly(db);
  });

  it('rejects reorder lists that are empty, duplicated, partial, or unknown', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const first = makeMilestone(1);
    const second = makeMilestone(2);
    await repository.add(first);
    await repository.add(second);

    await expect(
      repository.reorderActiveForPursuit(PURSUIT_ID, [], ENDED_AT),
    ).rejects.toThrow(/at least one/);
    await expect(
      repository.reorderActiveForPursuit(
        PURSUIT_ID,
        [first.id, first.id],
        ENDED_AT,
      ),
    ).rejects.toThrow(/duplicate/);
    await expect(
      repository.reorderActiveForPursuit(PURSUIT_ID, [first.id], ENDED_AT),
    ).rejects.toThrow(/every active id/);
    await expect(
      repository.reorderActiveForPursuit(
        PURSUIT_ID,
        [first.id, 'no-such-milestone'],
        ENDED_AT,
      ),
    ).rejects.toThrow(/unknown or inactive/);
    // Nothing was reordered by the rejected attempts.
    expect(
      (await repository.listForPursuit(PURSUIT_ID)).map((m) => m.id),
    ).toEqual([first.id, second.id]);
    await closeQuietly(db);
  });

  it('never touches archived Milestones when reordering', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneRepository(db);
    const active = makeMilestone(1);
    const archived = makeMilestone(2);
    await repository.add(active);
    await repository.add(archived);
    await repository.save(archiveMilestone(archived, ENDED_AT));

    await repository.reorderActiveForPursuit(PURSUIT_ID, [active.id], ENDED_AT);
    await expect(
      repository.reorderActiveForPursuit(
        PURSUIT_ID,
        [active.id, archived.id],
        ENDED_AT,
      ),
    ).rejects.toThrow(/unknown or inactive/);

    const stored = await repository.getById(archived.id);
    expect(stored?.sortOrder).toBe(2);
    expect(stored?.updatedAt).toBe(ENDED_AT);
    await closeQuietly(db);
  });
});

describe('MilestoneGoalAssignmentRepository contract', () => {
  function makeAssignment(
    milestone: Milestone,
    goalId: string,
    sortOrder: number,
    now = CREATED_AT,
  ) {
    return createMilestoneGoalAssignment(
      milestone,
      { goalId, sortOrder },
      { now },
    );
  }

  it('round-trips an assignment with every field preserved', async () => {
    const db = await createTestDatabase();
    const milestones = new SqliteMilestoneRepository(db);
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone();
    await milestones.add(milestone);
    const assignment = makeAssignment(milestone, GOAL_ID, 1);

    await repository.add(assignment);

    expect(await repository.getById(assignment.id)).toEqual(assignment);
    await closeQuietly(db);
  });

  it('returns null for an unknown id and rejects saving unknown assignments', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone();

    expect(await repository.getById('no-such-assignment')).toBeNull();
    await expect(
      repository.save(makeAssignment(milestone, GOAL_ID, 1)),
    ).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate before persistence', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone();
    const invalid = {
      ...makeAssignment(milestone, GOAL_ID, 1),
      goalId: ' ',
    };

    await expect(repository.add(invalid)).rejects.toThrow(/goalId/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('saves ended_at only and keeps the temporal history inspectable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone();
    const first = makeAssignment(milestone, GOAL_ID, 1);
    const second = makeAssignment(milestone, OTHER_GOAL_ID, 2, UPDATED_AT);
    await repository.add(first);
    await repository.add(second);
    await repository.save(endMilestoneGoalAssignment(first, ENDED_AT));

    expect(await repository.listCurrentForMilestone(milestone.id)).toEqual([
      second,
    ]);
    const history = await repository.listHistoryForMilestone(milestone.id);
    expect(history.map((a) => a.id)).toEqual([first.id, second.id]);
    expect(history[0].endedAt).toBe(ENDED_AT);
    expect(await repository.getById(first.id)).toEqual({
      ...first,
      endedAt: ENDED_AT,
    });
    await closeQuietly(db);
  });

  it('keeps a Goal actively assigned at most once per pursuit', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone(1);
    const otherMilestone = createMilestone(
      { ...validMilestoneInput(2), pursuitRelationId: PURSUIT_ID },
      { now: CREATED_AT },
    );
    await repository.add(makeAssignment(milestone, GOAL_ID, 1));

    // Same Goal in another active Milestone of the same pursuit: rejected.
    await expect(
      repository.add(makeAssignment(otherMilestone, GOAL_ID, 1)),
    ).rejects.toThrow();
    // Same Goal in a different pursuit: allowed.
    const foreignMilestone = createMilestone(
      { ...validMilestoneInput(1), pursuitRelationId: OTHER_PURSUIT_ID },
      { now: CREATED_AT },
    );
    await expect(
      repository.add(makeAssignment(foreignMilestone, GOAL_ID, 1)),
    ).resolves.toBeUndefined();
    // Ending frees the Goal for re-assignment as a new row.
    const current = await repository.findCurrentForGoal(PURSUIT_ID, GOAL_ID);
    await repository.save(endMilestoneGoalAssignment(current!, ENDED_AT));
    const reassigned = makeAssignment(otherMilestone, GOAL_ID, 1, ENDED_AT);
    await expect(repository.add(reassigned)).resolves.toBeUndefined();
    expect(reassigned.id).not.toBe(current!.id);
    await closeQuietly(db);
  });

  it('lists current assignments for a pursuit in deterministic order', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone(1);
    const first = makeAssignment(milestone, GOAL_ID, 2);
    const second = makeAssignment(milestone, OTHER_GOAL_ID, 1);
    // An assignment in another pursuit does not affect this pursuit's view.
    const foreignMilestone = createMilestone(
      { ...validMilestoneInput(1), pursuitRelationId: OTHER_PURSUIT_ID },
      { now: CREATED_AT },
    );
    const foreign = makeAssignment(foreignMilestone, GOAL_ID, 1, UPDATED_AT);
    await repository.add(first);
    await repository.add(second);
    await repository.add(foreign);
    await repository.save(endMilestoneGoalAssignment(foreign, ENDED_AT));

    const current = await repository.listCurrentForPursuit(PURSUIT_ID);
    expect(current.map((a) => a.id)).toEqual([second.id, first.id]);
    expect(await repository.listCurrentForPursuit(OTHER_PURSUIT_ID)).toEqual(
      [],
    );
    expect(
      await repository.findCurrentForGoal(PURSUIT_ID, OTHER_GOAL_ID),
    ).toEqual(second);
    expect(await repository.findCurrentForGoal(PURSUIT_ID, GOAL_ID)).toEqual(
      first,
    );
    expect(
      await repository.findCurrentForGoal(OTHER_PURSUIT_ID, GOAL_ID),
    ).toBeNull();
    await closeQuietly(db);
  });

  it('reorders the current assignments of one Milestone', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone();
    const first = makeAssignment(milestone, GOAL_ID, 1);
    const second = makeAssignment(milestone, OTHER_GOAL_ID, 2);
    await repository.add(first);
    await repository.add(second);

    await repository.reorderCurrentForMilestone(milestone.id, [
      second.id,
      first.id,
    ]);

    const ordered = await repository.listCurrentForMilestone(milestone.id);
    expect(ordered.map((a) => a.id)).toEqual([second.id, first.id]);
    expect(ordered.map((a) => a.sortOrder)).toEqual([1, 2]);
    await closeQuietly(db);
  });

  it('rejects reorder lists that miss, duplicate, or invent assignments', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteMilestoneGoalAssignmentRepository(db);
    const milestone = makeMilestone();
    const first = makeAssignment(milestone, GOAL_ID, 1);
    const second = makeAssignment(milestone, OTHER_GOAL_ID, 2);
    await repository.add(first);
    await repository.add(second);
    await repository.save(endMilestoneGoalAssignment(second, ENDED_AT));

    await expect(
      repository.reorderCurrentForMilestone(milestone.id, []),
    ).rejects.toThrow(/at least one/);
    await expect(
      repository.reorderCurrentForMilestone(milestone.id, [
        first.id,
        second.id,
      ]),
    ).rejects.toThrow(/unknown or inactive/);
    await expect(
      repository.reorderCurrentForMilestone(milestone.id, [first.id, first.id]),
    ).rejects.toThrow();

    await repository.reorderCurrentForMilestone(milestone.id, [first.id]);
    expect(
      (await repository.listCurrentForMilestone(milestone.id)).map(
        (a) => a.sortOrder,
      ),
    ).toEqual([1]);
    await closeQuietly(db);
  });
});

describe('milestones schema shape', () => {
  it('creates both tables with exactly the documented columns and indexes', async () => {
    const db = await createTestDatabase();

    const milestoneColumns = (
      await db.getAllAsync<{ name: string }>(`PRAGMA table_info(milestones)`)
    ).map((c) => c.name);
    expect(milestoneColumns).toEqual([
      'id',
      'pursuit_relation_id',
      'title',
      'description',
      'target_at',
      'sort_order',
      'created_at',
      'updated_at',
      'archived_at',
    ]);

    const assignmentColumns = (
      await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(milestone_goal_assignments)`,
      )
    ).map((c) => c.name);
    expect(assignmentColumns).toEqual([
      'id',
      'pursuit_relation_id',
      'milestone_id',
      'goal_id',
      'sort_order',
      'created_at',
      'ended_at',
    ]);

    const indexes = (
      await db.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'index'
           AND tbl_name IN ('milestones', 'milestone_goal_assignments')`,
      )
    ).map((i) => i.name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'milestones_pursuit_order_idx',
        'milestone_goal_assignments_milestone_idx',
        'milestone_active_order_unique_idx',
        'milestone_goal_active_pursuit_unique_idx',
      ]),
    );
    await closeQuietly(db);
  });

  it('declares no foreign keys and enforces the sort_order CHECK', async () => {
    const db = await createTestDatabase();

    for (const table of ['milestones', 'milestone_goal_assignments']) {
      const foreignKeys = await db.getAllAsync(
        `PRAGMA foreign_key_list(${table})`,
      );
      expect(foreignKeys).toEqual([]);
      const ddl = await db.getFirstAsync<{ sql: string }>(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [table],
      );
      expect(ddl?.sql.toUpperCase()).not.toMatch(/FOREIGN\s+KEY/);
      expect(ddl?.sql.toUpperCase()).not.toMatch(/REFERENCES/);
    }

    await expect(
      db.runAsync(
        `INSERT INTO milestones
           (id, pursuit_relation_id, title, sort_order, created_at, updated_at)
         VALUES ('m-1', 'r-1', 'Zero order', 0, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        `INSERT INTO milestone_goal_assignments
           (id, pursuit_relation_id, milestone_id, goal_id, sort_order, created_at)
         VALUES ('a-1', 'r-1', 'm-1', 'g-1', -1, '2026-08-12T00:00:00.000Z')`,
      ),
    ).rejects.toThrow();
    await closeQuietly(db);
  });
});
