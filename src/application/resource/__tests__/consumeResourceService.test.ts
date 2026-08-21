import { DomainError } from '../../../domain/shared/errors';
import { Relation } from '../../../domain/relation/Relation';
import { Resource } from '../../../domain/resource/Resource';
import { ConsumeResourceService } from '../ConsumeResourceService';
import { formatConsumptionDetail } from '../consumption';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');

async function makeService() {
  const {
    resourceRepo: resources,
    relationRepo: relations,
    recordRepo: records,
  } = await makeFakeRepos();
  return {
    service: new ConsumeResourceService(resources, relations, records),
    resources,
    relations,
    records,
  };
}

/** A quantity resource of 100 units with `allocated` units allocated to project p1. */
async function quantityResource(
  resources: TestRepositories['resourceRepo'],
  id: string,
  allocated: number,
): Promise<Resource> {
  const resource = Resource.create({
    id,
    typeId: `rt-${id}`,
    kind: 'quantity',
    name: `Budget ${id}`,
    amount: 100,
    now: t0,
  });
  resource.allocate({ id: `al-${id}`, projectId: 'p1', amount: allocated }, t0);
  await resources.save(resource);
  return resource;
}

describe('ConsumeResourceService', () => {
  it('appends a record and saves a consumes relation with JSON detail', async () => {
    const { service, resources, relations, records } = await makeService();
    await quantityResource(resources, 'r1', 40);

    await service.consume({
      recordId: 'rec1',
      relationId: 'rel1',
      resourceId: 'r1',
      projectId: 'p1',
      amount: 10,
      now: t0,
    });

    const [record] = await records.listRecent(10);
    expect(record.id).toBe('rec1');
    expect(record.kind).toBe('resourceConsumed');
    expect(record.detail).toBe('Consumed 10 from “Budget r1”');
    expect(record.occurredAt).toEqual(t0);

    const [relation] = await relations.list();
    expect(relation.id).toBe('rel1');
    expect(relation.sourceType).toBe('record');
    expect(relation.sourceId).toBe('rec1');
    expect(relation.targetType).toBe('resource');
    expect(relation.targetId).toBe('r1');
    expect(relation.kind).toBe('consumes');
    expect(JSON.parse(relation.detail ?? '')).toEqual({ projectId: 'p1', amount: 10 });
  });

  it('allows consumption up to exactly the allocated amount', async () => {
    const { service, resources, relations } = await makeService();
    await quantityResource(resources, 'r1', 40);
    await relations.save(
      Relation.create({
        id: 'rel0',
        sourceType: 'record',
        sourceId: 'rec0',
        targetType: 'resource',
        targetId: 'r1',
        kind: 'consumes',
        now: t0,
        detail: formatConsumptionDetail({ projectId: 'p1', amount: 30 }),
      }),
    );

    await service.consume({
      recordId: 'rec1',
      relationId: 'rel1',
      resourceId: 'r1',
      projectId: 'p1',
      amount: 10,
      now: t0,
    });

    expect(await relations.list()).toHaveLength(2);
  });

  it('rejects when consumed + amount exceeds the allocation', async () => {
    const { service, resources, relations, records } = await makeService();
    await quantityResource(resources, 'r1', 40);
    await relations.save(
      Relation.create({
        id: 'rel0',
        sourceType: 'record',
        sourceId: 'rec0',
        targetType: 'resource',
        targetId: 'r1',
        kind: 'consumes',
        now: t0,
        detail: formatConsumptionDetail({ projectId: 'p1', amount: 35 }),
      }),
    );

    await expect(
      service.consume({
        recordId: 'rec1',
        relationId: 'rel1',
        resourceId: 'r1',
        projectId: 'p1',
        amount: 10,
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
    // A rejected consumption leaves no trace.
    expect(await records.listRecent(10)).toHaveLength(0);
    expect(await relations.list()).toHaveLength(1);
  });

  it('ignores consumption of other projects when checking the allocation', async () => {
    const { service, resources, relations } = await makeService();
    await quantityResource(resources, 'r1', 40);
    await relations.save(
      Relation.create({
        id: 'rel0',
        sourceType: 'record',
        sourceId: 'rec0',
        targetType: 'resource',
        targetId: 'r1',
        kind: 'consumes',
        now: t0,
        detail: formatConsumptionDetail({ projectId: 'p2', amount: 35 }),
      }),
    );

    await service.consume({
      recordId: 'rec1',
      relationId: 'rel1',
      resourceId: 'r1',
      projectId: 'p1',
      amount: 40,
      now: t0,
    });

    expect(await relations.list()).toHaveLength(2);
  });

  it('rejects a time resource', async () => {
    const { service, resources } = await makeService();
    await resources.save(
      Resource.create({
        id: 'r1',
        typeId: 'rt-r1',
        kind: 'time',
        name: 'Focus time',
        amount: 600,
        now: t0,
      }),
    );

    await expect(
      service.consume({
        recordId: 'rec1',
        relationId: 'rel1',
        resourceId: 'r1',
        projectId: 'p1',
        amount: 10,
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects when the resource has no allocation to the project', async () => {
    const { service, resources } = await makeService();
    await quantityResource(resources, 'r1', 40);

    await expect(
      service.consume({
        recordId: 'rec1',
        relationId: 'rel1',
        resourceId: 'r1',
        projectId: 'p2',
        amount: 10,
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects an archived resource', async () => {
    const { service, resources } = await makeService();
    const resource = await quantityResource(resources, 'r1', 40);
    resource.archive(t0);
    await resources.save(resource);

    await expect(
      service.consume({
        recordId: 'rec1',
        relationId: 'rel1',
        resourceId: 'r1',
        projectId: 'p1',
        amount: 10,
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects an unknown resource', async () => {
    const { service } = await makeService();

    await expect(
      service.consume({
        recordId: 'rec1',
        relationId: 'rel1',
        resourceId: 'missing',
        projectId: 'p1',
        amount: 10,
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
  });
});
