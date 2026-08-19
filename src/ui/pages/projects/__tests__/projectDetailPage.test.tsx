import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { ProjectDetailView } from '../../../../application/project/ProjectDetailService';
import { Project } from '../../../../domain/project/Project';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { ProjectDetailPage } from '../ProjectDetailPage';

const HOUR = 60 * 60 * 1000;

function renderDetail(detailView: ProjectDetailView, projectId = 'p1') {
  const detail = { getDetail: jest.fn(async (_id: string) => detailView) };
  const destinations: ShellDestination[] = [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <ProjectDetailPage projectId={projectId} detail={detail} />,
      renderDetail: (entityId) => <Text testID={`goal-detail-${entityId}`} />,
      renderScreen: (screenId) => <Text testID={`screen:${screenId}`} />,
    },
  ];
  render(<NavigationShell destinations={destinations} />);
  return { detail };
}

function detailFixture(now: Date): ProjectDetailView {
  const project = Project.create({ id: 'p1', name: 'Spring training plan', goalId: 'g1', now });
  project.activate(now);
  project.setDue(new Date(now.getTime() + 60 * 24 * HOUR), undefined, now);
  return {
    project,
    plan: {
      id: 'g1',
      title: 'Run a half marathon',
      status: 'doing',
      tasks: [{ id: 't1', title: 'Base run 8 km', status: 'done' }],
      children: [
        {
          id: 'g2',
          title: '10 km under 50:00',
          status: 'doing',
          tasks: [{ id: 't2', title: 'Intervals 6 × 800 m', status: 'doing' }],
          children: [{ id: 'g3', title: 'Threshold endurance', status: 'todo', tasks: [], children: [] }],
        },
      ],
    },
    progress: { doneSubGoals: 1, totalSubGoals: 2, doneTasks: 1, totalTasks: 2, percent: 50 },
    weeks: { current: 6, total: 16 },
    milestones: [
      {
        id: 'm1',
        title: 'Base phase',
        date: new Date(now.getTime() - 7 * 24 * HOUR),
        reached: true,
        items: [{ kind: 'goal', id: 'g2', title: '10 km under 50:00', status: 'doing' }],
      },
      {
        id: 'm2',
        title: 'Race week',
        date: new Date(now.getTime() + 30 * 24 * HOUR),
        reached: false,
        items: [
          {
            kind: 'task',
            id: 't2',
            title: 'Intervals 6 × 800 m',
            status: 'doing',
            context: '10 km under 50:00',
          },
        ],
      },
    ],
    tasks: [
      { id: 't1', title: 'Base run 8 km', status: 'done' },
      { id: 't2', title: 'Intervals 6 × 800 m', status: 'doing', goalTitle: '10 km under 50:00' },
    ],
    resources: [
      {
        id: 'r1',
        name: 'Time budget',
        kind: 'time',
        amount: 480,
        span: { startAt: new Date(now.getTime() - 8 * HOUR), endAt: now },
      },
      { id: 'r2', name: 'Gear budget', kind: 'quantity', amount: 3000 },
    ],
    recentActivity: [
      {
        id: 'rec-1',
        kind: 'taskCompleted',
        detail: 'Completed "Long run 14 km"',
        occurredAt: new Date(now.getTime() - 2 * HOUR),
      },
    ],
  };
}

describe('ProjectDetailPage', () => {
  it('renders the header with week meta, progress stats and the tree view by default', async () => {
    const now = new Date();
    const { detail } = renderDetail(detailFixture(now));

    const header = within(await screen.findByTestId('project-detail-header'));
    expect(header.getByText('Spring training plan')).toBeTruthy();
    expect(header.getByText('Active')).toBeTruthy();
    expect(header.getByText(/^Week 6 of 16 · ends /)).toBeTruthy();
    expect(header.getByText('50%')).toBeTruthy();
    expect(header.getByText('1 of 2 sub-goals · 1 of 2 tasks')).toBeTruthy();

    const plan = within(screen.getByTestId('plan-section'));
    expect(plan.getByText('Plan — goal · sub-goals · tasks')).toBeTruthy();
    expect(plan.getByTestId('plan-tree-view')).toBeTruthy();
    expect(plan.getByText('Run a half marathon')).toBeTruthy();
    expect(plan.getByText('Goal · 2 sub-goals · 2 tasks')).toBeTruthy();
    expect(plan.getByText('10 km under 50:00')).toBeTruthy();
    expect(plan.getByText('Sub-goal · 0 / 1 tasks')).toBeTruthy();
    expect(plan.getByText('Threshold endurance')).toBeTruthy();
    // Tasks render under their goal node with a status meta.
    expect(plan.getByTestId('plan-task-t1')).toBeTruthy();
    expect(plan.getByTestId('plan-task-t2')).toBeTruthy();
    // One "Add task or sub-goal" row per tree level (root, g2, g3).
    expect(plan.getAllByText('Add task or sub-goal')).toHaveLength(3);

    const resources = within(screen.getByTestId('resources-section'));
    expect(resources.getByText('Time budget')).toBeTruthy();
    // Time resources show the span duration: 8 h.
    expect(resources.getByText('8 h')).toBeTruthy();
    // Quantity resources show the number.
    expect(resources.getByText('Gear budget')).toBeTruthy();
    expect(resources.getByText('3000')).toBeTruthy();

    const activity = within(screen.getByTestId('activity-section'));
    expect(activity.getByText('Completed "Long run 14 km"')).toBeTruthy();
    expect(activity.getByText('2 h')).toBeTruthy();

    // The page passes `now` explicitly to the read service.
    expect(detail.getDetail).toHaveBeenCalledWith('p1', expect.any(Date));
  });

  it('switches between the Tree, List and Roadmap views', async () => {
    renderDetail(detailFixture(new Date()));

    const plan = within(await screen.findByTestId('plan-section'));
    expect(plan.getByTestId('plan-tree-view')).toBeTruthy();

    fireEvent.press(plan.getByTestId('plan-segmented-list'));
    expect(plan.queryByTestId('plan-tree-view')).toBeNull();
    expect(plan.getByTestId('plan-list-view')).toBeTruthy();
    expect(plan.getByText('Sub-goals')).toBeTruthy();
    expect(plan.getByText('Tasks')).toBeTruthy();
    // Nested sub-goals show their parent context; tasks show the owning goal.
    expect(plan.getByText('under 10 km under 50:00 · 0 / 0 tasks')).toBeTruthy();
    // '10 km under 50:00' appears as the sub-goal title and as task context.
    expect(plan.getAllByText('10 km under 50:00')).toHaveLength(2);

    fireEvent.press(plan.getByTestId('plan-segmented-roadmap'));
    expect(plan.queryByTestId('plan-list-view')).toBeNull();
    expect(plan.getByTestId('plan-roadmap-view')).toBeTruthy();
    expect(plan.getByText('Base phase')).toBeTruthy();
    expect(plan.getByText('Reached')).toBeTruthy();
    expect(plan.getByText('Race week')).toBeTruthy();
    expect(plan.getByText('Upcoming')).toBeTruthy();
    // The today marker sits between the reached and the upcoming milestone.
    expect(plan.getByTestId('roadmap-today')).toBeTruthy();
    expect(plan.getByTestId('project-due-row')).toBeTruthy();
    expect(plan.getByText('Spring training plan ends')).toBeTruthy();

    fireEvent.press(plan.getByTestId('plan-segmented-tree'));
    expect(plan.getByTestId('plan-tree-view')).toBeTruthy();
  });

  it('opens the goal detail when a plan goal row is pressed', async () => {
    renderDetail(detailFixture(new Date()));

    fireEvent.press(await screen.findByTestId('plan-goal-g2'));

    expect(await screen.findByTestId('goal-detail-g2')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('pushes the add-plan-item screen from the tree add row with the node as parent', async () => {
    renderDetail(detailFixture(new Date()));

    fireEvent.press(await screen.findByTestId('add-plan-item-g2'));

    expect(await screen.findByTestId('screen:project:p1:add-plan-item:parent=g2')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('pushes the add-plan-item screen from the roadmap "Add milestone" row with the milestone tab', async () => {
    renderDetail(detailFixture(new Date()));

    const plan = within(await screen.findByTestId('plan-section'));
    fireEvent.press(plan.getByTestId('plan-segmented-roadmap'));
    fireEvent.press(plan.getByTestId('add-milestone'));

    expect(await screen.findByTestId('screen:project:p1:add-plan-item:tab=milestone')).toBeTruthy();
  });

  it('pushes the allocate-resource screen from the resources section', async () => {
    renderDetail(detailFixture(new Date()));

    fireEvent.press(await screen.findByTestId('allocate-resource'));

    expect(await screen.findByTestId('screen:project:p1:allocate-resource')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('renders "Unknown project" when the service returns null', async () => {
    const view = detailFixture(new Date());
    renderDetail({ ...view, project: null, plan: null }, 'p-missing');

    expect(await screen.findByText('Unknown project.')).toBeTruthy();
    expect(screen.queryByTestId('project-detail-header')).toBeNull();
  });
});
