import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Project } from '../../../domain/project';
import type { ProjectGoalPursuitView } from '../../../application/projectGoalPursuitQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import {
  RelationRejectionSheet,
  candidateRejectionReason,
  mapRelationError,
  useRelationCommit,
} from '../../relations';
import type { EndpointCandidate, RelationErrorFeedback } from '../../relations';
import { Sheet } from '../../shared/Sheet';
import { StatusBadge } from '../../shared/StatusBadge';
import { colors, radius, spacing } from '../../shared/theme';
import { EndPursuitFlow } from './EndPursuitFlow';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface ProjectPursuitActionsProps {
  project: Project;
  /** The Project's active pursuits, from the pursuit query. */
  pursuits: ProjectGoalPursuitView[];
  /** Runs after a committed mutation; re-runs the affected projections. */
  onChanged: () => void;
}

/**
 * The Project-Overview pursuit actions (#134): Add one or more Goals
 * (multi-select, broader than the prototype's one-at-a-time sketch) and
 * Remove an active pursuit. Unavailable Goals stay visible with #133
 * rejection reasons; commit-time validation stays authoritative.
 */
export function ProjectPursuitActions({ project, pursuits, onChanged }: ProjectPursuitActionsProps) {
  const navigation = useShellNavigation();

  function openAdd() {
    navigation.presentSheet(
      <AddGoalsFlow project={project} onCommitted={onChanged} onClose={navigation.dismissSheet} />,
    );
  }

  function openEnd() {
    navigation.presentSheet(
      <EndPursuitFlow
        context="project"
        pursuits={pursuits}
        onCommitted={onChanged}
        onClose={navigation.dismissSheet}
      />,
    );
  }

  return (
    <View style={styles.actions}>
      {pursuits.length > 0 && (
        <Text style={styles.action} onPress={openEnd} accessibilityRole="button"
          accessibilityLabel="Remove a pursued goal">
          Remove…
        </Text>
      )}
      <Text style={styles.action} onPress={openAdd} accessibilityRole="button"
        accessibilityLabel="Add pursued goals">
        ＋ Add
      </Text>
    </View>
  );
}

interface AddGoalsFlowProps {
  project: Project;
  onCommitted: () => void;
  onClose: () => void;
}

type CandidateState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; candidates: EndpointCandidate[] };

/**
 * Multi-Goal picker: the issue requires selecting multiple active Goals when
 * starting from Project context. Rejected candidates (duplicate active
 * relationship, archived endpoint) stay visible but cannot be selected. Each
 * selected Goal is committed through the pursuit service inside one
 * `useRelationCommit` operation; a rejection keeps every selection intact.
 */
function AddGoalsFlow({ project, onCommitted, onClose }: AddGoalsFlowProps) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const [state, setState] = useState<CandidateState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [goals, pursuits] = await Promise.all([
          services.goals.listGoalHistory(),
          services.goalPursuitQueries.listGoalsPursuedByProject(project.id),
        ]);
        const pursuedIds = new Set(pursuits.map((pursuit) => pursuit.goalId));
        if (!cancelled) {
          setState({
            status: 'ready',
            candidates: goals.map((goal) => ({
              id: goal.id,
              title: goal.title,
              detail: goal.targetState,
              rejection:
                goal.archivedAt !== null
                  ? { kind: 'archived-endpoint' }
                  : pursuedIds.has(goal.id)
                    ? { kind: 'duplicate-active-relation' }
                    : undefined,
            })),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The Goals could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id, reloadToken, services]);

  const candidates = state.status === 'ready' ? state.candidates : [];
  const availableSelected = candidates.filter(
    (candidate) => candidate.rejection === undefined && selected.has(candidate.id),
  );

  function toggle(candidate: EndpointCandidate) {
    if (candidate.rejection !== undefined) return;
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(candidate.id)) {
        next.delete(candidate.id);
      } else {
        next.add(candidate.id);
      }
      return next;
    });
  }

  async function pursueSelected() {
    if (submitting || availableSelected.length === 0) return;
    setSubmitting(true);
    const outcome = await commit(
      async () => {
        const failures: unknown[] = [];
        let started = 0;
        for (const candidate of availableSelected) {
          try {
            await services.goalPursuit.startPursuit({
              projectId: project.id,
              goalId: candidate.id,
              actor: ACTOR,
            });
            started += 1;
          } catch (error) {
            failures.push(error);
          }
        }
        if (started === 0 && failures.length > 0) throw failures[0];
        return { firstFailure: failures[0] };
      },
      {
        successMessage:
          availableSelected.length > 1
            ? `${availableSelected.length} pursuits started`
            : 'Pursuit started',
        refresh: [onCommitted],
      },
    );
    setSubmitting(false);
    if (outcome.status === 'rejected') {
      setFeedback(outcome.feedback);
      return;
    }
    if (outcome.result.firstFailure !== undefined) {
      // A partial commit: the started pursuits refreshed above; surface the
      // first failure without clearing the remaining selections.
      setFeedback(mapRelationError(outcome.result.firstFailure));
      return;
    }
    onClose();
  }

  return (
    <>
      <Sheet visible title="Pursue Goals" onClose={onClose}>
        <Text style={styles.intro} maxFontSizeMultiplier={2}>
          Select one or more Goals. Unavailable choices stay visible so the rule is understandable.
        </Text>
        {state.status === 'loading' && (
          <Text style={styles.notice} maxFontSizeMultiplier={2}>
            Loading goals…
          </Text>
        )}
        {state.status === 'error' && (
          <Text style={styles.notice} maxFontSizeMultiplier={2}>
            {state.message}
          </Text>
        )}
        {state.status === 'ready' && candidates.length === 0 && (
          <Text style={styles.notice} maxFontSizeMultiplier={2}>
            No Goals yet — define an outcome first.
          </Text>
        )}
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            selected={selected.has(candidate.id)}
            onToggle={toggle}
          />
        ))}
        {candidates.length > 0 && (
          <Pressable
            onPress={() => {
              void pursueSelected();
            }}
            disabled={availableSelected.length === 0 || submitting}
            accessibilityRole="button"
            accessibilityLabel="Pursue selected goals"
            accessibilityState={{
              busy: submitting,
              disabled: availableSelected.length === 0 || submitting,
            }}
            style={[
              styles.submit,
              (availableSelected.length === 0 || submitting) && styles.submitDisabled,
            ]}
          >
            <Text style={styles.submitText} maxFontSizeMultiplier={2}>
              {submitting
                ? 'Starting…'
                : `Pursue ${availableSelected.length} goal${availableSelected.length === 1 ? '' : 's'}`}
            </Text>
          </Pressable>
        )}
      </Sheet>
      <RelationRejectionSheet
        visible={feedback !== null}
        feedback={feedback}
        onReviewAnotherChoice={() => setFeedback(null)}
        onRefreshEndpoints={() => {
          setFeedback(null);
          setReloadToken((token) => token + 1);
        }}
        onClose={() => setFeedback(null)}
      />
    </>
  );
}

function CandidateRow({
  candidate,
  selected,
  onToggle,
}: {
  candidate: EndpointCandidate;
  selected: boolean;
  onToggle: (candidate: EndpointCandidate) => void;
}) {
  const rejected = candidate.rejection !== undefined;
  const reason = rejected ? candidateRejectionReason(candidate.rejection!) : undefined;
  return (
    <Pressable
      onPress={() => onToggle(candidate)}
      disabled={rejected}
      accessibilityRole="checkbox"
      accessibilityState={{ disabled: rejected, checked: selected }}
      accessibilityLabel={
        rejected ? `${candidate.title}, unavailable: ${reason}` : candidate.title
      }
      style={({ pressed }) => [
        styles.row,
        rejected && styles.rowRejected,
        !rejected && pressed && styles.rowPressed,
      ]}
    >
      <Text
        style={[styles.check, selected && styles.checkSelected]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {selected ? '✓' : '○'}
      </Text>
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowTitle, rejected && styles.rowTitleRejected]}
          maxFontSizeMultiplier={2}
        >
          {candidate.title}
        </Text>
        <Text style={styles.rowDetail} maxFontSizeMultiplier={2}>
          {rejected ? reason : (candidate.detail ?? 'Available')}
        </Text>
      </View>
      {rejected && <StatusBadge label="Rejected" icon="!" tone="danger" />}
    </Pressable>
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
  intro: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  notice: {
    fontSize: 14,
    color: colors.muted,
    paddingVertical: spacing.lg,
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
  rowRejected: {
    backgroundColor: colors.canvas,
  },
  check: {
    fontSize: 16,
    color: colors.muted,
  },
  checkSelected: {
    color: colors.brand,
    fontWeight: '800',
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
  rowTitleRejected: {
    color: colors.muted,
  },
  rowDetail: {
    fontSize: 12,
    color: colors.muted,
  },
  submit: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
