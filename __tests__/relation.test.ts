import {
  RELATION_TYPES,
  createRelation,
  validateRelation,
} from '../src/domain/relation';
import type { Relation } from '../src/domain/relation';
import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { RelationQueryService } from '../src/application/relationQueryService';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED_AT = '2026-08-12T14:00:00.000Z';
const TASK_ID = '3f6f2c34-0c1f-4f0d-9f8c-2a1b0c9d8e7f';
const RESOURCE_ID = '9b1c2d3e-4f5a-4b6c-8d9e-0f1a2b3c4d5e';

function validInput() {
  return {
    sourceType: 'task',
    sourceId: TASK_ID,
    relationType: 'constrained_by',
    targetType: 'resource',
    targetId: RESOURCE_ID,
  };
}

describe('relation domain model', () => {
  it('creates an active Relation with fresh id and null optionals', () => {
    const relation = createRelation(validInput());

    expect(relation.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(relation.createdAt).not.toBe('');
    expect(relation.endedAt).toBeNull();
    expect(relation.metadata).toBeNull();
    expect(() => validateRelation(relation)).not.toThrow();
  });

  it('supports every documented relation type', () => {
    for (const relationType of RELATION_TYPES) {
      expect(() =>
        createRelation({ ...validInput(), relationType }),
      ).not.toThrow();
    }
  });

  it('accepts every core entity type as source or target', () => {
    for (const entityType of CORE_ENTITY_TYPES) {
      expect(() =>
        createRelation({ ...validInput(), sourceType: entityType }),
      ).not.toThrow();
      expect(() =>
        createRelation({ ...validInput(), targetType: entityType }),
      ).not.toThrow();
    }
  });

  it('never references Labels, States, or State Transitions', () => {
    for (const nonCore of [
      'label',
      'entity_label',
      'workflow_state',
      'workflow_state_transition',
      'project_state',
      'project_state_transition',
    ]) {
      expect(() =>
        createRelation({ ...validInput(), sourceType: nonCore }),
      ).toThrow(/core entity type/);
      expect(() =>
        createRelation({ ...validInput(), targetType: nonCore }),
      ).toThrow(/core entity type/);
    }
  });

  it('rejects blank endpoint ids', () => {
    expect(() => createRelation({ ...validInput(), sourceId: '  ' })).toThrow(
      /sourceId/,
    );
    expect(() => createRelation({ ...validInput(), targetId: '' })).toThrow(
      /targetId/,
    );
  });

  it('rejects an unsupported relation type with an explicit error', () => {
    expect(() =>
      createRelation({ ...validInput(), relationType: 'likes' }),
    ).toThrow(/Unsupported relation type/);
    expect(() => createRelation({ ...validInput(), relationType: '' })).toThrow(
      /relationType/,
    );
  });

  it('extends the relation-type policy explicitly', () => {
    const relation = createRelation(
      { ...validInput(), relationType: 'funds' },
      { supportedRelationTypes: [...RELATION_TYPES, 'funds'] },
    );

    expect(relation.relationType).toBe('funds');
    expect(() =>
      validateRelation(relation, [...RELATION_TYPES, 'funds']),
    ).not.toThrow();
    expect(() => validateRelation(relation)).toThrow(
      /Unsupported relation type/,
    );
  });

  it('keeps structured metadata belonging to the relationship', () => {
    const metadata = {
      constraint_type: 'deadline',
      value: '2026-08-20T18:00:00',
    };
    const relation = createRelation({ ...validInput(), metadata });

    expect(relation.metadata).toEqual(metadata);
  });

  it('rejects non-serializable metadata before persistence', () => {
    expect(() =>
      createRelation({ ...validInput(), metadata: { f: () => 1 } }),
    ).toThrow(/JSON/);
    expect(() =>
      createRelation({ ...validInput(), metadata: Number.NaN }),
    ).toThrow(/finite/);
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => createRelation({ ...validInput(), metadata: circular })).toThrow(
      /circular/,
    );
  });

  it('accepts an ended Relation whose interval is valid', () => {
    const ended: Relation = {
      ...createRelation(validInput(), { now: CREATED_AT }),
      endedAt: '2026-08-12T15:00:00.000Z',
    };

    expect(() => validateRelation(ended)).not.toThrow();
  });

  it('rejects an active interval that ends before it starts', () => {
    const ended: Relation = {
      ...createRelation(validInput(), { now: CREATED_AT }),
      endedAt: '2026-08-12T13:59:59.999Z',
    };

    expect(() => validateRelation(ended)).toThrow(/endedAt/);
  });

  it('rejects missing or malformed interval timestamps', () => {
    const relation = createRelation(validInput(), { now: CREATED_AT });

    expect(() =>
      validateRelation({ ...relation, createdAt: 'not a timestamp' }),
    ).toThrow(/createdAt/);
    expect(() =>
      validateRelation({ ...relation, endedAt: 'eventually' }),
    ).toThrow(/endedAt/);
  });
});

describe('RelationRepository contract', () => {
  it('round-trips a Relation with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    const relation = createRelation(
      {
        ...validInput(),
        metadata: {
          constraint_type: 'deadline',
          value: '2026-08-20T18:00:00',
          notes: ['per release plan', null],
        },
      },
      { now: CREATED_AT },
    );

    await repository.add(relation);
    const loaded = await repository.getById(relation.id);

    expect(loaded).toEqual(relation);
    await closeQuietly(db);
  });

  it('round-trips omitted metadata as null', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    const relation = createRelation(validInput());

    await repository.add(relation);
    const loaded = await repository.getById(relation.id);

    expect(loaded).toEqual(relation);
    expect(loaded?.metadata).toBeNull();
    expect(loaded?.endedAt).toBeNull();
    await closeQuietly(db);
  });

  it('resolves an ended Relation so history stays resolvable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    const ended: Relation = {
      ...createRelation(validInput(), { now: CREATED_AT }),
      endedAt: '2026-08-12T15:00:00.000Z',
    };

    await repository.add(ended);
    const loaded = await repository.getById(ended.id);

    expect(loaded).toEqual(ended);
    expect(loaded?.endedAt).toBe('2026-08-12T15:00:00.000Z');
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);

    expect(await repository.getById('no-such-relation')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    const relation = createRelation(validInput());

    await repository.add(relation);
    await expect(repository.add(relation)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate before persistence', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    const invalid = {
      ...createRelation(validInput()),
      sourceType: 'label',
    } as unknown as Relation;

    await expect(repository.add(invalid)).rejects.toThrow(/core entity type/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });
});

describe('relations schema shape', () => {
  it('has exactly the documented columns and no foreign keys', async () => {
    const db = await createTestDatabase();
    const columns = (
      await db.getAllAsync<{ name: string; notnull: number }>(
        `PRAGMA table_info(relations)`,
      )
    ).map((c) => c.name);
    expect(columns).toEqual([
      'id',
      'source_type',
      'source_id',
      'relation_type',
      'target_type',
      'target_id',
      'metadata',
      'created_at',
      'ended_at',
    ]);

    const foreignKeys = await db.getAllAsync(
      `PRAGMA foreign_key_list(relations)`,
    );
    expect(foreignKeys).toEqual([]);

    const ddl = await db.getFirstAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'relations'`,
    );
    expect(ddl?.sql.toUpperCase()).not.toMatch(/FOREIGN\s+KEY/);
    expect(ddl?.sql.toUpperCase()).not.toMatch(/REFERENCES/);
    await closeQuietly(db);
  });
});

describe('RelationRepository queries', () => {
  it('combines directional, status, and temporal filters with half-open boundaries', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    const first = createRelation(
      { ...validInput(), metadata: { position: 1 } },
      { id: 'a', now: '2026-08-12T10:00:00.000Z' },
    );
    const ended = { ...first, endedAt: '2026-08-12T11:00:00.000Z' };
    const second = createRelation(
      { ...validInput(), metadata: { position: 2 } },
      { id: 'b', now: '2026-08-12T11:00:00.000Z' },
    );
    const reverse = createRelation(
      {
        sourceType: 'resource', sourceId: RESOURCE_ID, relationType: 'uses',
        targetType: 'task', targetId: TASK_ID,
      },
      { id: 'c', now: '2026-08-12T11:00:00.000Z' },
    );
    await repository.add(ended);
    await repository.add(second);
    await repository.add(reverse);

    expect(await repository.listCurrent({ source: { type: 'task', id: TASK_ID } }))
      .toEqual([second]);
    expect(await repository.listHistory({ target: { type: 'resource', id: RESOURCE_ID } }))
      .toEqual([ended, second]);
    expect(await repository.list({
      source: { type: 'task', id: TASK_ID },
      target: { type: 'resource', id: RESOURCE_ID },
      relationType: 'constrained_by', status: 'ended',
      overlaps: { start: '2026-08-12T10:30:00.000Z', end: '2026-08-12T11:00:00.000Z' },
    })).toEqual([ended]);
    expect(await repository.list({ at: '2026-08-12T10:00:00.000Z' })).toEqual([ended]);
    expect(await repository.list({ at: '2026-08-12T11:00:00.000Z' }))
      .toEqual([second, reverse]);
    await closeQuietly(db);
  });

  it('uses created_at and id as a stable total order for offset pages', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    for (const id of ['c', 'a', 'b']) {
      await repository.add(createRelation(validInput(), {
        id, now: '2026-08-12T10:00:00.000Z',
      }));
    }
    expect((await repository.list({ limit: 2 })).map((relation) => relation.id))
      .toEqual(['a', 'b']);
    expect((await repository.list({ limit: 2, offset: 2 })).map((relation) => relation.id))
      .toEqual(['c']);
    await closeQuietly(db);
  });

  it('reports missing logical endpoints during requested hydration without changing direction', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRelationRepository(db);
    const relation = createRelation(validInput(), { id: 'dangling', now: CREATED_AT });
    await repository.add(relation);
    const service = new RelationQueryService(repository, {
      async resolve(endpoint) {
        return endpoint.id === TASK_ID ? { title: 'Task' } : null;
      },
    });

    const [result] = await service.listHydrated({ target: { type: 'resource', id: RESOURCE_ID } });

    expect(result.relation).toEqual(relation);
    expect(result.source).toEqual({ title: 'Task' });
    expect(result.target).toBeNull();
    expect(result.anomalies).toEqual([{
      kind: 'missing_endpoint', endpoint: 'target', entityType: 'resource', entityId: RESOURCE_ID,
    }]);
    await closeQuietly(db);
  });
});
