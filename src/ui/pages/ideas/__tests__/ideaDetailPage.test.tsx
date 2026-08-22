import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { IdeaDetailView } from '../../../../application/idea/IdeaDetailService';
import { Idea } from '../../../../domain/idea/Idea';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { ToastProvider } from '../../../shared/Toast';
import { IdeaDetailPage, type IdeaDetailPageProps } from '../IdeaDetailPage';

const now = new Date('2026-08-22T08:00:00Z');

function fixture(): IdeaDetailView {
  const idea = Idea.create({ id: 'idea-1', content: 'Try a trail race', now });
  idea.explore(now);
  return {
    idea,
    labels: [{ id: 'label-1', name: 'Someday', color: '#fff' }],
    derivedItems: [
      { type: 'goal', id: 'goal-1', title: 'Run a race', status: 'todo' },
      { type: 'task', id: 'task-1', title: 'Choose race', status: 'todo', projectId: 'project-1', projectName: 'Training', context: 'Training' },
      { type: 'note', id: 'note-1', title: 'Race considerations' },
    ],
    recentActivity: [{ id: 'record-1', kind: 'ideaEdited', detail: 'Edited the idea', occurredAt: now }],
  };
}

function setup(view: IdeaDetailView = fixture()) {
  const props: IdeaDetailPageProps = {
    ideaId: 'idea-1',
    detail: { getDetail: jest.fn(async () => view) },
    edit: { edit: jest.fn(async () => undefined) },
    changeStatus: { change: jest.fn(async () => undefined) },
    derivationOptions: { getOptions: jest.fn(async () => []) },
    createGoal: { create: jest.fn(async () => undefined) },
    createTask: { create: jest.fn(async () => undefined) },
    extractNote: { extract: jest.fn(async () => undefined) },
  };
  const destinations: ShellDestination[] = [{
    id: 'library', title: 'Library', icon: 'folder', renderList: () => <IdeaDetailPage {...props} />,
    renderDetail: (id) => <Text testID={`goal:${id}`} />,
    renderScreen: (id) => <Text testID={id} />,
  }];
  render(<ToastProvider><NavigationShell destinations={destinations} /></ToastProvider>);
  return props;
}

describe('IdeaDetailPage', () => {
  it('renders header, labels, all derived types and activity', async () => {
    setup();
    expect(within(await screen.findByTestId('idea-detail-header')).getByText('Try a trail race')).toBeTruthy();
    expect(screen.getByText('Exploring')).toBeTruthy();
    expect(screen.getByText('Someday')).toBeTruthy();
    expect(screen.getByTestId('idea-derived-goal-goal-1')).toBeTruthy();
    expect(screen.getByTestId('idea-derived-task-task-1')).toBeTruthy();
    expect(screen.getByTestId('idea-derived-note-note-1')).toBeTruthy();
    expect(screen.getByText('Edited the idea')).toBeTruthy();
  });

  it('changes to any selected status and edits content, refreshing after each command', async () => {
    const props = setup();
    await screen.findByTestId('idea-detail-header');
    fireEvent.press(screen.getByTestId('idea-status-open'));
    expect(screen.getByTestId('idea-status-captured')).toBeTruthy();
    expect(screen.getByTestId('idea-status-exploring')).toBeTruthy();
    expect(screen.getByTestId('idea-status-paused')).toBeTruthy();
    expect(screen.getByTestId('idea-status-handled')).toBeTruthy();
    fireEvent.press(screen.getByTestId('idea-status-paused'));
    await waitFor(() => expect(props.changeStatus.change).toHaveBeenCalledWith(expect.objectContaining({ ideaId: 'idea-1', status: 'paused' })));
    await waitFor(() => expect(props.detail.getDetail).toHaveBeenCalledTimes(2));

    fireEvent.press(screen.getByTestId('idea-edit-open'));
    fireEvent.changeText(screen.getByTestId('idea-edit-input'), 'A clearer idea');
    fireEvent.press(screen.getByTestId('idea-edit-submit'));
    await waitFor(() => expect(props.edit.edit).toHaveBeenCalledWith(expect.objectContaining({ ideaId: 'idea-1', content: 'A clearer idea' })));
    await waitFor(() => expect(props.detail.getDetail).toHaveBeenCalledTimes(3));
  });

  it('opens Goal, Task and Note derivation forms from their shortcuts', async () => {
    const props = setup();
    await screen.findByTestId('idea-create-section');
    fireEvent.press(screen.getByTestId('idea-create-goal'));
    expect(screen.getByTestId('create-derived-title')).toBeTruthy();
    await waitFor(() => expect(props.derivationOptions.getOptions).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('create-from-cancel'));
    fireEvent.press(screen.getByTestId('idea-create-task'));
    expect(screen.getByTestId('create-task-project')).toBeTruthy();
    await waitFor(() => expect(props.derivationOptions.getOptions).toHaveBeenCalledTimes(2));
    fireEvent.press(screen.getByTestId('create-from-cancel'));
    fireEvent.press(screen.getByTestId('idea-create-note'));
    expect(screen.getByTestId('create-note-content')).toBeTruthy();
    await waitFor(() => expect(props.derivationOptions.getOptions).toHaveBeenCalledTimes(3));
  });

  it.each([
    ['goal', 'goal-1', 'goal:goal-1'],
    ['task', 'task-1', 'task:task-1'],
    ['note', 'note-1', 'note:note-1'],
  ] as const)('navigates from a derived %s using its route contract', async (type, id, route) => {
    setup();
    fireEvent.press(await screen.findByTestId(`idea-derived-${type}-${id}`));
    expect(await screen.findByTestId(route)).toBeTruthy();
  });

  it('renders an explicit unknown state', async () => {
    setup({ idea: null, labels: [], derivedItems: [], recentActivity: [] });
    expect(await screen.findByText('Unknown idea.')).toBeTruthy();
    expect(screen.queryByTestId('idea-detail-header')).toBeNull();
  });
});
