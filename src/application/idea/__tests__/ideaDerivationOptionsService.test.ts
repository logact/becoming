import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { IdeaDerivationOptionsService } from '../IdeaDerivationOptionsService';
import { makeFakeRepos } from '../../__tests__/fakes';

describe('IdeaDerivationOptionsService', () => {
  it('returns active projects with only goals in each project tree', async () => {
    const repos = await makeFakeRepos();
    const now = new Date('2026-08-22T08:00:00Z');
    const root = Goal.create({ id: 'g-root', title: 'Root', now });
    const other = Goal.create({ id: 'g-other', title: 'Other', now });
    const child = Goal.create({ id: 'g-child', title: 'Child', projectId: 'p1', now });
    const archivedChild = Goal.create({ id: 'g-old', title: 'Old', projectId: 'p1', now });
    archivedChild.archive(now);
    await Promise.all([
      repos.goalRepo.save(root), repos.goalRepo.save(other), repos.goalRepo.save(child),
      repos.goalRepo.save(archivedChild),
    ]);
    const project = Project.create({ id: 'p1', name: 'Project', goalId: root.id, now });
    const archived = Project.create({ id: 'p-old', name: 'Old', goalId: other.id, now });
    archived.archive(now);
    await repos.projectRepo.save(project);
    await repos.projectRepo.save(archived);

    const result = await new IdeaDerivationOptionsService(repos.projectRepo, repos.goalRepo).getOptions();

    expect(result).toEqual([{ id: 'p1', name: 'Project', goals: [
      { id: 'g-child', title: 'Child' }, { id: 'g-root', title: 'Root' },
    ] }]);
  });
});
