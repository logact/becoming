import React from 'react';

import { AppServicesProvider } from './src/ui/composition/AppServicesProvider';
import { NavigationShell } from './src/ui/navigation/NavigationShell';
import { appDestinations } from './src/ui/placeholderDestinations';
import { ToastProvider } from './src/ui/shared/Toast';

export default function App() {
  return (
    <AppServicesProvider>
      <ToastProvider>
        <NavigationShell destinations={appDestinations()} />
      </ToastProvider>
    </AppServicesProvider>
  );
}
