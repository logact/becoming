import { Milestone } from '../Milestone';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');

describe('Milestone', () => {
  it('is created with a title, date, and project link', () => {
    const milestone = Milestone.create({
      id: 'm1',
      title: 'Beta launch',
      date: t1,
      projectId: 'p1',
      now: t0,
    });
    expect(milestone.title).toBe('Beta launch');
    expect(milestone.date).toBe(t1);
    expect(milestone.projectId).toBe('p1');
    expect(milestone.createdAt).toBe(t0);
    expect(milestone.updatedAt).toBe(t0);
  });

  it('rejects a blank title at creation', () => {
    expect(() =>
      Milestone.create({ id: 'm1', title: '  ', date: t1, projectId: 'p1', now: t0 }),
    ).toThrow(DomainError);
  });

  it('rejects an empty rename and bumps updatedAt on a valid one', () => {
    const milestone = Milestone.create({
      id: 'm1',
      title: 'Beta launch',
      date: t1,
      projectId: 'p1',
      now: t0,
    });
    expect(() => milestone.rename('  ', t1)).toThrow(DomainError);
    milestone.rename('Public launch', t1);
    expect(milestone.title).toBe('Public launch');
    expect(milestone.updatedAt).toBe(t1);
  });

  it('reschedules the date and bumps updatedAt', () => {
    const milestone = Milestone.create({
      id: 'm1',
      title: 'Beta launch',
      date: t1,
      projectId: 'p1',
      now: t0,
    });
    milestone.reschedule(t2, t2);
    expect(milestone.date).toBe(t2);
    expect(milestone.updatedAt).toBe(t2);
  });

  it('restores from persisted fields without enforcing invariants', () => {
    const milestone = Milestone.create({
      id: 'm1',
      title: 'Beta launch',
      date: t1,
      projectId: 'p1',
      now: t0,
    });
    const restored = Milestone.restore({
      id: milestone.id,
      title: milestone.title,
      date: milestone.date,
      projectId: milestone.projectId,
      createdAt: milestone.createdAt,
      updatedAt: milestone.updatedAt,
    });
    expect(restored.id).toBe(milestone.id);
    expect(restored.title).toBe(milestone.title);
    expect(restored.date).toBe(milestone.date);
    expect(restored.projectId).toBe(milestone.projectId);
    expect(restored.createdAt).toBe(milestone.createdAt);
    expect(restored.updatedAt).toBe(milestone.updatedAt);
  });
});
