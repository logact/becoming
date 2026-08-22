import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { ProjectsOverviewView } from '../../../../application/project/ProjectsOverviewService';
import type { LibraryCounts } from '../../../../application/library/LibraryOverviewService';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { LibraryPage } from '../../library/LibraryPage';
import { ProjectsPage } from '../ProjectsPage';

const HOUR = 60 * 60 * 1000;

const LIBRARY_COUNTS: LibraryCounts = { goals: 4, tasks: 3, projects: 2, ideas: 5, notes: 6, resources: 1 };

/**
 * Plain stub services with the same shapes as LibraryOverviewService /
 * ProjectsOverviewService — the pages take them as props, so no repositories
 * or AppServices provider are involved.
 */
function makeStubs(overviewView: ProjectsOverviewView) {
  const library = { getCounts: jest.fn(async () => LIBRARY_COUNTS) };
  const overview = { getOverview: jest.fn(async (_now: Date) => overviewView) };
  return { library, overview };
}

/** The app's Library chain: hub → projects screen. */
function projectsDestinations(stubs: ReturnType<typeof makeStubs>): ShellDestination[] {
  return [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <LibraryPage overview={stubs.library} />,
      renderScreen: (id) =>
        id === 'projects' ? (
          <ProjectsPage overview={stubs.overview} />
        ) : id.startsWith('project:') ? (
          <Text testID={`route-${id}`}>{id}</Text>
        ) : null,
    },
  ];
}

/** Navigates the chain the user takes: Library tab → hub → Projects row. */
async function openProjectsFromHub(): Promise<void> {
  fireEvent.press(await screen.findByTestId('library-row-projects'));
  await screen.findByTestId('stats-row');
}

function overviewFixture(now: Date): ProjectsOverviewView {
  return {
    stats: { activeProjects: 1, totalProjects: 3 },
    attention: [
      { id: 'p-failed', name: 'MVP launch plan', reason: 'failed' },
      {
        id: 'p-due',
        name: 'Tax filing prep',
        reason: 'overdue',
        due: new Date(now.getTime() + 20 * HOUR),
      },
    ],
    focus: [
      {
        id: 'p-run',
        name: 'Spring training plan',
        status: 'active',
        labelIds: ['l-health'],
        goalId: 'g-run',
        goalTitle: 'Run a half marathon',
        due: new Date(now.getTime() + 30 * 24 * HOUR),
      },
    ],
    byStatus: { planning: 1, active: 1, paused: 0, failed: 1, done: 0 },
    byLabel: [{ labelId: 'l-health', name: 'Health', count: 1 }],
    allProjects: {
      planning: [
        {
          id: 'p-base',
          name: 'Off-season base building',
          status: 'planning',
          labelIds: [],
          goalId: 'g-run',
          goalTitle: 'Run a half marathon',
        },
      ],
      active: [
        {
          id: 'p-run',
          name: 'Spring training plan',
          status: 'active',
          labelIds: ['l-health'],
          goalId: 'g-run',
          goalTitle: 'Run a half marathon',
          due: new Date(now.getTime() + 30 * 24 * HOUR),
        },
      ],
      paused: [],
      failed: [
        {
          id: 'p-failed',
          name: 'MVP launch plan',
          status: 'failed',
          labelIds: [],
          goalId: 'g-mvp',
          goalTitle: 'Ship MVP',
        },
      ],
      done: [],
    },
  };
}

describe('ProjectsPage', () => {
  it('renders stats, attention, focus, by status, by label and all-projects sections', async () => {
    const now = new Date();
    const stubs = makeStubs(overviewFixture(now));

    render(<NavigationShell destinations={projectsDestinations(stubs)} />);
    await openProjectsFromHub();

    const stats = within(screen.getByTestId('stats-row'));
    expect(stats.getByText('1 / 3')).toBeTruthy();
    expect(stats.getByText('Active projects')).toBeTruthy();

    const attention = within(screen.getByTestId('attention-section'));
    expect(attention.getByText('Needs attention')).toBeTruthy();
    expect(attention.getByText('MVP launch plan')).toBeTruthy();
    expect(attention.getByText('Tax filing prep')).toBeTruthy();
    expect(attention.getByText(/^Due in \d+ h$/)).toBeTruthy();

    const focus = within(screen.getByTestId('focus-section'));
    expect(focus.getByText('Spring training plan')).toBeTruthy();
    expect(focus.getByText('Active')).toBeTruthy();

    const byStatus = within(screen.getByTestId('by-status-section'));
    expect(byStatus.getByText('Planning')).toBeTruthy();
    expect(byStatus.getByText('Paused')).toBeTruthy();
    expect(byStatus.getByText('Done')).toBeTruthy();

    const byLabel = within(screen.getByTestId('by-label-section'));
    expect(byLabel.getByText('Health')).toBeTruthy();
    expect(byLabel.getByText('1')).toBeTruthy();

    const all = within(screen.getByTestId('all-projects-section'));
    expect(all.getByTestId('project-group-active')).toBeTruthy();
    expect(all.getByTestId('project-group-planning')).toBeTruthy();
    expect(all.getByTestId('project-group-failed')).toBeTruthy();
    // Empty groups are not rendered.
    expect(all.queryByTestId('project-group-paused')).toBeNull();
    expect(all.getByText('Off-season base building')).toBeTruthy();
    // Rows show the serving goal's title.
    expect(all.getAllByText(/Run a half marathon/).length).toBeGreaterThan(0);
  });

  it('opens a Library Project row through the project:<id> route contract', async () => {
    const now = new Date();
    const stubs = makeStubs(overviewFixture(now));

    render(<NavigationShell destinations={projectsDestinations(stubs)} />);
    await openProjectsFromHub();

    const row = await screen.findByTestId('project-row-p-run');
    expect(row.props.accessibilityRole).toBe('button');
    fireEvent.press(row);

    expect(await screen.findByTestId('route-project:p-run')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('returns to the hub via the nav-bar back button', async () => {
    const now = new Date();
    const stubs = makeStubs(overviewFixture(now));

    render(<NavigationShell destinations={projectsDestinations(stubs)} />);
    await openProjectsFromHub();
    // Pushed screen hides the tab bar.
    expect(screen.queryByTestId('tab-bar')).toBeNull();

    fireEvent.press(screen.getByLabelText('Back'));

    expect(await screen.findByTestId('library-page')).toBeTruthy();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });
});
