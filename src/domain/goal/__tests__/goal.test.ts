import { Goal } from '../Goal';
import { Project } from '../../project/Project';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

describe('Goal', () => {
  it('is created in todo status', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run a marathon', now: t0 });
    expect(goal.status).toBe('todo');
    expect(goal.archived).toBe(false);
    expect(goal.milestoneId).toBeUndefined();
    expect(goal.createdAt).toBe(t0);
    expect(goal.updatedAt).toBe(t0);
  });

  it('carries an optional milestone link and can assign or clear it', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run a marathon', milestoneId: 'm1', now: t0 });
    expect(goal.milestoneId).toBe('m1');

    goal.assignMilestone('m2', t1);
    expect(goal.milestoneId).toBe('m2');
    expect(goal.updatedAt).toBe(t1);

    goal.assignMilestone(undefined, t2);
    expect(goal.milestoneId).toBeUndefined();
    expect(goal.updatedAt).toBe(t2);
  });

  it('carries optional sub-goal membership and parent links', () => {
    const topLevel = Goal.create({ id: 'g1', title: 'Run a marathon', now: t0 });
    expect(topLevel.projectId).toBeUndefined();
    expect(topLevel.parentGoalId).toBeUndefined();

    const subGoal = Goal.create({
      id: 'g2',
      title: '10 km under 50 min',
      projectId: 'p1',
      parentGoalId: 'g1',
      milestoneId: 'm1',
      now: t0,
    });
    expect(subGoal.projectId).toBe('p1');
    expect(subGoal.parentGoalId).toBe('g1');
    expect(subGoal.milestoneId).toBe('m1');

    const restored = Goal.restore({
      id: subGoal.id,
      title: subGoal.title,
      status: subGoal.status,
      archived: subGoal.archived,
      labelIds: subGoal.labelIds,
      projectId: subGoal.projectId,
      parentGoalId: subGoal.parentGoalId,
      milestoneId: subGoal.milestoneId,
      createdAt: subGoal.createdAt,
      updatedAt: subGoal.updatedAt,
    });
    expect(restored.projectId).toBe('p1');
    expect(restored.parentGoalId).toBe('g1');
    expect(restored.milestoneId).toBe('m1');
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

  it('sets and clears a due date', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    expect(goal.due).toBeUndefined();
    goal.setDue(t1, t1);
    expect(goal.due).toBe(t1);
    expect(goal.updatedAt).toBe(t1);
    goal.clearDue(t2);
    expect(goal.due).toBeUndefined();
    expect(goal.updatedAt).toBe(t2);
  });

  it('accepts a due at creation', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', due: t1, now: t0 });
    expect(goal.due).toBe(t1);
  });

  it('fails from doing or paused and rejects other statuses', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    expect(() => goal.fail(t1)).toThrow(DomainError);

    goal.start(t1);
    goal.fail(t2);
    expect(goal.status).toBe('failed');
    expect(goal.updatedAt).toBe(t2);
    expect(() => goal.fail(t2)).toThrow(DomainError);

    const paused = Goal.create({ id: 'g2', title: 'Swim', now: t0 });
    paused.start(t1);
    paused.pause(t2);
    paused.fail(t2);
    expect(paused.status).toBe('failed');

    const done = Goal.create({ id: 'g3', title: 'Bike', now: t0 });
    done.start(t1);
    done.complete(t2);
    expect(() => done.fail(t2)).toThrow(DomainError);
  });

  it('reopens from done or failed', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
    goal.start(t1);
    goal.complete(t2);
    goal.reopen(t2);
    expect(goal.status).toBe('todo');

    goal.start(t2);
    goal.fail(t2);
    goal.reopen(t2);
    expect(goal.status).toBe('todo');
    expect(goal.updatedAt).toBe(t2);
  });

  it('flags a due within the window or already past as imminent', () => {
    const dueSoon = Goal.create({ id: 'g1', title: 'Run', due: t1, now: t0 });
    expect(dueSoon.isDueImminent(HOUR_MS, t0)).toBe(true);
    expect(dueSoon.isDueImminent(HOUR_MS - 1, t0)).toBe(false);

    const pastDue = Goal.create({ id: 'g2', title: 'Swim', due: t0, now: t0 });
    expect(pastDue.isDueImminent(HOUR_MS, t1)).toBe(true);
  });

  it('does not flag a due outside the window or a missing due', () => {
    const dueLater = Goal.create({ id: 'g1', title: 'Run', due: t2, now: t0 });
    expect(dueLater.isDueImminent(HOUR_MS, t0)).toBe(false);

    const noDue = Goal.create({ id: 'g2', title: 'Swim', now: t0 });
    expect(noDue.isDueImminent(HOUR_MS, t0)).toBe(false);
  });

  it('does not flag done, failed, or archived goals', () => {
    const done = Goal.create({ id: 'g1', title: 'Run', due: t1, now: t0 });
    done.start(t0);
    done.complete(t0);
    expect(done.isDueImminent(HOUR_MS, t0)).toBe(false);

    const failed = Goal.create({ id: 'g2', title: 'Swim', due: t1, now: t0 });
    failed.start(t0);
    failed.fail(t0);
    expect(failed.isDueImminent(HOUR_MS, t0)).toBe(false);

    const archived = Goal.create({ id: 'g3', title: 'Bike', due: t1, now: t0 });
    archived.archive(t0);
    expect(archived.isDueImminent(HOUR_MS, t0)).toBe(false);
  });

  it('restores from persisted fields without enforcing invariants', () => {
    const goal = Goal.create({ id: 'g1', title: 'Run', description: 'A marathon', now: t0 });
    goal.start(t1);
    goal.setDue(t2, t1);
    goal.addLabel('l1');
    const restored = Goal.restore({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      due: goal.due,
      status: goal.status,
      archived: goal.archived,
      labelIds: goal.labelIds,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    });
    expect(restored.id).toBe(goal.id);
    expect(restored.title).toBe(goal.title);
    expect(restored.description).toBe(goal.description);
    expect(restored.due).toBe(goal.due);
    expect(restored.status).toBe(goal.status);
    expect(restored.archived).toBe(goal.archived);
    expect(restored.labelIds).toEqual(goal.labelIds);
    expect(restored.labelIds).not.toBe(goal.labelIds);
    expect(restored.createdAt).toBe(goal.createdAt);
    expect(restored.updatedAt).toBe(goal.updatedAt);
  });

  describe('activateProject', () => {
    it('activates a planning project of the goal', () => {
      const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
      const project = Project.create({ id: 'p1', name: 'Plan A', goalId: 'g1', now: t0 });
      goal.activateProject(project, undefined, t1);
      expect(project.status).toBe('active');
      expect(project.updatedAt).toBe(t1);
    });

    it('pauses the previously active project and activates the new one', () => {
      const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
      const current = Project.create({ id: 'p1', name: 'Plan A', goalId: 'g1', now: t0 });
      current.activate(t0);
      const next = Project.create({ id: 'p2', name: 'Plan B', goalId: 'g1', now: t0 });
      goal.activateProject(next, current, t1);
      expect(current.status).toBe('paused');
      expect(current.updatedAt).toBe(t1);
      expect(next.status).toBe('active');
      expect(next.updatedAt).toBe(t1);
    });

    it('rejects a project whose goalId is another goal', () => {
      const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
      const foreign = Project.create({ id: 'p1', name: 'Plan A', goalId: 'g2', now: t0 });
      expect(() => goal.activateProject(foreign, undefined, t1)).toThrow(DomainError);
      expect(foreign.status).toBe('planning');
    });

    it('rejects a currentActive belonging to another goal', () => {
      const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
      const foreign = Project.create({ id: 'p1', name: 'Plan A', goalId: 'g2', now: t0 });
      foreign.activate(t0);
      const project = Project.create({ id: 'p2', name: 'Plan B', goalId: 'g1', now: t0 });
      expect(() => goal.activateProject(project, foreign, t1)).toThrow(DomainError);
      expect(foreign.status).toBe('active');
      expect(project.status).toBe('planning');
    });

    it('activating the already-active project throws (via Project.activate)', () => {
      const goal = Goal.create({ id: 'g1', title: 'Run', now: t0 });
      const project = Project.create({ id: 'p1', name: 'Plan A', goalId: 'g1', now: t0 });
      project.activate(t0);
      expect(() => goal.activateProject(project, project, t1)).toThrow(DomainError);
      expect(project.status).toBe('active');
    });
  });
});
