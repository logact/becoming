import React from 'react';
import type { RenderAPI } from '@testing-library/react-native';

import type { AppServices } from '../../src/ui/composition/appServices';
import { NavigationShell } from '../../src/ui/navigation/NavigationShell';
import { tasksDestination } from '../../src/ui/tasks/tasksDestination';
import { renderWithServices, TestToastProvider } from './uiTestHarness';

/**
 * Render the real Tasks destination inside the shell and toast provider,
 * composed over the supplied services — the same wiring the app uses.
 */
export function renderTasksApp(services: AppServices): RenderAPI {
  return renderWithServices(
    <TestToastProvider>
      <NavigationShell destinations={[tasksDestination()]} />
    </TestToastProvider>,
    services,
  );
}
