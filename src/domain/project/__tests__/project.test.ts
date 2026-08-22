import { Project } from '../Project';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

describe('Project', () => {
  it('is created in planning status serving a goal', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(project.status).toBe('planning');
    expect(project.goalId).toBe('g1');
    expect(project.archived).toBe(false);
    expect(project.createdAt).toBe(t0);
    expect(project.updatedAt).toBe(t0);
  });

  it('rejects a blank name at creation', () => {
    expect(() =>
      Project.create({ id: 'p1', name: '  ', goalId: 'g1', now: t0 }),
    ).toThrow(DomainError);
  });

  it('activates from planning, pauses, and reactivates from paused', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    project.activate(t1);
    expect(project.status).toBe('active');
    expect(project.updatedAt).toBe(t1);
    project.pause(t2);
    expect(project.status).toBe('paused');
    project.activate(t2);
    expect(project.status).toBe('active');
  });

  it('rejects activation from active, done, and failed', () => {
    const active = Project.create({ id: 'p1', name: 'Active plan', goalId: 'g1', now: t0 });
    active.activate(t1);
    expect(() => active.activate(t2)).toThrow(DomainError);
    expect(active.status).toBe('active');
    expect(active.updatedAt).toBe(t1);

    const done = Project.create({ id: 'p2', name: 'Done plan', goalId: 'g1', now: t0 });
    done.activate(t1);
    done.complete(t2);
    expect(() => done.activate(t1)).toThrow(DomainError);
    expect(done.status).toBe('done');
    expect(done.updatedAt).toBe(t2);

    const failed = Project.create({ id: 'p3', name: 'Failed plan', goalId: 'g1', now: t0 });
    failed.activate(t1);
    failed.fail(t2);
    expect(() => failed.activate(t1)).toThrow(DomainError);
    expect(failed.status).toBe('failed');
    expect(failed.updatedAt).toBe(t2);
  });

  it('rejects pausing from planning', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(() => project.pause(t1)).toThrow(DomainError);
  });

  it('archives without touching status', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    project.activate(t1);
    project.archive(t2);
    expect(project.archived).toBe(true);
    expect(project.status).toBe('active');
    project.unarchive(t2);
    expect(project.archived).toBe(false);
    expect(project.status).toBe('active');
  });

  it('renames but rejects an empty name', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(() => project.rename('  ', t1)).toThrow(DomainError);
    project.rename('Q2 plan', t1);
    expect(project.name).toBe('Q2 plan');
    expect(project.updatedAt).toBe(t1);
  });

  it('adds and removes labels idempotently', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    project.addLabel('l1');
    project.addLabel('l1');
    expect(project.labelIds).toEqual(['l1']);
    project.removeLabel('l1');
    project.removeLabel('l1');
    expect(project.labelIds).toEqual([]);
  });

  it('sets and clears a due date', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(project.due).toBeUndefined();
    project.setDue(t1, t2, t1);
    expect(project.due).toBe(t1);
    expect(project.updatedAt).toBe(t1);
    project.clearDue(t2);
    expect(project.due).toBeUndefined();
  });

  it('requires the due to be earlier than the goal due', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(() => project.setDue(t2, t2, t1)).toThrow(DomainError);
    expect(() => project.setDue(t2, t1, t1)).toThrow(DomainError);
    project.setDue(t1, t2, t1);
    expect(project.due).toBe(t1);
  });

  it('allows any due when the goal has none', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    project.setDue(t2, undefined, t1);
    expect(project.due).toBe(t2);
  });

  it('validates the due at creation against the goal due', () => {
    expect(() =>
      Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', due: t2, goalDue: t1, now: t0 }),
    ).toThrow(DomainError);
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', due: t1, goalDue: t2, now: t0 });
    expect(project.due).toBe(t1);
  });

  it('completes from active, bumps updatedAt', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    project.activate(t1);
    project.complete(t2);
    expect(project.status).toBe('done');
    expect(project.updatedAt).toBe(t2);
  });

  it('rejects complete from planning / paused / done / failed', () => {
    const planning = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(() => planning.complete(t1)).toThrow(DomainError);

    const paused = Project.create({ id: 'p2', name: 'Q2 plan', goalId: 'g1', now: t0 });
    paused.activate(t1);
    paused.pause(t2);
    expect(() => paused.complete(t2)).toThrow(DomainError);

    const done = Project.create({ id: 'p3', name: 'Q3 plan', goalId: 'g1', now: t0 });
    done.activate(t1);
    done.complete(t2);
    expect(() => done.complete(t2)).toThrow(DomainError);

    const failed = Project.create({ id: 'p4', name: 'Q4 plan', goalId: 'g1', now: t0 });
    failed.activate(t1);
    failed.fail(t2);
    expect(() => failed.complete(t2)).toThrow(DomainError);
  });

  it('fails from active or paused and rejects other statuses', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(() => project.fail(t1)).toThrow(DomainError);

    project.activate(t1);
    project.fail(t2);
    expect(project.status).toBe('failed');
    expect(project.updatedAt).toBe(t2);
    expect(() => project.fail(t2)).toThrow(DomainError);

    const paused = Project.create({ id: 'p2', name: 'Q2 plan', goalId: 'g1', now: t0 });
    paused.activate(t1);
    paused.pause(t2);
    paused.fail(t2);
    expect(paused.status).toBe('failed');
  });

  it('flags a due within the window or already past as imminent', () => {
    const dueSoon = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', due: t1, now: t0 });
    expect(dueSoon.isDueImminent(HOUR_MS, t0)).toBe(true);
    expect(dueSoon.isDueImminent(HOUR_MS - 1, t0)).toBe(false);

    const pastDue = Project.create({ id: 'p2', name: 'Q2 plan', goalId: 'g1', due: t0, now: t0 });
    expect(pastDue.isDueImminent(HOUR_MS, t1)).toBe(true);
  });

  it('does not flag a due outside the window or a missing due', () => {
    const dueLater = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', due: t2, now: t0 });
    expect(dueLater.isDueImminent(HOUR_MS, t0)).toBe(false);

    const noDue = Project.create({ id: 'p2', name: 'Q2 plan', goalId: 'g1', now: t0 });
    expect(noDue.isDueImminent(HOUR_MS, t0)).toBe(false);
  });

  it('does not flag failed or archived projects', () => {
    const failed = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', due: t1, now: t0 });
    failed.activate(t0);
    failed.fail(t0);
    expect(failed.isDueImminent(HOUR_MS, t0)).toBe(false);

    const archived = Project.create({ id: 'p2', name: 'Q2 plan', goalId: 'g1', due: t1, now: t0 });
    archived.archive(t0);
    expect(archived.isDueImminent(HOUR_MS, t0)).toBe(false);
  });

  it('restores from persisted fields without enforcing invariants', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    project.activate(t1);
    project.setDue(t1, t2, t1);
    project.addLabel('l1');
    const restored = Project.restore({
      id: project.id,
      name: project.name,
      goalId: project.goalId,
      due: project.due,
      status: project.status,
      archived: project.archived,
      labelIds: project.labelIds,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
    expect(restored.id).toBe(project.id);
    expect(restored.name).toBe(project.name);
    expect(restored.goalId).toBe(project.goalId);
    expect(restored.due).toBe(project.due);
    expect(restored.status).toBe(project.status);
    expect(restored.archived).toBe(project.archived);
    expect(restored.labelIds).toEqual(project.labelIds);
    expect(restored.labelIds).not.toBe(project.labelIds);
    expect(restored.createdAt).toBe(project.createdAt);
    expect(restored.updatedAt).toBe(project.updatedAt);
  });
});
