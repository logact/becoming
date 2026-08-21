import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { TasksOverviewView } from '../../../../application/task/TasksOverviewService';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { TasksPage } from '../TasksPage';

const now = new Date('2026-08-21T12:00:00Z');

function fixture(): TasksOverviewView {
  const doing = { id: 'doing', title: 'Doing task', status: 'doing' as const, projectName: 'Project', labelIds: ['l1'] };
  const todo = { id: 'todo', title: 'Todo task', status: 'todo' as const, projectName: 'Project', due: new Date('2026-08-21T13:00:00Z'), labelIds: [] };
  const failed = { id: 'failed', title: 'Failed task', status: 'failed' as const, projectName: 'Project', labelIds: [] };
  return {
    stats: { doing: 1, todo: 1, done: 0, overdue: 0 },
    attention: [{ ...failed, reason: 'failed' }],
    doingNow: [doing],
    byStatus: { todo: 1, doing: 1, paused: 0, failed: 1, done: 0 },
    byLabel: [{ labelId: 'l1', name: 'Focus', count: 1 }],
    allTasks: { todo: [todo], doing: [doing], paused: [], failed: [failed], done: [] },
    recentActivity: [{ id: 'r1', kind: 'taskStarted', detail: 'Started task', occurredAt: now }],
  };
}

describe('TasksPage', () => {
  it('renders every overview section and opens task detail', async () => {
    const overview = { getOverview: jest.fn(async () => fixture()) };
    const destinations: ShellDestination[] = [{
      id: 'library', title: 'Library', icon: 'folder',
      renderList: () => <TasksPage overview={overview} />,
      renderScreen: (id) => id.startsWith('task:') ? <Text testID={id} /> : null,
    }];
    render(<NavigationShell destinations={destinations} />);

    expect(within(await screen.findByTestId('task-stats')).getByText('Doing')).toBeTruthy();
    expect(screen.getByTestId('task-attention-section')).toBeTruthy();
    expect(screen.getByTestId('doing-now-section')).toBeTruthy();
    expect(screen.getByTestId('task-by-status-section')).toBeTruthy();
    expect(screen.getByTestId('task-by-label-section')).toBeTruthy();
    expect(screen.getByTestId('all-tasks-section')).toBeTruthy();
    expect(screen.getByTestId('task-activity-section')).toBeTruthy();
    expect(screen.getByText('Focus')).toBeTruthy();
    expect(screen.getByText('Started task')).toBeTruthy();
    expect(overview.getOverview).toHaveBeenCalledWith(expect.any(Date));

    fireEvent.press(screen.getByTestId('task-row-todo'));
    expect(await screen.findByTestId('task:todo')).toBeTruthy();
  });
});
