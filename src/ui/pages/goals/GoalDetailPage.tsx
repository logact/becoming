import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GoalDetailService, GoalDetailView } from '../../../application/goal/GoalDetailService';
import type { GoalStatus } from '../../../domain/goal/Goal';
import type { ProjectStatus } from '../../../domain/project/Project';
import type { GoalId } from '../../../domain/shared/ids';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { StatTile } from '../../components/StatTile';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { colors, serif, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';

/** `StatusPill` has no `failed` state; the prototype renders it as conflict. */
const GOAL_STATUS_PILL: Record<GoalStatus, { state: StatusState; label: string }> = {
  todo: { state: 'todo', label: 'Todo' },
  doing: { state: 'doing', label: 'Doing' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

const PROJECT_STATUS_PILL: Record<ProjectStatus, { state: StatusState; label: string }> = {
  planning: { state: 'planning', label: 'Planning' },
  active: { state: 'active', label: 'Active' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface GoalDetailPageProps {
  goalId: GoalId;
  /**
   * Read service behind the screen. Passed as a prop (not pulled from
   * AppServices) so the page is testable with fakes before the composition
   * wiring lands.
   */
  detail: Pick<GoalDetailService, 'getDetail'>;
}

/**
 * Goal detail, pushed via the shell's `renderDetail(goalId)` mechanism:
 * header (title, status pill, target date, labels, Active projects count),
 * the goal's projects with a "Current plan" tag on the active one, and
 * goal-scoped recent activity. Project rows push the project detail screen.
 * No edit actions yet.
 */
export function GoalDetailPage({ goalId, detail }: GoalDetailPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ view: GoalDetailView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const view = await detail.getDetail(goalId);
      setLoadError(null);
      setLoaded({ view, now });
    } catch (cause: unknown) {
      // Surface load failures; a silent rejection would leave a blank screen.
      console.error('Failed to load the goal detail', cause);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [detail, goalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Minimal loading state: empty screen background until the first load.
  if (loaded === null) {
    return (
      <View testID="goal-detail-page" style={styles.screen}>
        <InlineNavBar title="Goal" onBack={navigation.goBack} />
        {loadError === null ? null : (
          <SectionNote>Could not load the goal: {loadError}</SectionNote>
        )}
      </View>
    );
  }
  const { view, now } = loaded;

  if (view.goal === null) {
    return (
      <View testID="goal-detail-page" style={styles.screen}>
        <InlineNavBar title="Goal" onBack={navigation.goBack} />
        <SectionNote>Unknown goal.</SectionNote>
      </View>
    );
  }

  const { goal } = view;
  const statusPill = GOAL_STATUS_PILL[goal.status];
  const activeProjects = view.activeProjectId === null ? 0 : 1;

  return (
    <View testID="goal-detail-page" style={styles.screen}>
      <InlineNavBar title="Goal" onBack={navigation.goBack} />
      <ScrollView>
        <View testID="goal-detail-header" style={styles.header}>
          <Text style={styles.title}>{goal.title}</Text>
          <View style={styles.metaRow}>
            <StatusPill state={statusPill.state} label={statusPill.label} />
            {goal.due ? <Text style={styles.meta}>Target {shortDate(goal.due)}</Text> : null}
          </View>
          {goal.labelIds.length > 0 ? (
            <Text testID="goal-detail-labels" style={styles.labels}>
              {goal.labelIds.join(' · ')}
            </Text>
          ) : null}
          <View style={styles.statCell}>
            <StatTile
              value={`${activeProjects} / ${view.projects.length}`}
              label="Active projects"
            />
          </View>
        </View>

        <View testID="projects-section">
          <SectionHeader title="Projects — plans for this goal" />
          <ListSection variant="panel">
            {view.projects.map((project) => {
              const pill = PROJECT_STATUS_PILL[project.status];
              const isCurrentPlan = project.id === view.activeProjectId;
              return (
                <ListRow
                  key={project.id}
                  testID={`project-row-${project.id}`}
                  icon="box"
                  title={project.name}
                  subtitle={`${project.subGoalCount} sub-goal${project.subGoalCount === 1 ? '' : 's'}`}
                  trailing={
                    <View style={styles.trailing}>
                      {isCurrentPlan ? (
                        <Text testID={`current-plan-${project.id}`} style={styles.currentPlan}>
                          Current plan
                        </Text>
                      ) : null}
                      <StatusPill state={pill.state} label={pill.label} />
                    </View>
                  }
                  onPress={() => navigation.pushScreen(`project:${project.id}`)}
                />
              );
            })}
          </ListSection>
          {view.projects.length === 0 ? <SectionNote>No project yet.</SectionNote> : null}
        </View>

        <View testID="activity-section" style={styles.lastSection}>
          <SectionHeader title="Recent activity" />
          <ListSection variant="panel">
            {view.recentActivity.map((item) => (
              <ListRow
                key={item.id}
                icon={activityIcon(item.kind)}
                title={item.detail ?? item.kind}
                trailing={<Text style={styles.meta}>{relativeTime(item.occurredAt, now)}</Text>}
              />
            ))}
          </ListSection>
          {view.recentActivity.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { marginTop: 4, marginHorizontal: spacing.screenMargin },
  title: {
    fontFamily: serif,
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    marginHorizontal: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginHorizontal: 6,
  },
  meta: { fontSize: 12.5, fontWeight: '500', color: colors.faint },
  labels: { fontSize: 12.5, fontWeight: '600', color: colors.muted, marginTop: 10, marginHorizontal: 6 },
  statCell: { marginTop: 12 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentPlan: { fontSize: 11.5, fontWeight: '700', color: colors.sage },
  lastSection: { paddingBottom: spacing.sectionTop },
});
