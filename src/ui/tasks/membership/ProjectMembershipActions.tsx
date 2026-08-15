import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Project } from '../../../domain/project';
import type { TaskProjectMembershipView } from '../../../application/taskProjectMembershipQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import {
  EndpointPickerSheet,
  RelationRejectionSheet,
  useRelationCommit,
} from '../../relations';
import type { EndpointCandidate, RelationErrorFeedback } from '../../relations';
import { colors, spacing } from '../../shared/theme';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface ProjectMembershipActionsProps {
  project: Project;
  /** The Project's active Task memberships, from the membership query. */
  memberTasks: TaskProjectMembershipView[];
  /** Runs after a committed mutation; re-runs the affected projections. */
  onChanged: () => void;
}

/**
 * The Project-Overview membership action (#132): Add an existing Task to this
 * Project. Unavailable Tasks stay visible with #133 rejection reasons
 * (archived endpoint, duplicate active membership, already belongs to
 * another Project); commit-time service validation stays authoritative.
 * Membership removal is owned by the Task detail flow.
 */
export function ProjectMembershipActions({
  project,
  memberTasks,
  onChanged,
}: ProjectMembershipActionsProps) {
  const navigation = useShellNavigation();

  function openAdd() {
    navigation.presentSheet(
      <AddExistingTaskFlow
        project={project}
        memberTasks={memberTasks}
        onCommitted={onChanged}
        onClose={navigation.dismissSheet}
      />,
    );
  }

  return (
    <View style={styles.actions}>
      <Text style={styles.action} onPress={openAdd} accessibilityRole="button"
        accessibilityLabel="Add an existing task to this project">
        ＋ Add
      </Text>
    </View>
  );
}

interface AddExistingTaskFlowProps {
  project: Project;
  memberTasks: TaskProjectMembershipView[];
  onCommitted: () => void;
  onClose: () => void;
}

type CandidateState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; candidates: EndpointCandidate[] };

/**
 * Pick an existing Task to join this Project. The candidate hints are
 * presentation derived from the membership queries; the membership service's
 * commit-time validation remains the authority.
 */
function AddExistingTaskFlow({
  project,
  memberTasks,
  onCommitted,
  onClose,
}: AddExistingTaskFlowProps) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const [state, setState] = useState<CandidateState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const tasks = await services.tasks.listHistory();
        const memberIds = new Set(memberTasks.map((membership) => membership.taskId));
        const activeMemberships = await Promise.all(
          tasks.map((task) => services.taskMembershipQueries.listActiveProjectsForTask(task.id)),
        );
        if (!cancelled) {
          setState({
            status: 'ready',
            candidates: tasks.map((task, index) => {
              const elsewhere = activeMemberships[index].find(
                (membership) => membership.projectId !== project.id,
              );
              return {
                id: task.id,
                title: task.title,
                detail: task.targetDescription,
                rejection:
                  task.archivedAt !== null
                    ? { kind: 'archived-endpoint' as const }
                    : memberIds.has(task.id)
                      ? { kind: 'duplicate-active-relation' as const }
                      : elsewhere !== undefined
                        ? {
                            kind: 'cardinality-violation' as const,
                            reason: `Already belongs to "${elsewhere.project?.title ?? 'another Project'}"`,
                          }
                        : undefined,
              };
            }),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The Tasks could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id, memberTasks, reloadToken, services]);

  async function choose(taskId: string) {
    setPendingTaskId(taskId);
    const outcome = await commit(
      () =>
        services.taskMembership.startMembership({
          taskId,
          projectId: project.id,
          actor: ACTOR,
        }),
      { successMessage: 'Task added to Project', refresh: [onCommitted, onClose] },
    );
    if (outcome.status === 'rejected') setFeedback(outcome.feedback);
  }

  return (
    <>
      <EndpointPickerSheet
        visible
        title="Add an existing Task"
        candidates={state.status === 'ready' ? state.candidates : []}
        onSelect={(candidate) => {
          void choose(candidate.id);
        }}
        onClose={onClose}
        emptyMessage={
          state.status === 'loading'
            ? 'Loading tasks…'
            : state.status === 'error'
              ? state.message
              : 'No Tasks yet — create one from the Tasks tab first.'
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
          pendingTaskId !== null
            ? () => {
                setFeedback(null);
                void choose(pendingTaskId);
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
});
