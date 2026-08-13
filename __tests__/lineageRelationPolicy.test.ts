import { createRelation } from '../src/domain/relation';
import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import {
  DEFAULT_RELATION_POLICIES,
  LINEAGE_ENDPOINT_MATRIX,
  LINEAGE_RELATION_TYPES,
  validateLineageMetadata,
} from '../src/domain/relationPolicy';
import {
  DEFAULT_LINEAGE_METADATA_SELECTION_POLICY,
  filterRelationMetadata,
} from '../src/domain/relationProvenance';
import {
  RelationCycleError,
  RelationTargetCardinalityError,
  RelationService,
} from '../src/application/relationService';
import { LineageQueryService } from '../src/application/lineageQueryService';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';
import type { SqliteDatabase } from '../src/persistence/database';

const NOW = '2026-08-13T12:00:00.000Z';
const lineageMetadata = {
  schema_version: 1,
  transformation_kind: 'refinement',
  rationale: 'turn a captured idea into an executable goal',
  actor: { type: 'user', id: 'planner' },
  tool: { name: 'becoming', version: '1' },
  source_fragments: [{ source_type: 'idea', source_id: 'idea-1', locator: 'paragraph:2' }],
};

describe('lineage relation policies', () => {
  it('declares canonical source-to-derivative policies for all 8 x 8 endpoint pairs', () => {
    expect(LINEAGE_RELATION_TYPES).toEqual(['origin_of', 'transforms_into']);
    for (const relationType of LINEAGE_RELATION_TYPES) {
      const policy = DEFAULT_RELATION_POLICIES[relationType];
      expect(policy.rejectsCycles).toBe(true);
      for (const sourceType of CORE_ENTITY_TYPES) {
        expect(LINEAGE_ENDPOINT_MATRIX[sourceType]).toEqual(CORE_ENTITY_TYPES);
        for (const targetType of CORE_ENTITY_TYPES) {
          expect(policy.allowsDirection(sourceType, targetType)).toBe(true);
        }
      }
    }
    expect(DEFAULT_RELATION_POLICIES.origin_of.maximumActiveRelationsForTarget).toBe(1);
    expect(DEFAULT_RELATION_POLICIES.transforms_into.maximumActiveRelationsForTarget).toBeUndefined();
  });

  it('requires versioned transformation metadata and validates optional context', () => {
    expect(() => validateLineageMetadata(lineageMetadata)).not.toThrow();
    expect(() => validateLineageMetadata(null)).toThrow(/JSON object/);
    expect(() => validateLineageMetadata({ ...lineageMetadata, schema_version: 2 })).toThrow(/schema_version/);
    expect(() => validateLineageMetadata({ schema_version: 1, transformation_kind: ' ' })).toThrow(/transformation_kind/);
    expect(() => validateLineageMetadata({ ...lineageMetadata, unknown: true })).toThrow(/not supported/);
    expect(() => validateLineageMetadata({ ...lineageMetadata, source_fragments: [{ source_type: 'label', source_id: 'x', locator: 'x' }] })).toThrow(/core entity type/);
  });

  it('requires explicit redaction for provenance metadata selection', () => {
    expect(filterRelationMetadata(lineageMetadata, DEFAULT_LINEAGE_METADATA_SELECTION_POLICY)).toEqual({
      schema_version: 1,
      transformation_kind: 'refinement',
      actor: { type: 'user', id: 'planner' },
      tool: { name: 'becoming', version: '1' },
    });
    const filtered = filterRelationMetadata(
      { transformation_kind: 'refinement', rationale: 'private', tool: { name: 'agent' } },
      { allowlist: ['transformation_kind', 'rationale', 'tool'], redacted: ['rationale', 'tool'] },
    );
    expect(filtered).toEqual({ transformation_kind: 'refinement' });
  });
});

describe('lineage application policy', () => {
  let db: SqliteDatabase;
  let id = 0;
  const endpoints = new Set([
    'idea:idea-1', 'goal:goal-1', 'task:task-1', 'record:record-1',
  ]);

  beforeEach(async () => { db = await createTestDatabase(); id = 0; });
  afterEach(async () => { await closeQuietly(db); });

  function service() {
    return new RelationService({
      unitOfWork: sqliteUnitOfWork(db),
      relations: (context) => new SqliteRelationRepository(context),
      endpoints: () => ({
        exists: async (type, entityId) => endpoints.has(`${type}:${entityId}`),
      }),
      clock: { now: () => NOW },
      ids: { newId: () => `lineage-${++id}` },
    });
  }

  function command(overrides: Record<string, unknown> = {}) {
    return {
      sourceType: 'idea', sourceId: 'idea-1', relationType: 'origin_of',
      targetType: 'goal', targetId: 'goal-1', metadata: lineageMetadata,
      actor: 'planner', ...overrides,
    };
  }

  it('enforces endpoints, target cardinality, and direct/indirect constrained cycles', async () => {
    const relations = service();
    await expect(relations.createRelation(command({ sourceId: 'absent' }))).rejects.toThrow(/source endpoint/);
    await expect(relations.createRelation(command({ sourceType: 'label' }))).rejects.toThrow(/core entity type/);
    await expect(relations.createRelation(command({ sourceId: '   ' }))).rejects.toThrow(/sourceId/);
    await relations.createRelation(command());
    await expect(relations.createRelation(command({ sourceType: 'record', sourceId: 'record-1' }))).rejects.toBeInstanceOf(RelationTargetCardinalityError);
    await relations.createRelation(command({ relationType: 'transforms_into', sourceType: 'goal', sourceId: 'goal-1', targetType: 'task', targetId: 'task-1' }));
    await expect(relations.createRelation(command({ relationType: 'transforms_into', sourceType: 'task', sourceId: 'task-1', targetType: 'idea', targetId: 'idea-1' }))).rejects.toBeInstanceOf(RelationCycleError);
    await expect(relations.createRelation(command({ relationType: 'transforms_into', sourceType: 'task', sourceId: 'task-1', targetType: 'task', targetId: 'task-1' }))).rejects.toBeInstanceOf(RelationCycleError);
  });

  it('reads immediate sources and derivatives from active rows only, preserving ended history', async () => {
    const relations = service();
    const link = await relations.createRelation(command());
    const reader = new LineageQueryService(new SqliteRelationRepository(db));
    expect(await reader.immediateSources({ type: 'goal', id: 'goal-1' })).toEqual([link]);
    expect(await reader.immediateDerivatives({ type: 'idea', id: 'idea-1' })).toEqual([link]);
    const ended = await relations.endRelation({ relationId: link.id, actor: 'planner', endedAt: '2026-08-13T13:00:00.000Z' });
    expect(ended.endedAt).toBe('2026-08-13T13:00:00.000Z');
    expect(await reader.immediateSources({ type: 'goal', id: 'goal-1' })).toEqual([]);
    expect(await new SqliteRelationRepository(db).listHistory({ relationType: 'origin_of' })).toEqual([ended]);
  });

  it('uses only independent relation rows, with no endpoint schema mutation or foreign keys', async () => {
    const relation = createRelation(command(), { id: 'domain-lineage', now: NOW });
    expect(relation.relationType).toBe('origin_of');
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(relations)');
    expect(columns.map((column) => column.name)).not.toContain('origin_id');
    expect(await db.getAllAsync('PRAGMA foreign_key_list(relations)')).toEqual([]);
  });
});
