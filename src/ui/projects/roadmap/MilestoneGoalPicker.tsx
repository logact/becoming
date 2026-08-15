import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../shared/theme';

/** One selectable descendant Goal of the pursuit, prepared by the caller. */
export interface MilestoneGoalCandidate {
  goalId: string;
  title: string;
  /** Secondary line (e.g. the Goal's target state). */
  detail: string | null;
  /**
   * Set when the Goal is actively assigned to another Milestone: the row
   * stays visible but disabled with this explanation (prototype rule).
   */
  disabledReason: string | null;
}

export interface MilestoneGoalPickerProps {
  candidates: MilestoneGoalCandidate[];
  /** The currently selected Goal ids, in assignment order. */
  selectedGoalIds: readonly string[];
  onToggle: (goalId: string) => void;
  /** Inline validation feedback for the selection as a whole. */
  error?: string;
}

/**
 * The Milestone Goal picker: only valid descendant Goals of the pursuit are
 * listed (the caller composes them from the Roadmap read model). Goals
 * already assigned to another active Milestone remain visible but disabled
 * with the conflict explanation; the service re-validates every choice at
 * commit time. Selection order follows candidate order, not tap order, so the
 * resulting assignment order is deterministic.
 */
export function MilestoneGoalPicker({
  candidates,
  selectedGoalIds,
  onToggle,
  error,
}: MilestoneGoalPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label} maxFontSizeMultiplier={2}>
        Goals *
      </Text>
      {candidates.length === 0 && (
        <Text style={styles.notice} maxFontSizeMultiplier={2}>
          No sub-goals are available to schedule.
        </Text>
      )}
      {candidates.map((candidate) => {
        const disabled = candidate.disabledReason !== null;
        const selected = selectedGoalIds.includes(candidate.goalId);
        return (
          <Pressable
            key={candidate.goalId}
            onPress={() => onToggle(candidate.goalId)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={
              disabled
                ? `${candidate.title}, unavailable: ${candidate.disabledReason}`
                : `${selected ? 'Deselect' : 'Select'} goal ${candidate.title}`
            }
            style={[styles.row, disabled && styles.rowDisabled]}
          >
            <Text
              style={[styles.checkbox, selected && styles.checkboxSelected]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {selected ? '☑' : '☐'}
            </Text>
            <View style={styles.rowBody}>
              <Text
                style={[styles.rowTitle, disabled && styles.rowTitleDisabled]}
                maxFontSizeMultiplier={2}
              >
                {candidate.title}
              </Text>
              <Text style={styles.rowDetail} maxFontSizeMultiplier={2}>
                {disabled ? candidate.disabledReason : (candidate.detail ?? 'Available sub-goal')}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {error !== undefined && (
        <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  notice: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowDisabled: {
    backgroundColor: colors.canvas,
  },
  checkbox: {
    fontSize: 16,
    color: colors.muted,
  },
  checkboxSelected: {
    color: colors.brand,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  rowTitleDisabled: {
    color: colors.muted,
  },
  rowDetail: {
    fontSize: 12,
    color: colors.muted,
  },
  error: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
    color: colors.red,
  },
});
