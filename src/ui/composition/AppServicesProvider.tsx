import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SqliteDatabase } from '../../persistence/database';
import { migrate } from '../../persistence/migrate';
import { colors, radius, spacing } from '../shared/theme';
import { composeAppServices } from './appServices';
import type { AppServices } from './appServices';

const AppServicesContext = createContext<AppServices | null>(null);

/** Access the composed application services. Throws outside the provider. */
export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (services === null) throw new Error('useAppServices must be used within an AppServicesProvider');
  return services;
}

export interface AppServicesProviderProps {
  children: ReactNode;
  /**
   * Pre-composed services. When provided, database startup is skipped
   * entirely — this is how UI tests inject the in-memory Node adapter.
   */
  services?: AppServices;
  /**
   * Database factory for app startup. Defaults to the production
   * expo-sqlite adapter (`becoming.db`); tests may inject the Node adapter.
   */
  openDatabase?: () => Promise<SqliteDatabase>;
}

type StartupState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; services: AppServices };

/**
 * Composition root: opens the on-device database, runs migrations, composes
 * the application services, and exposes them to the screen tree. Startup
 * loading and failure are explicit states; failure offers a retry that
 * re-runs startup without any mutation.
 */
export function AppServicesProvider({ children, services, openDatabase }: AppServicesProviderProps) {
  const [state, setState] = useState<StartupState>(() =>
    services ? { status: 'ready', services } : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (services) return;
    let cancelled = false;
    let opened: SqliteDatabase | null = null;

    async function start() {
      try {
        const open =
          openDatabase ??
          (async () => {
            // Lazy-imported so tests and app code that inject services never
            // load the expo-sqlite native module.
            const { openAppDatabase } = await import('../../persistence/sqlite/appDatabase');
            return openAppDatabase();
          });
        const db = await open();
        opened = db;
        await migrate(db);
        if (cancelled) return;
        setState({ status: 'ready', services: composeAppServices(db) });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'The database could not be opened.',
          });
        }
      }
    }

    setState({ status: 'loading' });
    void start();

    return () => {
      cancelled = true;
      if (opened !== null) {
        void opened.closeAsync().catch(() => {
          // Already closed; nothing to do during teardown.
        });
      }
    };
  }, [services, openDatabase, attempt]);

  if (state.status === 'loading') {
    return (
      <View style={styles.centered} accessibilityLabel="Starting Becoming">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.message}>Opening your workspace…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
          !
        </Text>
        <Text style={styles.title}>Workspace unavailable</Text>
        <Text style={styles.message}>{state.message}</Text>
        <Pressable
          onPress={() => setAttempt((value) => value + 1)}
          accessibilityRole="button"
          accessibilityLabel="Retry opening the workspace"
          style={styles.retry}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return <AppServicesContext.Provider value={state.services}>{children}</AppServicesContext.Provider>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorIcon: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.red,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
});
