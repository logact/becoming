import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { makeFakeRepos } from '../../__tests__/fakes';
import { NoteLinkOptionsService } from '../NoteLinkOptionsService';

const now = new Date('2026-08-22T08:00:00Z');

describe('NoteLinkOptionsService', () => {
  it('returns sorted active Goal and Project options and excludes archived entities', async () => {
    const repos = await makeFakeRepos();
    const alphaGoal = Goal.create({ id: 'goal-a', title: 'Alpha goal', now });
    const archivedGoal = Goal.create({ id: 'goal-z', title: 'Archived goal', now });
    archivedGoal.archive(now);
    const betaProject = Project.create({ id: 'project-b', name: 'Beta project', goalId: alphaGoal.id, now });
    const archivedProject = Project.create({ id: 'project-z', name: 'Archived project', goalId: alphaGoal.id, now });
    archivedProject.archive(now);
    await Promise.all([
      repos.goalRepo.save(alphaGoal),
      repos.goalRepo.save(archivedGoal),
      repos.projectRepo.save(betaProject),
      repos.projectRepo.save(archivedProject),
    ]);

    expect(await new NoteLinkOptionsService(repos.goalRepo, repos.projectRepo).getOptions()).toEqual([
      { type: 'goal', id: 'goal-a', title: 'Alpha goal', status: 'todo' },
      { type: 'project', id: 'project-b', title: 'Beta project', status: 'planning' },
    ]);
  });
});
