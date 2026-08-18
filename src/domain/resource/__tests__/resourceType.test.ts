import { ResourceType } from '../ResourceType';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');

describe('ResourceType', () => {
  it('is created with a name, kind, and unit', () => {
    const type = ResourceType.create({
      id: 'rt1',
      name: 'Focus time',
      kind: 'time',
      unit: 'minutes',
      now: t0,
    });
    expect(type.name).toBe('Focus time');
    expect(type.kind).toBe('time');
    expect(type.unit).toBe('minutes');
    expect(type.archived).toBe(false);
    expect(type.createdAt).toBe(t0);
    expect(type.updatedAt).toBe(t0);
  });

  it('rejects a blank name or unit', () => {
    expect(() =>
      ResourceType.create({
        id: 'rt1',
        name: '  ',
        kind: 'time',
        unit: 'minutes',
        now: t0,
      }),
    ).toThrow(DomainError);
    expect(() =>
      ResourceType.create({
        id: 'rt1',
        name: 'Budget',
        kind: 'quantity',
        unit: '',
        now: t0,
      }),
    ).toThrow(DomainError);
  });

  it('renames and rejects blank names', () => {
    const type = ResourceType.create({
      id: 'rt1',
      name: 'Budget',
      kind: 'quantity',
      unit: 'USD',
      now: t0,
    });
    type.rename('Monthly budget', t1);
    expect(type.name).toBe('Monthly budget');
    expect(type.updatedAt).toBe(t1);
    expect(() => type.rename('', t1)).toThrow(DomainError);
    expect(type.name).toBe('Monthly budget');
  });

  it('archives and unarchives independently', () => {
    const type = ResourceType.create({
      id: 'rt1',
      name: 'Budget',
      kind: 'quantity',
      unit: 'USD',
      now: t0,
    });
    type.archive(t1);
    expect(type.archived).toBe(true);
    type.unarchive(t1);
    expect(type.archived).toBe(false);
  });
});
