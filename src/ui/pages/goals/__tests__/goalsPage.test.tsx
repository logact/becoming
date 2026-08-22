import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import type { GoalDetailView } from '../../../../application/goal/GoalDetailService';
import type { GoalsOverviewView } from '../../../../application/goal/GoalsOverviewService';
import type { LibraryCounts } from '../../../../application/library/LibraryOverviewService';
import { Goal } from '../../../../domain/goal/Goal';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { LibraryPage } from '../../library/LibraryPage';
import { GoalDetailPage } from '../GoalDetailPage';
import { GoalsPage } from '../GoalsPage';

const HOUR = 60 * 60 * 1000;

const LIBRARY_COUNTS: LibraryCounts = { goals: 4, tasks: 3, projects: 2, ideas: 5, notes: 6, resources: 1 };

/**
 * Plain stub services with the same shapes as LibraryOverviewService /
 * GoalsOverviewService / GoalDetailService — the pages take them as props,
 * so no repositories or AppServices provider are involved.
 */
function makeStubs(overviewView: GoalsOverviewView, detailView: GoalDetailView) {
  const library = { getCounts: jest.fn(async () => LIBRARY_COUNTS) };
  const overview = { getOverview: jest.fn(async (_now: Date) => overviewView) };
  const detail = { getDetail: jest.fn(async (_goalId: string) => detailView) };
  const createProject = { create: jest.fn(async () => undefined) };
  const selectCurrentPlan = { select: jest.fn(async () => undefined) };
  const schedule = { schedule: jest.fn(async () => undefined) };
  return { library, overview, detail, createProject, selectCurrentPlan, schedule };
}

/** The app's Library chain: hub → goals screen → goal detail. */
function goalsDestinations(stubs: ReturnType<typeof makeStubs>): ShellDestination[] {
  return [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <LibraryPage overview={stubs.library} />,
      renderScreen: (id) => (id === 'goals' ? <GoalsPage overview={stubs.overview} /> : null),
      renderDetail: (id) => (
        <GoalDetailPage
          goalId={id}
          detail={stubs.detail}
          createProject={stubs.createProject}
          selectCurrentPlan={stubs.selectCurrentPlan}
          schedule={stubs.schedule}
        />
      ),
    },
  ];
}

/** Navigates the chain the user takes: Library tab → hub → Goals row. */
async function openGoalsFromHub(): Promise<void> {
  fireEvent.press(await screen.findByTestId('library-row-goals'));
  await screen.findByTestId('stats-row');
}

function overviewFixture(now: Date): GoalsOverviewView {
  return {
    stats: { activeGoals: 2, totalGoals: 4 },
    attention: [
      { id: 'g-failed', title: 'Ship MVP', reason: 'failed' },
      {
        id: 'g-due',
        title: 'File taxes',
        reason: 'overdue',
        due: new Date(now.getTime() + 20 * HOUR),
      },
      { id: 'g-ready', title: 'Ready goal', reason: 'readyToStart', startAt: now },
    ],
    focus: [
      {
        id: 'g-run',
        title: 'Run a half marathon',
        status: 'doing',
        labelIds: ['l-health'],
        due: new Date(now.getTime() + 30 * 24 * HOUR),
      },
      { id: 'g-read', title: 'Read 12 books', status: 'doing', labelIds: ['l-growth'] },
    ],
    byStatus: { todo: 1, doing: 2, paused: 0, failed: 1, done: 0 },
    byLabel: [{ labelId: 'l-health', name: 'Health', count: 2 }],
    allGoals: {
      todo: [{ id: 'g-fund', title: 'Emergency fund', status: 'todo', labelIds: [] }],
      doing: [
        {
          id: 'g-run',
          title: 'Run a half marathon',
          status: 'doing',
          labelIds: ['l-health'],
          due: new Date(now.getTime() + 30 * 24 * HOUR),
        },
        { id: 'g-read', title: 'Read 12 books', status: 'doing', labelIds: ['l-growth'] },
      ],
      paused: [],
      failed: [{ id: 'g-failed', title: 'Ship MVP', status: 'failed', labelIds: [] }],
      done: [],
    },
  };
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
      {
        id: 'p-active', name: 'Spring training plan', status: 'active', subGoalCount: 3,
        canSelectAsCurrentPlan: false,
      },
      {
        id: 'p-alt', name: 'Off-season base building', status: 'planning', subGoalCount: 2,
        canSelectAsCurrentPlan: true,
      },
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

describe('GoalsPage', () => {
  it('renders stats, attention, focus, by status, by label and all-goals sections', async () => {
    const now = new Date();
    const stubs = makeStubs(overviewFixture(now), detailFixture(now));

    render(<NavigationShell destinations={goalsDestinations(stubs)} />);
    await openGoalsFromHub();

    const stats = within(screen.getByTestId('stats-row'));
    expect(stats.getByText('2 / 4')).toBeTruthy();
    expect(stats.getByText('Active goals')).toBeTruthy();

    const attention = within(screen.getByTestId('attention-section'));
    expect(attention.getByText('Needs attention')).toBeTruthy();
    expect(attention.getByText('Ship MVP')).toBeTruthy();
    expect(attention.getByText('File taxes')).toBeTruthy();
    expect(attention.getByText(/^Due in \d+ h$/)).toBeTruthy();
    expect(attention.getAllByText('Ready to start').length).toBeGreaterThan(0);
    expect(attention.getByText(/Ready to start · Start /)).toBeTruthy();

    const focus = within(screen.getByTestId('focus-section'));
    expect(focus.getByText('Run a half marathon')).toBeTruthy();
    expect(focus.getByText('Read 12 books')).toBeTruthy();
    expect(focus.getAllByText('Doing')).toHaveLength(2);

    const byStatus = within(screen.getByTestId('by-status-section'));
    expect(byStatus.getByText('Todo')).toBeTruthy();
    expect(byStatus.getByText('Paused')).toBeTruthy();
    expect(byStatus.getByText('Done')).toBeTruthy();

    const byLabel = within(screen.getByTestId('by-label-section'));
    expect(byLabel.getByText('Health')).toBeTruthy();
    expect(byLabel.getByText('2')).toBeTruthy();

    const all = within(screen.getByTestId('all-goals-section'));
    expect(all.getByTestId('goal-group-doing')).toBeTruthy();
    expect(all.getByTestId('goal-group-todo')).toBeTruthy();
    expect(all.getByTestId('goal-group-failed')).toBeTruthy();
    // Empty groups are not rendered.
    expect(all.queryByTestId('goal-group-paused')).toBeNull();
    expect(all.getByText('Emergency fund')).toBeTruthy();
  });

  it('opens the goal detail when a goal row is pressed', async () => {
    const now = new Date();
    const stubs = makeStubs(overviewFixture(now), detailFixture(now));

    render(<NavigationShell destinations={goalsDestinations(stubs)} />);
    await openGoalsFromHub();

    fireEvent.press(await screen.findByTestId('goal-row-g-run'));

    // openDetail pushed the detail onto the stack, hiding the tab bar.
    expect(await screen.findByTestId('goal-detail-page')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    await waitFor(() => expect(stubs.detail.getDetail).toHaveBeenCalledWith('g-run'));
    expect(await screen.findByText('Spring training plan')).toBeTruthy();
  });

  it('returns to the hub via the nav-bar back button', async () => {
    const now = new Date();
    const stubs = makeStubs(overviewFixture(now), detailFixture(now));

    render(<NavigationShell destinations={goalsDestinations(stubs)} />);
    await openGoalsFromHub();
    // Pushed screen hides the tab bar.
    expect(screen.queryByTestId('tab-bar')).toBeNull();

    fireEvent.press(screen.getByLabelText('Back'));

    expect(await screen.findByTestId('library-page')).toBeTruthy();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });
});
