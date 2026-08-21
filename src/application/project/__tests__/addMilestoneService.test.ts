import { DomainError } from '../../../domain/shared/errors';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { AddMilestoneService } from '../AddMilestoneService';
import { makeFakeRepos } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');

async function makeService() {
  const { projectRepo: projects, milestoneRepo: milestones } = await makeFakeRepos();
  return { service: new AddMilestoneService(projects, milestones), projects, milestones };
}

describe('AddMilestoneService', () => {
  it('saves a milestone for the project', async () => {
    const { service, projects, milestones } = await makeService();
    await projects.save(
      Project.create({ id: 'p1', name: 'Project One', goalId: 'g-root', now: t0 }),
    );

    await service.add({
      id: 'm1',
      projectId: 'p1',
      title: 'Beta release',
      date: new Date('2026-04-01T00:00:00Z'),
      now: t0,
    });

    const milestone = await milestones.findById('m1');
    expect(milestone).not.toBeNull();
    expect(milestone.id).toBe('m1');
    expect(milestone.projectId).toBe('p1');
    expect(milestone.title).toBe('Beta release');
    expect(milestone.date).toEqual(new Date('2026-04-01T00:00:00Z'));
  });

  it('rejects an empty title', async () => {
    const { service, projects, milestones } = await makeService();
    await projects.save(
      Project.create({ id: 'p1', name: 'Project One', goalId: 'g-root', now: t0 }),
    );

    await expect(
      service.add({ id: 'm1', projectId: 'p1', title: '', date: t0, now: t0 }),
    ).rejects.toThrow(DomainError);
    expect(await milestones.list()).toHaveLength(0);
  });

  it('rejects an unknown project', async () => {
    const { service } = await makeService();

    await expect(
      service.add({ id: 'm1', projectId: 'missing', title: 'Beta', date: t0, now: t0 }),
    ).rejects.toThrow(DomainError);
  });
});
