import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Goal } from '../../domain/goal';
import { useAppServices } from '../composition/AppServicesProvider';
import { useShellNavigation } from '../navigation/NavigationShell';
import { EntityListScaffold } from '../shared/EntityListScaffold';
import type { EntityListFilter } from '../shared/EntityListScaffold';
import { StatusBadge } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { colors, spacing } from '../shared/theme';
import { GoalFormSheet } from './GoalFormSheet';

interface GoalRow {
  goal: Goal;
  /** Active Projects currently pursuing this Goal, from the pursuit query. */
  activePursuitCount: number;
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: GoalRow[] };

/**
 * The Goals destination list: planning hero, title search, Active/Archived
 * filter, populated rows with target-state and pursued/unpursued context,
 * explicit empty/loading/recoverable-error states, and an active-only New
 * Goal action. All data comes from the application services; the screen
 * never derives pursuit or archive rules itself.
 */
export function GoalListScreen() {
  const services = useAppServices();
  const navigation = useShellNavigation();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<EntityListFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      try {
        const goals = filter === 'active'
          ? await services.goals.listActiveGoals()
          : await services.goals.listArchivedGoals();
        const rows = await Promise.all(goals.map(async (goal) => ({
          goal,
          activePursuitCount:
            (await services.goalPursuitQueries.listProjectsPursuingGoal(goal.id)).length,
        })));
        if (!cancelled) setState({ status: 'ready', rows });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The list could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [filter, reloadToken, services]);

  const query = searchQuery.trim().toLowerCase();
  const rows = state.status === 'ready' ? state.rows : [];
  const visibleRows = query.length === 0
    ? rows
    : rows.filter((row) => row.goal.title.toLowerCase().includes(query));

  function openCreateSheet() {
    navigation.presentSheet(
      <GoalFormSheet
        mode="create"
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Goal created');
          reload();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  return (
    <EntityListScaffold<GoalRow>
      title="Goals"
      heroTitle="What do you want to become?"
      heroCopy="Define outcomes before choosing the work."
      heroKicker="Milestone 2 planning"
      searchPlaceholder="Search goals"
      status={state.status}
      errorMessage={state.status === 'error' ? state.message : undefined}
      onRetry={state.status === 'error' ? reload : undefined}
      items={visibleRows}
      keyExtractor={(row) => row.goal.id}
      renderRow={(row) => (
        <GoalRowView row={row} onOpen={() => navigation.openDetail(row.goal.id)} />
      )}
      filter={filter}
      onFilterChange={setFilter}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      emptyTitle={emptyTitle(filter, query)}
      emptyMessage={emptyMessage(filter, query)}
      createLabel="New goal"
      onCreate={openCreateSheet}
    />
  );
}

function emptyTitle(filter: EntityListFilter, query: string): string {
  if (query.length > 0) return 'No matching goals';
  return filter === 'active' ? 'No goals yet' : 'No archived goals';
}

function emptyMessage(filter: EntityListFilter, query: string): string {
  if (query.length > 0) return 'Try a different search.';
  return filter === 'active'
    ? 'Define an outcome to shape this plan.'
    : 'Archived Goals remain inspectable here.';
}

function GoalRowView({ row, onOpen }: { row: GoalRow; onOpen: () => void }) {
  const { goal, activePursuitCount } = row;
  const archived = goal.archivedAt !== null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open goal ${goal.title}`}
      style={styles.row}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} maxFontSizeMultiplier={2}>
          {goal.title}
        </Text>
        <Text style={styles.rowSub} maxFontSizeMultiplier={2}>
          {goal.targetState}
        </Text>
      </View>
      {archived ? (
        <StatusBadge label="Archived" icon="▣" />
      ) : activePursuitCount > 0 ? (
        <StatusBadge
          label={`${activePursuitCount} project${activePursuitCount === 1 ? '' : 's'}`}
          icon="↗"
          tone="info"
        />
      ) : (
        <StatusBadge label="Unpursued" icon="◌" />
      )}
      <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  rowSub: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.muted,
  },
  chevron: {
    fontSize: 18,
    color: colors.muted,
  },
});
