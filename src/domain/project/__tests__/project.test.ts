import { Project } from '../Project';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');

describe('Project', () => {
  it('is created in planning status serving a goal', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(project.status).toBe('planning');
    expect(project.goalId).toBe('g1');
    expect(project.archived).toBe(false);
    expect(project.createdAt).toBe(t0);
    expect(project.updatedAt).toBe(t0);
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

  it('rejects invalid transitions', () => {
    const project = Project.create({ id: 'p1', name: 'Q1 plan', goalId: 'g1', now: t0 });
    expect(() => project.pause(t1)).toThrow(DomainError);
    project.activate(t1);
    expect(() => project.activate(t2)).toThrow(DomainError);
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
});
