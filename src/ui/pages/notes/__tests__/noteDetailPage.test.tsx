import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text } from 'react-native';

import type { NoteDetailView } from '../../../../application/note/NoteDetailService';
import { Note } from '../../../../domain/note/Note';
import { NavigationShell, useShellNavigation, type ShellDestination } from '../../../navigation/NavigationShell';
import { ToastProvider } from '../../../shared/Toast';
import { NoteDetailPage, type NoteDetailPageProps } from '../NoteDetailPage';

const now = new Date('2026-08-22T08:00:00Z');

function fixture(): NoteDetailView {
  return {
    note: Note.restore({ id: 'note-1', content: 'Weekly review methodology', archived: false, pinnedAt: null, labelIds: ['label-1'], createdAt: now, updatedAt: now }),
    labels: [{ id: 'label-1', name: 'Growth' }],
    source: { ideaId: 'idea-1', content: 'Auto-generate a weekly review' },
    links: [
      { type: 'goal', id: 'goal-1', title: 'Build a review system', status: 'todo' },
      { type: 'project', id: 'project-1', title: 'Review automation', status: 'active' },
    ],
    recentActivity: [{ id: 'record-1', kind: 'noteEdited', detail: 'Edited content', occurredAt: now }],
  };
}

function ListHost() {
  const navigation = useShellNavigation();
  return <Pressable testID="open-note" onPress={() => navigation.pushScreen('note:note-1')} />;
}

function RouteTarget({ id }: { id: string }) {
  const navigation = useShellNavigation();
  return <Pressable accessibilityLabel="Back" onPress={navigation.goBack}><Text testID={id} /></Pressable>;
}

function setup(initialView: NoteDetailView = fixture()) {
  let view = initialView;
  const props: NoteDetailPageProps = {
    noteId: 'note-1',
    detail: { getDetail: jest.fn(async () => view) },
    edit: { edit: jest.fn(async ({ content, now: editTime }) => { view.note?.edit(content, editTime); }) },
    setPin: { setPinned: jest.fn(async ({ pinned, now: pinTime }) => { if (pinned) view.note?.pin(pinTime); else view.note?.unpin(pinTime); }) },
    archive: { setArchived: jest.fn(async ({ archived, now: archiveTime }) => { if (archived) view.note?.archive(archiveTime); else view.note?.unarchive(archiveTime); }) },
    link: { link: jest.fn(async ({ targetType, targetId }) => {
      if (targetType === 'goal') view = { ...view, links: [...view.links, { type: 'goal', id: targetId, title: 'New linked goal', status: 'doing' }] };
    }) },
    linkOptions: { getOptions: jest.fn(async () => [
      { type: 'goal' as const, id: 'goal-2', title: 'New linked goal', status: 'doing' as const },
      { type: 'project' as const, id: 'project-2', title: 'Another project', status: 'planning' as const },
    ]) },
    deleteNote: { delete: jest.fn(async () => undefined) },
  };
  const destinations: ShellDestination[] = [{
    id: 'library', title: 'Library', icon: 'folder', renderList: () => <ListHost />,
    renderDetail: (id) => <RouteTarget id={`goal:${id}`} />,
    renderScreen: (id) => id.startsWith('note:')
      ? <NoteDetailPage {...props} />
      : <RouteTarget id={id} />,
  }];
  render(<ToastProvider><NavigationShell destinations={destinations} /></ToastProvider>);
  fireEvent.press(screen.getByTestId('open-note'));
  return props;
}

describe('NoteDetailPage', () => {
  it('renders content, labels, source, links and activity and navigates each relation type', async () => {
    setup();
    expect(await screen.findByText('Weekly review methodology')).toBeTruthy();
    expect(screen.getByText('Growth')).toBeTruthy();
    expect(screen.getByText('Auto-generate a weekly review')).toBeTruthy();
    expect(screen.getByText('Build a review system')).toBeTruthy();
    expect(screen.getByText('Review automation')).toBeTruthy();
    expect(screen.getByText('Edited content')).toBeTruthy();

    fireEvent.press(screen.getByTestId('note-source-idea-idea-1'));
    expect(await screen.findByTestId('idea:idea-1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    fireEvent.press(await screen.findByTestId('note-link-goal-goal-1'));
    expect(await screen.findByTestId('goal:goal-1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    fireEvent.press(await screen.findByTestId('note-link-project-project-1'));
    expect(await screen.findByTestId('project:project-1')).toBeTruthy();
  });

  it('edits, pins, archives and unarchives through application commands', async () => {
    const props = setup();
    await screen.findByTestId('note-detail-header');

    fireEvent.press(screen.getByTestId('note-edit-open'));
    fireEvent.changeText(screen.getByTestId('note-edit-input'), 'A clearer method');
    fireEvent.press(screen.getByTestId('note-edit-submit'));
    await waitFor(() => expect(props.edit.edit).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'note-1', content: 'A clearer method' })));
    expect(await screen.findByText('A clearer method')).toBeTruthy();

    fireEvent.press(screen.getByTestId('note-pin-toggle'));
    await waitFor(() => expect(props.setPin.setPinned).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'note-1', pinned: true })));
    await waitFor(() => expect(screen.getByLabelText('Unpin note')).toBeTruthy());

    fireEvent.press(screen.getByTestId('note-archive-toggle'));
    await waitFor(() => expect(props.archive.setArchived).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'note-1', archived: true })));
    expect(await screen.findByText('Unarchive note')).toBeTruthy();
    expect(screen.queryByTestId('note-pin-toggle')).toBeNull();
    expect(screen.queryByTestId('note-link-add')).toBeNull();

    fireEvent.press(screen.getByTestId('note-archive-toggle'));
    await waitFor(() => expect(props.archive.setArchived).toHaveBeenLastCalledWith(expect.objectContaining({ archived: false })));
    expect(await screen.findByText('Archive note')).toBeTruthy();
  });

  it('loads picker options through a service, links and refreshes', async () => {
    const props = setup();
    fireEvent.press(await screen.findByTestId('note-link-add'));
    await waitFor(() => expect(props.linkOptions.getOptions).toHaveBeenCalledTimes(1));
    fireEvent.press(await screen.findByTestId('note-link-option-goal-goal-2'));
    await waitFor(() => expect(props.link.link).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'note-1', targetType: 'goal', targetId: 'goal-2' })));
    expect(await screen.findByTestId('note-link-goal-goal-2')).toBeTruthy();
  });

  it('requires explicit confirmation before deletion and returns to the list', async () => {
    const props = setup();
    fireEvent.press(await screen.findByTestId('note-delete-open'));
    expect(screen.getByTestId('note-delete-confirmation')).toBeTruthy();
    expect(props.deleteNote.delete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('note-delete-confirm'));
    await waitFor(() => expect(props.deleteNote.delete).toHaveBeenCalledWith('note-1'));
    expect(await screen.findByTestId('open-note')).toBeTruthy();
  });

  it('renders an explicit unknown state', async () => {
    setup({ note: null, labels: [], source: null, links: [], recentActivity: [] });
    expect(await screen.findByText('Unknown note.')).toBeTruthy();
    expect(screen.queryByTestId('note-detail-header')).toBeNull();
  });
});
