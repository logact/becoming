import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Goal } from '../../domain/goal';
import type { TimelineEvent } from '../../domain/timelineEvent';
import type { ProjectGoalPursuitView } from '../../application/projectGoalPursuitQueryService';
import { useAppServices } from '../composition/AppServicesProvider';
import { useShellNavigation } from '../navigation/NavigationShell';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { StatusBadge } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { colors, radius, spacing } from '../shared/theme';
import { describeGoalActivity, formatActivityTime } from './goalActivity';
import type { GoalDetailSlots } from './goalDetailSlots';
import { GoalFormSheet } from './GoalFormSheet';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

/** Recent activity shown on the detail, newest first. */
const RECENT_ACTIVITY_LIMIT = 5;

interface GoalDetailData {
  goal: Goal;
  pursuits: ProjectGoalPursuitView[];
  activity: TimelineEvent[];
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: GoalDetailData };

export interface GoalDetailScreenProps {
  entityId: string;
  /** Stable extension slots; #134 wires Goal pursuit actions here. */
  slots?: GoalDetailSlots;
}

/**
 * Goal detail: intended-outcome heading, description, archive/pursuit status
 * badges, target-state and active-Project facts, the Pursued-by list (or its
 * explicit empty state), recent persisted activity, edit, and confirmed
 * archive. Archived Goals render read-only. Presentation translates the
 * service read models; it never re-derives pursuit or archive state.
 */
export function GoalDetailScreen({ entityId, slots }: GoalDetailScreenProps) {
  const services = useAppServices();
  const navigation = useShellNavigation();
  const { showToast } = useToast();

  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      try {
        const goal = await services.goals.getGoal(entityId);
        if (goal === null) {
          throw new Error('This Goal could not be found. It may have been removed.');
        }
        const [pursuits, events] = await Promise.all([
          services.goalPursuitQueries.listProjectsPursuingGoal(entityId),
          services.timelines.list({ type: 'goal', id: entityId }),
        ]);
        if (!cancelled) {
          setState({
            status: 'ready',
            data: { goal, pursuits, activity: events.slice(-RECENT_ACTIVITY_LIMIT).reverse() },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The Goal could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityId, reloadToken, services]);

  function openEditSheet(goal: Goal) {
    navigation.presentSheet(
      <GoalFormSheet
        mode="edit"
        goal={goal}
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Goal updated');
          reload();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  function openArchiveConfirmation(goal: Goal) {
    navigation.presentSheet(
      <ConfirmDialog
        visible
        title="Archive this Goal?"
        message={
          `"${goal.title}" becomes read-only and leaves the Active list. ` +
          'It stays inspectable under Archived, and its history is preserved.'
        }
        confirmLabel="Confirm archive"
        destructive
        onCancel={navigation.dismissSheet}
        onConfirm={() => {
          void (async () => {
            try {
              await services.goals.archiveGoal(goal.id, ACTOR);
              navigation.dismissSheet();
              showToast('Goal archived');
              setActionError(null);
              reload();
            } catch (error) {
              navigation.dismissSheet();
              setActionError(
                error instanceof Error ? error.message : 'The Goal could not be archived.',
              );
              reload();
            }
          })();
        }}
      />,
    );
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.stateBlock} accessibilityLabel="Loading goal">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.stateText}>Loading goal…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.stateBlock}>
        <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
          !
        </Text>
        <Text style={styles.stateTitle}>Goal unavailable</Text>
        <Text style={styles.stateText}>{state.message}</Text>
        <Pressable
          onPress={reload}
          accessibilityRole="button"
          accessibilityLabel="Retry loading goal"
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to goals"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Goals</Text>
        </Pressable>
      </View>
    );
  }

  const { goal, pursuits, activity } = state.data;
  const archived = goal.archivedAt !== null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Pressable
        onPress={navigation.goBack}
        accessibilityRole="button"
        accessibilityLabel="Back to goals"
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹ Goals</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.typeLabel} maxFontSizeMultiplier={2}>
          Intended outcome
        </Text>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={2}>
          {goal.title}
        </Text>
        <Text style={styles.supporting} maxFontSizeMultiplier={2}>
          {goal.description ?? goal.targetState}
        </Text>
        <View style={styles.badges}>
          {archived ? (
            <StatusBadge label="Archived" icon="▣" />
          ) : pursuits.length > 0 ? (
            <StatusBadge label="Actively pursued" icon="↗" tone="info" />
          ) : (
            <StatusBadge label="Not pursued" icon="◌" />
          )}
        </View>
      </View>

      <View style={styles.factGrid}>
        <Fact label="Target state" value={goal.targetState} />
        <Fact label="Success criteria" value={goal.successCriteria ?? 'Not defined'} />
        <Fact label="Active projects" value={`${pursuits.length}`} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
          Pursued by
        </Text>
        {!archived && slots?.renderPursuitActions !== undefined && (
          <View style={styles.slotActions}>{slots.renderPursuitActions({ goal, refresh: reload })}</View>
        )}
      </View>
      {pursuits.length === 0 ? (
        <Text style={styles.emptySection} maxFontSizeMultiplier={2}>
          No active Project is pursuing this Goal.
        </Text>
      ) : (
        <View style={styles.sectionRows}>
          {pursuits.map((pursuit) => (
            <View key={pursuit.relationId} style={styles.sectionRow}>
              <Text style={styles.sectionRowIcon} accessibilityElementsHidden
                importantForAccessibility="no">
                ▦
              </Text>
              <View style={styles.sectionRowMain}>
                <Text style={styles.sectionRowTitle} maxFontSizeMultiplier={2}>
                  {pursuit.project?.title ?? 'Project unavailable'}
                </Text>
                {pursuit.project?.purpose !== null && pursuit.project?.purpose !== undefined && (
                  <Text style={styles.sectionRowSub} maxFontSizeMultiplier={2}>
                    {pursuit.project.purpose}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
          Recent activity
        </Text>
      </View>
      {activity.length === 0 ? (
        <Text style={styles.emptySection} maxFontSizeMultiplier={2}>
          No recorded activity yet.
        </Text>
      ) : (
        <View style={styles.sectionRows}>
          {activity.map((event) => {
            const item = describeGoalActivity(event);
            return (
              <View key={event.recordId} style={styles.sectionRow}>
                <Text style={styles.sectionRowIcon} accessibilityElementsHidden
                  importantForAccessibility="no">
                  {item.icon}
                </Text>
                <View style={styles.sectionRowMain}>
                  <Text style={styles.sectionRowTitle} maxFontSizeMultiplier={2}>
                    {item.text}
                  </Text>
                  <Text style={styles.sectionRowSub} maxFontSizeMultiplier={2}>
                    {formatActivityTime(event.occurredAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {actionError !== null && (
        <Text style={styles.actionError} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
          {actionError}
        </Text>
      )}

      {!archived && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => openEditSheet(goal)}
            accessibilityRole="button"
            accessibilityLabel="Edit goal"
            style={[styles.actionButton, styles.editButton]}
          >
            <Text style={styles.editText}>Edit goal</Text>
          </Pressable>
          <Pressable
            onPress={() => openArchiveConfirmation(goal)}
            accessibilityRole="button"
            accessibilityLabel="Archive goal"
            style={[styles.actionButton, styles.archiveButton]}
          >
            <Text style={styles.archiveText}>Archive</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <Text style={styles.factValue} maxFontSizeMultiplier={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  header: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.ink,
    marginTop: spacing.sm,
  },
  supporting: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  factGrid: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  fact: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  factValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  slotActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptySection: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionRows: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sectionRowIcon: {
    fontSize: 14,
    color: colors.brand,
  },
  sectionRowMain: {
    flex: 1,
    minWidth: 0,
  },
  sectionRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  sectionRowSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  actionError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.red,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.brandSoft,
  },
  editText: {
    color: colors.brand,
    fontWeight: '700',
  },
  archiveButton: {
    backgroundColor: colors.redSoft,
  },
  archiveText: {
    color: colors.red,
    fontWeight: '700',
  },
  stateBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorIcon: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.red,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  retryButton: {
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
