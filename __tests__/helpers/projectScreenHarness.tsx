import React from 'react';
import type { RenderAPI } from '@testing-library/react-native';

import type { AppServices } from '../../src/ui/composition/appServices';
import { NavigationShell } from '../../src/ui/navigation/NavigationShell';
import { appDestinations } from '../../src/ui/placeholderDestinations';
import { projectsDestination } from '../../src/ui/projects/projectsDestination';
import type { ProjectDetailSlots } from '../../src/ui/projects/projectDetailSlots';
import { renderWithServices, TestToastProvider } from './uiTestHarness';

/**
 * Render the real Projects destination inside the shell and toast provider,
 * composed over the supplied services — the same wiring the app uses.
 */
export function renderProjectsApp(services: AppServices, slots?: ProjectDetailSlots): RenderAPI {
  return renderWithServices(
    <TestToastProvider>
      <NavigationShell destinations={[projectsDestination(slots)]} />
    </TestToastProvider>,
    services,
  );
}

/**
 * Render the full app destination set (Goals + Projects + Task placeholder)
 * exactly as `App.tsx` composes it — required for Goal-context pursuit flows
 * and cross-destination navigation.
 */
export function renderPlanningApp(services: AppServices): RenderAPI {
  return renderWithServices(
    <TestToastProvider>
      <NavigationShell destinations={appDestinations()} />
    </TestToastProvider>,
    services,
  );
}
