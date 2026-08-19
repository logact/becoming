import { render, screen, within } from '@testing-library/react-native';
import React from 'react';

import type { GoalDetailView } from '../../../../application/goal/GoalDetailService';
import { Goal } from '../../../../domain/goal/Goal';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { GoalDetailPage } from '../GoalDetailPage';

const HOUR = 60 * 60 * 1000;

function renderDetail(detailView: GoalDetailView, goalId = 'g-run') {
  const detail = { getDetail: jest.fn(async (_id: string) => detailView) };
  const destinations: ShellDestination[] = [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <GoalDetailPage goalId={goalId} detail={detail} />,
    },
  ];
  render(<NavigationShell destinations={destinations} />);
  return { detail };
}

function detailFixture(now: Date): GoalDetailView {
  return {
    goal: Goal.restore({
      id: 'g-run',
      title: 'Run a half marathon',
      status: 'doing',
      archived: false,
      labelIds: ['l-health'],
      due: new Date(now.getTime() + 30 * 24 * HOUR),
      createdAt: now,
      updatedAt: now,
    }),
    projects: [
      { id: 'p-active', name: 'Spring training plan', status: 'active', subGoalCount: 3 },
      { id: 'p-alt', name: 'Off-season base building', status: 'planning', subGoalCount: 2 },
    ],
    activeProjectId: 'p-active',
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

describe('GoalDetailPage', () => {
  it('renders the header, projects with the Current plan tag, and recent activity', async () => {
    const now = new Date();
    const { detail } = renderDetail(detailFixture(now));

    const header = within(await screen.findByTestId('goal-detail-header'));
    expect(header.getByText('Run a half marathon')).toBeTruthy();
    expect(header.getByText('Doing')).toBeTruthy();
    expect(header.getByText(/^Target /)).toBeTruthy();
    expect(header.getByText('l-health')).toBeTruthy();
    expect(header.getByText('1 / 2')).toBeTruthy();
    expect(header.getByText('Active projects')).toBeTruthy();

    const projects = within(screen.getByTestId('projects-section'));
    expect(projects.getByText('Spring training plan')).toBeTruthy();
    expect(projects.getByText('3 sub-goals')).toBeTruthy();
    expect(projects.getByText('Off-season base building')).toBeTruthy();
    expect(projects.getByText('Planning')).toBeTruthy();
    // Only the active project carries the tag.
    expect(projects.getByTestId('current-plan-p-active')).toBeTruthy();
    expect(projects.queryByTestId('current-plan-p-alt')).toBeNull();

    const activity = within(screen.getByTestId('activity-section'));
    expect(activity.getByText('Recent activity')).toBeTruthy();
    expect(activity.getByText('Completed "Long run 14 km"')).toBeTruthy();
    expect(activity.getByText('2 h')).toBeTruthy();

    expect(detail.getDetail).toHaveBeenCalledWith('g-run');
  });

  it('renders "Unknown goal" when the service returns null', async () => {
    const view = detailFixture(new Date());
    renderDetail({ ...view, goal: null }, 'g-missing');

    expect(await screen.findByText('Unknown goal.')).toBeTruthy();
    expect(screen.queryByTestId('goal-detail-header')).toBeNull();
  });
});
