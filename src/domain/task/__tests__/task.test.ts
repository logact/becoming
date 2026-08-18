import { Task } from '../Task';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

describe('Task', () => {
  it('is created in todo status with optional goal and project links', () => {
    const task = Task.create({ id: 't1', title: 'Train', goalId: 'g1', projectId: 'p1', now: t0 });
    expect(task.status).toBe('todo');
    expect(task.goalId).toBe('g1');
    expect(task.projectId).toBe('p1');
    expect(task.createdAt).toBe(t0);
    expect(task.updatedAt).toBe(t0);
  });

  it('follows the valid transition path and bumps updatedAt', () => {
    const task = Task.create({ id: 't1', title: 'Train', now: t0 });
    task.start(t1);
    expect(task.status).toBe('doing');
    expect(task.updatedAt).toBe(t1);
    task.pause(t2);
    expect(task.status).toBe('paused');
    task.resume(t2);
    expect(task.status).toBe('doing');
    task.complete(t2);
    expect(task.status).toBe('done');
    task.reopen(t2);
    expect(task.status).toBe('todo');
  });

  it('rejects invalid transitions', () => {
    const task = Task.create({ id: 't1', title: 'Train', now: t0 });
    expect(() => task.pause(t1)).toThrow(DomainError);
    expect(() => task.resume(t1)).toThrow(DomainError);
    expect(() => task.complete(t1)).toThrow(DomainError);
    expect(() => task.reopen(t1)).toThrow(DomainError);

    task.start(t1);
    task.pause(t2);
    expect(() => task.complete(t2)).toThrow(DomainError);
  });

  it('archives without touching status', () => {
    const task = Task.create({ id: 't1', title: 'Train', now: t0 });
    task.start(t1);
    task.archive(t2);
    expect(task.archived).toBe(true);
    expect(task.status).toBe('doing');
    task.unarchive(t2);
    expect(task.archived).toBe(false);
    expect(task.status).toBe('doing');
  });

  it('adds and removes labels idempotently', () => {
    const task = Task.create({ id: 't1', title: 'Train', now: t0 });
    task.addLabel('l1');
    task.addLabel('l1');
    expect(task.labelIds).toEqual(['l1']);
    task.removeLabel('l1');
    task.removeLabel('l1');
    expect(task.labelIds).toEqual([]);
  });

  it('sets and clears a due date', () => {
    const task = Task.create({ id: 't1', title: 'Train', now: t0 });
    expect(task.due).toBeUndefined();
    task.setDue(t1, t1);
    expect(task.due).toBe(t1);
    expect(task.updatedAt).toBe(t1);
    task.clearDue(t2);
    expect(task.due).toBeUndefined();
    expect(task.updatedAt).toBe(t2);
  });

  it('accepts a due at creation', () => {
    const task = Task.create({ id: 't1', title: 'Train', due: t1, now: t0 });
    expect(task.due).toBe(t1);
  });

  it('fails from doing or paused and rejects other statuses', () => {
    const task = Task.create({ id: 't1', title: 'Train', now: t0 });
    expect(() => task.fail(t1)).toThrow(DomainError);

    task.start(t1);
    task.fail(t2);
    expect(task.status).toBe('failed');
    expect(task.updatedAt).toBe(t2);
    expect(() => task.fail(t2)).toThrow(DomainError);

    const paused = Task.create({ id: 't2', title: 'Stretch', now: t0 });
    paused.start(t1);
    paused.pause(t2);
    paused.fail(t2);
    expect(paused.status).toBe('failed');

    const done = Task.create({ id: 't3', title: 'Rest', now: t0 });
    done.start(t1);
    done.complete(t2);
    expect(() => done.fail(t2)).toThrow(DomainError);
  });

  it('reopens from done or failed', () => {
    const task = Task.create({ id: 't1', title: 'Train', now: t0 });
    task.start(t1);
    task.complete(t2);
    task.reopen(t2);
    expect(task.status).toBe('todo');

    task.start(t2);
    task.fail(t2);
    task.reopen(t2);
    expect(task.status).toBe('todo');
    expect(task.updatedAt).toBe(t2);
  });

  it('flags a due within the window or already past as imminent', () => {
    const dueSoon = Task.create({ id: 't1', title: 'Train', due: t1, now: t0 });
    expect(dueSoon.isDueImminent(HOUR_MS, t0)).toBe(true);
    expect(dueSoon.isDueImminent(HOUR_MS - 1, t0)).toBe(false);

    const pastDue = Task.create({ id: 't2', title: 'Stretch', due: t0, now: t0 });
    expect(pastDue.isDueImminent(HOUR_MS, t1)).toBe(true);
  });

  it('does not flag a due outside the window or a missing due', () => {
    const dueLater = Task.create({ id: 't1', title: 'Train', due: t2, now: t0 });
    expect(dueLater.isDueImminent(HOUR_MS, t0)).toBe(false);

    const noDue = Task.create({ id: 't2', title: 'Stretch', now: t0 });
    expect(noDue.isDueImminent(HOUR_MS, t0)).toBe(false);
  });

  it('does not flag done, failed, or archived tasks', () => {
    const done = Task.create({ id: 't1', title: 'Train', due: t1, now: t0 });
    done.start(t0);
    done.complete(t0);
    expect(done.isDueImminent(HOUR_MS, t0)).toBe(false);

    const failed = Task.create({ id: 't2', title: 'Stretch', due: t1, now: t0 });
    failed.start(t0);
    failed.fail(t0);
    expect(failed.isDueImminent(HOUR_MS, t0)).toBe(false);

    const archived = Task.create({ id: 't3', title: 'Rest', due: t1, now: t0 });
    archived.archive(t0);
    expect(archived.isDueImminent(HOUR_MS, t0)).toBe(false);
  });
});
