import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Task } from '../../domain/task';
import type { TimelineEvent } from '../../domain/timelineEvent';
import type { TaskProjectMembershipView } from '../../application/taskProjectMembershipQueryService';
import { useAppServices } from '../composition/AppServicesProvider';
import { useShellNavigation } from '../navigation/NavigationShell';
import { requestCrossDestinationDetail } from '../projects/crossDestinationDetail';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { StatusBadge } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { colors, radius, spacing } from '../shared/theme';
import { TaskMembershipActions } from './membership/TaskMembershipActions';
import { describeTaskActivity, formatActivityTime } from './taskActivity';
import {
  STANDALONE_TASK_LIFECYCLE,
  taskLifecycleFromSnapshot,
} from './taskLifecycle';
import type { TaskLifecyclePresentation } from './taskLifecycle';
import { TaskFormSheet } from './TaskFormSheet';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

/** Recent activity shown on the detail, newest first. */
const RECENT_ACTIVITY_LIMIT = 5;

interface TaskDetailData {
  task: Task;
  memberships: TaskProjectMembershipView[];
  lifecycle: TaskLifecyclePresentation | null;
  activity: TimelineEvent[];
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TaskDetailData };

export interface TaskDetailScreenProps {
  entityId: string;
}

/**
 * Task detail (#132): executable-work heading, target, lifecycle-status and
 * priority badges, the current Project fact, a read-only lifecycle fact with
 * the prototype's explicit note that transition actions belong to Feature
 * #29, recent persisted activity, edit, and confirmed archive. Membership
 * add/remove commits through the semantic membership service — never a
 * Project field on Task. Archived Tasks render read-only. Presentation
 * translates the service read models; it never re-derives membership,
 * lifecycle, or archive state.
 */
export function TaskDetailScreen({ entityId }: TaskDetailScreenProps) {
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
        const task = await services.tasks.getTask(entityId);
        if (task === null) {
          throw new Error('This Task could not be found. It may have been removed.');
        }
        const [memberships, events] = await Promise.all([
          services.taskMembershipQueries.listActiveProjectsForTask(entityId),
          services.timelines.list({ type: 'task', id: entityId }),
        ]);
        const membership = memberships[0] ?? null;
        let lifecycle: TaskLifecyclePresentation | null = null;
        if (task.archivedAt === null) {
          lifecycle = membership === null
            ? STANDALONE_TASK_LIFECYCLE
            : taskLifecycleFromSnapshot(
                await services.executionSnapshots.getSnapshot(membership.projectId),
                task.id,
              );
        }
        if (!cancelled) {
          setState({
            status: 'ready',
            data: {
              task,
              memberships,
              lifecycle,
              activity: events.slice(-RECENT_ACTIVITY_LIMIT).reverse(),
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The Task could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityId, reloadToken, services]);

  function openEditSheet(task: Task) {
    navigation.presentSheet(
      <TaskFormSheet
        mode="edit"
        task={task}
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Task updated');
          reload();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  function openArchiveConfirmation(task: Task) {
    navigation.presentSheet(
      <ConfirmDialog
        visible
        title="Archive this Task?"
        message={
          `"${task.title}" becomes read-only and leaves the Active list. ` +
          'It stays inspectable under Archived, and its history is preserved.'
        }
        confirmLabel="Confirm archive"
        destructive
        onCancel={navigation.dismissSheet}
        onConfirm={() => {
          void (async () => {
            try {
              await services.tasks.archiveTask(task.id, ACTOR);
              navigation.dismissSheet();
              showToast('Task archived');
              setActionError(null);
              reload();
            } catch (error) {
              navigation.dismissSheet();
              setActionError(
                error instanceof Error ? error.message : 'The Task could not be archived.',
              );
              reload();
            }
          })();
        }}
      />,
    );
  }

  function openProject(projectId: string) {
    requestCrossDestinationDetail({ destination: 'projects', entityId: projectId });
    navigation.switchDestination('projects');
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.stateBlock} accessibilityLabel="Loading task">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.stateText}>Loading task…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.stateBlock}>
        <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
          !
        </Text>
        <Text style={styles.stateTitle}>Task unavailable</Text>
        <Text style={styles.stateText}>{state.message}</Text>
        <Pressable
          onPress={reload}
          accessibilityRole="button"
          accessibilityLabel="Retry loading task"
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to tasks"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Tasks</Text>
        </Pressable>
      </View>
    );
  }

  const { task, memberships, lifecycle, activity } = state.data;
  const archived = task.archivedAt !== null;
  const membership = memberships[0] ?? null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Pressable
        onPress={navigation.goBack}
        accessibilityRole="button"
        accessibilityLabel="Back to tasks"
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹ Tasks</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.typeLabel} maxFontSizeMultiplier={2}>
          Executable work
        </Text>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={2}>
          {task.title}
        </Text>
        <Text style={styles.supporting} maxFontSizeMultiplier={2}>
          {task.description ?? task.targetDescription}
        </Text>
        <View style={styles.badges}>
          {archived ? (
            <StatusBadge label="Archived" icon="▣" />
          ) : (
            lifecycle !== null && (
              <StatusBadge
                label={lifecycle.badgeLabel}
                icon={lifecycle.badgeIcon}
                tone={lifecycle.badgeTone}
              />
            )
          )}
          {task.priority !== null && (
            <StatusBadge label={`Priority ${task.priority}`} icon="↑" />
          )}
        </View>
      </View>

      <View style={styles.factGrid}>
        <Fact label="Target" value={task.targetDescription} />
        <Fact
          label="Project"
          value={membership?.project?.title ?? 'No membership'}
        />
        <Fact
          label="Lifecycle"
          value={archived ? 'Archived — lifecycle no longer applies' : lifecycle?.factText ?? 'Unavailable'}
        />
        <Fact label="Exit criteria" value={task.exitCriteria ?? 'Not defined'} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
          Project membership
        </Text>
        {!archived && (
          <TaskMembershipActions task={task} memberships={memberships} onChanged={reload} />
        )}
      </View>
      {membership === null ? (
        <Text style={styles.emptySection} maxFontSizeMultiplier={2}>
          This Task does not belong to a Project yet.
        </Text>
      ) : (
        <View style={styles.sectionRows}>
          {memberships.map((view) => (
            <Pressable
              key={view.relationId}
              onPress={() => openProject(view.projectId)}
              accessibilityRole="button"
              accessibilityLabel={`Open project ${view.project?.title ?? 'unavailable'}`}
              style={({ pressed }) => [styles.sectionRow, pressed && styles.rowPressed]}
            >
              <Text style={styles.sectionRowIcon} accessibilityElementsHidden
                importantForAccessibility="no">
                ▦
              </Text>
              <View style={styles.sectionRowMain}>
                <Text style={styles.sectionRowTitle} maxFontSizeMultiplier={2}>
                  {view.project?.title ?? 'Project unavailable'}
                </Text>
                <Text style={styles.sectionRowSub} maxFontSizeMultiplier={2}>
                  Actively executing in this Project
                </Text>
              </View>
              <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
                ›
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.lifecycleNote}>
        <Text style={styles.lifecycleNoteIcon} accessibilityElementsHidden
          importantForAccessibility="no">
          ⌁
        </Text>
        <Text style={styles.lifecycleNoteText} maxFontSizeMultiplier={2}>
          <Text style={styles.lifecycleNoteStrong}>Lifecycle is inspect-only. </Text>
          Transition actions belong to Feature #29, outside this milestone.
        </Text>
      </View>

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
            const item = describeTaskActivity(event);
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
            onPress={() => openEditSheet(task)}
            accessibilityRole="button"
            accessibilityLabel="Edit task"
            style={[styles.actionButton, styles.editButton]}
          >
            <Text style={styles.editText}>Edit task</Text>
          </Pressable>
          <Pressable
            onPress={() => openArchiveConfirmation(task)}
            accessibilityRole="button"
            accessibilityLabel="Archive task"
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
    flexWrap: 'wrap',
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
  rowPressed: {
    backgroundColor: colors.canvas,
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
  chevron: {
    fontSize: 18,
    color: colors.muted,
  },
  lifecycleNote: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  lifecycleNoteIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.blue,
  },
  lifecycleNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  lifecycleNoteStrong: {
    fontWeight: '800',
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
