import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text } from 'react-native';

import type { NotesOverviewView } from '../../../../application/note/NotesOverviewService';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { useShellNavigation } from '../../../navigation/NavigationShell';
import { NotesPage, type NotesPageProps } from '../NotesPage';

const now = new Date('2026-08-22T08:00:00Z');

function fixture(): NotesOverviewView {
  return {
    counts: { active: 2, archived: 1 },
    pinned: [{ id: 'pinned', content: 'Pinned method', pinnedAt: new Date('2026-08-21T08:00:00Z'), labels: [{ id: 'l1', name: 'Growth' }], updatedAt: now }],
    active: [{ id: 'active', content: 'Active thought', pinnedAt: null, labels: [], updatedAt: now }],
    archived: [{ id: 'archived', content: 'Archived thought', pinnedAt: new Date('2026-08-20T08:00:00Z'), labels: [], updatedAt: now }],
    recentActivity: [],
  };
}

function setup(view: NotesOverviewView = fixture()) {
  const props: NotesPageProps = {
    overview: { getOverview: jest.fn(async () => view) },
    capture: { capture: jest.fn(async () => undefined) },
  };
  const destinations: ShellDestination[] = [{
    id: 'library', title: 'Library', icon: 'folder', renderList: () => <NotesPage {...props} />,
    renderScreen: (id) => <RouteTarget id={id} />,
  }];
  render(<NavigationShell destinations={destinations} />);
  return props;
}

function RouteTarget({ id }: { id: string }) {
  const navigation = useShellNavigation();
  return <Pressable accessibilityLabel="Back" onPress={navigation.goBack}><Text testID={`screen-${id}`} /></Pressable>;
}

describe('NotesPage', () => {
  it('renders pinned and all-note groups, switches to archived, and ignores archived pin display', async () => {
    setup();
    expect(within(await screen.findByTestId('note-group-pinned')).getByText('Pinned method')).toBeTruthy();
    expect(screen.getByText(/Growth · Pinned/)).toBeTruthy();
    expect(within(screen.getByTestId('note-group-active')).getByText('Active thought')).toBeTruthy();

    fireEvent.press(screen.getByTestId('notes-segmented-archived'));
    expect(within(screen.getByTestId('note-group-archived')).getByText('Archived thought')).toBeTruthy();
    expect(within(screen.getByTestId('note-row-archived')).getByText(/^Archived (now|\d)/)).toBeTruthy();
    expect(screen.queryByText(/Pinned 2 d ago/)).toBeNull();
  });

  it('captures a note, clears the input, returns to Active, and refreshes', async () => {
    const props = setup();
    await screen.findByTestId('note-capture-input');
    fireEvent.press(screen.getByTestId('notes-segmented-archived'));
    fireEvent.changeText(screen.getByTestId('note-capture-input'), 'A durable thought');
    fireEvent.press(screen.getByTestId('note-capture-submit'));

    await waitFor(() => expect(props.capture.capture).toHaveBeenCalledWith(expect.objectContaining({ content: 'A durable thought' })));
    await waitFor(() => expect(props.overview.getOverview).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('note-capture-input').props.value).toBe('');
    expect(screen.getByTestId('notes-segmented-active').props.accessibilityState.selected).toBe(true);
  });

  it('navigates to the note route and surfaces capture errors without clearing input', async () => {
    const props = setup();
    fireEvent.press(await screen.findByTestId('note-row-active'));
    expect(await screen.findByTestId('screen-note:active')).toBeTruthy();

    // Remount so the list is visible again.
    fireEvent.press(screen.getByLabelText('Back'));
    (props.capture.capture as jest.Mock).mockRejectedValueOnce(new Error('Could not save'));
    fireEvent.changeText(await screen.findByTestId('note-capture-input'), 'Keep this');
    fireEvent.press(screen.getByTestId('note-capture-submit'));
    expect(await screen.findByText('Could not save')).toBeTruthy();
    expect(screen.getByTestId('note-capture-input').props.value).toBe('Keep this');
  });
});
