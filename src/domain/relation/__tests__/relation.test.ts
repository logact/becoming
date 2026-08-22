import { DomainError } from '../../shared/errors';
import { Relation } from '../Relation';

const now = new Date('2026-01-01T01:00:00Z');

describe('Relation', () => {
  it('sets fields exactly as given', () => {
    const relation = Relation.create({
      id: 'rel1',
      sourceType: 'task',
      sourceId: 't1',
      targetType: 'idea',
      targetId: 'i1',
      kind: 'derivedFrom',
      now,
    });
    expect(relation.id).toBe('rel1');
    expect(relation.sourceType).toBe('task');
    expect(relation.sourceId).toBe('t1');
    expect(relation.targetType).toBe('idea');
    expect(relation.targetId).toBe('i1');
    expect(relation.kind).toBe('derivedFrom');
    expect(relation.createdAt).toBe(now);
  });

  it('allows links between different models of the same type', () => {
    const relation = Relation.create({
      id: 'rel2',
      sourceType: 'goal',
      sourceId: 'g1',
      targetType: 'goal',
      targetId: 'g2',
      kind: 'dependsOn',
      now,
    });
    expect(relation.sourceId).not.toBe(relation.targetId);
  });

  it.each(['goal', 'task', 'note'] as const)('creates a %s derived-from-Idea relation', (sourceType) => {
    const relation = Relation.derivedFromIdea({
      id: `rel-${sourceType}`,
      sourceType,
      sourceId: `${sourceType}-1`,
      ideaId: 'idea-1',
      now,
    });
    expect(relation).toMatchObject({
      sourceType,
      sourceId: `${sourceType}-1`,
      targetType: 'idea',
      targetId: 'idea-1',
      kind: 'derivedFrom',
    });
  });

  it('rejects a relation linking a model to itself', () => {
    expect(() =>
      Relation.create({
        id: 'rel3',
        sourceType: 'goal',
        sourceId: 'g1',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'dependsOn',
        now,
      }),
    ).toThrow(DomainError);
  });

  it('restores from persisted fields', () => {
    const restored = Relation.restore({
      id: 'rel1',
      sourceType: 'task',
      sourceId: 't1',
      targetType: 'idea',
      targetId: 'i1',
      kind: 'derivedFrom',
      createdAt: now,
      detail: 'from brainstorm',
    });
    expect(restored.id).toBe('rel1');
    expect(restored.sourceType).toBe('task');
    expect(restored.sourceId).toBe('t1');
    expect(restored.targetType).toBe('idea');
    expect(restored.targetId).toBe('i1');
    expect(restored.kind).toBe('derivedFrom');
    expect(restored.createdAt).toBe(now);
    expect(restored.detail).toBe('from brainstorm');
  });
});
