import { Resource } from '../../../domain/resource/Resource';
import { FakeResourceRepository } from '../../__tests__/fakes';
import { ResourcePoolsService } from '../ResourcePoolsService';

const t0 = new Date('2026-02-01T00:00:00Z');

describe('ResourcePoolsService', () => {
  it('lists non-archived pools with their available amounts', async () => {
    const resources = new FakeResourceRepository();
    const gear = Resource.create({
      id: 'r1',
      typeId: 'rt1',
      kind: 'quantity',
      name: 'Gear budget',
      amount: 5000,
      now: t0,
    });
    gear.allocate({ id: 'al1', projectId: 'p1', amount: 3000 }, t0);
    await resources.save(gear);
    await resources.save(
      Resource.create({ id: 'r2', typeId: 'rt2', kind: 'time', name: 'Time budget', amount: 720, now: t0 }),
    );

    const pools = await new ResourcePoolsService(resources).list();

    expect(pools).toEqual([
      { id: 'r1', name: 'Gear budget', kind: 'quantity', amount: 5000, available: 2000 },
      { id: 'r2', name: 'Time budget', kind: 'time', amount: 720, available: 720 },
    ]);
  });

  it('excludes archived pools', async () => {
    const resources = new FakeResourceRepository();
    const archived = Resource.create({
      id: 'r1',
      typeId: 'rt1',
      kind: 'quantity',
      name: 'Old budget',
      amount: 100,
      now: t0,
    });
    archived.archive(t0);
    await resources.save(archived);

    const pools = await new ResourcePoolsService(resources).list();

    expect(pools).toEqual([]);
  });
});
