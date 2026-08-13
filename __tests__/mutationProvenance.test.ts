import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import type { CoreEntityType } from '../src/domain/entityTypes';
import {
  applyFieldPolicy,
  buildProvenancePayload,
  DEFAULT_FIELD_POLICIES,
  diffFieldMaps,
  MUTATION_ACTIONS,
  PROVENANCE_RECORD_TYPE,
  provenancePayloadToJson,
  resolveFieldPolicy,
} from '../src/domain/mutationProvenance';
import type {
  FieldSelectionPolicy,
  ProvenancePayload,
} from '../src/domain/mutationProvenance';
import { createGoal } from '../src/domain/goal';
import { createRecord } from '../src/domain/record';
import type { Record } from '../src/domain/record';
import { RECORD_TYPES } from '../src/domain/record';
import {
  MutationPersistenceError,
  MutationProvenanceService,
  ProvenancePersistenceError,
  ProvenanceValidationError,
} from '../src/application/mutationProvenanceService';
import type { MutateWithProvenanceCommand } from '../src/application/mutationProvenanceService';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import type { RecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { createTestDatabase } from './helpers/testDatabase';

const OCCURRED_AT = '2026-08-12T10:00:00.000Z';
const RECORDED_AT = '2026-08-12T11:00:00.000Z';

const fixedClock = { now: () => RECORDED_AT };
let idCounter = 0;
const fixedIds = { newId: () => `prov-${++idCounter}` };

function createInput(entityType: string, after: unknown = { title: 'X' }) {
  return {
    entityType,
    entityId: 'entity-1',
    action: 'create',
    actor: 'user-1',
    occurredAt: OCCURRED_AT,
    after: after as { [field: string]: unknown },
  };
}

describe('mutation provenance payload (domain)', () => {
  it('supports every core entity type without an entities table', () => {
    for (const entityType of CORE_ENTITY_TYPES) {
      const payload = buildProvenancePayload(
        createInput(entityType),
        DEFAULT_FIELD_POLICIES[entityType],
      );
      expect(payload.entityType).toBe(entityType);
    }
    expect(CORE_ENTITY_TYPES).toHaveLength(8);
  });

  it('rejects an unknown entity type', () => {
    expect(() =>
      buildProvenancePayload(
        createInput('label'),
        DEFAULT_FIELD_POLICIES.goal,
      ),
    ).toThrow(/entityType/);
  });

  it('validates the action discriminator and distinguishes archive, restore, and delete', () => {
    for (const action of MUTATION_ACTIONS) {
      const input =
        action === 'create'
          ? createInput('goal')
          : action === 'delete'
            ? { ...createInput('goal'), action, after: null, before: { title: 'X' } }
            : action === 'update'
              ? {
                  ...createInput('goal'),
                  action,
                  before: { title: 'X' },
                  after: { title: 'Y' },
                }
              : { ...createInput('goal'), action, after: null, before: { title: 'X' } };
      const payload = buildProvenancePayload(input, DEFAULT_FIELD_POLICIES.goal);
      expect(payload.action).toBe(action);
    }
    expect(MUTATION_ACTIONS).toEqual([
      'create',
      'update',
      'archive',
      'restore',
      'delete',
    ]);
    expect(() =>
      buildProvenancePayload(
        { ...createInput('goal'), action: 'upsert' },
        DEFAULT_FIELD_POLICIES.goal,
      ),
    ).toThrow(/action/);
  });

  it('requires entity id, actor, and a valid event time on every payload', () => {
    expect(() =>
      buildProvenancePayload(
        { ...createInput('goal'), entityId: '  ' },
        DEFAULT_FIELD_POLICIES.goal,
      ),
    ).toThrow(/entityId/);
    expect(() =>
      buildProvenancePayload(
        { ...createInput('goal'), actor: '' },
        DEFAULT_FIELD_POLICIES.goal,
      ),
    ).toThrow(/actor/);
    expect(() =>
      buildProvenancePayload(
        { ...createInput('goal'), occurredAt: 'not-a-date' },
        DEFAULT_FIELD_POLICIES.goal,
      ),
    ).toThrow(/occurredAt/);

    const payload = buildProvenancePayload(
      createInput('goal'),
      DEFAULT_FIELD_POLICIES.goal,
    );
    expect(payload.entityId).toBe('entity-1');
    expect(payload.actor).toBe('user-1');
    expect(payload.occurredAt).toBe(OCCURRED_AT);
  });

  it('enforces per-action snapshot rules', () => {
    const policy = DEFAULT_FIELD_POLICIES.goal;
    // create: after required, before forbidden
    expect(() =>
      buildProvenancePayload(
        { ...createInput('goal'), before: { title: 'X' } },
        policy,
      ),
    ).toThrow(/before/);
    expect(() =>
      buildProvenancePayload({ ...createInput('goal'), after: null }, policy),
    ).toThrow(/after/);
    // update: both required
    expect(() =>
      buildProvenancePayload(
        { ...createInput('goal'), action: 'update', after: { title: 'Y' } },
        policy,
      ),
    ).toThrow(/before and after/);
    // archive/restore: before required
    for (const action of ['archive', 'restore']) {
      expect(() =>
        buildProvenancePayload(
          { ...createInput('goal'), action, after: null },
          policy,
        ),
      ).toThrow(/before/);
    }
    // delete: before required, after forbidden
    expect(() =>
      buildProvenancePayload(
        {
          ...createInput('goal'),
          action: 'delete',
          before: { title: 'X' },
        },
        policy,
      ),
    ).toThrow(/after/);
  });

  it('keeps only changed, allowlisted fields in update before/after data', () => {
    const payload = buildProvenancePayload(
      {
        ...createInput('goal'),
        action: 'update',
        before: {
          title: 'Old',
          description: 'same',
          secretNote: 'not allowlisted',
        },
        after: { title: 'New', description: 'same', secretNote: 'changed' },
      },
      DEFAULT_FIELD_POLICIES.goal,
    );

    expect(payload.before).toEqual({ title: 'Old' });
    expect(payload.after).toEqual({ title: 'New' });
  });

  it('represents added and removed fields as null on the missing side', () => {
    const payload = buildProvenancePayload(
      {
        ...createInput('goal'),
        action: 'update',
        before: { description: 'was set' },
        after: { successCriteria: 'now set' },
      },
      DEFAULT_FIELD_POLICIES.goal,
    );

    expect(payload.before).toEqual({
      description: 'was set',
      successCriteria: null,
    });
    expect(payload.after).toEqual({
      description: null,
      successCriteria: 'now set',
    });
  });

  it('redaction wins over the allowlist', () => {
    const policy: FieldSelectionPolicy = {
      allowlist: ['title', 'apiToken'],
      redacted: ['apiToken'],
    };

    const selected = applyFieldPolicy(
      { title: 'Visible', apiToken: 'secret' },
      policy,
    );

    expect(selected).toEqual({ title: 'Visible' });
  });

  it('drops fields outside the allowlist and skips undefined values', () => {
    const selected = applyFieldPolicy(
      { title: 'Kept', unrelated: 'dropped', description: undefined },
      DEFAULT_FIELD_POLICIES.goal,
    );

    expect(selected).toEqual({ title: 'Kept' });
  });

  it('rejects non-JSON values in snapshots', () => {
    const policy = DEFAULT_FIELD_POLICIES.goal;
    expect(() =>
      applyFieldPolicy({ title: () => 'fn' }, policy),
    ).toThrow(/title/);
    const circular: { [field: string]: unknown } = {};
    circular.self = circular;
    expect(() => applyFieldPolicy({ description: circular }, policy)).toThrow(
      /circular/,
    );
  });

  it('resolves per-entity policy overrides over the defaults', () => {
    const override: FieldSelectionPolicy = {
      allowlist: ['title'],
      redacted: [],
    };

    const policy = resolveFieldPolicy('goal', { goal: override });

    expect(policy).toBe(override);
    expect(resolveFieldPolicy('goal')).toBe(DEFAULT_FIELD_POLICIES.goal);
  });

  it('diffs filtered snapshots field by field', () => {
    const diff = diffFieldMaps(
      { a: '1', b: 'same' },
      { b: 'same', c: '3' },
    );

    expect(diff).toEqual({
      before: { a: '1', c: null },
      after: { a: null, c: '3' },
    });
  });

  it('serializes the payload as lossless JSON', () => {
    const payload = buildProvenancePayload(
      {
        ...createInput('goal'),
        action: 'update',
        before: { title: 'Old' },
        after: { title: 'New' },
      },
      DEFAULT_FIELD_POLICIES.goal,
    );

    const json = provenancePayloadToJson(payload);

    expect(JSON.parse(JSON.stringify(json))).toEqual({
      entityType: 'goal',
      entityId: 'entity-1',
      action: 'update',
      actor: 'user-1',
      occurredAt: OCCURRED_AT,
      before: { title: 'Old' },
      after: { title: 'New' },
    });
  });

  it('adopts the mutation record type in the default record-type policy', () => {
    expect(RECORD_TYPES).toContain(PROVENANCE_RECORD_TYPE);
  });
});

describe('MutationProvenanceService (contract)', () => {
  let db: SqliteDatabase;
  let service: MutationProvenanceService<SqliteDatabase>;

  async function count(table: string): Promise<number> {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table}`,
    );
    return row?.n ?? -1;
  }

  async function provenanceRecords(): Promise<Record[]> {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM records WHERE record_type = ?`,
      [PROVENANCE_RECORD_TYPE],
    );
    const repository = new SqliteRecordRepository(db);
    const records: Record[] = [];
    for (const row of rows) {
      records.push((await repository.getById(row.id)) as Record);
    }
    return records;
  }

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new MutationProvenanceService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      records: (context) => new SqliteRecordRepository(context),
      clock: fixedClock,
      ids: fixedIds,
    });
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  function goalCreateCommand(
    overrides: Partial<
      MutateWithProvenanceCommand<SqliteDatabase, unknown>
    > = {},
  ): MutateWithProvenanceCommand<SqliteDatabase, unknown> {
    const goal = createGoal({ title: 'Ship M1', targetState: 'M1 shipped' });
    return {
      entityType: 'goal',
      entityId: goal.id,
      action: 'create',
      actor: 'user-1',
      occurredAt: OCCURRED_AT,
      after: { ...goal },
      mutate: async (context) => {
        await new SqliteGoalRepository(context).add(goal);
        return goal;
      },
      ...overrides,
    };
  }

  it('commits the current-state mutation and one provenance Record atomically', async () => {
    const command = goalCreateCommand();
    const goal = await service.mutateWithProvenance(command);

    expect(await count('goals')).toBe(1);
    const records = await provenanceRecords();
    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record.recordType).toBe(PROVENANCE_RECORD_TYPE);
    expect(record.actor).toBe('user-1');
    expect(record.occurredAt).toBe(OCCURRED_AT);
    expect(record.recordedAt).toBe(RECORDED_AT);
    expect(record.payload).toMatchObject({
      entityType: 'goal',
      entityId: (goal as { id: string }).id,
      action: 'create',
      actor: 'user-1',
      occurredAt: OCCURRED_AT,
      before: null,
    });
    expect(
      (record.payload as { after: { title: string } }).after.title,
    ).toBe('Ship M1');
  });

  it('rolls back the provenance Record when the mutation fails', async () => {
    await expect(
      service.mutateWithProvenance(
        goalCreateCommand({
          mutate: async (context) => {
            await new SqliteGoalRepository(context).add(
              createGoal({ title: 'Lost', targetState: 'gone' }),
            );
            throw new Error('disk full');
          },
        }),
      ),
    ).rejects.toThrow(MutationPersistenceError);

    const error = await service
      .mutateWithProvenance(
        goalCreateCommand({
          entityId: 'goal-err',
          mutate: async () => {
            throw new Error('original cause');
          },
        }),
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MutationPersistenceError);
    expect((error as MutationPersistenceError).cause).toBeInstanceOf(Error);
    expect(((error as MutationPersistenceError).cause as Error).message).toBe(
      'original cause',
    );

    expect(await count('goals')).toBe(0);
    expect(await count('records')).toBe(0);
  });

  it('rolls back the mutation when the provenance append fails', async () => {
    const failingRecords: RecordRepository = {
      add: async () => {
        throw new Error('records table locked');
      },
      getById: async () => null,
    };
    const failingService = new MutationProvenanceService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      records: () => failingRecords,
      clock: fixedClock,
      ids: fixedIds,
    });

    const error = await failingService
      .mutateWithProvenance(goalCreateCommand())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProvenancePersistenceError);
    expect((error as ProvenancePersistenceError).cause).toBeInstanceOf(Error);
    expect(await count('goals')).toBe(0);
    expect(await count('records')).toBe(0);
  });

  it('rejects invalid commands before any persistence', async () => {
    let mutateCalled = false;

    await expect(
      service.mutateWithProvenance(
        goalCreateCommand({
          action: 'upsert',
          mutate: async () => {
            mutateCalled = true;
          },
        }),
      ),
    ).rejects.toThrow(ProvenanceValidationError);
    await expect(
      service.mutateWithProvenance(
        goalCreateCommand({ entityType: 'label' }),
      ),
    ).rejects.toThrow(ProvenanceValidationError);

    expect(mutateCalled).toBe(false);
    expect(await count('goals')).toBe(0);
    expect(await count('records')).toBe(0);
  });

  it('audits a user-facing Record mutation exactly once, without recursion', async () => {
    const userRecord = createRecord({
      description: 'Finished the first milestone wave',
      recordType: 'progress',
      occurredAt: OCCURRED_AT,
      recordedAt: RECORDED_AT,
      actor: 'user-1',
    });

    await service.mutateWithProvenance({
      entityType: 'record',
      entityId: userRecord.id,
      action: 'create',
      actor: 'user-1',
      occurredAt: OCCURRED_AT,
      after: {
        title: userRecord.title,
        description: userRecord.description,
        recordType: userRecord.recordType,
        occurredAt: userRecord.occurredAt,
        recordedAt: userRecord.recordedAt,
      },
      mutate: async (context) => {
        await new SqliteRecordRepository(context).add(userRecord);
      },
    });

    // The user's Record plus exactly one provenance Record; the provenance
    // insertion itself is not audited, so the trail terminates.
    expect(await count('records')).toBe(2);
    const provenance = await provenanceRecords();
    expect(provenance).toHaveLength(1);
    expect(provenance[0].payload).toMatchObject({
      entityType: 'record',
      entityId: userRecord.id,
      action: 'create',
    });
  });
});
