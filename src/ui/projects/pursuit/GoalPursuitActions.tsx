import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProjectGoalPursuitView } from '../../../application/projectGoalPursuitQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import type { GoalPursuitSlotContext } from '../../goals/goalDetailSlots';
import { useShellNavigation } from '../../navigation/NavigationShell';
import {
  EndpointPickerSheet,
  RelationRejectionSheet,
  useRelationCommit,
} from '../../relations';
import type { EndpointCandidate, RelationErrorFeedback } from '../../relations';
import { colors, spacing } from '../../shared/theme';
import { ProjectFormSheet } from '../ProjectFormSheet';
import { EndPursuitFlow } from './EndPursuitFlow';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

/**
 * The Goal-detail pursuit actions wired into the GoalDetailSlots
 * `renderPursuitActions` slot (#134): Connect to an existing Project, create
 * a New Project for this Goal, and Remove an active pursuit. Pursuit is
 * strict 1:1, so Connect/New Project are offered only while the Goal has no
 * active Project. All commits go through `useRelationCommit`; rejections
 * surface the #133 "Change not allowed" sheet without clearing the user's
 * place in the flow.
 */
export function GoalPursuitActions({ goal, refresh }: GoalPursuitSlotContext) {
  const services = useAppServices();
  const navigation = useShellNavigation();

  const [pursuits, setPursuits] = useState<ProjectGoalPursuitView[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const active = await services.goalPursuitQueries.listProjectsPursuingGoal(goal.id);
        if (!cancelled) setPursuits(active);
      } catch {
        // The Goal detail screen owns the error presentation; the slot simply
        // keeps its last known state.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [goal.id, reloadToken, services]);

  function afterCommit() {
    reload();
    refresh();
  }

  function openConnect() {
    navigation.presentSheet(
      <ConnectProjectFlow goal={goal} onCommitted={afterCommit} onClose={navigation.dismissSheet} />,
    );
  }

  function openNewProject() {
    navigation.presentSheet(
      <NewProjectPursuitFlow goal={goal} onCommitted={afterCommit} onClose={navigation.dismissSheet} />,
    );
  }

  function openEnd() {
    navigation.presentSheet(
      <EndPursuitFlow
        context="goal"
        pursuits={pursuits}
        onCommitted={afterCommit}
        onClose={navigation.dismissSheet}
      />,
    );
  }

  return (
    <View style={styles.actions}>
      {pursuits.length === 0 && (
        <>
          <Text style={styles.action} onPress={openConnect} accessibilityRole="button"
            accessibilityLabel="Connect goal to a project">
            ＋ Connect
          </Text>
          <Text style={styles.action} onPress={openNewProject} accessibilityRole="button"
            accessibilityLabel="Create a project for this goal">
            ＋ New Project
          </Text>
        </>
      )}
      {pursuits.length > 0 && (
        <Text style={styles.action} onPress={openEnd} accessibilityRole="button"
          accessibilityLabel="Remove goal from a project">
          Remove…
        </Text>
      )}
    </View>
  );
}

interface FlowProps {
  goal: GoalPursuitSlotContext['goal'];
  onCommitted: () => void;
  onClose: () => void;
}

type CandidateState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; candidates: EndpointCandidate[] };

/**
 * Connect an existing Project to this Goal. Unavailable Projects stay visible
 * with #133 rejection reasons (duplicate active relationship, archived
 * endpoint, already pursuing another Goal — pursuit is strict 1:1);
 * commit-time validation stays authoritative.
 */
function ConnectProjectFlow({ goal, onCommitted, onClose }: FlowProps) {
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
        const pursuitLists = await Promise.all(
          projects.map((project) =>
            services.goalPursuitQueries.listGoalsPursuedByProject(project.id)),
        );
        if (!cancelled) {
          setState({
            status: 'ready',
            candidates: projects.map((project, index) => {
              const activePursuits = pursuitLists[index];
              return {
                id: project.id,
                title: project.title,
                detail: project.purpose ?? project.description ?? undefined,
                rejection:
                  project.archivedAt !== null
                    ? { kind: 'archived-endpoint' as const }
                    : activePursuits.some((pursuit) => pursuit.goalId === goal.id)
                      ? { kind: 'duplicate-active-relation' as const }
                      : activePursuits.length > 0
                        ? { kind: 'cardinality-violation' as const, reason: 'Already pursues a goal' }
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
              : 'The Projects could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [goal.id, reloadToken, services]);

  async function choose(projectId: string) {
    setPendingProjectId(projectId);
    const outcome = await commit(
      () => services.goalPursuit.startPursuit({ projectId, goalId: goal.id, actor: ACTOR }),
      { successMessage: 'Pursuit started', refresh: [onCommitted, onClose] },
    );
    if (outcome.status === 'rejected') setFeedback(outcome.feedback);
  }

  return (
    <>
      <EndpointPickerSheet
        visible
        title="Connect to a Project"
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

/**
 * Create a Project from Goal context, then connect it. The Project form owns
 * its draft and validation feedback; the pursuit commit uses the relation
 * feedback contract.
 */
function NewProjectPursuitFlow({ goal, onCommitted, onClose }: FlowProps) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);

  async function connectCreated(projectId: string) {
    const outcome = await commit(
      () => services.goalPursuit.startPursuit({ projectId, goalId: goal.id, actor: ACTOR }),
      { successMessage: 'Project created and pursuit started', refresh: [onCommitted, onClose] },
    );
    if (outcome.status === 'rejected') setFeedback(outcome.feedback);
  }

  return (
    <>
      <ProjectFormSheet
        mode="create"
        onSaved={(project) => {
          void connectCreated(project.id);
        }}
        onCancel={onClose}
      />
      <RelationRejectionSheet
        visible={feedback !== null}
        feedback={feedback}
        onReviewAnotherChoice={onClose}
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
