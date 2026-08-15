import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Project } from '../../../domain/project';
import type {
  MilestoneRoadmapItem,
  ProjectRoadmap,
} from '../../../application/projectRoadmapQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { RelationRejectionSheet, useRelationCommit } from '../../relations';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { useToast } from '../../shared/Toast';
import { colors, spacing } from '../../shared/theme';
import { MilestoneFormSheet } from './MilestoneFormSheet';
import type { MilestoneGoalCandidate } from './MilestoneGoalPicker';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface MilestoneActionsProps {
  project: Project;
  roadmap: ProjectRoadmap;
  item: MilestoneRoadmapItem;
  /** Zero-based position of this Milestone in the ordered Roadmap. */
  index: number;
  /** Picker candidates for the edit sheet, composed by the segment. */
  candidates: MilestoneGoalCandidate[];
  /** Runs after a committed mutation; re-runs the affected projections. */
  onChanged: () => void;
}

/**
 * The per-Milestone edit/remove/reorder flows (active Projects only). Remove
 * is the confirmed, non-destructive archive: the Milestone leaves the current
 * Roadmap, its Goals stay in the Project Structure, and history is preserved.
 * Reorder swaps adjacent Milestones through the service's atomic reorder.
 * Commits go through `useRelationCommit`: toast + refresh on success, the
 * "Change not allowed" sheet on rejection — nothing renders optimistically.
 */
export function MilestoneActions({
  project,
  roadmap,
  item,
  index,
  candidates,
  onChanged,
}: MilestoneActionsProps) {
  const services = useAppServices();
  const navigation = useShellNavigation();
  const { showToast } = useToast();
  const { commit } = useRelationCommit();

  const title = item.milestone.title;
  const milestoneIds = roadmap.milestones.map((entry) => entry.milestone.id);

  function openEditSheet() {
    navigation.presentSheet(
      <MilestoneFormSheet
        mode="edit"
        project={project}
        milestone={item}
        candidates={candidates}
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Milestone updated');
          onChanged();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  function openRemoveConfirmation() {
    async function confirmRemove() {
      const outcome = await commit(
        () => services.milestones.archiveMilestone({ milestoneId: item.milestone.id, actor: ACTOR }),
        { successMessage: 'Milestone removed', refresh: [onChanged] },
      );
      navigation.dismissSheet();
      if (outcome.status === 'rejected') {
        navigation.presentSheet(
          <RelationRejectionSheet
            visible
            feedback={outcome.feedback}
            onReviewAnotherChoice={navigation.dismissSheet}
            onRetry={
              outcome.feedback.retryable
                ? () => {
                    void confirmRemove();
                  }
                : undefined
            }
            onClose={navigation.dismissSheet}
          />,
        );
      }
    }
    navigation.presentSheet(
      <ConfirmDialog
        visible
        title="Remove this milestone?"
        message={
          `Only the Roadmap checkpoint "${title}" will be removed. ` +
          'Its assigned Goals remain in the Project Structure, and its history is preserved.'
        }
        confirmLabel="Remove milestone"
        destructive
        onCancel={navigation.dismissSheet}
        onConfirm={() => {
          void confirmRemove();
        }}
      />,
    );
  }

  function move(direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= milestoneIds.length) return;
    const ordered = [...milestoneIds];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void (async () => {
      const outcome = await commit(
        () =>
          services.milestones.reorderMilestones({
            projectId: project.id,
            orderedMilestoneIds: ordered,
            actor: ACTOR,
          }),
        { successMessage: 'Milestones reordered', refresh: [onChanged] },
      );
      if (outcome.status === 'rejected') {
        navigation.presentSheet(
          <RelationRejectionSheet
            visible
            feedback={outcome.feedback}
            onReviewAnotherChoice={navigation.dismissSheet}
            onRetry={
              outcome.feedback.retryable
                ? () => {
                    navigation.dismissSheet();
                    move(direction);
                  }
                : undefined
            }
            onClose={navigation.dismissSheet}
          />,
        );
      }
    })();
  }

  return (
    <View style={styles.actions}>
      <Pressable
        onPress={() => move(-1)}
        disabled={index === 0}
        accessibilityRole="button"
        accessibilityLabel={`Move milestone ${title} up`}
        accessibilityState={{ disabled: index === 0 }}
        hitSlop={8}
        style={styles.action}
      >
        <Text style={[styles.actionText, index === 0 && styles.actionDisabled]}>↑</Text>
      </Pressable>
      <Pressable
        onPress={() => move(1)}
        disabled={index === milestoneIds.length - 1}
        accessibilityRole="button"
        accessibilityLabel={`Move milestone ${title} down`}
        accessibilityState={{ disabled: index === milestoneIds.length - 1 }}
        hitSlop={8}
        style={styles.action}
      >
        <Text
          style={[styles.actionText, index === milestoneIds.length - 1 && styles.actionDisabled]}
        >
          ↓
        </Text>
      </Pressable>
      <Pressable
        onPress={openEditSheet}
        accessibilityRole="button"
        accessibilityLabel={`Edit milestone ${title}`}
        hitSlop={8}
        style={styles.action}
      >
        <Text style={styles.editText}>Edit</Text>
      </Pressable>
      <Pressable
        onPress={openRemoveConfirmation}
        accessibilityRole="button"
        accessibilityLabel={`Remove milestone ${title}`}
        hitSlop={8}
        style={styles.action}
      >
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  action: {
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: 15,
    color: colors.brand,
  },
  actionDisabled: {
    color: colors.line,
  },
  editText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.red,
  },
});
