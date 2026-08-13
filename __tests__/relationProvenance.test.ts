import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import type { CoreEntityType } from '../src/domain/entityTypes';
import { createRelation } from '../src/domain/relation';
import {
  buildRelationChangePayload,
  filterRelationMetadata,
  relationChangePayloadToJson,
} from '../src/domain/relationProvenance';

const CREATED_AT = '2026-08-13T09:00:00.000Z';
const ENDED_AT = '2026-08-13T10:00:00.000Z';

function relation(sourceType: CoreEntityType, targetType: CoreEntityType) {
  return createRelation(
    {
      sourceType,
      sourceId: `${sourceType}-1`,
      relationType: 'related_to',
      targetType,
      targetId: `${targetType}-1`,
      metadata: {
        purpose: 'planning',
        amount: '2.5',
        credential: 'must not enter history',
        nested: { private: true },
      },
    },
    { id: `${sourceType}-${targetType}-relation`, now: CREATED_AT },
  );
}

describe('relation-change provenance payload', () => {
  it('supports every one of the eight endpoint discriminators without an entities table', () => {
    for (const sourceType of CORE_ENTITY_TYPES) {
      for (const targetType of CORE_ENTITY_TYPES) {
        const payload = buildRelationChangePayload({
          action: 'relation_created',
          relation: relation(sourceType, targetType),
          actor: 'planner',
          occurredAt: CREATED_AT,
        });
        expect(payload.sourceType).toBe(sourceType);
        expect(payload.targetType).toBe(targetType);
        expect(payload.created_at).toBe(CREATED_AT);
        expect(payload.ended_at).toBeUndefined();
      }
    }
    expect(CORE_ENTITY_TYPES).toHaveLength(8);
  });

  it('captures explicit temporal facts and retains the immutable creation time on end', () => {
    const created = relation('goal', 'resource');
    const ended = { ...created, endedAt: ENDED_AT };
    const payload = buildRelationChangePayload({
      action: 'relation_ended',
      relation: ended,
      actor: 'planner',
      occurredAt: ENDED_AT,
    });

    expect(payload).toMatchObject({
      action: 'relation_ended',
      relationId: created.id,
      actor: 'planner',
      occurredAt: ENDED_AT,
      created_at: CREATED_AT,
      ended_at: ENDED_AT,
    });
    expect(relationChangePayloadToJson(payload)).toMatchObject({
      created_at: CREATED_AT,
      ended_at: ENDED_AT,
    });
  });

  it('filters metadata through an allowlist and gives redaction precedence', () => {
    const relationWithMetadata = relation('goal', 'resource');
    const payload = buildRelationChangePayload(
      {
        action: 'relation_created',
        relation: relationWithMetadata,
        actor: 'planner',
        occurredAt: CREATED_AT,
      },
      {
        allowlist: ['purpose', 'credential', 'nested'],
        redacted: ['credential', 'nested'],
      },
    );
    expect(payload.metadata).toEqual({ purpose: 'planning' });
    expect(filterRelationMetadata(['not', 'named'])).toBeNull();
    expect(filterRelationMetadata('not named')).toBeNull();
  });

  it('rejects mismatched action temporal facts', () => {
    const created = relation('goal', 'resource');
    expect(() =>
      buildRelationChangePayload({
        action: 'relation_created',
        relation: created,
        actor: 'planner',
        occurredAt: ENDED_AT,
      }),
    ).toThrow(/occurredAt/);
    expect(() =>
      buildRelationChangePayload({
        action: 'relation_ended',
        relation: created,
        actor: 'planner',
        occurredAt: ENDED_AT,
      }),
    ).toThrow(/ended Relation/);
  });
});
