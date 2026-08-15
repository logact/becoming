import React from 'react';
import type { RenderAPI } from '@testing-library/react-native';

import type { AppServices } from '../../src/ui/composition/appServices';
import { NavigationShell } from '../../src/ui/navigation/NavigationShell';
import { ToastProvider } from '../../src/ui/shared/Toast';
import { tasksDestination } from '../../src/ui/tasks/tasksDestination';
import { renderWithServices } from './uiTestHarness';

/**
 * Render the real Tasks destination inside the shell and toast provider,
 * composed over the supplied services — the same wiring the app uses.
 */
export function renderTasksApp(services: AppServices): RenderAPI {
  return renderWithServices(
    <ToastProvider>
      <NavigationShell destinations={[tasksDestination()]} />
    </ToastProvider>,
    services,
  );
}
