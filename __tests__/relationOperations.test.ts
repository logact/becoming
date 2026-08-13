import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

import { createGoal } from '../src/domain/goal';
import { createResource } from '../src/domain/resource';
import { createRecord } from '../src/domain/record';
import { RELATION_TYPES, endRelation, createRelation } from '../src/domain/relation';
import type { Relation } from '../src/domain/relation';
import {
  DEFAULT_RELATION_POLICIES,
  RelationMetadataPolicyError,
  openRelationPolicy,
  resolveRelationPolicy,
} from '../src/domain/relationPolicy';
import type { RelationPolicy } from '../src/domain/relationPolicy';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import { RecordRelationProvenancePort } from '../src/application/relationProvenanceService';
import {
  DuplicateActiveRelationError,
  RelationDirectionNotPermittedError,
  RelationEndpointNotFoundError,
  RelationNotFoundError,
  RelationPersistenceError,
  RelationPolicyNotFoundError,
  RelationProvenancePersistenceError,
  RelationService,
} from '../src/application/relationService';
import type {
  CreateRelationCommand,
  RelationEndpointLookup,
  RelationMutationNotice,
  RelationProvenancePort,
} from '../src/application/relationService';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteGoalRepository } from '../src/persistence/goalRepository';
import { SqliteResourceRepository } from '../src/persistence/resourceRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { NodeSqliteDatabase } from '../src/persistence/sqlite/nodeSqliteDatabase';
import { migrate } from '../src/persistence/migrate';
import type { SqliteDatabase } from '../src/persistence/database';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CLOCK_NOW = '2026-08-12T12:00:00.000Z';
const RECORDED_AT = '2026-08-12T12:00:01.000Z';
const ENDED_AT = '2026-08-12T13:00:00.000Z';

const fixedClock = { now: () => CLOCK_NOW };
let idCounter = 0;
const fixedIds = { newId: () => `rel-${++idCounter}` };

async function relationCount(db: SqliteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM relations',
  );
  return row?.n ?? -1;
}

async function recordCount(db: SqliteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM records',
  );
  return row?.n ?? -1;
}

async function activeRelationCount(db: SqliteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM relations WHERE ended_at IS NULL',
  );
  return row?.n ?? -1;
}

/**
 * Typed-endpoint lookup over the per-aggregate repositories where they exist;
 * core types whose repositories have not landed yet are served from an
 * explicit in-memory registry.
 */
function endpointLookup(
  db: SqliteDatabase,
  extra: Set<string>,
): RelationEndpointLookup {
  const goals = new SqliteGoalRepository(db);
  const resources = new SqliteResourceRepository(db);
  const records = new SqliteRecordRepository(db);
  return {
    async exists(entityType, id) {
      if (entityType === 'goal') {
        return (await goals.getById(id)) !== null;
      }
      if (entityType === 'resource') {
        return (await resources.getById(id)) !== null;
      }
      if (entityType === 'record') {
        return (await records.getById(id)) !== null;
      }
      return extra.has(`${entityType}:${id}`);
    },
  };
}

/**
 * Test provenance appender: appends one provenance Record per relation
 * mutation through the unit-of-work context, mirroring the atomic seam the
 * relation-change provenance contract (Feature #5) will plug into.
 */
function provenanceAppender(
  events: RelationMutationNotice[],
  options: { fail?: boolean } = {},
): RelationProvenancePort<SqliteDatabase> {
  let provenanceId = 0;
  return {
    async append(context, notice) {
      if (options.fail === true) {
        throw new Error('provenance store unavailable');
      }
      events.push(notice);
      provenanceId += 1;
      const record = createRecord(
        {
          description: `relation ${notice.kind}: ${notice.relation.id}`,
          recordType: PROVENANCE_RECORD_TYPE,
          occurredAt: notice.occurredAt,
          recordedAt: RECORDED_AT,
          actor: notice.actor,
          payload: {
            kind: notice.kind,
            relationId: notice.relation.id,
            sourceType: notice.relation.sourceType,
            sourceId: notice.relation.sourceId,
            relationType: notice.relation.relationType,
            targetType: notice.relation.targetType,
            targetId: notice.relation.targetId,
            metadata: notice.relation.metadata,
            actor: notice.actor,
            occurredAt: notice.occurredAt,
          },
        },
        { id: `prov-${provenanceId}`, now: RECORDED_AT },
      );
      await new SqliteRecordRepository(context).add(record);
    },
  };
}

interface ServiceOptions {
  provenance?: RelationProvenancePort<SqliteDatabase>;
  policies?: Readonly<Record<string, RelationPolicy>>;
  supportedRelationTypes?: readonly string[];
  ids?: { newId(): string };
  extraEndpoints?: Set<string>;
}

function makeService(
  db: SqliteDatabase,
  options: ServiceOptions = {},
): RelationService<SqliteDatabase> {
  const extraEndpoints = options.extraEndpoints ?? new Set<string>();
  return new RelationService<SqliteDatabase>({
    unitOfWork: sqliteUnitOfWork(db),
    relations: (context) => new SqliteRelationRepository(context),
    endpoints: (context) => endpointLookup(context, extraEndpoints),
    provenance: options.provenance ?? new RecordRelationProvenancePort({
      records: (context) => new SqliteRecordRepository(context),
      clock: fixedClock,
      ids: { newId: () => `default-audit-${++idCounter}` },
    }),
    policies: options.policies,
    supportedRelationTypes: options.supportedRelationTypes,
    clock: fixedClock,
    ids: options.ids ?? fixedIds,
  });
}

describe('relation policies (domain)', () => {
  it('provides a default policy for every supported relation type', () => {
    for (const relationType of RELATION_TYPES) {
      const policy = resolveRelationPolicy(relationType);
      expect(policy?.relationType).toBe(relationType);
    }
    expect(Object.keys(DEFAULT_RELATION_POLICIES).sort()).toEqual(
      [...RELATION_TYPES].sort(),
    );
  });

  it('defaults to a unique active identity, except for consumes and metadata-scoped workflow applicability', () => {
    for (const relationType of RELATION_TYPES) {
      expect(DEFAULT_RELATION_POLICIES[relationType].allowsMultipleActive).toBe(
        relationType === 'consumes' || relationType === 'workflow_applies_to',
      );
    }
  });

  it('open policies permit any core direction and any JSON metadata', () => {
    const policy = openRelationPolicy('related_to');
    expect(policy.allowsDirection('task', 'philosophy')).toBe(true);
    expect(policy.allowsDirection('record', 'resource')).toBe(true);
    expect(() => policy.validateMetadata(null)).not.toThrow();
    expect(() =>
      policy.validateMetadata({ amount: '2.5', unit: 'hour' }),
    ).not.toThrow();
  });

  it('resolves per-type overrides over the defaults', () => {
    const override = openRelationPolicy('uses', { allowsMultipleActive: true });
    expect(resolveRelationPolicy('uses', { uses: override })).toBe(override);
    expect(resolveRelationPolicy('uses', { guides: override })).toBe(
      DEFAULT_RELATION_POLICIES.uses,
    );
  });

  it('returns null for a relation type no policy governs', () => {
    expect(resolveRelationPolicy('funds')).toBeNull();
  });
});

describe('endRelation (domain)', () => {
  const input = {
    sourceType: 'goal',
    sourceId: 'goal-1',
    relationType: 'constrained_by',
    targetType: 'resource',
    targetId: 'resource-1',
  };

  it('sets endedAt without touching any other field', () => {
    const relation = createRelation(
      { ...input, metadata: { constraint_type: 'deadline' } },
      { id: 'rel-1', now: CLOCK_NOW },
    );

    const ended = endRelation(relation, ENDED_AT);

    expect(ended).toEqual({ ...relation, endedAt: ENDED_AT });
    expect(relation.endedAt).toBeNull();
  });

  it('is an idempotent no-op on an already-ended relation: the first end wins', () => {
    const relation = createRelation(input, { id: 'rel-1', now: CLOCK_NOW });
    const ended = endRelation(relation, ENDED_AT);

    const endedAgain = endRelation(ended, '2026-08-12T14:00:00.000Z');

    expect(endedAgain).toBe(ended);
    expect(endedAgain.endedAt).toBe(ENDED_AT);
  });

  it('rejects an end earlier than the relation started', () => {
    const relation = createRelation(input, { id: 'rel-1', now: CLOCK_NOW });

    expect(() => endRelation(relation, '2026-08-12T11:59:59.999Z')).toThrow(
      /endedAt/,
    );
  });
});

describe('RelationService create', () => {
  let db: SqliteDatabase;
  let goalId: string;
  let resourceId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    const goal = createGoal({ title: 'Ship M1', targetState: 'M1 shipped' });
    const resource = createResource({ title: 'Dev time', resourceType: 'time' });
    await new SqliteGoalRepository(db).add(goal);
    await new SqliteResourceRepository(db).add(resource);
    goalId = goal.id;
    resourceId = resource.id;
  });

  afterEach(async () => {
    await closeQuietly(db);
  });

  function createCommand(
    overrides: Partial<CreateRelationCommand> = {},
  ): CreateRelationCommand {
    return {
      sourceType: 'goal',
      sourceId: goalId,
      relationType: 'constrained_by',
      targetType: 'resource',
      targetId: resourceId,
      actor: 'user-1',
      ...overrides,
    };
  }

  it('creates a relation and appends provenance in one atomic operation', async () => {
    const events: RelationMutationNotice[] = [];
    const service = makeService(db, { provenance: provenanceAppender(events) });

    const relation = await service.createRelation(
      createCommand({ metadata: { constraint_type: 'deadline' } }),
    );

    expect(relation.endedAt).toBeNull();
    expect(relation.createdAt).toBe(CLOCK_NOW);
    const stored = await new SqliteRelationRepository(db).getById(relation.id);
    expect(stored).toEqual(relation);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'created',
      relation,
      actor: 'user-1',
      occurredAt: CLOCK_NOW,
    });
    expect(await recordCount(db)).toBe(1);
    const provenanceRecord = await db.getFirstAsync<{
      actor: string;
      occurred_at: string;
      payload: string;
    }>(`SELECT actor, occurred_at, payload FROM records`);
    expect(provenanceRecord?.actor).toBe('user-1');
    expect(provenanceRecord?.occurred_at).toBe(CLOCK_NOW);
    expect(JSON.parse(provenanceRecord?.payload ?? '{}')).toEqual({
      kind: 'created',
      relationId: relation.id,
      sourceType: 'goal',
      sourceId: goalId,
      relationType: 'constrained_by',
      targetType: 'resource',
      targetId: resourceId,
      metadata: { constraint_type: 'deadline' },
      actor: 'user-1',
      occurredAt: CLOCK_NOW,
    });
  });

  it('creates a relation with the required default Record-backed provenance port', async () => {
    const service = makeService(db);

    const relation = await service.createRelation(createCommand());

    expect(await relationCount(db)).toBe(1);
    expect(await recordCount(db)).toBe(1);
    expect(
      await new SqliteRelationRepository(db).getById(relation.id),
    ).toEqual(relation);
  });

  it('rejects an unsupported relation type and persists nothing', async () => {
    const service = makeService(db);

    await expect(
      service.createRelation(createCommand({ relationType: 'likes' })),
    ).rejects.toThrow(/Unsupported relation type/);

    expect(await relationCount(db)).toBe(0);
    expect(await recordCount(db)).toBe(0);
  });

  it('rejects a relation type no policy governs', async () => {
    const service = makeService(db, {
      supportedRelationTypes: [...RELATION_TYPES, 'funds'],
    });

    const error = await service
      .createRelation(createCommand({ relationType: 'funds' }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RelationPolicyNotFoundError);
    expect(await relationCount(db)).toBe(0);
    expect(await recordCount(db)).toBe(0);
  });

  it('rejects non-core endpoint types and persists nothing', async () => {
    const service = makeService(db);

    await expect(
      service.createRelation(createCommand({ sourceType: 'label' })),
    ).rejects.toThrow(/core entity type/);

    expect(await relationCount(db)).toBe(0);
  });

  it('rejects metadata that is not structured JSON and persists nothing', async () => {
    const service = makeService(db);

    await expect(
      service.createRelation(createCommand({ metadata: { f: () => 1 } })),
    ).rejects.toThrow(/JSON/);

    expect(await relationCount(db)).toBe(0);
  });

  it('rejects a blank actor and persists nothing', async () => {
    const service = makeService(db);

    await expect(
      service.createRelation(createCommand({ actor: '  ' })),
    ).rejects.toThrow(/actor/);

    expect(await relationCount(db)).toBe(0);
  });

  it('enforces the policy direction exactly', async () => {
    const extraEndpoints = new Set(['project:project-1', 'workflow:workflow-1']);
    const managedByProjectToWorkflow: RelationPolicy = {
      relationType: 'managed_by',
      allowsMultipleActive: false,
      allowsDirection: (sourceType, targetType) =>
        sourceType === 'project' && targetType === 'workflow',
      validateMetadata: () => undefined,
    };
    const service = makeService(db, {
      extraEndpoints,
      policies: { managed_by: managedByProjectToWorkflow },
    });

    await expect(
      service.createRelation(
        createCommand({
          relationType: 'managed_by',
          targetType: 'workflow',
          targetId: 'workflow-1',
        }),
      ),
    ).rejects.toThrow(RelationDirectionNotPermittedError);
    expect(await relationCount(db)).toBe(0);

    await expect(
      service.createRelation(
        createCommand({
          relationType: 'managed_by',
          sourceType: 'project',
          sourceId: 'project-1',
          targetType: 'workflow',
          targetId: 'workflow-1',
        }),
      ),
    ).resolves.toMatchObject({ relationType: 'managed_by' });
    expect(await relationCount(db)).toBe(1);
  });

  it('enforces policy-specific metadata rules', async () => {
    const requiresConstraintType: RelationPolicy = {
      relationType: 'constrained_by',
      allowsMultipleActive: false,
      allowsDirection: () => true,
      validateMetadata: (metadata) => {
        if (
          metadata === null ||
          typeof metadata !== 'object' ||
          Array.isArray(metadata) ||
          !('constraint_type' in metadata)
        ) {
          throw new RelationMetadataPolicyError(
            'constrained_by',
            'metadata.constraint_type is required',
          );
        }
      },
    };
    const service = makeService(db, {
      policies: { constrained_by: requiresConstraintType },
    });

    await expect(service.createRelation(createCommand())).rejects.toThrow(
      RelationMetadataPolicyError,
    );
    expect(await relationCount(db)).toBe(0);

    await expect(
      service.createRelation(
        createCommand({ metadata: { constraint_type: 'deadline' } }),
      ),
    ).resolves.toMatchObject({ relationType: 'constrained_by' });
    expect(await relationCount(db)).toBe(1);
  });

  it('rejects a missing source endpoint and persists nothing', async () => {
    const service = makeService(db);

    const error = await service
      .createRelation(createCommand({ sourceId: 'no-such-goal' }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RelationEndpointNotFoundError);
    expect((error as Error).message).toMatch(/source endpoint goal no-such-goal/);
    expect(await relationCount(db)).toBe(0);
  });

  it('rejects a missing target endpoint and persists nothing', async () => {
    const service = makeService(db);

    const error = await service
      .createRelation(createCommand({ targetId: 'no-such-resource' }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RelationEndpointNotFoundError);
    expect((error as Error).message).toMatch(
      /target endpoint resource no-such-resource/,
    );
    expect(await relationCount(db)).toBe(0);
  });

  it('rejects a duplicate active relation under a unique-identity policy', async () => {
    const service = makeService(db);
    await service.createRelation(createCommand());

    const error = await service
      .createRelation(createCommand())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DuplicateActiveRelationError);
    expect(await relationCount(db)).toBe(1);
    expect(await activeRelationCount(db)).toBe(1);
  });

  it('allows many-to-many relations across distinct identities', async () => {
    const secondGoal = createGoal({ title: 'Ship M2', targetState: 'M2 shipped' });
    const secondResource = createResource({
      title: 'Budget',
      resourceType: 'money',
    });
    await new SqliteGoalRepository(db).add(secondGoal);
    await new SqliteResourceRepository(db).add(secondResource);
    const service = makeService(db);

    await service.createRelation(createCommand());
    await service.createRelation(createCommand({ sourceId: secondGoal.id }));
    await service.createRelation(createCommand({ targetId: secondResource.id }));

    expect(await relationCount(db)).toBe(3);
    expect(await activeRelationCount(db)).toBe(3);
  });

  it('allows duplicate active relations under a many-active policy (consumes)', async () => {
    const record = createRecord({
      description: 'Focused work session',
      recordType: 'action',
      occurredAt: CLOCK_NOW,
      recordedAt: RECORDED_AT,
    });
    await new SqliteRecordRepository(db).add(record);
    const service = makeService(db);
    const consume = {
      sourceType: 'record',
      sourceId: record.id,
      relationType: 'consumes',
      targetType: 'resource',
      targetId: resourceId,
      actor: 'user-1',
    };

    await service.createRelation({
      ...consume,
      metadata: { amount: '2.5', unit: 'hour' },
    });
    await service.createRelation({
      ...consume,
      metadata: { amount: '1.5', unit: 'hour' },
    });

    expect(await relationCount(db)).toBe(2);
    expect(await activeRelationCount(db)).toBe(2);
  });
});

describe('RelationService end', () => {
  let db: SqliteDatabase;
  let goalId: string;
  let resourceId: string;
  let service: RelationService<SqliteDatabase>;
  let events: RelationMutationNotice[];

  beforeEach(async () => {
    db = await createTestDatabase();
    const goal = createGoal({ title: 'Ship M1', targetState: 'M1 shipped' });
    const resource = createResource({ title: 'Dev time', resourceType: 'time' });
    await new SqliteGoalRepository(db).add(goal);
    await new SqliteResourceRepository(db).add(resource);
    goalId = goal.id;
    resourceId = resource.id;
    events = [];
    service = makeService(db, { provenance: provenanceAppender(events) });
  });

  afterEach(async () => {
    await closeQuietly(db);
  });

  async function createActive(): Promise<Relation> {
    return service.createRelation({
      sourceType: 'goal',
      sourceId: goalId,
      relationType: 'constrained_by',
      targetType: 'resource',
      targetId: resourceId,
      metadata: { constraint_type: 'deadline' },
      actor: 'user-1',
    });
  }

  it('sets ended_at and preserves the original row', async () => {
    const relation = await createActive();
    events.length = 0;

    const ended = await service.endRelation({
      relationId: relation.id,
      actor: 'user-2',
      endedAt: ENDED_AT,
    });

    expect(ended).toEqual({ ...relation, endedAt: ENDED_AT });
    const stored = await new SqliteRelationRepository(db).getById(relation.id);
    expect(stored).toEqual(ended);
    expect(stored?.createdAt).toBe(relation.createdAt);
    expect(stored?.metadata).toEqual({ constraint_type: 'deadline' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'ended',
      relation: ended,
      actor: 'user-2',
      occurredAt: ENDED_AT,
    });
  });

  it('treats a repeated end as an idempotent no-op', async () => {
    const relation = await createActive();
    const ended = await service.endRelation({
      relationId: relation.id,
      actor: 'user-1',
      endedAt: ENDED_AT,
    });
    events.length = 0;

    const endedAgain = await service.endRelation({
      relationId: relation.id,
      actor: 'user-2',
      endedAt: '2026-08-12T16:00:00.000Z',
    });

    expect(endedAgain).toEqual(ended);
    expect(endedAgain.endedAt).toBe(ENDED_AT);
    // No rewrite and no second provenance entry for the no-op.
    expect(events).toHaveLength(0);
    expect(await recordCount(db)).toBe(2);
    expect(await relationCount(db)).toBe(1);
  });

  it('rejects ending an unknown relation', async () => {
    await expect(
      service.endRelation({ relationId: 'no-such-relation', actor: 'user-1' }),
    ).rejects.toThrow(RelationNotFoundError);
    expect(await relationCount(db)).toBe(0);
  });

  it('rejects an end earlier than the relation started and keeps it active', async () => {
    const relation = await createActive();

    await expect(
      service.endRelation({
        relationId: relation.id,
        actor: 'user-1',
        endedAt: '2026-08-12T11:00:00.000Z',
      }),
    ).rejects.toThrow(/endedAt/);

    const stored = await new SqliteRelationRepository(db).getById(relation.id);
    expect(stored?.endedAt).toBeNull();
  });

  it('replaces a relationship as end-old/create-new', async () => {
    const original = await createActive();
    await service.endRelation({
      relationId: original.id,
      actor: 'user-1',
      endedAt: ENDED_AT,
    });

    const replacement = await service.createRelation({
      sourceType: 'goal',
      sourceId: goalId,
      relationType: 'constrained_by',
      targetType: 'resource',
      targetId: resourceId,
      metadata: { constraint_type: 'budget cap' },
      actor: 'user-1',
    });

    expect(await relationCount(db)).toBe(2);
    expect(await activeRelationCount(db)).toBe(1);
    const active = await new SqliteRelationRepository(db).findActiveByIdentity(
      'goal',
      goalId,
      'constrained_by',
      'resource',
      resourceId,
    );
    expect(active?.id).toBe(replacement.id);
    // The ended row keeps its full history.
    const endedRow = await new SqliteRelationRepository(db).getById(original.id);
    expect(endedRow?.endedAt).toBe(ENDED_AT);
    expect(endedRow?.metadata).toEqual({ constraint_type: 'deadline' });
  });

  it('replaces atomically and appends end then create provenance Records', async () => {
    const original = await createActive();
    let auditId = 0;
    const provenance = new RecordRelationProvenancePort<SqliteDatabase>({
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => RECORDED_AT },
      ids: { newId: () => `audit-${++auditId}` },
    });
    const audited = makeService(db, { provenance });

    const result = await audited.replaceRelation({
      relationId: original.id,
      actor: 'user-2',
      endedAt: ENDED_AT,
      replacement: {
        sourceType: 'goal',
        sourceId: goalId,
        relationType: 'constrained_by',
        targetType: 'resource',
        targetId: resourceId,
        metadata: { constraint_type: 'budget cap', ignored: 'not audited' },
        occurredAt: ENDED_AT,
      },
    });

    expect(result.ended).toEqual({ ...original, endedAt: ENDED_AT });
    expect(result.replacement.endedAt).toBeNull();
    expect(await relationCount(db)).toBe(2);
    const records = await new SqliteRecordRepository(db).list({ status: 'all' });
    expect(records).toHaveLength(3); // original create, then replacement's end/create
    const replacementAudits = records.filter((record) =>
      typeof record.payload === 'object' &&
      record.payload !== null &&
      !Array.isArray(record.payload) &&
      typeof record.payload.action === 'string',
    );
    expect(replacementAudits.map((record) => (record.payload as { action: string }).action))
      .toEqual(['relation_ended', 'relation_created']);
    expect((replacementAudits.at(-1)?.payload as { metadata: unknown }).metadata)
      .toEqual({ constraint_type: 'budget cap' });
  });

  it('uses the ending time as the replacement creation time by default', async () => {
    const original = await createActive();
    const result = await service.replaceRelation({
      relationId: original.id,
      actor: 'user-2',
      endedAt: ENDED_AT,
      replacement: {
        sourceType: 'goal',
        sourceId: goalId,
        relationType: 'constrained_by',
        targetType: 'resource',
        targetId: resourceId,
      },
    });

    expect(result.ended.endedAt).toBe(ENDED_AT);
    expect(result.replacement.createdAt).toBe(ENDED_AT);
  });

  it('forbids ordinary hard deletion; an ended relation stays stored', async () => {
    const relation = await createActive();
    const ended = await service.endRelation({
      relationId: relation.id,
      actor: 'user-1',
      endedAt: ENDED_AT,
    });

    const repository = new SqliteRelationRepository(db);
    for (const name of ['delete', 'remove', 'destroy', 'hardDelete']) {
      expect(
        (repository as unknown as Record<string, unknown>)[name],
      ).toBeUndefined();
      expect(
        (service as unknown as Record<string, unknown>)[name],
      ).toBeUndefined();
    }

    expect(await repository.getById(relation.id)).toEqual(ended);
    expect(await relationCount(db)).toBe(1);
  });
});

describe('RelationService transactions', () => {
  let db: SqliteDatabase;
  let goalId: string;
  let resourceId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    const goal = createGoal({ title: 'Ship M1', targetState: 'M1 shipped' });
    const resource = createResource({ title: 'Dev time', resourceType: 'time' });
    await new SqliteGoalRepository(db).add(goal);
    await new SqliteResourceRepository(db).add(resource);
    goalId = goal.id;
    resourceId = resource.id;
  });

  afterEach(async () => {
    await closeQuietly(db);
  });

  function createCommand(
    overrides: Partial<CreateRelationCommand> = {},
  ): CreateRelationCommand {
    return {
      sourceType: 'goal',
      sourceId: goalId,
      relationType: 'constrained_by',
      targetType: 'resource',
      targetId: resourceId,
      actor: 'user-1',
      ...overrides,
    };
  }

  it('rolls back the relation when the provenance append fails on create', async () => {
    const service = makeService(db, {
      provenance: provenanceAppender([], { fail: true }),
    });

    const error = await service
      .createRelation(createCommand())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RelationProvenancePersistenceError);
    expect(
      (error as RelationProvenancePersistenceError).cause,
    ).toBeInstanceOf(Error);
    expect(await relationCount(db)).toBe(0);
    expect(await recordCount(db)).toBe(0);
  });

  it('rolls back the provenance when the relation write fails on create', async () => {
    const collisionIds = { newId: () => 'rel-collision' };
    await makeService(db, { ids: collisionIds }).createRelation(
      createCommand(),
    );
    const events: RelationMutationNotice[] = [];
    const failing = makeService(db, {
      ids: collisionIds,
      provenance: provenanceAppender(events),
    });

    // A different relation type avoids the duplicate-identity guard, so the
    // colliding id forces the INSERT itself to fail.
    const error = await failing
      .createRelation(createCommand({ relationType: 'uses' }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RelationPersistenceError);
    // node:sqlite raises errors from another realm, so assert on the
    // preserved message instead of `instanceof`.
    expect(
      String((error as RelationPersistenceError).cause),
    ).toMatch(/UNIQUE|constraint/i);
    // The duplicate-id insert failed before provenance ran; the original row
    // is untouched and no provenance was appended.
    expect(events).toHaveLength(0);
    expect(await relationCount(db)).toBe(1);
    // The initial successful create has its required creation audit; the
    // colliding write adds no second Record.
    expect(await recordCount(db)).toBe(1);
    const original = await new SqliteRelationRepository(db).getById(
      'rel-collision',
    );
    expect(original?.endedAt).toBeNull();
  });

  it('rolls back the ended_at update when the provenance append fails on end', async () => {
    const service = makeService(db);
    const relation = await service.createRelation(createCommand());
    const failing = makeService(db, {
      provenance: provenanceAppender([], { fail: true }),
    });

    const error = await failing
      .endRelation({ relationId: relation.id, actor: 'user-1', endedAt: ENDED_AT })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RelationProvenancePersistenceError);
    const stored = await new SqliteRelationRepository(db).getById(relation.id);
    expect(stored?.endedAt).toBeNull();
    expect(await activeRelationCount(db)).toBe(1);
    // The initial successful create has its required creation audit; the
    // failed end contributes no misleading end Record.
    expect(await recordCount(db)).toBe(1);
  });

  it('rolls back both relation changes when replacement provenance fails', async () => {
    const service = makeService(db);
    const relation = await service.createRelation(createCommand());
    const failing = makeService(db, {
      provenance: provenanceAppender([], { fail: true }),
    });

    await expect(
      failing.replaceRelation({
        relationId: relation.id,
        actor: 'user-1',
        endedAt: ENDED_AT,
        replacement: { ...createCommand(), occurredAt: ENDED_AT },
      }),
    ).rejects.toThrow(RelationProvenancePersistenceError);

    expect(await relationCount(db)).toBe(1);
    expect(await activeRelationCount(db)).toBe(1);
    expect((await new SqliteRelationRepository(db).getById(relation.id))?.endedAt)
      .toBeNull();
    // The initial successful create has its required creation audit; neither
    // half of the failed replacement adds a Record.
    expect(await recordCount(db)).toBe(1);
  });
});

describe('RelationService concurrency', () => {
  it('never leaves a cardinality-violating active result from competing creates', async () => {
    const location = join(
      tmpdir(),
      `relation-concurrency-${process.pid}-${Date.now()}.sqlite`,
    );
    const dbA = new NodeSqliteDatabase(location);
    let dbB: NodeSqliteDatabase | null = null;
    try {
      await migrate(dbA);
      const goal = createGoal({ title: 'Ship M1', targetState: 'M1 shipped' });
      const resource = createResource({
        title: 'Dev time',
        resourceType: 'time',
      });
      await new SqliteGoalRepository(dbA).add(goal);
      await new SqliteResourceRepository(dbA).add(resource);
      dbB = new NodeSqliteDatabase(location);

      const command: CreateRelationCommand = {
        sourceType: 'goal',
        sourceId: goal.id,
        relationType: 'constrained_by',
        targetType: 'resource',
        targetId: resource.id,
        actor: 'user-1',
      };
      const serviceA = makeService(dbA, { ids: { newId: () => 'race-a' } });
      const serviceB = makeService(dbB, { ids: { newId: () => 'race-b' } });

      const results = await Promise.allSettled([
        serviceA.createRelation(command),
        serviceB.createRelation(command),
      ]);

      // Exactly one competing create wins; the loser is rejected (duplicate
      // active identity or a serialized-transaction lock) and persists
      // nothing, so at most one active relation ever exists.
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(await relationCount(dbA)).toBe(1);
      expect(await activeRelationCount(dbA)).toBe(1);
    } finally {
      await closeQuietly(dbA);
      if (dbB !== null) {
        await closeQuietly(dbB);
      }
      rmSync(location, { force: true });
    }
  });
});
