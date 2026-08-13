import {
  RecordNotFoundError,
  RecordService,
} from '../src/application/recordService';
import {
  MutationPersistenceError,
  ProvenancePersistenceError,
} from '../src/application/mutationProvenanceService';
import {
  RecordCorrectionPersistenceError,
  RecordHistoryService,
} from '../src/application/recordHistoryService';
import {
  RECORD_TYPES,
  archiveRecord,
  assertJsonValue,
  createRecord,
  validateRecord,
} from '../src/domain/record';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import { buildRecordCorrectionPayload } from '../src/domain/recordCorrection';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const OCCURRED_AT = '2026-08-10T09:30:00.000Z';
const RECORDED_AT = '2026-08-12T14:00:00.000Z';

function validInput() {
  return {
    description: 'Completed the first prototype session',
    recordType: 'action',
    occurredAt: OCCURRED_AT,
    recordedAt: RECORDED_AT,
  };
}

describe('record domain model', () => {
  it('creates a Record with fresh id, audit timestamps, and null optionals', () => {
    const record = createRecord(validInput());

    expect(record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(record.createdAt).toBe(record.updatedAt);
    expect(record.archivedAt).toBeNull();
    expect(record.title).toBeNull();
    expect(record.actor).toBeNull();
    expect(record.payload).toBeNull();
    expect(() => validateRecord(record)).not.toThrow();
  });

  it('keeps occurredAt and recordedAt independent and unchanged', () => {
    const record = createRecord(validInput());

    expect(record.occurredAt).toBe(OCCURRED_AT);
    expect(record.recordedAt).toBe(RECORDED_AT);
    expect(record.occurredAt).not.toBe(record.recordedAt);
  });

  it('supports every documented record type', () => {
    for (const recordType of RECORD_TYPES) {
      expect(() =>
        createRecord({ ...validInput(), recordType }),
      ).not.toThrow();
    }
  });

  it('rejects a blank description', () => {
    expect(() =>
      createRecord({ ...validInput(), description: '   ' }),
    ).toThrow(/description/);
  });

  it('rejects an unsupported record type with an explicit error', () => {
    expect(() =>
      createRecord({ ...validInput(), recordType: 'vibe' }),
    ).toThrow(/Unsupported record type/);
    expect(() => createRecord({ ...validInput(), recordType: '' })).toThrow(
      /recordType/,
    );
  });

  it('extends the record-type policy explicitly', () => {
    const record = createRecord(
      { ...validInput(), recordType: 'milestone' },
      { supportedRecordTypes: [...RECORD_TYPES, 'milestone'] },
    );

    expect(record.recordType).toBe('milestone');
    expect(() =>
      validateRecord(record, [...RECORD_TYPES, 'milestone']),
    ).not.toThrow();
    expect(() => validateRecord(record)).toThrow(/Unsupported record type/);
  });

  it('rejects missing or malformed occurred-at and recorded-at', () => {
    expect(() => createRecord({ ...validInput(), occurredAt: '' })).toThrow(
      /occurredAt/,
    );
    expect(() =>
      createRecord({ ...validInput(), occurredAt: 'yesterday-ish' }),
    ).toThrow(/occurredAt/);
    expect(() =>
      createRecord({ ...validInput(), recordedAt: 'not a timestamp' }),
    ).toThrow(/recordedAt/);
  });

  it('rejects a blank title or actor when present', () => {
    expect(() => createRecord({ ...validInput(), title: ' ' })).toThrow(
      /title/,
    );
    expect(() => createRecord({ ...validInput(), actor: '' })).toThrow(
      /actor/,
    );
  });

  it('keeps optional title, actor, and structured payload', () => {
    const payload = {
      session: { index: 1, tags: ['prototype', 'domain'] },
      durationHours: 2.5,
      note: 'nested ✓ payload',
    };
    const record = createRecord({
      ...validInput(),
      title: 'Prototype session',
      actor: 'user:logact',
      payload,
    });

    expect(record.title).toBe('Prototype session');
    expect(record.actor).toBe('user:logact');
    expect(record.payload).toEqual(payload);
  });

  it('rejects non-serializable payloads before persistence', () => {
    expect(() =>
      createRecord({ ...validInput(), payload: { f: () => 1 } }),
    ).toThrow(/JSON/);
    expect(() =>
      createRecord({ ...validInput(), payload: { nested: undefined } }),
    ).toThrow(/JSON/);
    expect(() =>
      createRecord({ ...validInput(), payload: Number.NaN }),
    ).toThrow(/finite/);
    expect(() =>
      createRecord({ ...validInput(), payload: Infinity }),
    ).toThrow(/finite/);
    expect(() =>
      createRecord({ ...validInput(), payload: 10n }),
    ).toThrow(/JSON/);
    expect(() =>
      createRecord({ ...validInput(), payload: new Date() }),
    ).toThrow(/plain JSON/);
  });

  it('rejects circular payloads with an explicit error', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(() => createRecord({ ...validInput(), payload: circular })).toThrow(
      /circular/,
    );
    expect(() => assertJsonValue(circular)).toThrow(/circular/);
  });
});

describe('RecordRepository contract', () => {
  it('round-trips a Record with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const record = createRecord({
      ...validInput(),
      title: 'Token usage',
      recordType: 'resource_usage',
      actor: 'worker:term-1',
      payload: {
        amount: '12500.50',
        unit: 'token',
        context: { task: 'm1-w2-task-53', retry: 1, flags: [true, null] },
      },
    });

    await repository.add(record);
    const loaded = await repository.getById(record.id);

    expect(loaded).toEqual(record);
    await closeQuietly(db);
  });

  it('persists occurred_at and recorded_at independently and unchanged', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const record = createRecord(validInput());

    await repository.add(record);
    const loaded = await repository.getById(record.id);

    expect(loaded?.occurredAt).toBe(OCCURRED_AT);
    expect(loaded?.recordedAt).toBe(RECORDED_AT);
    expect(loaded?.createdAt).toBe(record.createdAt);
    await closeQuietly(db);
  });

  it('round-trips omitted optional fields as null', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const record = createRecord(validInput());

    await repository.add(record);
    const loaded = await repository.getById(record.id);

    expect(loaded).toEqual(record);
    expect(loaded?.title).toBeNull();
    expect(loaded?.actor).toBeNull();
    expect(loaded?.payload).toBeNull();
    expect(loaded?.archivedAt).toBeNull();
    await closeQuietly(db);
  });

  it('round-trips a nested JSON payload without loss', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const payload = {
      transition: { from: 'Backlog', to: 'In Progress' },
      measurements: [0.1, 2, -3.75],
      externalIds: { github: 53, labels: ['task', 'm1'] },
      unicode: '記録 ✓',
    };
    const record = createRecord({ ...validInput(), payload });

    await repository.add(record);
    const loaded = await repository.getById(record.id);

    expect(loaded?.payload).toEqual(payload);
    expect(JSON.stringify(loaded?.payload)).toBe(JSON.stringify(payload));
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);

    expect(await repository.getById('no-such-record')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const record = createRecord(validInput());

    await repository.add(record);
    await expect(repository.add(record)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate before persistence', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const invalid = {
      ...createRecord(validInput()),
      recordType: 'vibe',
    };

    await expect(repository.add(invalid)).rejects.toThrow(
      /Unsupported record type/,
    );
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });
});

describe('RecordService application boundary', () => {
  function createService(db: Awaited<ReturnType<typeof createTestDatabase>>) {
    const clock = { now: () => RECORDED_AT };
    let nextId = 0;
    const ids = { newId: () => `record-${++nextId}` };
    const repository = new SqliteRecordRepository(db);
    return new RecordService({
      repository,
      unitOfWork: sqliteUnitOfWork(db),
      records: (context) => new SqliteRecordRepository(context),
      clock,
      ids,
    });
  }

  it('creates and reads a Record through framework-neutral ports', async () => {
    const db = await createTestDatabase();
    const service = createService(db);

    const created = await service.createRecord({
      description: 'Observed a failing migration',
      recordType: 'observation',
      occurredAt: OCCURRED_AT,
      actor: 'ci',
      payload: { suite: 'migrations', attempt: 2 },
    });

    expect(created.id).toBe('record-1');
    expect(created.recordedAt).toBe(RECORDED_AT);
    expect(created.createdAt).toBe(RECORDED_AT);

    const audit = await new SqliteRecordRepository(db).list({
      recordType: PROVENANCE_RECORD_TYPE,
    });
    expect(audit).toHaveLength(1);
    expect(audit[0].payload).toMatchObject({
      entityType: 'record',
      entityId: created.id,
      action: 'create',
      actor: 'ci',
      occurredAt: OCCURRED_AT,
      after: {
        description: 'Observed a failing migration',
        recordType: 'observation',
        actor: 'ci',
      },
    });

    const loaded = await service.getRecord(created.id);
    expect(loaded).toEqual(created);
    await closeQuietly(db);
  });

  it('lets the caller supply an explicit recordedAt', async () => {
    const db = await createTestDatabase();
    const service = createService(db);

    const created = await service.createRecord({
      description: 'Backfilled a historical occurrence',
      recordType: 'external_event',
      occurredAt: OCCURRED_AT,
      recordedAt: '2026-08-11T08:00:00.000Z',
      actor: 'user',
    });

    expect(created.recordedAt).toBe('2026-08-11T08:00:00.000Z');
    await closeQuietly(db);
  });

  it('throws RecordNotFoundError for an unknown Record id', async () => {
    const db = await createTestDatabase();
    const service = createService(db);

    await expect(service.getRecord('missing')).rejects.toThrow(
      RecordNotFoundError,
    );
    await expect(service.getRecord('missing')).rejects.toThrow(/not found/);
    await closeQuietly(db);
  });

  it('rejects invalid commands with domain errors before persistence', async () => {
    const db = await createTestDatabase();
    const service = createService(db);

    await expect(
      service.createRecord({
        description: 'Bad type',
        recordType: 'vibe',
        occurredAt: OCCURRED_AT,
        actor: 'user',
      }),
    ).rejects.toThrow(/Unsupported record type/);
    await expect(
      service.createRecord({
        description: 'Bad payload',
        recordType: 'action',
        occurredAt: OCCURRED_AT,
        actor: 'user',
        payload: { fn: () => 1 },
      }),
    ).rejects.toThrow(/JSON/);

    const repository = new SqliteRecordRepository(db);
    expect(await repository.getById('record-1')).toBeNull();
    await closeQuietly(db);
  });

  it('rolls back Record creation for both core and provenance persistence failures', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const command = {
      description: 'Atomic user-facing occurrence',
      recordType: 'action',
      occurredAt: OCCURRED_AT,
      actor: 'user',
    };

    const coreFailure = new RecordService({
      repository,
      unitOfWork: sqliteUnitOfWork(db),
      records: () => ({
        add: async () => { throw new Error('core record write failed'); },
        getById: async () => null,
      }),
      clock: { now: () => RECORDED_AT },
      ids: { newId: () => 'record-core-failure' },
    });
    await expect(coreFailure.createRecord(command)).rejects.toBeInstanceOf(
      MutationPersistenceError,
    );

    let writes = 0;
    const provenanceFailure = new RecordService({
      repository,
      unitOfWork: sqliteUnitOfWork(db),
      records: (context) => ({
        add: async (record) => {
          writes += 1;
          if (writes === 2) throw new Error('provenance record write failed');
          await new SqliteRecordRepository(context).add(record);
        },
        getById: async (id) => new SqliteRecordRepository(context).getById(id),
      }),
      clock: { now: () => RECORDED_AT },
      ids: { newId: () => `record-provenance-failure-${writes}` },
    });
    await expect(provenanceFailure.createRecord(command)).rejects.toBeInstanceOf(
      ProvenancePersistenceError,
    );
    expect(await repository.list({ status: 'all' })).toEqual([]);
    await closeQuietly(db);
  });
});

describe('records schema shape', () => {
  it('has exactly the documented columns and no foreign keys', async () => {
    const db = await createTestDatabase();
    const columns = (
      await db.getAllAsync<{ name: string; notnull: number }>(
        `PRAGMA table_info(records)`,
      )
    ).map((c) => c.name);
    expect(columns).toEqual([
      'id',
      'title',
      'description',
      'record_type',
      'occurred_at',
      'recorded_at',
      'actor',
      'payload',
      'created_at',
      'updated_at',
      'archived_at',
    ]);

    const foreignKeys = await db.getAllAsync(`PRAGMA foreign_key_list(records)`);
    expect(foreignKeys).toEqual([]);

    const ddl = await db.getFirstAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'records'`,
    );
    expect(ddl?.sql.toUpperCase()).not.toMatch(/FOREIGN\s+KEY/);
    expect(ddl?.sql.toUpperCase()).not.toMatch(/REFERENCES/);
    await closeQuietly(db);
  });
});

describe('Record correction and archive history (#56)', () => {
  const ARCHIVED_AT = '2026-08-13T10:00:00.000Z';

  function historyService(
    db: Awaited<ReturnType<typeof createTestDatabase>>,
    overrides: Partial<{
      records: () => SqliteRecordRepository;
      relations: () => SqliteRelationRepository;
    }> = {},
  ) {
    let nextId = 0;
    return new RecordHistoryService({
      unitOfWork: sqliteUnitOfWork(db),
      records: () => overrides.records?.() ?? new SqliteRecordRepository(db),
      relations: () => overrides.relations?.() ?? new SqliteRelationRepository(db),
      clock: { now: () => RECORDED_AT },
      ids: { newId: () => `history-${++nextId}` },
    });
  }

  it('builds a correction with only allowed changed values and filters sensitive payload data', () => {
    const target = createRecord({
      ...validInput(),
      title: 'Private note',
      payload: { public: 'before', apiKey: 'do-not-copy', nested: { token: 'hide', safe: 1 } },
    });

    const payload = buildRecordCorrectionPayload(target, {
      description: 'Corrected occurrence description',
      payload: { public: 'after', password: 'do-not-copy', nested: { secret: 'hide', safe: 2 } },
    });

    expect(payload).toEqual({
      targetRecordId: target.id,
      changes: {
        description: { before: target.description, after: 'Corrected occurrence description' },
        payload: {
          before: { public: 'before', nested: { safe: 1 } },
          after: { public: 'after', nested: { safe: 2 } },
        },
      },
    });
    expect(() => buildRecordCorrectionPayload(target, { actor: 'other' } as never)).toThrow(/unsupported fields/);
    expect(() => buildRecordCorrectionPayload(target, {})).toThrow(/at least one/);
  });

  it('appends an independent correction and its semantic link atomically without changing the original', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    const original = createRecord({ ...validInput(), actor: 'reporter', payload: { value: 'old' } }, { id: 'original', now: RECORDED_AT });
    await records.add(original);
    const service = historyService(db);

    const result = await service.correct({
      targetRecordId: original.id,
      actor: 'editor',
      occurredAt: ARCHIVED_AT,
      changes: { description: 'Corrected description', payload: { value: 'new' } },
    });

    expect(await records.getById(original.id)).toEqual(original);
    expect(result.correction).toMatchObject({
      id: 'history-1', recordType: 'correction', actor: 'editor', occurredAt: ARCHIVED_AT,
      payload: {
        targetRecordId: original.id,
        changes: {
          description: { before: original.description, after: 'Corrected description' },
          payload: { before: { value: 'old' }, after: { value: 'new' } },
        },
      },
    });
    expect(result.relation).toMatchObject({
      id: 'history-2', sourceType: 'record', sourceId: result.correction.id,
      relationType: 'related_to', targetType: 'record', targetId: original.id,
      metadata: { semantic: 'record_correction' },
    });
    await closeQuietly(db);
  });

  it('rolls back the correction when the semantic relation write fails', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    const original = createRecord(validInput(), { id: 'original', now: RECORDED_AT });
    await records.add(original);
    const service = historyService(db, {
      relations: () => ({ add: async () => { throw new Error('relation unavailable'); } } as unknown as SqliteRelationRepository),
    });

    await expect(service.correct({ targetRecordId: original.id, actor: 'editor', changes: { description: 'Corrected' } }))
      .rejects.toBeInstanceOf(RecordCorrectionPersistenceError);
    expect(await records.list({ status: 'all' })).toEqual([original]);
    await closeQuietly(db);
  });

  it('rolls back without a relation when the correction Record write fails', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    const original = createRecord(validInput(), { id: 'original', now: RECORDED_AT });
    await records.add(original);
    const service = historyService(db, {
      records: () => ({
        getById: records.getById.bind(records),
        list: records.list.bind(records),
        save: records.save.bind(records),
        add: async () => { throw new Error('record unavailable'); },
      } as unknown as SqliteRecordRepository),
    });

    await expect(service.correct({ targetRecordId: original.id, actor: 'editor', changes: { description: 'Corrected' } }))
      .rejects.toBeInstanceOf(RecordCorrectionPersistenceError);
    expect(await new SqliteRelationRepository(db).listByTarget('record', original.id)).toEqual([]);
    await closeQuietly(db);
  });

  it('archives by retention, is idempotent, and exposes active/archive/history visibility', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    const original = createRecord(validInput(), { id: 'original', now: RECORDED_AT });
    await records.add(original);
    const service = historyService(db);
    await service.correct({ targetRecordId: original.id, actor: 'editor', changes: { title: 'Correct title' } });

    const archived = await service.archive({ recordId: original.id, actor: 'archivist', archivedAt: ARCHIVED_AT });
    const retried = await service.archive({ recordId: original.id, actor: 'archivist', archivedAt: '2026-08-14T10:00:00.000Z' });
    expect(archived.archivedAt).toBe(ARCHIVED_AT);
    expect(retried).toEqual(archived);
    const provenance = await records.list({ status: 'all', recordType: PROVENANCE_RECORD_TYPE });
    expect(provenance).toHaveLength(1);
    expect(provenance[0].payload).toMatchObject({
      entityType: 'record', entityId: original.id, action: 'archive', actor: 'archivist',
      before: { archivedAt: null }, after: { archivedAt: ARCHIVED_AT },
    });
    expect(await records.list()).toHaveLength(2);
    expect(await records.list({ status: 'archived' })).toEqual([archived]);
    expect(await service.getHistory(original.id, { includeArchived: false })).toHaveLength(1);
    expect(await service.getHistory(original.id, { includeArchived: true })).toEqual([
      archived,
      expect.objectContaining({ recordType: 'correction' }),
    ]);
    expect('delete' in records).toBe(false);
    expect(archiveRecord(archived, '2026-08-14T10:00:00.000Z')).toBe(archived);
    await closeQuietly(db);
  });
});
