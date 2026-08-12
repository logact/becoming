import {
  createEntityLabelAssignment,
  endEntityLabelAssignment,
  validateEntityLabelAssignment,
} from '../src/domain/entityLabel';
import type { EntityLabelAssignment } from '../src/domain/entityLabel';
import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import { archiveLabel, createLabel } from '../src/domain/label';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import {
  LabelArchivedError,
  LabelAssignmentNotFoundError,
  LabelAssignmentService,
  LabelNotFoundError,
} from '../src/application/labelAssignmentService';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED_AT = '2026-08-12T14:00:00.000Z';
const ENDED_AT = '2026-08-12T15:00:00.000Z';
const TASK_ID = '3f6f2c34-0c1f-4f0d-9f8c-2a1b0c9d8e7f';
const GOAL_ID = '9b1c2d3e-4f5a-4b6c-8d9e-0f1a2b3c4d5e';
const LABEL_ID = '5c8e7a1b-2d3f-4e5a-9b0c-1d2e3f4a5b6c';
const OTHER_LABEL_ID = '6d9f8b2c-3e4a-4f5b-8c1d-2e3f4a5b6c7d';

function validInput() {
  return {
    entityType: 'task',
    entityId: TASK_ID,
    labelId: LABEL_ID,
  };
}

describe('entity label assignment domain model', () => {
  it('creates an active assignment with fresh id and null endedAt', () => {
    const assignment = createEntityLabelAssignment(validInput());

    expect(assignment.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(assignment.entityType).toBe('task');
    expect(assignment.createdAt).not.toBe('');
    expect(assignment.endedAt).toBeNull();
    expect(() => validateEntityLabelAssignment(assignment)).not.toThrow();
  });

  it('accepts every core entity type as the assignment target', () => {
    for (const entityType of CORE_ENTITY_TYPES) {
      const assignment = createEntityLabelAssignment({
        ...validInput(),
        entityType,
      });
      expect(assignment.entityType).toBe(entityType);
    }
  });

  it('never targets Labels, States, or State Transitions', () => {
    for (const nonCore of [
      'label',
      'entity_label',
      'workflow_state',
      'workflow_state_transition',
      'project_state',
      'project_state_transition',
    ]) {
      expect(() =>
        createEntityLabelAssignment({ ...validInput(), entityType: nonCore }),
      ).toThrow(/core entity type/);
    }
  });

  it('rejects blank entity and label ids', () => {
    expect(() =>
      createEntityLabelAssignment({ ...validInput(), entityId: '  ' }),
    ).toThrow(/entityId/);
    expect(() =>
      createEntityLabelAssignment({ ...validInput(), labelId: '' }),
    ).toThrow(/labelId/);
  });

  it('rejects missing or malformed interval timestamps', () => {
    const assignment = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });

    expect(() =>
      validateEntityLabelAssignment({ ...assignment, createdAt: 'soon' }),
    ).toThrow(/createdAt/);
    expect(() =>
      validateEntityLabelAssignment({ ...assignment, createdAt: '' }),
    ).toThrow(/createdAt/);
    expect(() =>
      validateEntityLabelAssignment({ ...assignment, endedAt: 'eventually' }),
    ).toThrow(/endedAt/);
  });

  it('rejects an active interval that ends before it starts', () => {
    const assignment: EntityLabelAssignment = {
      ...createEntityLabelAssignment(validInput(), { now: CREATED_AT }),
      endedAt: '2026-08-12T13:59:59.999Z',
    };

    expect(() => validateEntityLabelAssignment(assignment)).toThrow(/endedAt/);
  });

  it('ends an assignment without mutating the original', () => {
    const assignment = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });
    const ended = endEntityLabelAssignment(assignment, ENDED_AT);

    expect(assignment.endedAt).toBeNull();
    expect(ended.id).toBe(assignment.id);
    expect(ended.createdAt).toBe(CREATED_AT);
    expect(ended.endedAt).toBe(ENDED_AT);
    expect(() => validateEntityLabelAssignment(ended)).not.toThrow();
  });

  it('rejects ending an already ended assignment', () => {
    const ended = endEntityLabelAssignment(
      createEntityLabelAssignment(validInput(), { now: CREATED_AT }),
      ENDED_AT,
    );

    expect(() => endEntityLabelAssignment(ended)).toThrow(/already ended/);
  });

  it('rejects ending before the assignment started', () => {
    const assignment = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });

    expect(() =>
      endEntityLabelAssignment(assignment, '2026-08-12T13:00:00.000Z'),
    ).toThrow(/endedAt/);
  });
});

describe('EntityLabelRepository contract', () => {
  it('round-trips an assignment with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const assignment = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });

    await repository.add(assignment);
    const loaded = await repository.getById(assignment.id);

    expect(loaded).toEqual(assignment);
    await closeQuietly(db);
  });

  it('resolves an ended assignment so history stays resolvable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const assignment = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });
    await repository.add(assignment);
    const ended = endEntityLabelAssignment(assignment, ENDED_AT);
    await repository.save(ended);

    const loaded = await repository.getById(assignment.id);

    expect(loaded).toEqual(ended);
    expect(loaded?.endedAt).toBe(ENDED_AT);
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);

    expect(await repository.getById('no-such-assignment')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const assignment = createEntityLabelAssignment(validInput());

    await repository.add(assignment);
    await expect(repository.add(assignment)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate before persistence', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const invalid = {
      ...createEntityLabelAssignment(validInput()),
      entityType: 'label',
    } as unknown as EntityLabelAssignment;

    await expect(repository.add(invalid)).rejects.toThrow(/core entity type/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a second active assignment of the same Label to the same entity', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    await repository.add(createEntityLabelAssignment(validInput()));

    await expect(
      repository.add(createEntityLabelAssignment(validInput())),
    ).rejects.toThrow(/already actively assigned/);
    await closeQuietly(db);
  });

  it('allows the same Label on a different entity and other Labels on the same entity', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    await repository.add(createEntityLabelAssignment(validInput()));

    await expect(
      repository.add(
        createEntityLabelAssignment({ ...validInput(), entityId: GOAL_ID }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      repository.add(
        createEntityLabelAssignment({
          ...validInput(),
          labelId: OTHER_LABEL_ID,
        }),
      ),
    ).resolves.toBeUndefined();
    await closeQuietly(db);
  });

  it('allows re-assigning a Label after the previous assignment ended', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const first = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });
    await repository.add(first);
    await repository.save(endEntityLabelAssignment(first, ENDED_AT));

    const second = createEntityLabelAssignment(validInput(), {
      now: '2026-08-12T16:00:00.000Z',
    });
    await repository.add(second);

    expect(second.id).not.toBe(first.id);
    expect(await repository.findActive('task', TASK_ID, LABEL_ID)).toEqual(
      second,
    );
    // The ended first assignment stays resolvable by id.
    expect(await repository.getById(first.id)).toEqual({
      ...first,
      endedAt: ENDED_AT,
    });
    await closeQuietly(db);
  });

  it('rejects saving an unknown assignment', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);

    await expect(
      repository.save(createEntityLabelAssignment(validInput())),
    ).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });

  it('rejects a save that would duplicate an active assignment', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const first = createEntityLabelAssignment(validInput());
    const second = createEntityLabelAssignment({
      ...validInput(),
      labelId: OTHER_LABEL_ID,
    });
    await repository.add(first);
    await repository.add(second);

    await expect(
      repository.save({ ...second, labelId: LABEL_ID }),
    ).rejects.toThrow(/already actively assigned/);
    expect(await repository.getById(second.id)).toEqual(second);
    await closeQuietly(db);
  });

  it('findActiveForEntity returns only currently active assignments', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const ended = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });
    const active = createEntityLabelAssignment(
      { ...validInput(), labelId: OTHER_LABEL_ID },
      { now: ENDED_AT },
    );
    await repository.add(ended);
    await repository.save(endEntityLabelAssignment(ended, ENDED_AT));
    await repository.add(active);

    expect(await repository.findActiveForEntity('task', TASK_ID)).toEqual([
      active,
    ]);
    expect(await repository.findActive('task', TASK_ID, LABEL_ID)).toBeNull();
    expect(
      await repository.findActive('task', TASK_ID, OTHER_LABEL_ID),
    ).toEqual(active);
    expect(await repository.findActiveForEntity('goal', TASK_ID)).toEqual([]);
    await closeQuietly(db);
  });

  it('listForEntity returns the full temporal history in order', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteEntityLabelRepository(db);
    const first = createEntityLabelAssignment(validInput(), {
      now: CREATED_AT,
    });
    const second = createEntityLabelAssignment(
      { ...validInput(), labelId: OTHER_LABEL_ID },
      { now: ENDED_AT },
    );
    const third = createEntityLabelAssignment(validInput(), {
      now: '2026-08-12T16:00:00.000Z',
    });
    await repository.add(first);
    await repository.save(endEntityLabelAssignment(first, ENDED_AT));
    await repository.add(second);
    await repository.add(third);

    const history = await repository.listForEntity('task', TASK_ID);

    expect(history.map((a) => a.id)).toEqual([first.id, second.id, third.id]);
    expect(history[0].endedAt).toBe(ENDED_AT);
    expect(history[1].endedAt).toBeNull();
    expect(history[2].endedAt).toBeNull();
    await closeQuietly(db);
  });
});

describe('entity_labels schema shape', () => {
  it('has exactly the documented columns and no foreign keys', async () => {
    const db = await createTestDatabase();
    const columns = (
      await db.getAllAsync<{ name: string; notnull: number }>(
        `PRAGMA table_info(entity_labels)`,
      )
    ).map((c) => c.name);
    expect(columns).toEqual([
      'id',
      'entity_type',
      'entity_id',
      'label_id',
      'created_at',
      'ended_at',
    ]);

    const foreignKeys = await db.getAllAsync(
      `PRAGMA foreign_key_list(entity_labels)`,
    );
    expect(foreignKeys).toEqual([]);

    const ddl = await db.getFirstAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entity_labels'`,
    );
    expect(ddl?.sql.toUpperCase()).not.toMatch(/FOREIGN\s+KEY/);
    expect(ddl?.sql.toUpperCase()).not.toMatch(/REFERENCES/);
    await closeQuietly(db);
  });
});

describe('LabelAssignmentService', () => {
  async function createService() {
    const db = await createTestDatabase();
    const service = new LabelAssignmentService({
      labels: new SqliteLabelRepository(db),
      assignments: new SqliteEntityLabelRepository(db),
    });
    return { db, service };
  }

  it('assigns an existing Label to every core entity type', async () => {
    const { db, service } = await createService();
    const labels = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Feature' });
    await labels.add(label);

    for (const entityType of CORE_ENTITY_TYPES) {
      const assignment = await service.assignLabel({
        entityType,
        entityId: TASK_ID,
        labelId: label.id,
      });
      expect(assignment.entityType).toBe(entityType);
      expect(assignment.endedAt).toBeNull();
    }
    await closeQuietly(db);
  });

  it('rejects assigning a Label that does not exist', async () => {
    const { db, service } = await createService();

    await expect(
      service.assignLabel({ ...validInput(), labelId: LABEL_ID }),
    ).rejects.toThrow(LabelNotFoundError);
    await closeQuietly(db);
  });

  it('rejects assigning an archived Label while keeping existing history resolvable', async () => {
    const { db, service } = await createService();
    const labels = new SqliteLabelRepository(db);
    const assignments = new SqliteEntityLabelRepository(db);
    const label = createLabel({ name: 'Experimental' });
    await labels.add(label);

    const existing = await service.assignLabel({
      ...validInput(),
      labelId: label.id,
      assignedAt: CREATED_AT,
    });
    await labels.save(archiveLabel(label));

    await expect(
      service.assignLabel({
        entityType: 'goal',
        entityId: GOAL_ID,
        labelId: label.id,
      }),
    ).rejects.toThrow(LabelArchivedError);
    // The pre-archival assignment is untouched and can still be ended.
    expect(await assignments.getById(existing.id)).toEqual(existing);
    await expect(
      service.endLabelAssignment(existing.id, ENDED_AT),
    ).resolves.toMatchObject({ id: existing.id, endedAt: ENDED_AT });
    await closeQuietly(db);
  });

  it('rejects a duplicate active assignment of the same Label', async () => {
    const { db, service } = await createService();
    const labels = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Bug' });
    await labels.add(label);
    await service.assignLabel({ ...validInput(), labelId: label.id });

    await expect(
      service.assignLabel({ ...validInput(), labelId: label.id }),
    ).rejects.toThrow(/already actively assigned/);
    await closeQuietly(db);
  });

  it('ends an assignment and keeps the temporal history inspectable', async () => {
    const { db, service } = await createService();
    const labels = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Strategic' });
    await labels.add(label);
    const assigned = await service.assignLabel({
      ...validInput(),
      labelId: label.id,
      assignedAt: CREATED_AT,
    });

    const ended = await service.endLabelAssignment(assigned.id, ENDED_AT);

    expect(ended.endedAt).toBe(ENDED_AT);
    expect(await service.getActiveAssignments('task', TASK_ID)).toEqual([]);
    const history = await service.getAssignmentHistory('task', TASK_ID);
    expect(history).toEqual([ended]);
    await closeQuietly(db);
  });

  it('supports an assign, end, re-assign lifecycle as distinct rows', async () => {
    const { db, service } = await createService();
    const labels = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Research' });
    await labels.add(label);

    const first = await service.assignLabel({
      ...validInput(),
      labelId: label.id,
      assignedAt: CREATED_AT,
    });
    await service.endLabelAssignment(first.id, ENDED_AT);
    const second = await service.assignLabel({
      ...validInput(),
      labelId: label.id,
      assignedAt: '2026-08-12T16:00:00.000Z',
    });

    expect(second.id).not.toBe(first.id);
    const active = await service.getActiveAssignments('task', TASK_ID);
    expect(active).toEqual([second]);
    const history = await service.getAssignmentHistory('task', TASK_ID);
    expect(history.map((a) => a.id)).toEqual([first.id, second.id]);
    await closeQuietly(db);
  });

  it('throws LabelAssignmentNotFoundError when ending an unknown assignment', async () => {
    const { db, service } = await createService();

    await expect(
      service.endLabelAssignment('no-such-assignment'),
    ).rejects.toThrow(LabelAssignmentNotFoundError);
    await closeQuietly(db);
  });
});
