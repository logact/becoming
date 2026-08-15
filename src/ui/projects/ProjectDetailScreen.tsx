import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Project } from '../../domain/project';
import type { TimelineEvent } from '../../domain/timelineEvent';
import type { ProjectGoalPursuitView } from '../../application/projectGoalPursuitQueryService';
import type { TaskProjectMembershipView } from '../../application/taskProjectMembershipQueryService';
import { useAppServices } from '../composition/AppServicesProvider';
import { useShellNavigation } from '../navigation/NavigationShell';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { StatusBadge } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { colors, radius, spacing } from '../shared/theme';
import { ProjectFormSheet } from './ProjectFormSheet';
import { ProjectOverview } from './ProjectOverview';
import type { ProjectDetailSegmentId, ProjectDetailSlots } from './projectDetailSlots';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

/** Recent activity shown on the detail, newest first. */
const RECENT_ACTIVITY_LIMIT = 5;

const SEGMENTS: readonly { id: ProjectDetailSegmentId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'structure', label: 'Structure' },
  { id: 'progress', label: 'Progress' },
];

interface ProjectDetailData {
  project: Project;
  pursuits: ProjectGoalPursuitView[];
  memberTasks: TaskProjectMembershipView[];
  activity: TimelineEvent[];
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ProjectDetailData };

export interface ProjectDetailScreenProps {
  entityId: string;
  /** Stable extension slots; #135/#136 inject Structure and Progress content. */
  slots?: ProjectDetailSlots;
}

/**
 * Project detail (#134): execution-context header with title, purpose, and
 * archive status; the sticky Overview/Structure/Progress segment shell; the
 * Overview segment (facts, pursued Goals, member Tasks, persisted activity);
 * edit and confirmed archive. #134 owns the shell and Overview only —
 * Structure and Progress render as clearly-labeled placeholder panes until
 * #135/#136 inject their content through `ProjectDetailSlots`, and #132
 * injects the Overview's membership actions through the same slots.
 * Presentation translates service read models; it never re-derives pursuit,
 * membership, archive, or progress rules.
 */
export function ProjectDetailScreen({ entityId, slots }: ProjectDetailScreenProps) {
  const services = useAppServices();
  const navigation = useShellNavigation();
  const { showToast } = useToast();

  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [segment, setSegment] = useState<ProjectDetailSegmentId>('overview');
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      try {
        const project = await services.projects.getProject(entityId);
        if (project === null) {
          throw new Error('This Project could not be found. It may have been removed.');
        }
        const [pursuits, memberTasks, events] = await Promise.all([
          services.goalPursuitQueries.listGoalsPursuedByProject(entityId),
          services.taskMembershipQueries.listActiveTasksForProject(entityId),
          services.timelines.list({ type: 'project', id: entityId }),
        ]);
        if (!cancelled) {
          setState({
            status: 'ready',
            data: {
              project,
              pursuits,
              memberTasks,
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
              : 'The Project could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityId, reloadToken, services]);

  function openEditSheet(project: Project) {
    navigation.presentSheet(
      <ProjectFormSheet
        mode="edit"
        project={project}
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Project updated');
          reload();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  function openArchiveConfirmation(project: Project) {
    navigation.presentSheet(
      <ConfirmDialog
        visible
        title="Archive this Project?"
        message={
          `"${project.title}" becomes read-only and leaves the Active list. ` +
          'It stays inspectable under Archived, and its history is preserved.'
        }
        confirmLabel="Confirm archive"
        destructive
        onCancel={navigation.dismissSheet}
        onConfirm={() => {
          void (async () => {
            try {
              await services.projects.archiveProject({ id: project.id, actor: ACTOR });
              navigation.dismissSheet();
              showToast('Project archived');
              setActionError(null);
              reload();
            } catch (error) {
              navigation.dismissSheet();
              setActionError(
                error instanceof Error ? error.message : 'The Project could not be archived.',
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
      <View style={styles.stateBlock} accessibilityLabel="Loading project">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.stateText}>Loading project…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.stateBlock}>
        <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
          !
        </Text>
        <Text style={styles.stateTitle}>Project unavailable</Text>
        <Text style={styles.stateText}>{state.message}</Text>
        <Pressable
          onPress={reload}
          accessibilityRole="button"
          accessibilityLabel="Retry loading project"
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to projects"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Projects</Text>
        </Pressable>
      </View>
    );
  }

  const { project, pursuits, memberTasks, activity } = state.data;
  const archived = project.archivedAt !== null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
      stickyHeaderIndices={[2]}>
      <Pressable
        onPress={navigation.goBack}
        accessibilityRole="button"
        accessibilityLabel="Back to projects"
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹ Projects</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.typeLabel} maxFontSizeMultiplier={2}>
          Execution context
        </Text>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={2}>
          {project.title}
        </Text>
        <Text style={styles.supporting} maxFontSizeMultiplier={2}>
          {project.purpose ?? project.description ?? 'No purpose defined yet'}
        </Text>
        <View style={styles.badges}>
          {archived ? (
            <StatusBadge label="Archived" icon="▣" />
          ) : (
            <StatusBadge label="Active project" icon="▦" tone="info" />
          )}
        </View>
      </View>

      <View
        style={styles.segmentBar}
        accessibilityRole="tablist"
        accessibilityLabel="Project detail sections"
      >
        {SEGMENTS.map((option) => {
          const selected = segment === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setSegment(option.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${option.label.toLowerCase()}`}
              style={[styles.segmentOption, selected && styles.segmentOptionSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {segment === 'overview' && (
        <ProjectOverview
          project={project}
          pursuits={pursuits}
          memberTasks={memberTasks}
          activity={activity}
          refresh={reload}
          renderMembershipActions={slots?.renderMembershipActions}
        />
      )}
      {segment === 'structure' &&
        (slots?.renderStructure !== undefined ? (
          <>{slots.renderStructure({ project, refresh: reload })}</>
        ) : (
          <PlaceholderPane
            icon="⌁"
            title="Structure arrives with the decomposition task"
            message="The Project-scoped Goal and Task hierarchy (#135) will render here."
          />
        ))}
      {segment === 'progress' &&
        (slots?.renderProgress !== undefined ? (
          <>{slots.renderProgress({ project, refresh: reload })}</>
        ) : (
          <PlaceholderPane
            icon="◔"
            title="Progress arrives with the execution task"
            message="The Project execution snapshot (#136) will render derived progress here."
          />
        ))}

      {actionError !== null && (
        <Text style={styles.actionError} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
          {actionError}
        </Text>
      )}

      {!archived && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => openEditSheet(project)}
            accessibilityRole="button"
            accessibilityLabel="Edit project"
            style={[styles.actionButton, styles.editButton]}
          >
            <Text style={styles.editText}>Edit project</Text>
          </Pressable>
          <Pressable
            onPress={() => openArchiveConfirmation(project)}
            accessibilityRole="button"
            accessibilityLabel="Archive project"
            style={[styles.actionButton, styles.archiveButton]}
          >
            <Text style={styles.archiveText}>Archive</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

/** Clearly-labeled placeholder for a segment owned by a later task. */
function PlaceholderPane({
  icon,
  title,
  message,
}: {
  icon: string;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon} accessibilityElementsHidden importantForAccessibility="no">
        {icon}
      </Text>
      <Text style={styles.placeholderTitle} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      <Text style={styles.placeholderMessage} maxFontSizeMultiplier={2}>
        {message}
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
    marginBottom: spacing.md,
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
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.badge,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  segmentOption: {
    flex: 1,
    borderRadius: radius.badge,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  segmentOptionSelected: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextSelected: {
    color: colors.white,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  placeholderIcon: {
    fontSize: 26,
    color: colors.brand,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  placeholderMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
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
