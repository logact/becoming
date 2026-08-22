import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Pressable } from 'react-native';

import { NavigationShell, useShellNavigation, type ShellDestination } from '../../../navigation/NavigationShell';
import { ToastProvider } from '../../../shared/Toast';
import { CreateFromIdeaSheet, type CreateFromIdeaSheetProps } from '../CreateFromIdeaSheet';

function Host({ props }: { props: CreateFromIdeaSheetProps }) {
  const navigation = useShellNavigation();
  return <Pressable testID="open" onPress={() => navigation.presentSheet(<CreateFromIdeaSheet {...props} />)} />;
}

function setup(overrides: Partial<CreateFromIdeaSheetProps> = {}) {
  const props: CreateFromIdeaSheetProps = {
    ideaId: 'idea-1',
    content: 'Try a trail race\nBuild a training plan.',
    options: { getOptions: jest.fn(async () => [{ id: 'project-1', name: 'Training', goals: [{ id: 'goal-1', title: 'Finish race' }] }]) },
    createGoal: { create: jest.fn(async () => undefined) },
    createTask: { create: jest.fn(async () => undefined) },
    extractNote: { extract: jest.fn(async () => undefined) },
    onCreated: jest.fn(async () => undefined),
    ...overrides,
  };
  const destinations: ShellDestination[] = [{ id: 'library', title: 'Library', icon: 'folder', renderList: () => <Host props={props} /> }];
  render(<ToastProvider><NavigationShell destinations={destinations} /></ToastProvider>);
  fireEvent.press(screen.getByTestId('open'));
  return props;
}

describe('CreateFromIdeaSheet', () => {
  it('offers Goal, Task and Note and creates a prefilled Goal', async () => {
    const props = setup();
    expect(screen.getByTestId('create-choice-goal')).toBeTruthy();
    expect(screen.getByTestId('create-choice-task')).toBeTruthy();
    expect(screen.getByTestId('create-choice-note')).toBeTruthy();

    fireEvent.press(screen.getByTestId('create-choice-goal'));
    expect(screen.getByTestId('create-derived-title').props.value).toBe('Try a trail race');
    expect(screen.getByTestId('create-derived-description').props.value).toBe('Try a trail race\nBuild a training plan.');
    fireEvent.changeText(screen.getByTestId('create-goal-due'), '2026-10-10');
    fireEvent.press(screen.getByTestId('create-from-submit'));

    await waitFor(() => expect(props.createGoal.create).toHaveBeenCalledWith(expect.objectContaining({
      ideaId: 'idea-1', title: 'Try a trail race', description: 'Try a trail race\nBuild a training plan.', due: new Date(2026, 9, 10),
    })));
    expect(props.onCreated).toHaveBeenCalledWith({ type: 'goal', id: expect.any(String) });
    expect(screen.queryByTestId('create-from-idea-sheet')).toBeNull();
  });

  it('requires a Project and limits the optional Goal picker to its tree', async () => {
    const props = setup({ initialType: 'task' });
    fireEvent.press(screen.getByTestId('create-from-submit'));
    expect(await screen.findByText('Choose a project.')).toBeTruthy();
    expect(props.createTask.create).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('create-task-project'));
    fireEvent.press(await screen.findByTestId('create-option-project-1'));
    fireEvent.press(screen.getByTestId('create-task-goal'));
    expect(screen.getByText('Finish race')).toBeTruthy();
    fireEvent.press(screen.getByTestId('create-option-goal-1'));
    fireEvent.press(screen.getByTestId('create-from-submit'));

    await waitFor(() => expect(props.createTask.create).toHaveBeenCalledWith(expect.objectContaining({
      ideaId: 'idea-1', projectId: 'project-1', goalId: 'goal-1', title: 'Try a trail race',
      description: 'Try a trail race\nBuild a training plan.',
    })));
    expect(props.onCreated).toHaveBeenCalledWith({ type: 'task', id: expect.any(String) });
  });

  it('extracts a Note with editable content', async () => {
    const props = setup({ initialType: 'note' });
    fireEvent.changeText(screen.getByTestId('create-note-content'), 'A durable note');
    fireEvent.press(screen.getByTestId('create-from-submit'));

    await waitFor(() => expect(props.extractNote.extract).toHaveBeenCalledWith(expect.objectContaining({
      ideaId: 'idea-1', content: 'A durable note', noteId: expect.any(String),
    })));
    expect(props.onCreated).toHaveBeenCalledWith({ type: 'note', id: expect.any(String) });
  });
});
