import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import type { RenderAPI } from '@testing-library/react-native';

import type { AppServices } from '../../src/ui/composition/appServices';
import { NavigationShell } from '../../src/ui/navigation/NavigationShell';
import { goalsDestination } from '../../src/ui/goals/goalsDestination';
import type { GoalDetailSlots } from '../../src/ui/goals/goalDetailSlots';
import { renderWithServices, TestToastProvider } from './uiTestHarness';

/**
 * Render the real Goals destination inside the shell and toast provider,
 * composed over the supplied services — the same wiring the app uses.
 */
export function renderGoalsApp(services: AppServices, slots?: GoalDetailSlots): RenderAPI {
  return renderWithServices(
    <TestToastProvider>
      <NavigationShell destinations={[goalsDestination(slots)]} />
    </TestToastProvider>,
    services,
  );
}

/**
 * Return a shallow services override with one method replaced. Used to drive
 * loading, query-failure, and mutation-failure states through the real
 * screen; the original instances stay untouched.
 */
export function overrideServiceMethod<TService extends object, TMethod extends keyof TService>(
  service: TService,
  method: TMethod,
  implementation: TService[TMethod],
): TService {
  return new Proxy(service, {
    get: (target, property, receiver) =>
      property === method ? implementation : Reflect.get(target, property, receiver),
  });
}

/**
 * Assert a success toast appears after a committed mutation and then fades.
 * Toasts are transient announcements only — never persisted state — so tests
 * also verify the message disappears; this releases the toast timer before
 * test teardown.
 */
export async function expectTransientToast(message: string): Promise<void> {
  expect(await screen.findByText(`✓ ${message}`)).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(`✓ ${message}`)).toBeNull(), { timeout: 4000 });
}
