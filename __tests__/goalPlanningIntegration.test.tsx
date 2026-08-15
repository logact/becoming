import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import type { RenderAPI } from '@testing-library/react-native';

import { composeAppServices } from '../src/ui/composition/appServices';
import { NavigationShell } from '../src/ui/navigation/NavigationShell';
import { appDestinations } from '../src/ui/placeholderDestinations';
import { ToastProvider } from '../src/ui/shared/Toast';
import { closeUiTestHarness, createUiTestHarness, renderWithServices } from './helpers/uiTestHarness';
import { expectTransientToast } from './helpers/goalScreenHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import type { AppServices } from '../src/ui/composition/appServices';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function renderApp(services: AppServices): RenderAPI {
  return renderWithServices(
    <ToastProvider>
      <NavigationShell destinations={appDestinations()} />
    </ToastProvider>,
    services,
  );
}

describe('Goal planning flow (integration through the real shell and services)', () => {
  it('create -> list -> detail -> edit -> archive -> archived history', async () => {    renderApp(harness.services);

    // Create through the sheet; the list refreshes immediately.
    fireEvent.press(await screen.findByLabelText('New goal'));
    fireEvent.changeText(await screen.findByLabelText('Goal title'), 'Learn Spanish');
    fireEvent.changeText(screen.getByLabelText('Goal target state'), 'Hold a 15-minute conversation');
    fireEvent.press(screen.getByLabelText('Save new goal'));
    await expectTransientToast('Goal created');
    expect(await screen.findByText('Learn Spanish')).toBeTruthy();
    expect(screen.getByLabelText('Unpursued')).toBeTruthy();

    // Edit through the detail; the detail and list both refresh.
    fireEvent.press(screen.getByLabelText('Open goal Learn Spanish'));
    fireEvent.press(await screen.findByLabelText('Edit goal'));
    fireEvent.changeText(
      await screen.findByLabelText('Goal target state'),
      'Hold a 30-minute conversation',
    );
    fireEvent.press(screen.getByLabelText('Save goal changes'));
    await expectTransientToast('Goal updated');
    // Detail shows the target state as supporting copy and as the fact value.
    expect((await screen.findAllByText('Hold a 30-minute conversation')).length).toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('Back to goals'));
    expect(await screen.findByText('Hold a 30-minute conversation')).toBeTruthy();

    // Confirmed archive removes the Goal from Active and keeps it inspectable.
    fireEvent.press(screen.getByLabelText('Open goal Learn Spanish'));
    fireEvent.press(await screen.findByLabelText('Archive goal'));
    fireEvent.press(await screen.findByLabelText('Confirm archive'));
    await expectTransientToast('Goal archived');

    fireEvent.press(screen.getByLabelText('Back to goals'));
    expect(await screen.findByText('No goals yet')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Show archived goals'));
    expect(await screen.findByText('Learn Spanish')).toBeTruthy();
    expect(screen.queryByLabelText('New goal')).toBeNull();

    // Archived detail is read-only and keeps the persisted activity.
    fireEvent.press(screen.getByLabelText('Open goal Learn Spanish'));
    expect(await screen.findByLabelText('Archived')).toBeTruthy();
    expect(screen.queryByLabelText('Edit goal')).toBeNull();
    expect(screen.queryByLabelText('Archive goal')).toBeNull();
    expect(screen.getByText('Goal created')).toBeTruthy();
    expect(screen.getByText('Goal updated')).toBeTruthy();
    expect(screen.getByText('Goal archived')).toBeTruthy();
  }, 15000);

  it('a fresh services instance over the same database reconstructs the same values', async () => {
    const goal = await harness.services.goals.createGoal({
      actor: 'test',
      title: 'Learn Spanish',
      targetState: 'Hold a 15-minute conversation',
      description: 'For travelling.',
      successCriteria: 'Chat with a neighbour without switching to English',
    });

    const first = renderApp(harness.services);
    expect(await screen.findByText('Learn Spanish')).toBeTruthy();
    first.unmount();

    // Simulate an application reload: a new service graph reads the same
    // persisted SQLite records — no in-memory UI state carries over.
    const reloadedServices = composeAppServices(harness.db);
    renderApp(reloadedServices);

    expect(await screen.findByText('Learn Spanish')).toBeTruthy();
    expect(screen.getByText('Hold a 15-minute conversation')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open goal Learn Spanish'));
    expect(await screen.findByText('For travelling.')).toBeTruthy();
    expect(
      screen.getByText('Chat with a neighbour without switching to English'),
    ).toBeTruthy();
    expect(screen.getByText('Goal created')).toBeTruthy();

    const persisted = await reloadedServices.goals.getGoal(goal.id);
    expect(persisted).toMatchObject({
      title: 'Learn Spanish',
      targetState: 'Hold a 15-minute conversation',
      description: 'For travelling.',
      successCriteria: 'Chat with a neighbour without switching to English',
    });
  });
});
