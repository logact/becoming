import { DomainError } from '../../../domain/shared/errors';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { AddSubGoalService } from '../AddSubGoalService';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');
const PROJECT_DUE = new Date('2026-06-01T00:00:00Z');

async function makeService() {
  const { projectRepo: projects, goalRepo: goals } = await makeFakeRepos();
  return { service: new AddSubGoalService(projects, goals), projects, goals };
}

/** Project p1 serving goal g-root, with the given project due. */
async function seedProject(
  projects: TestRepositories['projectRepo'],
  goals: TestRepositories['goalRepo'],
  due?: Date,
): Promise<void> {
  await goals.save(Goal.create({ id: 'g-root', title: 'Root goal', now: t0 }));
  await projects.save(
    Project.create({
      id: 'p1',
      name: 'Project One',
      goalId: 'g-root',
      ...(due === undefined ? {} : { due }),
      now: t0,
    }),
  );
}

describe('AddSubGoalService', () => {
  it('saves a sub-goal under a parent of the project tree', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals, PROJECT_DUE);
    await goals.save(
      Goal.create({ id: 'g-sub', title: 'Sub goal', projectId: 'p1', parentGoalId: 'g-root', now: t0 }),
    );

    await service.add({
      id: 'g-new',
      projectId: 'p1',
      parentGoalId: 'g-sub',
      title: 'Nested goal',
      startAt: new Date('2026-02-15T00:00:00Z'),
      due: new Date('2026-03-01T00:00:00Z'),
      milestoneId: 'm1',
      now: t0,
    });

    expect(await goals.list()).toHaveLength(3);
    const goal = await goals.findById('g-new');
    expect(goal).toBeDefined();
    expect(goal?.title).toBe('Nested goal');
    expect(goal?.projectId).toBe('p1');
    expect(goal?.parentGoalId).toBe('g-sub');
    expect(goal?.startAt).toEqual(new Date('2026-02-15T00:00:00Z'));
    expect(goal?.due).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(goal?.milestoneId).toBe('m1');
    expect(goal?.status).toBe('todo');
  });

  it('accepts the serving goal as the parent and works without due/milestone', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals, PROJECT_DUE);

    await service.add({
      id: 'g-new',
      projectId: 'p1',
      parentGoalId: 'g-root',
      title: 'Direct sub-goal',
      now: t0,
    });

    const goal = await goals.findById('g-new');
    expect(goal?.parentGoalId).toBe('g-root');
    expect(goal?.startAt).toBeUndefined();
    expect(goal?.due).toBeUndefined();
    expect(goal?.milestoneId).toBeUndefined();
  });

  it('accepts no parent (the sub-goal attaches under the root)', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals, PROJECT_DUE);

    await service.add({ id: 'g-new', projectId: 'p1', title: 'Orphan sub-goal', now: t0 });

    const goal = await goals.findById('g-new');
    expect(goal?.parentGoalId).toBeUndefined();
  });

  it('rejects an empty title', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals, PROJECT_DUE);

    await expect(
      service.add({ id: 'g-new', projectId: 'p1', title: '   ', now: t0 }),
    ).rejects.toThrow(DomainError);
    expect(await goals.list()).toHaveLength(1);
  });

  it('rejects a parent outside the project goal tree', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals, PROJECT_DUE);
    await goals.save(
      Goal.create({ id: 'g-other', title: 'Other tree', projectId: 'p2', now: t0 }),
    );

    await expect(
      service.add({
        id: 'g-new',
        projectId: 'p1',
        parentGoalId: 'g-other',
        title: 'Nested goal',
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
    expect(await goals.list()).toHaveLength(2);
  });

  it('rejects an unknown parent goal', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals, PROJECT_DUE);

    await expect(
      service.add({
        id: 'g-new',
        projectId: 'p1',
        parentGoalId: 'g-missing',
        title: 'Nested goal',
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects a due not earlier than the project due', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals, PROJECT_DUE);

    await expect(
      service.add({ id: 'g-new', projectId: 'p1', title: 'Late', due: PROJECT_DUE, now: t0 }),
    ).rejects.toThrow(DomainError);
    await expect(
      service.add({
        id: 'g-new',
        projectId: 'p1',
        title: 'Later',
        due: new Date('2026-07-01T00:00:00Z'),
        now: t0,
      }),
    ).rejects.toThrow(DomainError);
    expect(await goals.list()).toHaveLength(1);
  });

  it('does not check the due when the project has none', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals);

    await service.add({
      id: 'g-new',
      projectId: 'p1',
      title: 'Any due',
      due: new Date('2027-01-01T00:00:00Z'),
      now: t0,
    });

    expect(await goals.findById('g-new')).not.toBeNull();
  });

  it('rejects an unknown project', async () => {
    const { service } = await makeService();

    await expect(
      service.add({ id: 'g-new', projectId: 'missing', title: 'Nested goal', now: t0 }),
    ).rejects.toThrow(DomainError);
  });
});
