import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProjectGoalPursuitView } from '../../../application/projectGoalPursuitQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { RelationRejectionSheet, useRelationCommit } from '../../relations';
import type { RelationErrorFeedback } from '../../relations';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { Sheet } from '../../shared/Sheet';
import { StatusBadge } from '../../shared/StatusBadge';
import { colors, radius, spacing } from '../../shared/theme';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface EndPursuitFlowProps {
  /**
   * Which endpoint the flow starts from: 'goal' lists the pursuing Projects,
   * 'project' lists the pursued Goals.
   */
  context: 'goal' | 'project';
  /** The endpoint's active pursuits, from the pursuit query. */
  pursuits: ProjectGoalPursuitView[];
  /** Runs after a committed end; re-runs the affected projections. */
  onCommitted: () => void;
  onClose: () => void;
}

/**
 * End-pursuit flow shared by the Goal and Project contexts: an explicit
 * picker when more than one active pursuit exists, then a confirmation
 * explaining that both entities and the prior association remain in history.
 * The commit goes through `useRelationCommit`; a rejection surfaces the
 * "Change not allowed" sheet without discarding the user's place in the flow.
 */
export function EndPursuitFlow({ context, pursuits, onCommitted, onClose }: EndPursuitFlowProps) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const [selected, setSelected] = useState<ProjectGoalPursuitView | null>(
    pursuits.length === 1 ? pursuits[0] : null,
  );
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);

  const pickerTitle = context === 'goal' ? 'Remove from a Project' : 'Remove a pursued Goal';

  async function confirmEnd(pursuit: ProjectGoalPursuitView) {
    const outcome = await commit(
      () => services.goalPursuit.endPursuit({ relationId: pursuit.relationId, actor: ACTOR }),
      { successMessage: 'Pursuit ended', refresh: [onCommitted, onClose] },
    );
    if (outcome.status === 'rejected') setFeedback(outcome.feedback);
  }

  function endpointTitle(pursuit: ProjectGoalPursuitView): string {
    return context === 'goal'
      ? pursuit.project?.title ?? 'Project unavailable'
      : pursuit.goal?.title ?? 'Goal unavailable';
  }

  return (
    <>
      {selected === null ? (
        <Sheet visible title={pickerTitle} onClose={onClose}>
          <View style={styles.note}>
            <Text style={styles.noteIcon} accessibilityElementsHidden importantForAccessibility="no">
              ↺
            </Text>
            <Text style={styles.noteText} maxFontSizeMultiplier={2}>
              The Goal will no longer be active in that Project. Its previous association remains
              visible in history.
            </Text>
          </View>
          {pursuits.map((pursuit) => (
            <Pressable
              key={pursuit.relationId}
              onPress={() => setSelected(pursuit)}
              accessibilityRole="button"
              accessibilityLabel={`End pursuit with ${endpointTitle(pursuit)}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowIcon} accessibilityElementsHidden importantForAccessibility="no">
                {context === 'goal' ? '▦' : '◎'}
              </Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} maxFontSizeMultiplier={2}>
                  {endpointTitle(pursuit)}
                </Text>
                <Text style={styles.rowDetail} maxFontSizeMultiplier={2}>
                  Currently active in this Project
                </Text>
              </View>
              <StatusBadge label="Remove…" icon="−" tone="warning" />
            </Pressable>
          ))}
        </Sheet>
      ) : (
        <ConfirmDialog
          visible
          title="End this pursuit?"
          message={
            `"${selected.goal?.title ?? 'This Goal'}" will no longer be actively pursued by ` +
            `"${selected.project?.title ?? 'this Project'}". Both remain, and the previous ` +
            'association stays visible in history.'
          }
          confirmLabel="End pursuit"
          destructive
          onCancel={() => (pursuits.length > 1 ? setSelected(null) : onClose())}
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
          if (pursuits.length > 1) setSelected(null);
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
