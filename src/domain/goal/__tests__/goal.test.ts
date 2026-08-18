import { Goal } from '../Goal';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');

describe('Goal', () => {
  it('is created in todo status', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run a marathon', now: t0 });
    expect(goal.status).toBe('todo');
    expect(goal.archived).toBe(false);
    expect(goal.createdAt).toBe(t0);
    expect(goal.updatedAt).toBe(t0);
  });

  it('follows the valid transition path and bumps updatedAt', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    goal.start(t1);
    expect(goal.status).toBe('doing');
    expect(goal.updatedAt).toBe(t1);
    goal.pause(t2);
    expect(goal.status).toBe('paused');
    goal.resume(t2);
    expect(goal.status).toBe('doing');
    goal.complete(t2);
    expect(goal.status).toBe('done');
    goal.reopen(t2);
    expect(goal.status).toBe('todo');
  });

  it('rejects invalid transitions', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    expect(() => goal.pause(t1)).toThrow(DomainError);
    expect(() => goal.resume(t1)).toThrow(DomainError);
    expect(() => goal.complete(t1)).toThrow(DomainError);
    expect(() => goal.reopen(t1)).toThrow(DomainError);

    goal.start(t1);
    goal.pause(t2);
    expect(() => goal.complete(t2)).toThrow(DomainError);
  });

  it('archives without touching status', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    goal.start(t1);
    goal.archive(t2);
    expect(goal.archived).toBe(true);
    expect(goal.status).toBe('doing');
    goal.unarchive(t2);
    expect(goal.archived).toBe(false);
    expect(goal.status).toBe('doing');
  });

  it('adds and removes labels idempotently', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    goal.addLabel('l1');
    goal.addLabel('l1');
    expect(goal.labelIds).toEqual(['l1']);
    goal.removeLabel('l1');
    goal.removeLabel('l1');
    expect(goal.labelIds).toEqual([]);
  });

  it('rejects an empty rename', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    expect(() => goal.rename('  ', t1)).toThrow(DomainError);
    goal.rename('Swim', t1);
    expect(goal.title).toBe('Swim');
    expect(goal.updatedAt).toBe(t1);
  });
});
