import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { LibraryCounts } from '../../../../application/library/LibraryOverviewService';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { LibraryPage } from '../LibraryPage';

const COUNTS: LibraryCounts = { goals: 5, tasks: 18, projects: 4, ideas: 9, resources: 3 };

/** Stub service with the LibraryOverviewService shape; pages take it as a prop. */
function makeStub(counts: LibraryCounts = COUNTS) {
  return { getCounts: jest.fn(async () => counts) };
}

function libraryDestinations(stub: ReturnType<typeof makeStub>): ShellDestination[] {
  return [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <LibraryPage overview={stub} />,
      renderScreen: (id) =>
        id === 'goals' ? (
          <Text testID="goals-screen" />
        ) : id === 'projects' ? (
          <Text testID="projects-screen" />
        ) : null,
    },
  ];
}

describe('LibraryPage', () => {
  it('renders the hub sections, rows, counts and slogan', async () => {
    render(<NavigationShell destinations={libraryDestinations(makeStub())} />);

    const planDo = within(await screen.findByTestId('plan-do-section'));
    expect(planDo.getByText('Plan & do')).toBeTruthy();
    expect(planDo.getByText('Goals')).toBeTruthy();
    expect(planDo.getByText('Targets you aim to achieve')).toBeTruthy();
    expect(planDo.getByText('5')).toBeTruthy();
    expect(planDo.getByText('Tasks')).toBeTruthy();
    expect(planDo.getByText('18')).toBeTruthy();
    expect(planDo.getByText('Projects')).toBeTruthy();
    expect(planDo.getByText('4')).toBeTruthy();

    const captureThink = within(screen.getByTestId('capture-think-section'));
    expect(captureThink.getByText('Capture & think')).toBeTruthy();
    expect(captureThink.getByText('Ideas')).toBeTruthy();
    expect(captureThink.getByText('9')).toBeTruthy();
    expect(captureThink.getByText('Notes')).toBeTruthy();

    const manage = within(screen.getByTestId('manage-section'));
    expect(manage.getByText('Manage')).toBeTruthy();
    expect(manage.getByText('Resources')).toBeTruthy();
    expect(manage.getByText('3')).toBeTruthy();
    expect(manage.getByText('Records')).toBeTruthy();
    expect(manage.getByText('Labels')).toBeTruthy();
    expect(manage.getByText('Archive')).toBeTruthy();

    expect(screen.getByText('Record what you do. Shape what you become.')).toBeTruthy();
  });

  it('pushes the goals screen when the Goals row is pressed', async () => {
    render(<NavigationShell destinations={libraryDestinations(makeStub())} />);

    fireEvent.press(await screen.findByTestId('library-row-goals'));

    expect(await screen.findByTestId('goals-screen')).toBeTruthy();
    // A pushed screen hides the tab bar.
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('pushes the projects screen when the Projects row is pressed', async () => {
    render(<NavigationShell destinations={libraryDestinations(makeStub())} />);

    fireEvent.press(await screen.findByTestId('library-row-projects'));

    expect(await screen.findByTestId('projects-screen')).toBeTruthy();
    // A pushed screen hides the tab bar.
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('keeps the other rows inert', async () => {
    render(<NavigationShell destinations={libraryDestinations(makeStub())} />);

    const tasksRow = await screen.findByTestId('library-row-tasks');
    // Inert rows render as plain views (no accessibility role button).
    expect(tasksRow.props.accessibilityRole).not.toBe('button');
  });
});
