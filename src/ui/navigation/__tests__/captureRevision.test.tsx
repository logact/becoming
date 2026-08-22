import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import type { AppServices } from '../../composition/AppServicesProvider';
import { AppServicesProvider } from '../../composition/AppServicesProvider';
import { DashboardPage } from '../../pages/dashboard/DashboardPage';
import { GoalsPage } from '../../pages/goals/GoalsPage';
import { IdeasPage } from '../../pages/ideas/IdeasPage';
import { NotesPage } from '../../pages/notes/NotesPage';
import { TasksPage } from '../../pages/tasks/TasksPage';
import { useCaptureRevisionActions } from '../CaptureRevision';
import { NavigationShell, type ShellDestination } from '../NavigationShell';

function RevisionHost({ children, onMount }: { children: React.ReactNode; onMount: () => void }) {
  const revision = useCaptureRevisionActions();
  useEffect(onMount, [onMount]);
  return (
    <View>
      <Pressable testID="increment-capture-revision" onPress={revision.increment} />
      {children}
    </View>
  );
}

function destination(renderList: () => React.ReactElement): ShellDestination[] {
  return [{ id: 'test', title: 'Test', icon: 'grid', renderList }];
}

const emptyGoals = {
  stats: { activeGoals: 0, totalGoals: 0 },
  attention: [],
  focus: [],
  byStatus: { todo: 0, doing: 0, paused: 0, failed: 0, done: 0 },
  byLabel: [],
  allGoals: { todo: [], doing: [], paused: [], failed: [], done: [] },
};

const emptyTasks = {
  stats: { doing: 0, todo: 0, done: 0, overdue: 0 },
  attention: [],
  doingNow: [],
  byStatus: { todo: 0, doing: 0, paused: 0, failed: 0, done: 0 },
  byLabel: [],
  allTasks: { todo: [], doing: [], paused: [], failed: [], done: [] },
  recentActivity: [],
};

describe('captureRevision collection refresh', () => {
  it('reloads Dashboard without remounting it', async () => {
    const getDashboard = jest.fn(async () => ({
      doing: [], attention: [], recentActivity: [], stats: { doingNow: 0, doneToday: 0, dueToday: 0 },
    }));
    const mounted = jest.fn();
    const services = {
      dashboard: { getDashboard },
      attention: { dismiss: jest.fn(async () => undefined) },
    } as unknown as AppServices;
    render(
      <AppServicesProvider services={services}>
        <NavigationShell destinations={destination(() => (
          <RevisionHost onMount={mounted}><DashboardPage /></RevisionHost>
        ))} />
      </AppServicesProvider>,
    );
    await screen.findByTestId('dashboard-page');
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('increment-capture-revision'));
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2));
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('reloads Ideas without remounting it', async () => {
    const getOverview = jest.fn(async () => ({
      counts: { open: 0, handled: 0 },
      open: { captured: [], exploring: [], paused: [] },
      handled: [],
      recentActivity: [],
    }));
    const mounted = jest.fn();
    render(<NavigationShell destinations={destination(() => (
      <RevisionHost onMount={mounted}>
        <IdeasPage
          overview={{ getOverview }}
          capture={{ capture: jest.fn(async () => undefined) }}
          derivationOptions={{ getOptions: jest.fn(async () => []) }}
          createGoal={{ create: jest.fn(async () => undefined) }}
          createTask={{ create: jest.fn(async () => undefined) }}
          extractNote={{ extract: jest.fn(async () => undefined) }}
        />
      </RevisionHost>
    ))} />);
    await screen.findByTestId('ideas-page');
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('increment-capture-revision'));
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(2));
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('reloads Goals without remounting it', async () => {
    const getOverview = jest.fn(async () => emptyGoals);
    const mounted = jest.fn();
    render(<NavigationShell destinations={destination(() => (
      <RevisionHost onMount={mounted}><GoalsPage overview={{ getOverview }} /></RevisionHost>
    ))} />);
    await screen.findByTestId('goals-page');
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('increment-capture-revision'));
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(2));
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('reloads Tasks without remounting it', async () => {
    const getOverview = jest.fn(async () => emptyTasks);
    const mounted = jest.fn();
    render(<NavigationShell destinations={destination(() => (
      <RevisionHost onMount={mounted}><TasksPage overview={{ getOverview }} /></RevisionHost>
    ))} />);
    await screen.findByTestId('tasks-page');
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('increment-capture-revision'));
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(2));
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('reloads Notes without remounting it', async () => {
    const getOverview = jest.fn(async () => ({
      counts: { active: 0, archived: 0 }, pinned: [], active: [], archived: [], recentActivity: [],
    }));
    const mounted = jest.fn();
    render(<NavigationShell destinations={destination(() => (
      <RevisionHost onMount={mounted}>
        <NotesPage
          overview={{ getOverview }}
          capture={{ capture: jest.fn(async () => undefined) }}
        />
      </RevisionHost>
    ))} />);
    await screen.findByTestId('notes-page');
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('increment-capture-revision'));
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(2));
    expect(mounted).toHaveBeenCalledTimes(1);
  });
});
