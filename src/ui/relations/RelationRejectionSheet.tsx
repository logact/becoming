import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '../shared/Sheet';
import { colors, radius, spacing } from '../shared/theme';
import type { RelationErrorFeedback } from './relationErrorMapping';

export interface RelationRejectionSheetProps {
  /** Controls visibility together with `feedback`. */
  visible: boolean;
  /**
   * The mapped commit-time feedback. When null the sheet renders nothing.
   * Pass the result of `mapRelationError` (or a `useRelationCommit` rejected
   * outcome); never a fabricated message.
   */
  feedback: RelationErrorFeedback | null;
  /**
   * Close the sheet and return to the picker/form so the user can review
   * another choice. The sheet owns no draft state — the caller's selection
   * and input remain exactly as they were.
   */
  onReviewAnotherChoice: () => void;
  /** Offered when provided: re-fetch endpoint candidates that may be stale. */
  onRefreshEndpoints?: () => void;
  /**
   * Offered when provided and the feedback is retryable: re-run the same
   * commit after the user corrected the underlying problem.
   */
  onRetry?: () => void;
  onClose: () => void;
}

/**
 * The prototype's focused "Change not allowed" commit-time feedback. It is a
 * modal Sheet, so nothing navigates away; it owns no draft or selection
 * state, so a rejection never clears valid input; and it is rendered only in
 * response to a service rejection, so a relation never appears optimistically.
 *
 * From here the user can review another choice, refresh stale endpoints, or
 * retry — matching the mapped feedback's retryability.
 */
export function RelationRejectionSheet({
  visible,
  feedback,
  onReviewAnotherChoice,
  onRefreshEndpoints,
  onRetry,
  onClose,
}: RelationRejectionSheetProps) {
  if (feedback === null) return null;
  return (
    <Sheet visible={visible} title="Change not allowed" onClose={onClose}>
      <View style={styles.note} accessibilityLiveRegion="polite">
        <Text
          style={styles.noteIcon}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          !
        </Text>
        <View style={styles.noteBody}>
          <Text style={styles.noteTitle} maxFontSizeMultiplier={2}>
            {feedback.title}
          </Text>
          <Text style={styles.noteText} maxFontSizeMultiplier={2}>
            {feedback.explanation}
          </Text>
          <Text style={styles.noteReassurance} maxFontSizeMultiplier={2}>
            Nothing was saved — your current screen and draft remain unchanged.
          </Text>
        </View>
      </View>
      <SheetButton
        label="Review another choice"
        onPress={onReviewAnotherChoice}
        primary
      />
      {onRefreshEndpoints !== undefined && (
        <SheetButton label="Refresh choices" onPress={onRefreshEndpoints} />
      )}
      {onRetry !== undefined && feedback.retryable && (
        <SheetButton label="Try again" onPress={onRetry} />
      )}
    </Sheet>
  );
}

function SheetButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonSoft]}
    >
      <Text
        style={[styles.buttonText, primary ? styles.buttonTextPrimary : styles.buttonTextSoft]}
        maxFontSizeMultiplier={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.redSoft,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  noteIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.red,
  },
  noteBody: {
    flex: 1,
    gap: spacing.xs,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.red,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  noteReassurance: {
    fontSize: 12,
    color: colors.muted,
  },
  button: {
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.brand,
  },
  buttonSoft: {
    backgroundColor: colors.canvas,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: colors.white,
  },
  buttonTextSoft: {
    color: colors.ink,
  },
});
