import { Task } from '../Task';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');
const localDayBefore = new Date(2026, 0, 14, 12, 0);
const localDayStart = new Date(2026, 0, 15, 12, 0);
const localDayAfter = new Date(2026, 0, 16, 12, 0);
const HOUR_MS = 60 * 60 * 1000;

describe('Task', () => {
  it('is created in todo status with a project link', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    expect(task.status).toBe('todo');
    expect(task.projectId).toBe('p1');
    expect(task.goalId).toBeUndefined();
    expect(task.milestoneId).toBeUndefined();
    expect(task.createdAt).toBe(t0);
    expect(task.updatedAt).toBe(t0);
  });

  it('accepts an optional goal and milestone link at creation', () => {
    const task = Task.create({
      id: 't1',
      title: 'Train',
      projectId: 'p1',
      goalId: 'g1',
      milestoneId: 'm1',
      now: t0,
    });
    expect(task.goalId).toBe('g1');
    expect(task.milestoneId).toBe('m1');
  });

  it('assigns a goal and bumps updatedAt', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    task.assignGoal('g1', t1);
    expect(task.goalId).toBe('g1');
    expect(task.updatedAt).toBe(t1);
    task.assignGoal('g2', t2);
    expect(task.goalId).toBe('g2');
    expect(task.updatedAt).toBe(t2);
  });

  it('assigns and clears a milestone link', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    task.assignMilestone('m1', t1);
    expect(task.milestoneId).toBe('m1');
    expect(task.updatedAt).toBe(t1);
    task.assignMilestone(undefined, t2);
    expect(task.milestoneId).toBeUndefined();
    expect(task.updatedAt).toBe(t2);
  });

  it('follows the valid transition path and bumps updatedAt', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
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
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    expect(() => task.pause(t1)).toThrow(DomainError);
    expect(() => task.resume(t1)).toThrow(DomainError);
    expect(() => task.complete(t1)).toThrow(DomainError);
    expect(() => task.reopen(t1)).toThrow(DomainError);

    task.start(t1);
    task.pause(t2);
    expect(() => task.complete(t2)).toThrow(DomainError);
  });

  it('archives without touching status', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    task.start(t1);
    task.archive(t2);
    expect(task.archived).toBe(true);
    expect(task.status).toBe('doing');
    task.unarchive(t2);
    expect(task.archived).toBe(false);
    expect(task.status).toBe('doing');
  });

  it('adds and removes labels idempotently', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    task.addLabel('l1');
    task.addLabel('l1');
    expect(task.labelIds).toEqual(['l1']);
    task.removeLabel('l1');
    task.removeLabel('l1');
    expect(task.labelIds).toEqual([]);
  });

  it('sets and clears a due date', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    expect(task.due).toBeUndefined();
    task.setDue(t1, t1);
    expect(task.due).toBe(t1);
    expect(task.updatedAt).toBe(t1);
    task.clearDue(t2);
    expect(task.due).toBeUndefined();
    expect(task.updatedAt).toBe(t2);
  });

  it('accepts a due at creation', () => {
    const task = Task.create({ id: 't1', title: 'Train', due: t1, projectId: 'p1', now: t0 });
    expect(task.due).toBe(t1);
  });

  it('accepts an optional valid schedule at creation', () => {
    const task = Task.create({
      id: 't1',
      title: 'Train',
      startAt: t1,
      due: t2,
      projectId: 'p1',
      now: t0,
    });
    expect(task.startAt).toBe(t1);
    expect(task.due).toBe(t2);

    const sameDate = Task.create({
      id: 't2',
      title: 'Stretch',
      startAt: t1,
      due: t1,
      projectId: 'p1',
      now: t0,
    });
    expect(sameDate.startAt).toBe(t1);
    expect(sameDate.due).toBe(t1);
  });

  it('accepts a start later than the due clock time on the same local calendar date', () => {
    const due = new Date(2026, 0, 15, 8, 0);
    const startAt = new Date(2026, 0, 15, 18, 0);

    const task = Task.create({ id: 't1', title: 'Train', startAt, due, projectId: 'p1', now: t0 });

    expect(task.startAt).toBe(startAt);
    expect(task.due).toBe(due);
  });

  it('rejects an invalid schedule at creation', () => {
    expect(() =>
      Task.create({
        id: 't1',
        title: 'Train',
        startAt: localDayAfter,
        due: localDayStart,
        projectId: 'p1',
        now: t0,
      }),
    ).toThrow(DomainError);
  });

  it('rejects a start on the next local calendar date', () => {
    const due = new Date(2026, 0, 15, 18, 0);
    const startAt = new Date(2026, 0, 16, 8, 0);

    expect(() =>
      Task.create({ id: 't1', title: 'Train', startAt, due, projectId: 'p1', now: t0 }),
    ).toThrow(DomainError);
  });

  it('atomically sets, changes, and clears either schedule date', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });

    task.setSchedule(t1, t2, t1);
    expect(task.startAt).toBe(t1);
    expect(task.due).toBe(t2);
    expect(task.updatedAt).toBe(t1);

    task.setSchedule(t0, t1, t2);
    expect(task.startAt).toBe(t0);
    expect(task.due).toBe(t1);
    expect(task.updatedAt).toBe(t2);

    task.setSchedule(undefined, t2, t1);
    expect(task.startAt).toBeUndefined();
    expect(task.due).toBe(t2);

    task.setSchedule(t1, undefined, t2);
    expect(task.startAt).toBe(t1);
    expect(task.due).toBeUndefined();

    task.setSchedule(undefined, undefined, t1);
    expect(task.startAt).toBeUndefined();
    expect(task.due).toBeUndefined();
  });

  it('rejects invalid schedule updates without partially changing state', () => {
    const task = Task.create({
      id: 't1',
      title: 'Train',
      startAt: localDayBefore,
      due: localDayAfter,
      projectId: 'p1',
      now: t0,
    });

    expect(() => task.setSchedule(localDayAfter, localDayStart, t1)).toThrow(DomainError);
    expect(task.startAt).toBe(localDayBefore);
    expect(task.due).toBe(localDayAfter);
    expect(task.updatedAt).toBe(t0);

    task.setSchedule(t1, t1, t1);
    expect(task.startAt).toBe(t1);
    expect(task.due).toBe(t1);
  });

  it('keeps legacy due updates inside the schedule invariant', () => {
    const task = Task.create({
      id: 't1',
      title: 'Train',
      startAt: localDayStart,
      due: localDayAfter,
      projectId: 'p1',
      now: t0,
    });

    expect(() => task.setDue(localDayBefore, t1)).toThrow(DomainError);
    expect(task.startAt).toBe(localDayStart);
    expect(task.due).toBe(localDayAfter);
    expect(task.updatedAt).toBe(t0);

    task.clearDue(t2);
    expect(task.startAt).toBe(localDayStart);
    expect(task.due).toBeUndefined();
    expect(task.updatedAt).toBe(t2);
  });

  it('is ready only when a todo schedule has reached its start boundary', () => {
    const task = Task.create({
      id: 't1',
      title: 'Train',
      startAt: localDayStart,
      projectId: 'p1',
      now: t0,
    });
    expect(task.isReadyToStart(localDayBefore)).toBe(false);
    expect(task.isReadyToStart(localDayStart)).toBe(true);
    expect(task.isReadyToStart(localDayAfter)).toBe(true);
    expect(
      Task.create({ id: 't2', title: 'Stretch', projectId: 'p1', now: t0 }).isReadyToStart(
        localDayAfter,
      ),
    ).toBe(false);
  });

  it('becomes ready at the beginning of its local start calendar date', () => {
    const startAt = new Date(2026, 0, 15, 18, 0);
    const task = Task.create({ id: 't1', title: 'Train', startAt, projectId: 'p1', now: t0 });

    expect(task.isReadyToStart(new Date(2026, 0, 14, 23, 59))).toBe(false);
    expect(task.isReadyToStart(new Date(2026, 0, 15, 8, 0))).toBe(true);
  });

  it('is not ready while doing, paused, done, failed, or archived', () => {
    const doing = Task.create({
      id: 'doing',
      title: 'Doing',
      startAt: t0,
      projectId: 'p1',
      now: t0,
    });
    doing.start(t1);
    expect(doing.isReadyToStart(t2)).toBe(false);

    const paused = Task.create({
      id: 'paused',
      title: 'Paused',
      startAt: t0,
      projectId: 'p1',
      now: t0,
    });
    paused.start(t1);
    paused.pause(t2);
    expect(paused.isReadyToStart(t2)).toBe(false);

    const done = Task.create({
      id: 'done',
      title: 'Done',
      startAt: t0,
      projectId: 'p1',
      now: t0,
    });
    done.start(t1);
    done.complete(t2);
    expect(done.isReadyToStart(t2)).toBe(false);

    const failed = Task.create({
      id: 'failed',
      title: 'Failed',
      startAt: t0,
      projectId: 'p1',
      now: t0,
    });
    failed.start(t1);
    failed.fail(t2);
    expect(failed.isReadyToStart(t2)).toBe(false);

    const archived = Task.create({
      id: 'archived',
      title: 'Archived',
      startAt: t0,
      projectId: 'p1',
      now: t0,
    });
    archived.archive(t1);
    expect(archived.isReadyToStart(t2)).toBe(false);
    archived.unarchive(t2);
    expect(archived.isReadyToStart(t2)).toBe(true);
  });

  it('fails from doing or paused and rejects other statuses', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    expect(() => task.fail(t1)).toThrow(DomainError);

    task.start(t1);
    task.fail(t2);
    expect(task.status).toBe('failed');
    expect(task.updatedAt).toBe(t2);
    expect(() => task.fail(t2)).toThrow(DomainError);

    const paused = Task.create({ id: 't2', title: 'Stretch', projectId: 'p1', now: t0 });
    paused.start(t1);
    paused.pause(t2);
    paused.fail(t2);
    expect(paused.status).toBe('failed');

    const done = Task.create({ id: 't3', title: 'Rest', projectId: 'p1', now: t0 });
    done.start(t1);
    done.complete(t2);
    expect(() => done.fail(t2)).toThrow(DomainError);
  });

  it('reopens from done or failed', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
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
    const dueSoon = Task.create({ id: 't1', title: 'Train', due: t1, projectId: 'p1', now: t0 });
    expect(dueSoon.isDueImminent(HOUR_MS, t0)).toBe(true);
    expect(dueSoon.isDueImminent(HOUR_MS - 1, t0)).toBe(false);

    const pastDue = Task.create({ id: 't2', title: 'Stretch', due: t0, projectId: 'p1', now: t0 });
    expect(pastDue.isDueImminent(HOUR_MS, t1)).toBe(true);
  });

  it('does not flag a due outside the window or a missing due', () => {
    const dueLater = Task.create({ id: 't1', title: 'Train', due: t2, projectId: 'p1', now: t0 });
    expect(dueLater.isDueImminent(HOUR_MS, t0)).toBe(false);

    const noDue = Task.create({ id: 't2', title: 'Stretch', projectId: 'p1', now: t0 });
    expect(noDue.isDueImminent(HOUR_MS, t0)).toBe(false);
  });

  it('does not flag done, failed, or archived tasks', () => {
    const done = Task.create({ id: 't1', title: 'Train', due: t1, projectId: 'p1', now: t0 });
    done.start(t0);
    done.complete(t0);
    expect(done.isDueImminent(HOUR_MS, t0)).toBe(false);

    const failed = Task.create({ id: 't2', title: 'Stretch', due: t1, projectId: 'p1', now: t0 });
    failed.start(t0);
    failed.fail(t0);
    expect(failed.isDueImminent(HOUR_MS, t0)).toBe(false);

    const archived = Task.create({ id: 't3', title: 'Rest', due: t1, projectId: 'p1', now: t0 });
    archived.archive(t0);
    expect(archived.isDueImminent(HOUR_MS, t0)).toBe(false);
  });

  it('reports overdue only for unfinished, unarchived tasks strictly past due', () => {
    const overdue = Task.create({ id: 'overdue', title: 'Overdue', due: t0, projectId: 'p1', now: t0 });
    expect(overdue.isOverdue(t1)).toBe(true);

    const future = Task.create({ id: 'future', title: 'Future', due: t2, projectId: 'p1', now: t0 });
    expect(future.isOverdue(t1)).toBe(false);

    const equal = Task.create({ id: 'equal', title: 'Equal', due: t1, projectId: 'p1', now: t0 });
    expect(equal.isOverdue(t1)).toBe(false);

    const noDue = Task.create({ id: 'no-due', title: 'No due', projectId: 'p1', now: t0 });
    expect(noDue.isOverdue(t1)).toBe(false);

    const done = Task.create({ id: 'done', title: 'Done', due: t0, projectId: 'p1', now: t0 });
    done.start(t0);
    done.complete(t0);
    expect(done.isOverdue(t1)).toBe(false);

    const failed = Task.create({ id: 'failed', title: 'Failed', due: t0, projectId: 'p1', now: t0 });
    failed.start(t0);
    failed.fail(t0);
    expect(failed.isOverdue(t1)).toBe(false);

    const archived = Task.create({ id: 'archived', title: 'Archived', due: t0, projectId: 'p1', now: t0 });
    archived.archive(t0);
    expect(archived.isOverdue(t1)).toBe(false);
  });

  it('restores persisted schedule fields and rejects an invalid schedule', () => {
    const task = Task.create({ id: 't1', title: 'Train', projectId: 'p1', now: t0 });
    task.start(t1);
    task.setSchedule(t1, t2, t1);
    task.assignGoal('g1', t1);
    task.assignMilestone('m1', t1);
    task.addLabel('l1');
    const restored = Task.restore({
      id: task.id,
      title: task.title,
      description: task.description,
      startAt: task.startAt,
      due: task.due,
      status: task.status,
      archived: task.archived,
      labelIds: task.labelIds,
      projectId: task.projectId,
      goalId: task.goalId,
      milestoneId: task.milestoneId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
    expect(restored.id).toBe(task.id);
    expect(restored.title).toBe(task.title);
    expect(restored.description).toBe(task.description);
    expect(restored.startAt).toBe(task.startAt);
    expect(restored.due).toBe(task.due);
    expect(restored.status).toBe(task.status);
    expect(restored.archived).toBe(task.archived);
    expect(restored.labelIds).toEqual(task.labelIds);
    expect(restored.labelIds).not.toBe(task.labelIds);
    expect(restored.projectId).toBe(task.projectId);
    expect(restored.goalId).toBe(task.goalId);
    expect(restored.milestoneId).toBe(task.milestoneId);
    expect(restored.createdAt).toBe(task.createdAt);
    expect(restored.updatedAt).toBe(task.updatedAt);

    expect(() =>
      Task.restore({
        id: 't2',
        title: 'Invalid',
        startAt: localDayAfter,
        due: localDayStart,
        status: 'todo',
        archived: false,
        labelIds: [],
        projectId: 'p1',
        createdAt: t0,
        updatedAt: t0,
      }),
    ).toThrow(DomainError);
  });
});
