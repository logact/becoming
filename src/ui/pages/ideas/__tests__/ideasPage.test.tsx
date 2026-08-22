import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { IdeasOverviewView } from '../../../../application/idea/IdeasOverviewService';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { ToastProvider } from '../../../shared/Toast';
import { IdeasPage, type IdeasPageProps } from '../IdeasPage';

const now = new Date('2026-08-22T08:00:00Z');
const item = (id: string, content: string, status: 'captured' | 'exploring' | 'paused' | 'handled') => ({ id, content, status, labelIds: [], updatedAt: now });

function fixture(): IdeasOverviewView {
  return {
    counts: { open: 3, handled: 1 },
    open: {
      captured: [item('captured', 'Captured idea', 'captured')],
      exploring: [item('exploring', 'Exploring idea', 'exploring')],
      paused: [item('paused', 'Paused idea', 'paused')],
    },
    handled: [item('handled', 'Handled idea', 'handled')],
    recentActivity: [{ id: 'record-1', kind: 'ideaCaptured', detail: 'Captured an idea', occurredAt: now }],
  };
}

function setup() {
  const props: IdeasPageProps = {
    overview: { getOverview: jest.fn(async () => fixture()) },
    capture: { capture: jest.fn(async () => undefined) },
    derivationOptions: { getOptions: jest.fn(async () => []) },
    createGoal: { create: jest.fn(async () => undefined) },
    createTask: { create: jest.fn(async () => undefined) },
    extractNote: { extract: jest.fn(async () => undefined) },
  };
  const destinations: ShellDestination[] = [{
    id: 'library', title: 'Library', icon: 'folder', renderList: () => <IdeasPage {...props} />,
    renderScreen: (id) => <Text testID={`screen-${id}`} />,
  }];
  render(<ToastProvider><NavigationShell destinations={destinations} /></ToastProvider>);
  return props;
}

describe('IdeasPage', () => {
  it('renders Open groups, switches to Handled, captures and refreshes', async () => {
    const props = setup();
    expect(within(await screen.findByTestId('idea-group-captured')).getByText('Captured idea')).toBeTruthy();
    expect(within(screen.getByTestId('idea-group-exploring')).getByText('Exploring idea')).toBeTruthy();
    expect(within(screen.getByTestId('idea-group-paused')).getByText('Paused idea')).toBeTruthy();
    expect(screen.getByText('Captured an idea')).toBeTruthy();

    fireEvent.press(screen.getByTestId('ideas-segmented-handled'));
    expect(within(screen.getByTestId('idea-group-handled')).getByText('Handled idea')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('idea-capture-input'), 'A new idea');
    fireEvent.press(screen.getByTestId('idea-capture-submit'));
    await waitFor(() => expect(props.capture.capture).toHaveBeenCalledWith(expect.objectContaining({ content: 'A new idea' })));
    await waitFor(() => expect(props.overview.getOverview).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('idea-capture-input').props.value).toBe('');
  });

  it('opens detail from a row and opens the three-way derivation sheet from + without navigating', async () => {
    setup();
    await screen.findByTestId('idea-row-captured');
    fireEvent.press(screen.getByTestId('idea-quick-create-captured'));
    expect(screen.getByTestId('create-from-idea-sheet')).toBeTruthy();
    expect(screen.getByTestId('create-choice-note')).toBeTruthy();
    expect(screen.queryByTestId('screen-idea:captured')).toBeNull();
    fireEvent.press(screen.getByTestId('create-from-cancel'));

    fireEvent.press(screen.getByTestId('idea-row-captured'));
    expect(await screen.findByTestId('screen-idea:captured')).toBeTruthy();
  });
});
