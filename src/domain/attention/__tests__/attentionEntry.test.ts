import { AttentionEntry } from '../AttentionEntry';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');

describe('AttentionEntry', () => {
  it('creates a pin entry', () => {
    const entry = AttentionEntry.create({
      id: 'a1',
      targetType: 'goal',
      targetId: 'g1',
      kind: 'pin',
      now: t0,
    });
    expect(entry.id).toBe('a1');
    expect(entry.targetType).toBe('goal');
    expect(entry.targetId).toBe('g1');
    expect(entry.kind).toBe('pin');
    expect(entry.createdAt).toBe(t0);
  });

  it('creates a dismiss entry', () => {
    const entry = AttentionEntry.create({
      id: 'a2',
      targetType: 'task',
      targetId: 't1',
      kind: 'dismiss',
      now: t0,
    });
    expect(entry.targetType).toBe('task');
    expect(entry.kind).toBe('dismiss');
  });

  it('rejects a blank targetId', () => {
    expect(() =>
      AttentionEntry.create({ id: 'a1', targetType: 'goal', targetId: '  ', kind: 'pin', now: t0 }),
    ).toThrow(DomainError);
  });
});
