import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  GoalAttentionItem,
  GoalListItem,
  GoalsOverviewService,
  GoalsOverviewView,
} from '../../../application/goal/GoalsOverviewService';
import type { GoalStatus } from '../../../domain/goal/Goal';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { StatTile } from '../../components/StatTile';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { colors, spacing } from '../../shared/theme';
import { relativeTime } from '../dashboard/format';

/** `StatusPill` has no `failed` state; the prototype renders it as conflict. */
const GOAL_STATUS_PILL: Record<GoalStatus, { state: StatusState; label: string }> = {
  todo: { state: 'todo', label: 'Todo' },
  doing: { state: 'doing', label: 'Doing' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

const STATUS_GROUP_ORDER: GoalStatus[] = ['doing', 'todo', 'paused', 'failed', 'done'];

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function attentionSubtitle(item: GoalAttentionItem): string {
  return item.reason === 'failed'
    ? 'Failed'
    : `Target ${shortDate(item.due as Date)}`;
}

function attentionPillLabel(item: GoalAttentionItem, now: Date): string {
  if (item.reason === 'failed') {
    return 'Failed';
  }
  const due = item.due as Date;
  return due.getTime() < now.getTime()
    ? `Overdue ${relativeTime(due, now)}`
    : `Due in ${relativeTime(due, now)}`;
}

export interface GoalsPageProps {
  /**
   * Read service behind the screen. Passed as a prop (not pulled from
   * AppServices) so the page is testable with fakes before the composition
   * wiring lands.
   */
  overview: Pick<GoalsOverviewService, 'getOverview'>;
}

/**
 * Goals screen, pushed from the Library hub (Library → Goals → goal detail):
 * headline "Active goals" stat, Needs attention, Focus (doing goals), By
 * status, By label and All goals grouped by status. Goal rows push the goal
 * detail via `navigation.openDetail`. Recent activity stays on the dashboard
 * and is not repeated here.
 */
export function GoalsPage({ overview }: GoalsPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ view: GoalsOverviewView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const view = await overview.getOverview(now);
      setLoadError(null);
      setLoaded({ view, now });
    } catch (cause: unknown) {
      // Surface load failures; a silent rejection would leave a blank screen.
      console.error('Failed to load the goals overview', cause);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [overview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Minimal loading state: empty screen background until the first load.
  if (loaded === null) {
    return (
      <View testID="goals-page" style={styles.screen}>
        <InlineNavBar title="Goals" onBack={navigation.goBack} />
        {loadError === null ? null : (
          <SectionNote>Could not load the goals: {loadError}</SectionNote>
        )}
      </View>
    );
  }
  const { view, now } = loaded;

  const openGoal = (goalId: string): void => navigation.openDetail(goalId);

  const goalRow = (goal: GoalListItem) => (
    <ListRow
      key={goal.id}
      testID={`goal-row-${goal.id}`}
      icon="target"
      title={goal.title}
      subtitle={goal.due ? `Target ${shortDate(goal.due)}` : undefined}
      trailing={<Icon name="chevron" size={14} color={colors.chevron} />}
      onPress={() => openGoal(goal.id)}
    />
  );

  return (
    <ScrollView testID="goals-page" style={styles.screen}>
      <InlineNavBar title="Goals" onBack={navigation.goBack} />
      <View testID="stats-row" style={styles.statsRow}>
        <View style={styles.statCell}>
          <StatTile
            value={`${view.stats.activeGoals} / ${view.stats.totalGoals}`}
            label="Active goals"
          />
        </View>
      </View>

      <View testID="attention-section">
        <SectionHeader title="Needs attention" />
        <ListSection variant="panel">
          {view.attention.map((item) => (
            <ListRow
              key={item.id}
              testID={`attention-goal-${item.id}`}
              icon={item.reason === 'failed' ? 'alert' : 'clock'}
              title={item.title}
              subtitle={attentionSubtitle(item)}
              trailing={
                <StatusPill
                  state={item.reason === 'failed' ? 'conflict' : 'blocked'}
                  label={attentionPillLabel(item, now)}
                />
              }
              onPress={() => openGoal(item.id)}
            />
          ))}
        </ListSection>
        {view.attention.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="focus-section">
        <SectionHeader title="Focus" />
        <ListSection variant="panel">
          {view.focus.map((goal) => (
            <ListRow
              key={goal.id}
              testID={`focus-goal-${goal.id}`}
              icon="target"
              title={goal.title}
              subtitle={goal.due ? `Target ${shortDate(goal.due)}` : 'No target date'}
              trailing={<StatusPill state="doing" label="Doing" />}
              onPress={() => openGoal(goal.id)}
            />
          ))}
        </ListSection>
        {view.focus.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="by-status-section">
        <SectionHeader title="By status" />
        <ListSection variant="panel">
          {STATUS_GROUP_ORDER.map((status) => (
            <ListRow
              key={status}
              title={GOAL_STATUS_PILL[status].label}
              trailing={<Text style={styles.count}>{view.byStatus[status]}</Text>}
            />
          ))}
        </ListSection>
      </View>

      <View testID="by-label-section">
        <SectionHeader title="By label" />
        <ListSection variant="panel">
          {view.byLabel.map((entry) => (
            <ListRow
              key={entry.labelId}
              icon="tag"
              title={entry.name}
              trailing={<Text style={styles.count}>{entry.count}</Text>}
            />
          ))}
        </ListSection>
        {view.byLabel.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="all-goals-section" style={styles.lastSection}>
        <SectionHeader title="All goals" />
        {STATUS_GROUP_ORDER.map((status) => {
          const goals = view.allGoals[status];
          if (goals.length === 0) {
            return null;
          }
          return (
            <View key={status} testID={`goal-group-${status}`}>
              <Text style={styles.groupLabel}>{GOAL_STATUS_PILL[status].label}</Text>
              <ListSection variant="panel">{goals.map(goalRow)}</ListSection>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginHorizontal: spacing.screenMargin,
  },
  statCell: { flex: 1 },
  count: { fontSize: 14, fontWeight: '700', color: colors.muted },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.faint,
    marginTop: 6,
    marginBottom: 8,
    marginHorizontal: spacing.textMargin,
  },
  lastSection: { paddingBottom: spacing.sectionTop },
});
