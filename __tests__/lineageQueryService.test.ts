import {
  LineageEndpointNotFoundError,
  LineageQueryService,
  LineageQueryValidationError,
  traverseLineageEndpoints,
} from '../src/application/lineageQueryService';
import { createRecord } from '../src/domain/record';
import { createRelation } from '../src/domain/relation';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';
import type { SqliteDatabase } from '../src/persistence/database';

const T0 = '2026-08-13T09:00:00.000Z';
const T1 = '2026-08-13T10:00:00.000Z';
const T2 = '2026-08-13T11:00:00.000Z';
const metadata = { schema_version: 1, transformation_kind: 'refinement', context: { source: 'note' } };

describe('LineageQueryService (#72)', () => {
  let db: SqliteDatabase;
  let endpoints: Set<string>;
  let relations: SqliteRelationRepository;
  let records: SqliteRecordRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    endpoints = new Set(['idea:idea-1', 'idea:idea-2', 'goal:goal-1', 'task:task-1']);
    relations = new SqliteRelationRepository(db);
    records = new SqliteRecordRepository(db);
  });

  afterEach(async () => closeQuietly(db));

  function query() {
    return new LineageQueryService(relations, {
      endpoints: { exists: async (type, id) => endpoints.has(`${type}:${id}`) },
      records,
    });
  }

  async function addRelation(
    id: string,
    sourceType: 'idea' | 'goal',
    sourceId: string,
    relationType: 'origin_of' | 'transforms_into',
    targetType: 'goal' | 'task',
    targetId: string,
    createdAt: string,
    endedAt: string | null = null,
  ) {
    const relation = createRelation({
      sourceType, sourceId, relationType, targetType, targetId, metadata,
    }, { id, now: createdAt });
    const stored = endedAt === null ? relation : { ...relation, endedAt };
    await relations.add(stored);
    return stored;
  }

  it('returns immediate sources and derivatives with composable filters, complete relation facts, and stable ordering', async () => {
    const first = await addRelation('source-1', 'idea', 'idea-1', 'origin_of', 'goal', 'goal-1', T0);
    const ended = await addRelation('source-2', 'idea', 'idea-2', 'transforms_into', 'goal', 'goal-1', T1, T2);
    const derivative = await addRelation('derivative-1', 'goal', 'goal-1', 'transforms_into', 'task', 'task-1', T1);

    const sources = await query().listImmediateSources(
      { type: 'goal', id: 'goal-1' },
      { status: 'ended', relationType: 'transforms_into', overlaps: { start: T1, end: '2026-08-13T12:00:00.000Z' } },
    );
    expect(sources).toEqual([{
      direction: 'source', endpoint: { type: 'idea', id: 'idea-2' }, relation: ended, auditReferences: [],
    }]);
    expect((await query().listImmediateSources({ type: 'goal', id: 'goal-1' }))
      .map((entry) => entry.relation.id)).toEqual([first.id, ended.id]);
    expect(await query().listImmediateDerivatives({ type: 'goal', id: 'goal-1' }))
      .toEqual([{
        direction: 'derivative', endpoint: { type: 'task', id: 'task-1' }, relation: derivative, auditReferences: [],
      }]);
    expect(sources[0].relation).toMatchObject({ metadata, createdAt: T1, endedAt: T2 });
  });

  it('keeps ended lineage queryable from either endpoint and exposes relation-change audit references', async () => {
    const relation = await addRelation('ended-link', 'idea', 'idea-1', 'origin_of', 'goal', 'goal-1', T0, T1);
    await records.add(createRecord({
      recordType: PROVENANCE_RECORD_TYPE, description: 'Relation ended', actor: 'planner',
      occurredAt: T1, recordedAt: T1,
      payload: { action: 'relation_ended', relationId: relation.id, occurredAt: T1 },
    }, { id: 'audit-ended', now: T1 }));

    const sources = await query().listImmediateSources({ type: 'goal', id: 'goal-1' }, { status: 'ended' });
    const derivatives = await query().listImmediateDerivatives({ type: 'idea', id: 'idea-1' }, { status: 'ended' });
    expect(sources[0].auditReferences).toEqual([
      { recordId: 'audit-ended', action: 'relation_ended', occurredAt: T1, actor: 'planner' },
    ]);
    expect(derivatives[0].relation).toEqual(relation);
  });

  it('rejects unknown endpoints and invalid policy, temporal, and pagination inputs without partial effects', async () => {
    await expect(query().listImmediateSources({ type: 'goal', id: 'missing' }))
      .rejects.toBeInstanceOf(LineageEndpointNotFoundError);
    await expect(query().listImmediateSources({ type: 'goal', id: 'goal-1' }, { relationType: 'related_to' as never }))
      .rejects.toBeInstanceOf(LineageQueryValidationError);
    await expect(query().listImmediateSources({ type: 'goal', id: 'goal-1' }, { limit: 0 }))
      .rejects.toBeInstanceOf(LineageQueryValidationError);
    await expect(query().listImmediateSources({ type: 'goal', id: 'goal-1' }, {
      overlaps: { start: T2, end: T1 },
    })).rejects.toBeInstanceOf(LineageQueryValidationError);
    expect(await relations.listHistory()).toEqual([]);
  });

  it('uses a bounded visited-set traversal to terminate duplicate-safe on cyclic legacy data', async () => {
    const a = { type: 'idea' as const, id: 'idea-1' };
    const b = { type: 'goal' as const, id: 'goal-1' };
    const c = { type: 'task' as const, id: 'task-1' };
    const next = async (endpoint: typeof a | typeof b | typeof c) => {
      if (endpoint.id === a.id) return [b, b];
      if (endpoint.id === b.id) return [c];
      return [a];
    };
    await expect(traverseLineageEndpoints(a, { maxDepth: 10, maxVisited: 10 }, next))
      .resolves.toEqual([b, c]);
    await expect(traverseLineageEndpoints(a, { maxDepth: 10, maxVisited: 2 }, next))
      .resolves.toEqual([b]);
  });
});
