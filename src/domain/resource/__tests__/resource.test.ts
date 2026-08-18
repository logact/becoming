import { Resource } from '../Resource';
import { ResourceAllocation } from '../ResourceAllocation';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');

function createQuantityResource(amount = 100): Resource {
  return Resource.create({
    id: 'r1',
    typeId: 'rt1',
    kind: 'quantity',
    name: 'Budget',
    amount,
    now: t0,
  });
}

function createTimeResource(amount = 600): Resource {
  return Resource.create({
    id: 'r2',
    typeId: 'rt2',
    kind: 'time',
    name: 'Weekly focus time',
    amount,
    now: t0,
  });
}

describe('Resource', () => {
  it('is created as a pool of a type with everything available', () => {
    const resource = createQuantityResource();
    expect(resource.typeId).toBe('rt1');
    expect(resource.kind).toBe('quantity');
    expect(resource.amount).toBe(100);
    expect(resource.available).toBe(100);
    expect(resource.allocations).toEqual([]);
    expect(resource.archived).toBe(false);
    expect(resource.createdAt).toBe(t0);
    expect(resource.updatedAt).toBe(t0);
  });

  it('rejects a negative or non-finite initial amount', () => {
    expect(() => createQuantityResource(-1)).toThrow(DomainError);
    expect(() => createQuantityResource(NaN)).toThrow(DomainError);
  });

  it('adjusts the pool by signed deltas and bumps updatedAt', () => {
    const resource = createQuantityResource();
    resource.adjust(-40, t1);
    expect(resource.amount).toBe(60);
    expect(resource.updatedAt).toBe(t1);
    resource.adjust(10, t1);
    expect(resource.amount).toBe(70);
  });

  it('rejects adjustments that produce a negative or non-finite total', () => {
    const resource = createQuantityResource();
    expect(() => resource.adjust(-101, t1)).toThrow(DomainError);
    expect(() => resource.adjust(Infinity, t1)).toThrow(DomainError);
    expect(() => resource.adjust(NaN, t1)).toThrow(DomainError);
    expect(resource.amount).toBe(100);
  });

  it('rejects shrinking the pool below the total allocated', () => {
    const resource = createQuantityResource();
    resource.allocate({ id: 'a1', projectId: 'p1', amount: 60 }, t0);
    expect(() => resource.adjust(-50, t1)).toThrow(DomainError);
    expect(resource.amount).toBe(100);
    resource.adjust(-40, t1);
    expect(resource.amount).toBe(60);
    expect(resource.available).toBe(0);
  });

  it('archives and unarchives independently', () => {
    const resource = createQuantityResource();
    resource.archive(t1);
    expect(resource.archived).toBe(true);
    resource.unarchive(t1);
    expect(resource.archived).toBe(false);
  });

  it('adds and removes labels idempotently', () => {
    const resource = createQuantityResource();
    resource.addLabel('l1');
    resource.addLabel('l1');
    expect(resource.labelIds).toEqual(['l1']);
    resource.removeLabel('l1');
    resource.removeLabel('l1');
    expect(resource.labelIds).toEqual([]);
  });

  describe('quantity allocation', () => {
    it('allocates part of the pool to a project', () => {
      const resource = createQuantityResource();
      const allocation = resource.allocate(
        { id: 'a1', projectId: 'p1', amount: 40 },
        t1,
      );
      expect(allocation.amount).toBe(40);
      expect(allocation.span).toBeUndefined();
      expect(resource.available).toBe(60);
      expect(resource.updatedAt).toBe(t1);
    });

    it('rejects non-positive, non-finite, and over-available amounts', () => {
      const resource = createQuantityResource();
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1', amount: 0 }, t1),
      ).toThrow(DomainError);
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1', amount: -5 }, t1),
      ).toThrow(DomainError);
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1', amount: NaN }, t1),
      ).toThrow(DomainError);
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1', amount: 101 }, t1),
      ).toThrow(DomainError);
      expect(resource.available).toBe(100);
    });

    it('rejects a span on a quantity resource and an amount-less call', () => {
      const resource = createQuantityResource();
      expect(() =>
        resource.allocate(
          {
            id: 'a1',
            projectId: 'p1',
            span: { startAt: t0, endAt: t1 },
          },
          t1,
        ),
      ).toThrow(DomainError);
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1' }, t1),
      ).toThrow(DomainError);
    });

    it('rejects allocation from an archived resource', () => {
      const resource = createQuantityResource();
      resource.archive(t0);
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1', amount: 10 }, t1),
      ).toThrow(DomainError);
    });

    it('adjusts an allocation within the available amount', () => {
      const resource = createQuantityResource();
      resource.allocate({ id: 'a1', projectId: 'p1', amount: 40 }, t0);
      resource.adjustAllocation('a1', { amount: 90 }, t1);
      expect(resource.available).toBe(10);
      expect(() =>
        resource.adjustAllocation('a1', { amount: 101 }, t1),
      ).toThrow(DomainError);
      expect(resource.available).toBe(10);
    });

    it('releases an allocation back into the pool', () => {
      const resource = createQuantityResource();
      resource.allocate({ id: 'a1', projectId: 'p1', amount: 40 }, t0);
      resource.releaseAllocation('a1', t1);
      expect(resource.allocations).toEqual([]);
      expect(resource.available).toBe(100);
      expect(resource.updatedAt).toBe(t1);
    });

    it('throws on unknown allocation ids', () => {
      const resource = createQuantityResource();
      expect(() =>
        resource.adjustAllocation('nope', { amount: 10 }, t1),
      ).toThrow(DomainError);
      expect(() => resource.releaseAllocation('nope', t1)).toThrow(DomainError);
    });
  });

  describe('time allocation', () => {
    const span = { startAt: t0, endAt: t1 }; // 60 minutes

    it('allocates a span whose amount equals its duration', () => {
      const resource = createTimeResource();
      const allocation = resource.allocate(
        { id: 'a1', projectId: 'p1', span },
        t0,
      );
      expect(allocation.amount).toBe(60);
      expect(allocation.durationMinutes).toBe(60);
      expect(allocation.span).toEqual(span);
      expect(resource.available).toBe(540);
    });

    it('supports spans covering several days', () => {
      const resource = createTimeResource(6000);
      const allocation = resource.allocate(
        {
          id: 'a1',
          projectId: 'p1',
          span: {
            startAt: new Date('2026-01-05T09:00:00Z'),
            endAt: new Date('2026-01-07T17:00:00Z'),
          },
        },
        t0,
      );
      expect(allocation.durationMinutes).toBe(3360);
      expect(resource.available).toBe(2640);
    });

    it('rejects a bare amount on a time resource', () => {
      const resource = createTimeResource();
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1', amount: 60 }, t0),
      ).toThrow(DomainError);
    });

    it('rejects invalid spans', () => {
      const resource = createTimeResource();
      const cases = [
        { startAt: t1, endAt: t0 }, // end before start
        { startAt: t0, endAt: t0 }, // zero length
        {
          startAt: new Date('2026-01-01T00:00:30Z'), // not minute precision
          endAt: t1,
        },
      ];
      for (const badSpan of cases) {
        expect(() =>
          resource.allocate({ id: 'a1', projectId: 'p1', span: badSpan }, t0),
        ).toThrow(DomainError);
      }
      expect(resource.available).toBe(600);
    });

    it('rejects an explicit amount together with a span', () => {
      const resource = createTimeResource();
      expect(() =>
        resource.allocate(
          { id: 'a1', projectId: 'p1', amount: 60, span },
          t0,
        ),
      ).toThrow(DomainError);
    });

    it('rejects spans longer than the available amount', () => {
      const resource = createTimeResource(30);
      expect(() =>
        resource.allocate({ id: 'a1', projectId: 'p1', span }, t0),
      ).toThrow(DomainError);
    });

    it('accepts back-to-back spans but rejects overlapping ones', () => {
      const resource = createTimeResource();
      resource.allocate({ id: 'a1', projectId: 'p1', span }, t0);
      resource.allocate(
        {
          id: 'a2',
          projectId: 'p2',
          span: {
            startAt: t1,
            endAt: new Date('2026-01-01T02:00:00Z'),
          },
        },
        t0,
      );
      expect(resource.allocations).toHaveLength(2);
      expect(() =>
        resource.allocate(
          {
            id: 'a3',
            projectId: 'p3',
            span: {
              startAt: new Date('2026-01-01T00:30:00Z'),
              endAt: new Date('2026-01-01T01:30:00Z'),
            },
          },
          t0,
        ),
      ).toThrow(DomainError);
    });

    it('adjusts a span, keeping the amount in sync with the duration', () => {
      const resource = createTimeResource();
      resource.allocate({ id: 'a1', projectId: 'p1', span }, t0);
      resource.adjustAllocation(
        'a1',
        { span: { startAt: t1, endAt: new Date('2026-01-01T03:00:00Z') } },
        t1,
      );
      const allocation = resource.allocations[0];
      expect(allocation.durationMinutes).toBe(120);
      expect(allocation.amount).toBe(120);
      expect(resource.available).toBe(480);
    });

    it('rejects adjusting a span into an overlapping one', () => {
      const resource = createTimeResource();
      resource.allocate({ id: 'a1', projectId: 'p1', span }, t0);
      resource.allocate(
        {
          id: 'a2',
          projectId: 'p2',
          span: { startAt: t1, endAt: new Date('2026-01-01T02:00:00Z') },
        },
        t0,
      );
      expect(() =>
        resource.adjustAllocation(
          'a2',
          { span: { startAt: new Date('2026-01-01T00:30:00Z'), endAt: t1 } },
          t1,
        ),
      ).toThrow(DomainError);
      expect(resource.allocations[1].span?.startAt).toEqual(t1);
    });

    it('rejects adjusting a time allocation with an amount', () => {
      const resource = createTimeResource();
      resource.allocate({ id: 'a1', projectId: 'p1', span }, t0);
      expect(() =>
        resource.adjustAllocation('a1', { amount: 30 }, t1),
      ).toThrow(DomainError);
    });
  });

  describe('ResourceAllocation.assertNoOverlap', () => {
    const existing = [
      ResourceAllocation.create({
        id: 'a1',
        projectId: 'p1',
        span: { startAt: t0, endAt: t1 },
        now: t0,
      }),
    ];

    it('detects overlap across arbitrary allocation lists', () => {
      const candidate = ResourceAllocation.create({
        id: 'a2',
        projectId: 'p2',
        span: {
          startAt: new Date('2026-01-01T00:30:00Z'),
          endAt: new Date('2026-01-01T02:00:00Z'),
        },
        now: t0,
      });
      expect(() =>
        ResourceAllocation.assertNoOverlap(existing, candidate),
      ).toThrow(DomainError);
    });

    it('passes for disjoint spans and honors ignoreId', () => {
      const disjoint = ResourceAllocation.create({
        id: 'a2',
        projectId: 'p2',
        span: { startAt: t1, endAt: new Date('2026-01-01T02:00:00Z') },
        now: t0,
      });
      expect(() =>
        ResourceAllocation.assertNoOverlap(existing, disjoint),
      ).not.toThrow();
      const overlappingSelf = ResourceAllocation.create({
        id: 'a1',
        projectId: 'p1',
        span: { startAt: t0, endAt: t1 },
        now: t0,
      });
      expect(() =>
        ResourceAllocation.assertNoOverlap(existing, overlappingSelf, 'a1'),
      ).not.toThrow();
    });
  });
});
