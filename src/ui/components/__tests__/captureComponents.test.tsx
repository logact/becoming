import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { CaptureProjectOption } from '../../../application/capture/CaptureOptionsService';
import {
  CaptureComposer,
  type CaptureComposerProps,
} from '../CaptureComposer';
import { CaptureFloatingButton } from '../CaptureFloatingButton';

const PROJECTS: CaptureProjectOption[] = [
  { id: 'project-active', name: 'Active work', status: 'active' },
  { id: 'project-planning', name: 'Later work', status: 'planning' },
];

function composer(overrides: Partial<CaptureComposerProps> = {}) {
  const props: CaptureComposerProps = {
    visible: true,
    onDismiss: jest.fn(),
    options: PROJECTS,
    onSubmit: jest.fn(async () => undefined),
    ...overrides,
  };
  render(<CaptureComposer {...props} />);
  return props;
}

describe('CaptureFloatingButton', () => {
  it('uses the shell offset and exposes a large accessible pressed/focus target', () => {
    const onPress = jest.fn();
    render(<CaptureFloatingButton bottomOffset={92} onPress={onPress} />);

    const button = screen.getByTestId('capture-floating-button');
    expect(button).toHaveStyle({ bottom: 92, height: 50 });
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Open capture');
    expect(button.props.hitSlop).toBe(8);
    fireEvent(button, 'focus');
    expect(button).toHaveStyle({ borderWidth: 2 });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('CaptureComposer', () => {
  it('keeps all controls reachable when the keyboard reduces the viewport', () => {
    composer();

    const scroll = screen.getByTestId('capture-composer-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId('capture-content-input')).toBeTruthy();
    expect(screen.getByTestId('capture-intent-inbox')).toBeTruthy();
    expect(screen.getByTestId('capture-submit')).toBeTruthy();
  });

  it('switches intents without losing text and reports selected/disabled accessibility state', () => {
    composer();
    const submit = screen.getByTestId('capture-submit');
    expect(submit.props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(screen.getByTestId('capture-intent-inbox').props.accessibilityState.selected).toBe(true);

    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Keep this draft');
    fireEvent.press(screen.getByTestId('capture-intent-note'));
    expect(screen.getByTestId('capture-content-input').props.value).toBe('Keep this draft');
    expect(screen.getByTestId('capture-intent-note').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('capture-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('defaults Task to the first Project and delegates changes to the shell picker', async () => {
    const onRequestProjectPicker = jest.fn(
      (_selected: string | null, select: (id: string) => void) => select('project-planning'),
    );
    const props = composer({ onRequestProjectPicker });
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Ship it');
    fireEvent.press(screen.getByTestId('capture-intent-task'));

    await waitFor(() => expect(screen.getByText('Active work')).toBeTruthy());
    fireEvent.press(screen.getByTestId('capture-project-picker'));
    await waitFor(() => expect(screen.getByText('Later work')).toBeTruthy());
    fireEvent.press(screen.getByTestId('capture-submit'));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({
      intent: 'task', content: 'Ship it', projectId: 'project-planning',
    }));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('disables Task for loading, option errors, and an empty Project list', () => {
    const { rerender } = render(
      <CaptureComposer
        visible
        onDismiss={jest.fn()}
        options={[]}
        optionsLoading
        onSubmit={jest.fn(async () => undefined)}
      />,
    );
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Task');
    fireEvent.press(screen.getByTestId('capture-intent-task'));
    expect(screen.getByTestId('capture-project-loading')).toBeTruthy();
    expect(screen.getByTestId('capture-submit').props.accessibilityState.disabled).toBe(true);

    rerender(
      <CaptureComposer
        visible
        onDismiss={jest.fn()}
        options={[]}
        optionsError="Could not load projects"
        onSubmit={jest.fn(async () => undefined)}
      />,
    );
    expect(screen.getByTestId('capture-project-error')).toBeTruthy();
    rerender(
      <CaptureComposer
        visible
        onDismiss={jest.fn()}
        options={[]}
        onSubmit={jest.fn(async () => undefined)}
      />,
    );
    expect(screen.getByTestId('capture-project-empty')).toBeTruthy();
  });

  it('keeps the draft usable as Decide later when no Task Project exists', async () => {
    const props = composer({ options: [] });
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Capture without a project');
    fireEvent.press(screen.getByTestId('capture-intent-task'));
    expect(screen.getByTestId('capture-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('capture-intent-inbox'));
    expect(screen.getByTestId('capture-content-input').props.value).toBe('Capture without a project');
    expect(screen.getByTestId('capture-submit').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('capture-submit'));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({
      intent: 'inbox', content: 'Capture without a project',
    }));
  });

  it('blocks duplicate submit and dismiss while saving, then resets after success', async () => {
    let resolve: (() => void) | undefined;
    const onSubmit = jest.fn(() => new Promise<void>((done) => { resolve = done; }));

    function Host() {
      const [visible, setVisible] = useState(true);
      return (
        <View>
          <CaptureComposer
            visible={visible}
            onDismiss={() => setVisible(false)}
            options={PROJECTS}
            onSubmit={onSubmit}
          />
        </View>
      );
    }
    render(<Host />);
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'One only');
    fireEvent.press(screen.getByTestId('capture-submit'));
    fireEvent.press(screen.getByTestId('capture-submit'));
    fireEvent.press(screen.getByTestId('capture-composer-backdrop'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('capture-composer')).toBeTruthy();
    expect(screen.getByTestId('capture-submit').props.accessibilityState.busy).toBe(true);

    resolve?.();
    await waitFor(() => expect(screen.queryByTestId('capture-composer')).toBeNull());
  });

  it('keeps the draft and shows an inline error when saving fails', async () => {
    composer({ onSubmit: jest.fn(async () => { throw new Error('Database unavailable'); }) });
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Do not lose me');
    fireEvent.press(screen.getByTestId('capture-submit'));

    expect(await screen.findByTestId('capture-submit-error')).toHaveTextContent('Database unavailable');
    expect(screen.getByTestId('capture-content-input').props.value).toBe('Do not lose me');
  });

  it('clears the draft and intent after an explicit close and reopen', () => {
    function Host() {
      const [visible, setVisible] = useState(true);
      return (
        <View>
          <CaptureComposer
            visible={visible}
            onDismiss={() => setVisible(false)}
            options={PROJECTS}
            onSubmit={jest.fn(async () => undefined)}
          />
          <View
            testID="reopen-composer"
            onTouchEnd={() => setVisible(true)}
          />
        </View>
      );
    }
    render(<Host />);
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Discard me');
    fireEvent.press(screen.getByTestId('capture-intent-goal'));
    fireEvent.press(screen.getByTestId('capture-close'));
    fireEvent(screen.getByTestId('reopen-composer'), 'touchEnd');
    expect(screen.getByTestId('capture-content-input').props.value).toBe('');
    expect(screen.getByTestId('capture-intent-inbox').props.accessibilityState.selected).toBe(true);
  });
});
