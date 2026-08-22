import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppServices } from '../../composition/AppServicesProvider';
import { AppServicesProvider } from '../../composition/AppServicesProvider';
import { ToastProvider } from '../../shared/Toast';
import { useCaptureRevision } from '../CaptureRevision';
import { NavigationShell, useShellNavigation, type ShellDestination } from '../NavigationShell';

function FakeList({ id }: { id: string }) {
  const navigation = useShellNavigation();
  const captureRevision = useCaptureRevision();
  return (
    <View>
      <Text testID={`${id}-list`}>{`${id} list`}</Text>
      <Text testID={`${id}-revision`}>{captureRevision}</Text>
      <Pressable testID={`${id}-push`} onPress={() => navigation.pushScreen('x')} />
      <Pressable testID={`${id}-sheet`} onPress={() => navigation.presentSheet(<Text>Ordinary sheet</Text>)} />
    </View>
  );
}

function FakeScreen({ id }: { id: string }) {
  const navigation = useShellNavigation();
  const captureRevision = useCaptureRevision();
  return (
    <View>
      <Text testID={`${id}-screen-x`}>{`${id} screen x`}</Text>
      <Text testID={`${id}-screen-revision`}>{captureRevision}</Text>
      <Pressable testID={`${id}-back`} onPress={() => navigation.goBack()} />
    </View>
  );
}

function fakeDestinations(): ShellDestination[] {
  return (['dash', 'lib', 'set'] as const).map((id) => ({
    id,
    title: { dash: 'Dashboard', lib: 'Library', set: 'Setting' }[id],
    icon: ({ dash: 'grid', lib: 'folder', set: 'gear' } as const)[id],
    renderList: () => <FakeList id={id} />,
    renderScreen: () => <FakeScreen id={id} />,
  }));
}

function DetailRouteLaunchers() {
  const navigation = useShellNavigation();
  return (
    <View>
      <Pressable testID="open-goal-detail" onPress={() => navigation.openDetail('goal-1')} />
      {(['project:project-1', 'task:task-1', 'idea:idea-1', 'note:note-1'] as const).map((route) => (
        <Pressable key={route} testID={`open-${route}`} onPress={() => navigation.pushScreen(route)} />
      ))}
    </View>
  );
}

function detailDestinations(): ShellDestination[] {
  return [{
    id: 'library', title: 'Library', icon: 'folder',
    renderList: () => <DetailRouteLaunchers />,
    renderDetail: (entityId) => <Text testID={`detail-goal-${entityId}`} />,
    renderScreen: (screenId) => <Text testID={`detail-${screenId}`} />,
  }];
}

function captureServices(overrides: Record<string, unknown> = {}): AppServices {
  return {
    quickCapture: { capture: jest.fn(async () => ({ entityType: 'idea', entityId: 'new' })) },
    captureOptions: { getOptions: jest.fn(async () => ({
      projects: [
        { id: 'project-1', name: 'Current project', status: 'active' },
        { id: 'project-2', name: 'Next project', status: 'planning' },
      ],
    })) },
    ...overrides,
  } as unknown as AppServices;
}

function renderCaptureShell(
  services = captureServices(),
  bottomInset = 0,
  destinations: ShellDestination[] = fakeDestinations(),
) {
  render(
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, right: 0, bottom: bottomInset, left: 0 },
    }}>
      <ToastProvider>
        <AppServicesProvider services={services}>
          <NavigationShell destinations={destinations} />
        </AppServicesProvider>
      </ToastProvider>
    </SafeAreaProvider>,
  );
  return services;
}

describe('NavigationShell', () => {
  it('renders all three tab labels and switches screens on tap', () => {
    render(<NavigationShell destinations={fakeDestinations()} />);

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Library')).toBeTruthy();
    expect(screen.getByText('Setting')).toBeTruthy();

    expect(screen.getByTestId('dash-list')).toBeTruthy();

    fireEvent.press(screen.getByText('Library'));
    expect(screen.getByTestId('lib-list')).toBeTruthy();
    // Inactive destinations unmount entirely.
    expect(screen.queryByTestId('dash-list')).toBeNull();

    fireEvent.press(screen.getByText('Setting'));
    expect(screen.getByTestId('set-list')).toBeTruthy();
    expect(screen.queryByTestId('lib-list')).toBeNull();
  });

  it('pushScreen renders the pushed screen and hides the tab bar', () => {
    render(<NavigationShell destinations={fakeDestinations()} />);

    expect(screen.getByTestId('tab-bar')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dash-push'));
    expect(screen.getByTestId('dash-screen-x')).toBeTruthy();
    expect(screen.queryByTestId('dash-list')).toBeNull();
    // Pushed screens hide the tab bar.
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('goBack pops back to the list and the tab bar returns', () => {
    render(<NavigationShell destinations={fakeDestinations()} />);

    fireEvent.press(screen.getByTestId('dash-push'));
    expect(screen.getByTestId('dash-screen-x')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dash-back'));
    expect(screen.getByTestId('dash-list')).toBeTruthy();
    expect(screen.queryByTestId('dash-screen-x')).toBeNull();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });

  it('shows Capture on every tab and pushed screen with the correct bottom offset', () => {
    renderCaptureShell();
    expect(screen.getByTestId('capture-floating-button')).toHaveStyle({ bottom: 76 });

    fireEvent.press(screen.getByText('Library'));
    expect(screen.getByTestId('lib-list')).toBeTruthy();
    expect(screen.getByTestId('capture-floating-button')).toHaveStyle({ bottom: 76 });
    fireEvent.press(screen.getByText('Setting'));
    expect(screen.getByTestId('set-list')).toBeTruthy();

    fireEvent.press(screen.getByTestId('set-push'));
    expect(screen.getByTestId('set-screen-x')).toBeTruthy();
    expect(screen.getByTestId('capture-floating-button')).toHaveStyle({ bottom: 16 });
  });

  it('adds the device bottom safe area to list and pushed-screen offsets', () => {
    renderCaptureShell(captureServices(), 34);
    expect(screen.getByTestId('capture-floating-button')).toHaveStyle({ bottom: 110 });

    fireEvent.press(screen.getByTestId('dash-push'));
    expect(screen.getByTestId('capture-floating-button')).toHaveStyle({ bottom: 50 });
  });

  it.each([
    ['goal', 'open-goal-detail', 'detail-goal-goal-1'],
    ['project', 'open-project:project-1', 'detail-project:project-1'],
    ['task', 'open-task:task-1', 'detail-task:task-1'],
    ['idea', 'open-idea:idea-1', 'detail-idea:idea-1'],
    ['note', 'open-note:note-1', 'detail-note:note-1'],
  ])('shows Capture on the pushed %s detail route', (_type, launcherId, detailId) => {
    renderCaptureShell(captureServices(), 0, detailDestinations());
    fireEvent.press(screen.getByTestId(launcherId));

    expect(screen.getByTestId(detailId)).toBeTruthy();
    expect(screen.getByTestId('capture-floating-button')).toHaveStyle({ bottom: 16 });
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('hides Capture while an ordinary sheet is presented', () => {
    renderCaptureShell();
    fireEvent.press(screen.getByTestId('dash-sheet'));
    expect(screen.getByText('Ordinary sheet')).toBeTruthy();
    expect(screen.queryByTestId('capture-floating-button')).toBeNull();
    expect(screen.queryByTestId('capture-composer')).toBeNull();
  });

  it('captures without changing the active destination or pushed stack', async () => {
    const services = renderCaptureShell();
    fireEvent.press(screen.getByText('Library'));
    fireEvent.press(screen.getByTestId('lib-push'));
    expect(screen.getByTestId('lib-screen-x')).toBeTruthy();
    expect(screen.getByTestId('lib-screen-revision')).toHaveTextContent('0');

    fireEvent.press(screen.getByTestId('capture-floating-button'));
    expect(screen.queryByTestId('capture-floating-button')).toBeNull();
    fireEvent.press(screen.getByTestId('capture-intent-note'));
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'A shell note');
    fireEvent.press(screen.getByTestId('capture-submit'));

    await waitFor(() => expect(services.quickCapture.capture).toHaveBeenCalledWith({
      intent: 'note',
      entityId: expect.any(String),
      content: 'A shell note',
      recordId: expect.any(String),
      recordRelationId: expect.any(String),
      now: expect.any(Date),
    }));
    expect(await screen.findByText('Note saved')).toBeTruthy();
    expect(screen.getByTestId('lib-screen-x')).toBeTruthy();
    expect(screen.getByTestId('lib-screen-revision')).toHaveTextContent('1');
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    expect(screen.getByTestId('capture-floating-button')).toHaveStyle({ bottom: 16 });
  });

  it.each([
    ['inbox', 'Saved to inbox'],
    ['idea', 'Idea captured'],
    ['task', 'Task created'],
    ['goal', 'Goal created'],
    ['note', 'Note saved'],
  ] as const)('submits the %s intent and shows its success toast', async (intent, message) => {
    const services = renderCaptureShell();
    fireEvent.press(screen.getByTestId('capture-floating-button'));
    if (intent !== 'inbox') fireEvent.press(screen.getByTestId(`capture-intent-${intent}`));
    fireEvent.changeText(screen.getByTestId('capture-content-input'), `${intent} content`);
    if (intent === 'task') await screen.findByText('Current project');
    fireEvent.press(screen.getByTestId('capture-submit'));

    await waitFor(() => expect(services.quickCapture.capture).toHaveBeenCalledWith(
      expect.objectContaining({ intent, content: `${intent} content` }),
    ));
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('keeps an unfinished draft when the underlying stack changes', async () => {
    renderCaptureShell();
    fireEvent.press(screen.getByTestId('capture-floating-button'));
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Still drafting');
    fireEvent.press(screen.getByTestId('capture-intent-task'));
    await screen.findByText('Current project');
    fireEvent.press(screen.getByTestId('capture-intent-inbox'));

    // The composer is shell-owned, so a navigation change does not remount it.
    fireEvent.press(screen.getByTestId('dash-push'));
    expect(screen.getByTestId('dash-screen-x')).toBeTruthy();
    expect(screen.getByTestId('capture-content-input').props.value).toBe('Still drafting');
  });

  it('loads Task Project options and selects through the shell sheet', async () => {
    const services = renderCaptureShell();
    fireEvent.press(screen.getByTestId('capture-floating-button'));
    fireEvent.press(screen.getByTestId('capture-intent-task'));
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'Project task');
    await screen.findByText('Current project');

    fireEvent.press(screen.getByTestId('capture-project-picker'));
    expect(screen.getByTestId('capture-project-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('capture-project-option-project-2'));
    expect(screen.queryByTestId('capture-project-sheet')).toBeNull();
    expect(screen.getByText('Next project')).toBeTruthy();
    fireEvent.press(screen.getByTestId('capture-submit'));

    await waitFor(() => expect(services.quickCapture.capture).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'task', content: 'Project task', projectId: 'project-2' }),
    ));
  });

  it('keeps non-Task capture available when Project options fail', async () => {
    const services = captureServices({
      captureOptions: { getOptions: jest.fn(async () => { throw new Error('No projects'); }) },
    });
    renderCaptureShell(services);
    fireEvent.press(screen.getByTestId('capture-floating-button'));
    fireEvent.press(screen.getByTestId('capture-intent-goal'));
    fireEvent.changeText(screen.getByTestId('capture-content-input'), 'A goal');
    fireEvent.press(screen.getByTestId('capture-submit'));

    await waitFor(() => expect(services.quickCapture.capture).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'goal', content: 'A goal' }),
    ));
  });
});
