import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  ActivityItem,
  AttentionItem,
  DashboardView,
  DoingItem,
} from '../../../application/dashboard/DashboardService';
import type { IconName } from '../../components/Icon';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { StatTile } from '../../components/StatTile';
import { StatusPill } from '../../components/StatusPill';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { useCaptureRevision } from '../../navigation/CaptureRevision';
import { createId } from '../../shared/id';
import { colors, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { eyebrowDate, relativeTime } from './format';

const DOING_ICON: Record<DoingItem['type'], IconName> = {
  goal: 'target',
  task: 'checkCircle',
  idea: 'bulb',
};

// Scheduling attention receives its presentation in the scheduling UI slice.
const ATTENTION_ICON: Record<string, IconName> = {
  failed: 'alert',
  overdue: 'clock',
  resourceExhausted: 'banknote',
  pinned: 'bulb',
};

type DashboardEntityType = DoingItem['type'] | AttentionItem['type'];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function doingSubtitle(item: DoingItem, now: Date): string {
  const base = `${capitalize(item.type)} · ${capitalize(item.status)}`;
  return item.due ? `${base} · Due ${relativeTime(item.due, now)}` : base;
}

function attentionSubtitle(item: AttentionItem, now: Date): string {
  return `${capitalize(item.type)} · ${attentionReasonText(item, now)}`;
}

function attentionReasonText(item: AttentionItem, now: Date): string {
  switch (item.reason) {
    case 'failed':
      return 'Failed';
    case 'overdue':
      if (item.due === undefined) {
        return 'Overdue';
      }
      return item.due.getTime() < now.getTime()
        ? `Overdue ${relativeTime(item.due, now)}`
        : `Due in ${relativeTime(item.due, now)}`;
    case 'resourceExhausted':
      return 'Resource ≥ 90% used';
    case 'pinned':
      return 'Pinned';
  }
}

/**
 * Dashboard tab: eyebrow date, headline stats, Doing now, Needs attention
 * (with the "Pin an item…" row pushing the attention-pin screen) and the
 * Recent activity panel. Doing and attention entity rows open detail on the
 * Dashboard stack; Recent activity remains informational.
 */
export function DashboardPage() {
  const { dashboard, attention } = useAppServices();
  if (!dashboard) {
    throw new Error('AppServices.dashboard is not provided');
  }
  if (!attention) {
    throw new Error('AppServices.attention is not provided');
  }

  const navigation = useShellNavigation();
  const captureRevision = useCaptureRevision();
  const [loaded, setLoaded] = useState<{ view: DashboardView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openEntity = (type: DashboardEntityType, id: string): void => {
    if (type === 'goal') {
      navigation.openDetail(id);
      return;
    }
    navigation.pushScreen(`${type}:${id}`);
  };

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const view = await dashboard.getDashboard(now);
      setLoadError(null);
      setLoaded({ view, now });
    } catch (cause: unknown) {
      // Surface load failures; a silent rejection would leave a blank screen.
      console.error('Failed to load the dashboard', cause);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [dashboard]);

  useEffect(() => {
    void refresh();
  }, [refresh, captureRevision]);

  // Minimal loading state: empty screen background until the first load.
  if (loaded === null) {
    return (
      <View testID="dashboard-page" style={styles.screen}>
        {loadError === null ? null : (
          <SectionNote>Could not load the dashboard: {loadError}</SectionNote>
        )}
      </View>
    );
  }
  const { view, now } = loaded;

  const removeAttention = async (item: AttentionItem): Promise<void> => {
    await attention.dismiss({
      id: createId(),
      targetType: item.type,
      targetId: item.id,
      now: new Date(),
    });
    await refresh();
  };

  return (
    <ScrollView testID="dashboard-page" style={styles.screen}>
      <Text style={styles.eyebrow}>{eyebrowDate(now)}</Text>

      <View testID="stats-row" style={styles.statsRow}>
        <View style={styles.statCell}>
          <StatTile value={view.stats.doingNow} label="Doing now" />
        </View>
        <View style={styles.statCell}>
          <StatTile value={view.stats.doneToday} label="Done today" />
        </View>
        <View style={styles.statCell}>
          <StatTile value={view.stats.dueToday} label="Due today" />
        </View>
      </View>

      <View testID="doing-section">
        <SectionHeader title="Doing now" />
        <ListSection variant="borderless">
          {view.doing.map((item) => (
            // Deviation from the prototype: its rows show a per-row progress
            // bar; no progress data source exists yet, so rows render none.
            <ListRow
              key={`${item.type}-${item.id}`}
              testID={`dashboard-doing-${item.type}-${item.id}`}
              icon={DOING_ICON[item.type]}
              title={item.title}
              subtitle={doingSubtitle(item, now)}
              onPress={() => openEntity(item.type, item.id)}
              trailing={
                item.type === 'idea' ? (
                  <StatusPill state="captured" label="Captured" />
                ) : item.due ? (
                  <Text style={styles.meta}>{relativeTime(item.due, now)}</Text>
                ) : undefined
              }
            />
          ))}
        </ListSection>
        {view.doing.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="attention-section">
        <SectionHeader title="Needs attention" />
        <ListSection variant="borderless">
          {view.attention.map((item) => (
            <ListRow
              key={`${item.type}-${item.id}`}
              testID={`dashboard-attention-${item.type}-${item.id}`}
              icon={ATTENTION_ICON[item.reason]}
              title={item.title}
              subtitle={attentionSubtitle(item, now)}
              onPress={() => openEntity(item.type, item.id)}
              trailing={
                <PrimaryChipButton
                  testID={`attention-remove-${item.type}-${item.id}`}
                  label="Remove"
                  stopPropagation
                  onPress={() => void removeAttention(item)}
                />
              }
            />
          ))}
          <ListRow
            testID="pin-an-item"
            icon="plus"
            title="Pin an item…"
            titleStyle={styles.pinLabel}
            onPress={() => navigation.pushScreen('attention-pin')}
          />
        </ListSection>
        <SectionNote>
          Failed, due-soon (goal/project 1 d, task 2 h) and resource-exhausted (≥90%) items surface
          automatically. Pin anything yourself — it stays until you remove it.
        </SectionNote>
      </View>

      <View testID="activity-section" style={styles.activitySection}>
        <SectionHeader title="Recent activity" />
        <ListSection variant="panel">
          {view.recentActivity.map((item) => (
            <ListRow
              key={item.id}
              testID={`dashboard-activity-${item.id}`}
              icon={activityIcon(item.kind)}
              title={item.detail ?? item.kind}
              trailing={<Text style={styles.meta}>{relativeTime(item.occurredAt, now)}</Text>}
            />
          ))}
        </ListSection>
        {view.recentActivity.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.84,
    textTransform: 'uppercase',
    color: colors.faint,
    marginTop: 10,
    marginHorizontal: spacing.textMargin,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginHorizontal: spacing.screenMargin,
  },
  statCell: { flex: 1 },
  /** Meta / timestamps: 12.5px / 500, faint. */
  meta: { fontSize: 12.5, fontWeight: '500', color: colors.faint },
  pinLabel: { fontSize: 15.5, fontWeight: '700', color: colors.green },
  activitySection: { paddingBottom: spacing.sectionTop },
});
