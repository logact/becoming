import React from 'react';
import type { RenderAPI } from '@testing-library/react-native';

import type { AppServices } from '../../src/ui/composition/appServices';
import { NavigationShell } from '../../src/ui/navigation/NavigationShell';
import { appDestinations } from '../../src/ui/placeholderDestinations';
import { projectsDestination } from '../../src/ui/projects/projectsDestination';
import type { ProjectDetailSlots } from '../../src/ui/projects/projectDetailSlots';
import { ToastProvider } from '../../src/ui/shared/Toast';
import { renderWithServices } from './uiTestHarness';

/**
 * Render the real Projects destination inside the shell and toast provider,
 * composed over the supplied services — the same wiring the app uses.
 */
export function renderProjectsApp(services: AppServices, slots?: ProjectDetailSlots): RenderAPI {
  return renderWithServices(
    <ToastProvider>
      <NavigationShell destinations={[projectsDestination(slots)]} />
    </ToastProvider>,
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
    <ToastProvider>
      <NavigationShell destinations={appDestinations()} />
    </ToastProvider>,
    services,
  );
}
