import { Resource } from '../Resource';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');

describe('Resource', () => {
  it('is created with an amount and unit', () => {
    const resource = Resource.create({
      id: 'r1',
      name: 'Budget',
      kind: 'money',
      amount: 100,
      unit: 'CNY',
      projectId: 'p1',
      now: t0,
    });
    expect(resource.amount).toBe(100);
    expect(resource.unit).toBe('CNY');
    expect(resource.projectId).toBe('p1');
    expect(resource.archived).toBe(false);
    expect(resource.createdAt).toBe(t0);
    expect(resource.updatedAt).toBe(t0);
  });

  it('adjusts the amount by signed deltas and bumps updatedAt', () => {
    const resource = Resource.create({
      id: 'r1',
      name: 'Budget',
      kind: 'money',
      amount: 100,
      unit: 'CNY',
      now: t0,
    });
    resource.adjust(-40, t1);
    expect(resource.amount).toBe(60);
    expect(resource.updatedAt).toBe(t1);
    resource.adjust(10, t1);
    expect(resource.amount).toBe(70);
  });

  it('rejects adjustments that produce a negative total', () => {
    const resource = Resource.create({
      id: 'r1',
      name: 'Budget',
      kind: 'money',
      amount: 100,
      unit: 'CNY',
      now: t0,
    });
    expect(() => resource.adjust(-101, t1)).toThrow(DomainError);
    expect(resource.amount).toBe(100);
  });

  it('rejects non-finite results', () => {
    const resource = Resource.create({
      id: 'r1',
      name: 'Budget',
      kind: 'money',
      amount: 100,
      unit: 'CNY',
      now: t0,
    });
    expect(() => resource.adjust(Infinity, t1)).toThrow(DomainError);
    expect(() => resource.adjust(NaN, t1)).toThrow(DomainError);
    expect(resource.amount).toBe(100);
  });

  it('archives and unarchives independently', () => {
    const resource = Resource.create({
      id: 'r1',
      name: 'Budget',
      kind: 'money',
      amount: 100,
      unit: 'CNY',
      now: t0,
    });
    resource.archive(t1);
    expect(resource.archived).toBe(true);
    resource.unarchive(t1);
    expect(resource.archived).toBe(false);
  });

  it('adds and removes labels idempotently', () => {
    const resource = Resource.create({
      id: 'r1',
      name: 'Budget',
      kind: 'money',
      amount: 100,
      unit: 'CNY',
      now: t0,
    });
    resource.addLabel('l1');
    resource.addLabel('l1');
    expect(resource.labelIds).toEqual(['l1']);
    resource.removeLabel('l1');
    resource.removeLabel('l1');
    expect(resource.labelIds).toEqual([]);
  });
});
