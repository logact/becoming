import { DomainError } from '../../../domain/shared/errors';
import { Resource } from '../../../domain/resource/Resource';
import { AllocateResourceService } from '../AllocateResourceService';
import { makeFakeRepos } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');

async function makeService() {
  const { resourceRepo: resources } = await makeFakeRepos();
  return { service: new AllocateResourceService(resources), resources };
}

describe('AllocateResourceService', () => {
  it('allocates an amount of a quantity resource and saves it', async () => {
    const { service, resources } = await makeService();
    await resources.save(
      Resource.create({ id: 'r1', typeId: 'rt1', kind: 'quantity', name: 'Budget', amount: 100, now: t0 }),
    );

    await service.allocate({
      allocationId: 'al1',
      resourceId: 'r1',
      projectId: 'p1',
      amount: 40,
      now: t0,
    });

    const resource = await resources.findById('r1');
    expect(resource).not.toBeNull();
    expect(resource.allocations).toHaveLength(1);
    const allocation = resource.allocations[0];
    expect(allocation.id).toBe('al1');
    expect(allocation.projectId).toBe('p1');
    expect(allocation.amount).toBe(40);
    expect(allocation.span).toBeUndefined();
    expect(resource.available).toBe(60);
  });

  it('allocates a span of a time resource, deriving the amount from the span', async () => {
    const { service, resources } = await makeService();
    await resources.save(
      Resource.create({ id: 'r1', typeId: 'rt1', kind: 'time', name: 'Focus time', amount: 600, now: t0 }),
    );
    const span = {
      startAt: new Date('2026-02-02T09:00:00Z'),
      endAt: new Date('2026-02-02T11:00:00Z'),
    };

    await service.allocate({ allocationId: 'al1', resourceId: 'r1', projectId: 'p1', span, now: t0 });

    const allocation = (await resources.findById('r1'))?.allocations[0];
    expect(allocation.span).toEqual(span);
    expect(allocation.amount).toBe(120);
  });

  it('rejects an unknown resource', async () => {
    const { service } = await makeService();

    await expect(
      service.allocate({
        allocationId: 'al1',
        resourceId: 'missing',
        projectId: 'p1',
        amount: 10,
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects an amount beyond the available pool and saves nothing', async () => {
    const { service, resources } = await makeService();
    await resources.save(
      Resource.create({ id: 'r1', typeId: 'rt1', kind: 'quantity', name: 'Budget', amount: 100, now: t0 }),
    );

    await expect(
      service.allocate({
        allocationId: 'al1',
        resourceId: 'r1',
        projectId: 'p1',
        amount: 101,
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
    expect((await resources.findById('r1'))?.allocations).toHaveLength(0);
  });

  it('rejects an amount for a time resource and a span for a quantity resource', async () => {
    const { service, resources } = await makeService();
    await resources.save(
      Resource.create({ id: 'r-time', typeId: 'rt1', kind: 'time', name: 'Focus', amount: 600, now: t0 }),
    );
    await resources.save(
      Resource.create({ id: 'r-qty', typeId: 'rt2', kind: 'quantity', name: 'Budget', amount: 100, now: t0 }),
    );
    const span = {
      startAt: new Date('2026-02-02T09:00:00Z'),
      endAt: new Date('2026-02-02T10:00:00Z'),
    };

    await expect(
      service.allocate({ allocationId: 'al1', resourceId: 'r-time', projectId: 'p1', amount: 10, now: t0 }),
    ).rejects.toThrow(DomainError);
    await expect(
      service.allocate({ allocationId: 'al2', resourceId: 'r-qty', projectId: 'p1', span, now: t0 }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects overlapping spans on a time resource', async () => {
    const { service, resources } = await makeService();
    await resources.save(
      Resource.create({ id: 'r1', typeId: 'rt1', kind: 'time', name: 'Focus time', amount: 600, now: t0 }),
    );
    await service.allocate({
      allocationId: 'al1',
      resourceId: 'r1',
      projectId: 'p1',
      span: {
        startAt: new Date('2026-02-02T09:00:00Z'),
        endAt: new Date('2026-02-02T11:00:00Z'),
      },
      now: t0,
    });

    await expect(
      service.allocate({
        allocationId: 'al2',
        resourceId: 'r1',
        projectId: 'p2',
        span: {
          startAt: new Date('2026-02-02T10:00:00Z'),
          endAt: new Date('2026-02-02T12:00:00Z'),
        },
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
    expect((await resources.findById('r1'))?.allocations).toHaveLength(1);
  });
});
