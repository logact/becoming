import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Task } from '../../../domain/task';
import type { TaskProjectMembershipView } from '../../../application/taskProjectMembershipQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import {
  EndpointPickerSheet,
  RelationRejectionSheet,
  useRelationCommit,
} from '../../relations';
import type { EndpointCandidate, RelationErrorFeedback } from '../../relations';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { Sheet } from '../../shared/Sheet';
import { StatusBadge } from '../../shared/StatusBadge';
import { colors, radius, spacing } from '../../shared/theme';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface TaskMembershipActionsProps {
  task: Task;
  /** The Task's active memberships, from the membership query. */
  memberships: TaskProjectMembershipView[];
  /** Runs after a committed mutation; re-runs the affected projections. */
  onChanged: () => void;
}

/**
 * The Task-detail membership actions (#132): Add to a Project when the Task
 * is unassigned, and confirmed Remove from Project for an active membership.
 * All commits go through `useRelationCommit` and the typed membership
 * service — membership is a semantic relation, never a field on Task.
 * Rejections surface the #133 "Change not allowed" sheet without clearing
 * the user's place in the flow.
 */
export function TaskMembershipActions({
  task,
  memberships,
  onChanged,
}: TaskMembershipActionsProps) {
  const navigation = useShellNavigation();

  function openAdd() {
    navigation.presentSheet(
      <AddToProjectFlow task={task} onCommitted={onChanged} onClose={navigation.dismissSheet} />,
    );
  }

  function openRemove() {
    navigation.presentSheet(
      <RemoveFromProjectFlow
        task={task}
        memberships={memberships}
        onCommitted={onChanged}
        onClose={navigation.dismissSheet}
      />,
    );
  }

  return (
    <View style={styles.actions}>
      {memberships.length === 0 ? (
        <Text style={styles.action} onPress={openAdd} accessibilityRole="button"
          accessibilityLabel="Add task to a project">
          ＋ Add to a Project
        </Text>
      ) : (
        <Text style={styles.action} onPress={openRemove} accessibilityRole="button"
          accessibilityLabel="Remove task from project">
          Remove from Project…
        </Text>
      )}
    </View>
  );
}

interface FlowProps {
  task: Task;
  onCommitted: () => void;
  onClose: () => void;
}

type CandidateState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; candidates: EndpointCandidate[] };

/**
 * Add this Task to an existing Project. Archived Projects stay visible with
 * the #133 archived-endpoint rejection; commit-time service validation stays
 * authoritative.
 */
function AddToProjectFlow({ task, onCommitted, onClose }: FlowProps) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const [state, setState] = useState<CandidateState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const projects = await services.projects.listProjectHistory();
        if (!cancelled) {
          setState({
            status: 'ready',
            candidates: projects.map((project) => ({
              id: project.id,
              title: project.title,
              detail: project.purpose ?? project.description ?? undefined,
              rejection:
                project.archivedAt !== null ? { kind: 'archived-endpoint' } : undefined,
            })),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The Projects could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, services]);

  async function choose(projectId: string) {
    setPendingProjectId(projectId);
    const outcome = await commit(
      () => services.taskMembership.startMembership({ taskId: task.id, projectId, actor: ACTOR }),
      { successMessage: 'Added to Project', refresh: [onCommitted, onClose] },
    );
    if (outcome.status === 'rejected') setFeedback(outcome.feedback);
  }

  return (
    <>
      <EndpointPickerSheet
        visible
        title="Add to a Project"
        candidates={state.status === 'ready' ? state.candidates : []}
        onSelect={(candidate) => {
          void choose(candidate.id);
        }}
        onClose={onClose}
        emptyMessage={
          state.status === 'loading'
            ? 'Loading projects…'
            : state.status === 'error'
              ? state.message
              : 'No Projects yet — create one first.'
        }
      />
      <RelationRejectionSheet
        visible={feedback !== null}
        feedback={feedback}
        onReviewAnotherChoice={() => setFeedback(null)}
        onRefreshEndpoints={() => {
          setFeedback(null);
          setReloadToken((token) => token + 1);
        }}
        onRetry={
          pendingProjectId !== null
            ? () => {
                setFeedback(null);
                void choose(pendingProjectId);
              }
            : undefined
        }
        onClose={() => setFeedback(null)}
      />
    </>
  );
}

interface RemoveFlowProps extends FlowProps {
  memberships: TaskProjectMembershipView[];
}

/**
 * Confirmed end of an active membership. The confirmation explains that the
 * active membership ends while the Task, the Project, and the prior
 * association remain in history. When more than one active membership exists
 * (the service permits multi-Project membership), an explicit picker chooses
 * which one ends.
 */
function RemoveFromProjectFlow({ task, memberships, onCommitted, onClose }: RemoveFlowProps) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const [selected, setSelected] = useState<TaskProjectMembershipView | null>(
    memberships.length === 1 ? memberships[0] : null,
  );
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);

  async function confirmEnd(membership: TaskProjectMembershipView) {
    const outcome = await commit(
      () =>
        services.taskMembership.endMembership({
          relationId: membership.relationId,
          actor: ACTOR,
        }),
      { successMessage: 'Removed from Project', refresh: [onCommitted, onClose] },
    );
    if (outcome.status === 'rejected') setFeedback(outcome.feedback);
  }

  return (
    <>
      {selected === null ? (
        <Sheet visible title="Remove from a Project" onClose={onClose}>
          <View style={styles.note}>
            <Text style={styles.noteIcon} accessibilityElementsHidden importantForAccessibility="no">
              ↺
            </Text>
            <Text style={styles.noteText} maxFontSizeMultiplier={2}>
              The Task will no longer be an active member of that Project. The previous membership
              remains visible in history.
            </Text>
          </View>
          {memberships.map((membership) => (
            <Pressable
              key={membership.relationId}
              onPress={() => setSelected(membership)}
              accessibilityRole="button"
              accessibilityLabel={`End membership with ${membership.project?.title ?? 'unavailable project'}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowIcon} accessibilityElementsHidden importantForAccessibility="no">
                ▦
              </Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} maxFontSizeMultiplier={2}>
                  {membership.project?.title ?? 'Project unavailable'}
                </Text>
                <Text style={styles.rowDetail} maxFontSizeMultiplier={2}>
                  Currently an active member
                </Text>
              </View>
              <StatusBadge label="Remove…" icon="−" tone="warning" />
            </Pressable>
          ))}
        </Sheet>
      ) : (
        <ConfirmDialog
          visible
          title="Remove Task from Project?"
          message={
            `"${task.title}" will no longer be an active member of ` +
            `"${selected.project?.title ?? 'this Project'}". The Task and the Project remain, ` +
            'and the previous membership stays visible in history.'
          }
          confirmLabel="Remove from Project"
          destructive
          onCancel={() => (memberships.length > 1 ? setSelected(null) : onClose())}
          onConfirm={() => {
            void confirmEnd(selected);
          }}
        />
      )}
      <RelationRejectionSheet
        visible={feedback !== null}
        feedback={feedback}
        onReviewAnotherChoice={() => {
          setFeedback(null);
          if (memberships.length > 1) setSelected(null);
        }}
        onRetry={
          selected !== null
            ? () => {
                setFeedback(null);
                void confirmEnd(selected);
              }
            : undefined
        }
        onClose={() => setFeedback(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  action: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
    paddingVertical: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  noteIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.amber,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.canvas,
  },
  rowIcon: {
    fontSize: 14,
    color: colors.brand,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  rowDetail: {
    fontSize: 12,
    color: colors.muted,
  },
});
