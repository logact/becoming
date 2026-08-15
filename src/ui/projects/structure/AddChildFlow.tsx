import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Project } from '../../../domain/project';
import type { DecompositionHierarchyEdge } from '../../../application/decompositionHierarchyQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import {
  RelationRejectionSheet,
  candidateRejectionReason,
  useRelationCommit,
} from '../../relations';
import type { CandidateRejection, RelationErrorFeedback } from '../../relations';
import { GoalFormSheet } from '../../goals/GoalFormSheet';
import { Sheet } from '../../shared/Sheet';
import { StatusBadge } from '../../shared/StatusBadge';
import { useToast } from '../../shared/Toast';
import { TaskFormSheet } from '../../tasks/TaskFormSheet';
import { colors, radius, spacing } from '../../shared/theme';
import {
  DECOMPOSITION_MANAGEMENT_LABEL_ID,
  childCandidateRejection,
  childDirectionNote,
} from './structureTree';
import type { StructureNodeRef } from './structureTree';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface AddChildFlowProps {
  project: Project;
  parent: { node: StructureNodeRef; title: string };
  /** The Project's active decomposition edges (all root traversals, deduplicated). */
  edges: readonly DecompositionHierarchyEdge[];
  /** Runs after a committed mutation; re-runs the affected projections. */
  onCommitted: () => void;
  onClose: () => void;
}

interface ChildCandidate {
  key: string;
  node: StructureNodeRef;
  title: string;
  detail?: string;
  rejection?: CandidateRejection;
}

type CandidateState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; candidates: ChildCandidate[] };

type AddChildMode = 'choose' | 'create-goal' | 'create-task';

/**
 * The contextual add-child sheet (#135): explains the valid directions for
 * this parent (Goal -> Goal or Task; Task -> Task), combines eligible Goals
 * and Tasks in one list, offers creation of a new valid child in place, and
 * keeps rejected candidates visible with distinct
 * #133 reasons (invalid direction, already in structure, duplicate placement,
 * archived endpoint, cross-Project structure, self-link). Commits go through
 * the decomposition service via `useRelationCommit`; a rejection shows the
 * "Change not allowed" sheet without clearing the selection or closing the
 * picker.
 */
export function AddChildFlow({ project, parent, edges, onCommitted, onClose }: AddChildFlowProps) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AddChildMode>('choose');
  const [state, setState] = useState<CandidateState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);
  const [pending, setPending] = useState<ChildCandidate | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [goals, tasks, pursuits, memberships] = await Promise.all([
          services.goals.listGoalHistory(),
          services.tasks.listHistory(),
          services.goalPursuitQueries.listGoalsPursuedByProject(project.id),
          services.taskMembershipQueries.listActiveTasksForProject(project.id),
        ]);
        const pursued = new Set(pursuits.map((pursuit) => pursuit.goalId));
        const members = new Set(memberships.map((membership) => membership.taskId));
        const candidates: ChildCandidate[] = [
          ...goals.map((goal) =>
            toCandidate(
              { type: 'goal', id: goal.id },
              goal.title,
              goal.targetState,
              goal.archivedAt !== null,
              pursued.has(goal.id),
            ),
          ),
          ...tasks.map((task) =>
            toCandidate(
              { type: 'task', id: task.id },
              task.title,
              task.targetDescription,
              task.archivedAt !== null,
              members.has(task.id),
            ),
          ),
        ];
        if (!cancelled) setState({ status: 'ready', candidates });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The choices could not be loaded. No changes were made.',
          });
        }
      }
    }
    function toCandidate(
      node: StructureNodeRef,
      title: string,
      detail: string,
      archived: boolean,
      hasProjectContext: boolean,
    ): ChildCandidate {
      return {
        key: `${node.type}:${node.id}`,
        node,
        title,
        detail,
        rejection: childCandidateRejection({
          parent: parent.node,
          candidate: node,
          candidateArchived: archived,
          candidateHasProjectContext: hasProjectContext,
          edges,
        }),
      };
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id, parent.node, edges, reloadToken, services]);

  async function choose(candidate: ChildCandidate) {
    setPending(candidate);
    const outcome = await commit(
      () =>
        services.structureCreation.attachExistingChild({
          projectId: project.id,
          parentType: parent.node.type,
          parentId: parent.node.id,
          childType: candidate.node.type,
          childId: candidate.node.id,
          managementLabelId: DECOMPOSITION_MANAGEMENT_LABEL_ID,
          actor: ACTOR,
        }),
      { successMessage: 'Child added', refresh: [onCommitted] },
    );
    if (outcome.status === 'rejected') {
      // The picker and its candidates stay exactly as they were.
      setFeedback(outcome.feedback);
      return;
    }
    onClose();
  }

  const candidates = state.status === 'ready' ? state.candidates : [];

  if (mode === 'create-goal') {
    return (
      <GoalFormSheet
        mode="create"
        createHeading={`New sub-goal for ${parent.title}`}
        createGoal={async ({ actor, occurredAt, ...goal }) => {
          const created = await services.structureCreation.createGoalChild({
            projectId: project.id,
            parentType: parent.node.type,
            parentId: parent.node.id,
            managementLabelId: DECOMPOSITION_MANAGEMENT_LABEL_ID,
            actor,
            occurredAt,
            goal,
          });
          return created.goal;
        }}
        onSaved={() => {
          showToast('Sub-goal created');
          onCommitted();
          onClose();
        }}
        onCancel={() => setMode('choose')}
      />
    );
  }

  if (mode === 'create-task') {
    return (
      <TaskFormSheet
        mode="create"
        createHeading={`New sub-task for ${parent.title}`}
        createTask={async ({ actor, occurredAt, ...task }) => {
          const created = await services.structureCreation.createTaskChild({
            projectId: project.id,
            parentType: parent.node.type,
            parentId: parent.node.id,
            managementLabelId: DECOMPOSITION_MANAGEMENT_LABEL_ID,
            actor,
            occurredAt,
            task,
          });
          return created.task;
        }}
        onSaved={() => {
          showToast('Sub-task created');
          onCommitted();
          onClose();
        }}
        onCancel={() => setMode('choose')}
      />
    );
  }

  return (
    <>
      <Sheet visible title={`Add a child to ${parent.title}`} onClose={onClose}>
        <Text style={styles.intro} maxFontSizeMultiplier={2}>
          {childDirectionNote(parent.node)} Unavailable choices stay visible so the rule is
          understandable.
        </Text>
        <View style={styles.createActions}>
          {parent.node.type === 'goal' && (
            <Pressable
              onPress={() => setMode('create-goal')}
              accessibilityRole="button"
              accessibilityLabel={`Create a sub-goal under ${parent.title}`}
              style={({ pressed }) => [styles.createButton, pressed && styles.rowPressed]}
            >
              <Text style={[styles.typeDot, styles.typeGoal]}>GOAL</Text>
              <View style={styles.rowBody}>
                <Text style={styles.createTitle} maxFontSizeMultiplier={2}>Create sub-goal</Text>
                <Text style={styles.rowDetail} maxFontSizeMultiplier={2}>
                  Define a new outcome in this branch
                </Text>
              </View>
              <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">›</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setMode('create-task')}
            accessibilityRole="button"
            accessibilityLabel={`Create a sub-task under ${parent.title}`}
            style={({ pressed }) => [styles.createButton, pressed && styles.rowPressed]}
          >
            <Text style={[styles.typeDot, styles.typeTask]}>TASK</Text>
            <View style={styles.rowBody}>
              <Text style={styles.createTitle} maxFontSizeMultiplier={2}>Create sub-task</Text>
              <Text style={styles.rowDetail} maxFontSizeMultiplier={2}>
                Define new work in this branch
              </Text>
            </View>
            <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">›</Text>
          </Pressable>
        </View>
        <Text style={styles.existingLabel} maxFontSizeMultiplier={2}>OR CHOOSE EXISTING</Text>
        {state.status === 'loading' && (
          <Text style={styles.notice} maxFontSizeMultiplier={2}>
            Loading goals and tasks…
          </Text>
        )}
        {state.status === 'error' && (
          <Text style={styles.notice} maxFontSizeMultiplier={2}>
            {state.message}
          </Text>
        )}
        {state.status === 'ready' && candidates.length === 0 && (
          <Text style={styles.notice} maxFontSizeMultiplier={2}>
            No existing Goals or Tasks are available.
          </Text>
        )}
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.key}
            candidate={candidate}
            onSelect={(selected) => {
              void choose(selected);
            }}
          />
        ))}
      </Sheet>
      <RelationRejectionSheet
        visible={feedback !== null}
        feedback={feedback}
        onReviewAnotherChoice={() => setFeedback(null)}
        onRefreshEndpoints={() => {
          setFeedback(null);
          setReloadToken((token) => token + 1);
        }}
        onRetry={
          pending !== null
            ? () => {
                setFeedback(null);
                void choose(pending);
              }
            : undefined
        }
        onClose={() => setFeedback(null)}
      />
    </>
  );
}

function CandidateRow({
  candidate,
  onSelect,
}: {
  candidate: ChildCandidate;
  onSelect: (candidate: ChildCandidate) => void;
}) {
  const rejected = candidate.rejection !== undefined;
  const reason = rejected ? candidateRejectionReason(candidate.rejection!) : undefined;
  const typeText = candidate.node.type === 'goal' ? 'GOAL' : 'TASK';
  return (
    <Pressable
      onPress={() => onSelect(candidate)}
      disabled={rejected}
      accessibilityRole="button"
      accessibilityLabel={
        rejected ? `${candidate.title}, unavailable: ${reason}` : `Choose ${candidate.title}`
      }
      accessibilityState={{ disabled: rejected }}
      style={({ pressed }) => [
        styles.row,
        rejected && styles.rowRejected,
        !rejected && pressed && styles.rowPressed,
      ]}
    >
      <Text
        style={[styles.typeDot, candidate.node.type === 'goal' ? styles.typeGoal : styles.typeTask]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {typeText}
      </Text>
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowTitle, rejected && styles.rowTitleRejected]}
          maxFontSizeMultiplier={2}
        >
          {candidate.title}
        </Text>
        <Text style={styles.rowDetail} maxFontSizeMultiplier={2}>
          {rejected ? reason : (candidate.detail ?? 'Available child')}
        </Text>
      </View>
      {rejected ? (
        <StatusBadge label="Rejected" icon="!" tone="danger" />
      ) : (
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  createActions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  createTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  existingLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
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
  typeDot: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    overflow: 'hidden',
  },
  typeGoal: {
    backgroundColor: colors.blueSoft,
    color: colors.blue,
  },
  typeTask: {
    backgroundColor: colors.brandSoft,
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
  rowTitleRejected: {
    color: colors.muted,
  },
  rowDetail: {
    fontSize: 12,
    color: colors.muted,
  },
  chevron: {
    fontSize: 22,
    color: colors.muted,
  },
});
