import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import type { CoreEntityType } from '../src/domain/entityTypes';
import {
  LineageService,
  RelationIsNotLineageError,
  UnsupportedLineageRelationTypeError,
} from '../src/application/lineageService';
import {
  RelationCycleError,
  RelationEndpointNotFoundError,
  RelationProvenancePersistenceError,
  RelationService,
} from '../src/application/relationService';
import { RecordRelationProvenancePort } from '../src/application/relationProvenanceService';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';
import type { SqliteDatabase } from '../src/persistence/database';

const NOW = '2026-08-13T12:00:00.000Z';
const ENDED = '2026-08-13T13:00:00.000Z';

const metadata = {
  schema_version: 1,
  transformation_kind: 'refinement',
  rationale: 'make the goal actionable',
  context: { source: 'planning-session' },
};

describe('LineageService', () => {
  let db: SqliteDatabase;
  let ids: number;
  let knownEndpoints: Set<string>;

  beforeEach(async () => {
    db = await createTestDatabase();
    ids = 0;
    knownEndpoints = new Set();
  });

  afterEach(async () => closeQuietly(db));

  function service(options: { failProvenance?: boolean } = {}): LineageService<SqliteDatabase> {
    const relationService = new RelationService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      relations: (context) => new SqliteRelationRepository(context),
      endpoints: () => ({ exists: async (type, id) => knownEndpoints.has(`${type}:${id}`) }),
      provenance: options.failProvenance
        ? { append: async () => { throw new Error('audit unavailable'); } }
        : new RecordRelationProvenancePort({
          records: (context) => new SqliteRecordRepository(context),
          clock: { now: () => NOW },
          ids: { newId: () => `audit-${++ids}` },
          // A lineage link's Record preserves only deliberate public context.
          metadataPolicy: { allowlist: ['schema_version', 'transformation_kind'], redacted: [] },
        }),
      clock: { now: () => NOW },
      ids: { newId: () => `relation-${++ids}` },
    });
    return new LineageService({
      relationService,
      relations: new SqliteRelationRepository(db),
    });
  }

  function register(type: CoreEntityType, id: string): void {
    knownEndpoints.add(`${type}:${id}`);
  }

  it('creates every policy-allowed endpoint combination through explicit origin and transformation commands', async () => {
    const lineage = service();
    const created = [];
    for (const relationType of ['origin_of', 'transforms_into'] as const) {
      for (const sourceType of CORE_ENTITY_TYPES) {
        for (const targetType of CORE_ENTITY_TYPES) {
          const suffix = `${relationType}-${sourceType}-${targetType}`;
          const sourceId = `source-${suffix}`;
          const targetId = `target-${suffix}`;
          register(sourceType, sourceId);
          register(targetType, targetId);
          created.push(await lineage.createLink({
            sourceType, sourceId, relationType, targetType, targetId,
            metadata, actor: 'planner',
          }));
        }
      }
    }
    expect(created).toHaveLength(CORE_ENTITY_TYPES.length ** 2 * 2);
    const history = await new SqliteRelationRepository(db).listHistory({ limit: created.length });
    expect(history).toHaveLength(created.length);
    expect(history).toEqual(expect.arrayContaining(created));
    const auditCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM records');
    expect(auditCount?.count).toBe(created.length);
  });

  it('preserves metadata and creates matching provenance while end is idempotent', async () => {
    const lineage = service();
    register('idea', 'idea-1');
    register('goal', 'goal-1');
    const link = await lineage.createOrigin({
      sourceType: 'idea', sourceId: 'idea-1', targetType: 'goal', targetId: 'goal-1',
      metadata, actor: 'planner',
    });
    const ended = await lineage.endLink({ relationId: link.id, actor: 'planner', endedAt: ENDED });
    const retried = await lineage.endLink({ relationId: link.id, actor: 'other', endedAt: '2026-08-13T14:00:00.000Z' });
    expect(ended).toEqual({ ...link, endedAt: ENDED });
    expect(retried).toEqual(ended);
    expect((await new SqliteRelationRepository(db).getById(link.id))?.metadata).toEqual(metadata);
    const records = await new SqliteRecordRepository(db).list({ status: 'all' });
    expect(records).toHaveLength(2);
    expect(records.map((record) => (record.payload as { action: string }).action))
      .toEqual(['relation_created', 'relation_ended']);
    expect((records[0].payload as { metadata: unknown }).metadata).toEqual({ schema_version: 1, transformation_kind: 'refinement' });
  });

  it('replaces by ending the historical row and creating a distinct lineage row', async () => {
    const lineage = service();
    register('goal', 'goal-1');
    register('task', 'task-1');
    register('task', 'task-2');
    const original = await lineage.createTransformation({
      sourceType: 'goal', sourceId: 'goal-1', targetType: 'task', targetId: 'task-1', metadata, actor: 'planner',
    });
    const result = await lineage.replaceLink({
      relationId: original.id, actor: 'planner', endedAt: ENDED,
      replacement: {
        sourceType: 'goal', sourceId: 'goal-1', relationType: 'transforms_into',
        targetType: 'task', targetId: 'task-2', metadata: { ...metadata, transformation_kind: 'correction' },
      },
    });
    expect(result.ended).toEqual({ ...original, endedAt: ENDED });
    expect(result.replacement.id).not.toBe(original.id);
    expect(result.replacement.createdAt).toBe(ENDED);
    expect((await new SqliteRelationRepository(db).getById(original.id))).toEqual(result.ended);
    expect((await new SqliteRecordRepository(db).list({ status: 'all' })))
      .toHaveLength(3);
  });

  it('rejects invalid type, missing endpoints, malformed metadata, and cycles without partial writes', async () => {
    const lineage = service();
    register('idea', 'idea-1');
    register('goal', 'goal-1');
    await expect(lineage.createLink({
      sourceType: 'idea', sourceId: 'idea-1', relationType: 'related_to', targetType: 'goal', targetId: 'goal-1', metadata, actor: 'planner',
    })).rejects.toBeInstanceOf(UnsupportedLineageRelationTypeError);
    await expect(lineage.createOrigin({
      sourceType: 'idea', sourceId: 'missing', targetType: 'goal', targetId: 'goal-1', metadata, actor: 'planner',
    })).rejects.toBeInstanceOf(RelationEndpointNotFoundError);
    await expect(lineage.createOrigin({
      sourceType: 'idea', sourceId: 'idea-1', targetType: 'goal', targetId: 'goal-1', metadata: { schema_version: 1 }, actor: 'planner',
    })).rejects.toThrow(/transformation_kind/);
    const first = await lineage.createTransformation({
      sourceType: 'idea', sourceId: 'idea-1', targetType: 'goal', targetId: 'goal-1', metadata, actor: 'planner',
    });
    await expect(lineage.createTransformation({
      sourceType: 'goal', sourceId: 'goal-1', targetType: 'idea', targetId: 'idea-1', metadata, actor: 'planner',
    })).rejects.toBeInstanceOf(RelationCycleError);
    expect(await new SqliteRelationRepository(db).listHistory()).toEqual([first]);
  });

  it('does not operate on other semantic relation types and rolls back a failed lineage audit', async () => {
    const lineage = service();
    register('idea', 'idea-1');
    register('goal', 'goal-1');
    const foreign = await new RelationService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db), relations: (context) => new SqliteRelationRepository(context),
      endpoints: () => ({ exists: async () => true }),
      provenance: new RecordRelationProvenancePort({ records: (context) => new SqliteRecordRepository(context), clock: { now: () => NOW }, ids: { newId: () => `audit-${++ids}` } }),
      clock: { now: () => NOW }, ids: { newId: () => `relation-${++ids}` },
    }).createRelation({ sourceType: 'idea', sourceId: 'idea-1', relationType: 'related_to', targetType: 'goal', targetId: 'goal-1', actor: 'planner' });
    await expect(lineage.endLink({ relationId: foreign.id, actor: 'planner' })).rejects.toBeInstanceOf(RelationIsNotLineageError);
    await expect(service({ failProvenance: true }).createOrigin({
      sourceType: 'idea', sourceId: 'idea-1', targetType: 'goal', targetId: 'goal-1', metadata, actor: 'planner',
    })).rejects.toBeInstanceOf(RelationProvenancePersistenceError);
    expect(await new SqliteRelationRepository(db).listHistory()).toEqual([foreign]);
  });
});
