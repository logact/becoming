import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Pressable } from 'react-native';

import { makeFakeRepos } from '../../../application/__tests__/fakes';
import { AddMilestoneService } from '../../../application/project/AddMilestoneService';
import { AddSubGoalService } from '../../../application/project/AddSubGoalService';
import { AddTaskService } from '../../../application/project/AddTaskService';
import { ProjectDetailService } from '../../../application/project/ProjectDetailService';
import { ProjectsOverviewService } from '../../../application/project/ProjectsOverviewService';
import { ConsumeResourceService } from '../../../application/resource/ConsumeResourceService';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { appDestinations } from '../../appDestinations';
import { NavigationShell, useShellNavigation } from '../../navigation/NavigationShell';
import { AppServicesProvider, type AppServices } from '../AppServicesProvider';
import { seedDevData } from '../devSeed';

const now = new Date('2026-08-22T08:00:00Z');

function DashboardProjectLauncher() {
  const navigation = useShellNavigation();
  return (
    <Pressable
      testID="dashboard-open-project"
      onPress={() => navigation.pushScreen('project:project-1')}
    />
  );
}

describe('Project detail regression composition', () => {
  it('keeps the dev seed populated for the project detail prototype', async () => {
    const repos = await makeFakeRepos();
    await seedDevData({
      goals: repos.goalRepo,
      tasks: repos.taskRepo,
      ideas: repos.ideaRepo,
      projects: repos.projectRepo,
      resources: repos.resourceRepo,
      records: repos.recordRepo,
      relations: repos.relationRepo,
      milestones: repos.milestoneRepo,
      notes: repos.noteRepo,
      consumeResource: new ConsumeResourceService(
        repos.resourceRepo,
        repos.relationRepo,
        repos.recordRepo,
      ),
    });
    const detail = await new ProjectDetailService(
      repos.projectRepo,
      repos.goalRepo,
      repos.taskRepo,
      repos.resourceRepo,
      repos.recordRepo,
      repos.milestoneRepo,
    ).getDetail('seed-project-training', new Date());

    expect(detail.project?.name).toBe('Spring training plan');
    expect(detail.plan?.children.map((goal) => goal.title)).toEqual(
      expect.arrayContaining(['5 km under 24:00', '10 km under 50:00', 'Race day: finish under 1:55']),
    );
    expect(detail.plan?.children.find((goal) => goal.id === 'seed-subgoal-10k')?.children)
      .toEqual([expect.objectContaining({ id: 'seed-subgoal-threshold' })]);
    expect(detail.milestones).toHaveLength(3);
    expect(detail.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'seed-resource-gear', kind: 'quantity' }),
        expect.objectContaining({ id: 'seed-resource-focus-time', kind: 'time', span: expect.any(Object) }),
      ]),
    );
    expect(await repos.recordRepo.listByTarget('task', 10, 'seed-task-easy-run')).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'taskCreated' })]),
    );
  });

  it('wires Library -> Project -> Add task and persists its taskCreated log relation', async () => {
    const repos = await makeFakeRepos();
    await repos.goalRepo.save(Goal.create({ id: 'goal-1', title: 'Ship the plan', now }));
    await repos.projectRepo.save(
      Project.create({ id: 'project-1', name: 'Release plan', goalId: 'goal-1', now }),
    );

    const services = {
      libraryOverview: {
        getCounts: jest.fn(async () => ({
          goals: 1,
          tasks: 0,
          projects: 1,
          ideas: 0,
          notes: 0,
          resources: 0,
        })),
      },
      projectsOverview: new ProjectsOverviewService(
        repos.projectRepo,
        repos.goalRepo,
        repos.labelRepo,
      ),
      projectDetail: new ProjectDetailService(
        repos.projectRepo,
        repos.goalRepo,
        repos.taskRepo,
        repos.resourceRepo,
        repos.recordRepo,
        repos.milestoneRepo,
      ),
      addSubGoal: new AddSubGoalService(repos.projectRepo, repos.goalRepo),
      addTask: new AddTaskService(
        repos.projectRepo,
        repos.goalRepo,
        repos.taskRepo,
        repos.recordRepo,
        repos.relationRepo,
      ),
      addMilestone: new AddMilestoneService(repos.projectRepo, repos.milestoneRepo),
      resourcePools: { list: jest.fn(async () => []) },
      allocateResource: { allocate: jest.fn(async () => undefined) },
    } as unknown as AppServices;
    const library = appDestinations().find((destination) => destination.id === 'library');
    if (library === undefined) throw new Error('Library destination missing');

    render(
      <AppServicesProvider services={services}>
        <NavigationShell destinations={[library]} />
      </AppServicesProvider>,
    );

    fireEvent.press(await screen.findByTestId('library-row-projects'));
    fireEvent.press(await screen.findByTestId('project-row-project-1'));
    fireEvent.press(await screen.findByTestId('add-plan-item-goal-1'));

    expect(await screen.findByTestId('add-plan-item-page')).toBeTruthy();
    fireEvent.press(screen.getByTestId('add-plan-item-segmented-task'));
    fireEvent.changeText(screen.getByTestId('plan-item-title'), 'Write release notes');
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    await waitFor(async () => {
      expect(await repos.taskRepo.list({ projectId: 'project-1' })).toHaveLength(1);
    });
    const [task] = await repos.taskRepo.list({ projectId: 'project-1' });
    expect(task).toMatchObject({
      title: 'Write release notes',
      projectId: 'project-1',
      goalId: 'goal-1',
    });
    const [record] = await repos.recordRepo.listByTarget('task', 10, task.id);
    expect(record).toMatchObject({
      kind: 'taskCreated',
      detail: 'Created “Write release notes”',
    });
    expect(
      await repos.relationRepo.list({
        sourceType: 'record',
        sourceId: record.id,
        targetType: 'task',
        targetId: task.id,
        kind: 'logs',
      }),
    ).toHaveLength(1);
    expect(await screen.findByTestId(`plan-task-${task.id}`)).toBeTruthy();
  });

  it('keeps nested Project routes on the Dashboard destination stack', async () => {
    const repos = await makeFakeRepos();
    await repos.goalRepo.save(Goal.create({ id: 'goal-1', title: 'Ship the plan', now }));
    await repos.projectRepo.save(
      Project.create({ id: 'project-1', name: 'Release plan', goalId: 'goal-1', now }),
    );
    const services = {
      projectDetail: new ProjectDetailService(
        repos.projectRepo,
        repos.goalRepo,
        repos.taskRepo,
        repos.resourceRepo,
        repos.recordRepo,
        repos.milestoneRepo,
      ),
      addSubGoal: new AddSubGoalService(repos.projectRepo, repos.goalRepo),
      addTask: new AddTaskService(
        repos.projectRepo,
        repos.goalRepo,
        repos.taskRepo,
        repos.recordRepo,
        repos.relationRepo,
      ),
      addMilestone: new AddMilestoneService(repos.projectRepo, repos.milestoneRepo),
      resourcePools: { list: jest.fn(async () => []) },
      allocateResource: { allocate: jest.fn(async () => undefined) },
    } as unknown as AppServices;
    const dashboard = appDestinations().find((destination) => destination.id === 'dashboard');
    if (dashboard === undefined) throw new Error('Dashboard destination missing');

    render(
      <AppServicesProvider services={services}>
        <NavigationShell destinations={[
          { ...dashboard, renderList: () => <DashboardProjectLauncher /> },
        ]} />
      </AppServicesProvider>,
    );

    fireEvent.press(screen.getByTestId('dashboard-open-project'));
    expect(await screen.findByTestId('project-detail-page')).toBeTruthy();
    fireEvent.press(await screen.findByTestId('add-plan-item-goal-1'));

    expect(await screen.findByTestId('add-plan-item-page')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-open-project')).toBeNull();
  });
});
