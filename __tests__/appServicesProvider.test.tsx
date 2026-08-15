import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppServicesProvider, useAppServices } from '../src/ui/composition/AppServicesProvider';
import type { SqliteDatabase } from '../src/persistence/database';
import { NodeSqliteDatabase } from '../src/persistence/sqlite/nodeSqliteDatabase';
import { closeQuietly, createTestDatabase, listTables } from './helpers/testDatabase';
import { closeUiTestHarness, createUiTestHarness, renderWithServices } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';

/** Consumer that proves context access and lists active Goal titles. */
function GoalTitles() {
  const services = useAppServices();
  const [titles, setTitles] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void services.goals.listActiveGoals().then((goals) => {
      if (!cancelled) setTitles(goals.map((goal) => goal.title));
    });
    return () => {
      cancelled = true;
    };
  }, [services]);
  if (titles === null) return <Text>Loading goals…</Text>;
  if (titles.length === 0) return <Text>No goals yet</Text>;
  return (
    <View>
      {titles.map((title) => (
        <Text key={title}>{title}</Text>
      ))}
    </View>
  );
}

describe('AppServicesProvider', () => {
  let harness: UiTestHarness;
  beforeEach(async () => {
    harness = await createUiTestHarness();
  });
  afterEach(async () => closeUiTestHarness(harness));

  it('exposes the composed services against the in-memory database', async () => {
    await harness.services.goals.createGoal({
      title: 'Become fluent',
      targetState: 'Hold a conversation',
      actor: 'test',
    });

    renderWithServices(<GoalTitles />, harness.services);
    expect(await screen.findByText('Become fluent')).toBeTruthy();
  });

  it('opens, migrates, and composes from an injected database factory', async () => {
    let db: SqliteDatabase | null = null;
    render(
      <AppServicesProvider
        openDatabase={async () => {
          db = new NodeSqliteDatabase(':memory:');
          return db;
        }}
      >
        <GoalTitles />
      </AppServicesProvider>,
    );

    expect(screen.getByText('Opening your workspace…')).toBeTruthy();
    expect(await screen.findByText('No goals yet')).toBeTruthy();
    expect(await listTables(db!)).toContain('goals');
    await closeQuietly(db!);
  });

  it('shows a recoverable startup failure and retries', async () => {
    let db: SqliteDatabase | null = null;
    const openDatabase = jest
      .fn<Promise<SqliteDatabase>, []>()
      .mockRejectedValueOnce(new Error('disk is full'))
      .mockImplementationOnce(async () => {
        db = await createTestDatabase();
        return db;
      });

    render(
      <AppServicesProvider openDatabase={openDatabase}>
        <GoalTitles />
      </AppServicesProvider>,
    );

    expect(await screen.findByText('Workspace unavailable')).toBeTruthy();
    expect(screen.getByText('disk is full')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry opening the workspace'));
    expect(await screen.findByText('No goals yet')).toBeTruthy();
    expect(openDatabase).toHaveBeenCalledTimes(2);
    await closeQuietly(db!);
  });
});
