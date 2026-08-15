import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from './src/ui/composition/AppServicesProvider';
import { NavigationShell } from './src/ui/navigation/NavigationShell';
import { appDestinations } from './src/ui/placeholderDestinations';
import { ToastProvider } from './src/ui/shared/Toast';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppServicesProvider>
        <ToastProvider>
          <NavigationShell destinations={appDestinations()} />
        </ToastProvider>
      </AppServicesProvider>
    </SafeAreaProvider>
  );
}
