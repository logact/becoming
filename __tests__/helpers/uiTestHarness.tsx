import React from 'react';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import type { RenderAPI } from '@testing-library/react-native';

import type { SqliteDatabase } from '../../src/persistence/database';
import { composeAppServices } from '../../src/ui/composition/appServices';
import type { AppServices } from '../../src/ui/composition/appServices';
import { AppServicesProvider } from '../../src/ui/composition/AppServicesProvider';
import { closeQuietly, createTestDatabase } from './testDatabase';

/**
 * UI test harness: a fresh, fully migrated in-memory database (same engine,
 * migrations, and transaction semantics as production) plus the real
 * application-service graph composed over it — exactly what the app
 * composition root builds with the expo-sqlite adapter.
 */
export interface UiTestHarness {
  db: SqliteDatabase;
  services: AppServices;
}

export async function createUiTestHarness(): Promise<UiTestHarness> {
  const db = await createTestDatabase();
  return { db, services: composeAppServices(db) };
}

export async function closeUiTestHarness(harness: UiTestHarness): Promise<void> {
  await closeQuietly(harness.db);
}

/** Render a screen wrapped in the services provider, as the app shell does. */
export function renderWithServices(ui: ReactElement, services: AppServices): RenderAPI {
  return render(<AppServicesProvider services={services}>{ui}</AppServicesProvider>);
}
