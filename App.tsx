import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider, type AppServices } from './src/ui/composition/AppServicesProvider';
import { composeServices } from './src/ui/composition/composeServices';
import { NavigationShell } from './src/ui/navigation/NavigationShell';
import { appDestinations } from './src/ui/appDestinations';
import { ToastProvider } from './src/ui/shared/Toast';
import { colors, serif } from './src/ui/shared/theme';

export default function App() {
  const [services, setServices] = useState<AppServices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    composeServices({ seed: __DEV__ })
      .then((composed) => {
        if (!cancelled) {
          setServices(composed);
        }
      })
      .catch((cause: unknown) => {
        console.error('Failed to compose app services', cause);
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        {services === null ? (
          <BootScreen error={error} />
        ) : (
          <AppServicesProvider services={services}>
            <NavigationShell destinations={appDestinations()} />
          </AppServicesProvider>
        )}
      </ToastProvider>
    </SafeAreaProvider>
  );
}

/** Minimal boot screen shown while services compose; doubles as the error state. */
function BootScreen({ error }: { error: string | null }) {
  return (
    <View style={styles.boot}>
      <Text style={styles.bootTitle}>Becoming</Text>
      {error === null ? null : (
        <Text style={styles.bootError}>Could not start: {error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootTitle: { fontFamily: serif, fontSize: 34, color: colors.ink },
  bootError: {
    marginTop: 12,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginHorizontal: 32,
  },
});
