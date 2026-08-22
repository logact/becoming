import { Project } from '../../../domain/project/Project';
import { makeFakeRepos } from '../../__tests__/fakes';
import { CaptureOptionsService } from '../CaptureOptionsService';

const at = (minute: number) => new Date(`2026-08-22T10:${String(minute).padStart(2, '0')}:00Z`);

describe('CaptureOptionsService', () => {
  it('excludes archived Projects and sorts active, then planning/paused, by newest update', async () => {
    const repos = await makeFakeRepos();
    const projects = [
      Project.restore({
        id: 'active-old', name: 'Active old', goalId: 'goal-1', status: 'active', archived: false,
        labelIds: [], createdAt: at(0), updatedAt: at(1),
      }),
      Project.restore({
        id: 'active-new', name: 'Active new', goalId: 'goal-1', status: 'active', archived: false,
        labelIds: [], createdAt: at(0), updatedAt: at(9),
      }),
      Project.restore({
        id: 'planning', name: 'Planning', goalId: 'goal-1', status: 'planning', archived: false,
        labelIds: [], createdAt: at(0), updatedAt: at(3),
      }),
      Project.restore({
        id: 'paused', name: 'Paused', goalId: 'goal-1', status: 'paused', archived: false,
        labelIds: [], createdAt: at(0), updatedAt: at(8),
      }),
      Project.restore({
        id: 'done', name: 'Done', goalId: 'goal-1', status: 'done', archived: false,
        labelIds: [], createdAt: at(0), updatedAt: at(7),
      }),
      Project.restore({
        id: 'archived', name: 'Archived', goalId: 'goal-1', status: 'active', archived: true,
        labelIds: [], createdAt: at(0), updatedAt: at(10),
      }),
    ];
    await Promise.all(projects.map((project) => repos.projectRepo.save(project)));

    const options = await new CaptureOptionsService(repos.projectRepo).getOptions();

    expect(options).toEqual({ projects: [
      { id: 'active-new', name: 'Active new', status: 'active' },
      { id: 'active-old', name: 'Active old', status: 'active' },
      { id: 'paused', name: 'Paused', status: 'paused' },
      { id: 'planning', name: 'Planning', status: 'planning' },
      { id: 'done', name: 'Done', status: 'done' },
    ] });
  });

  it('returns an empty Project option list', async () => {
    const repos = await makeFakeRepos();

    await expect(new CaptureOptionsService(repos.projectRepo).getOptions())
      .resolves.toEqual({ projects: [] });
  });
});
