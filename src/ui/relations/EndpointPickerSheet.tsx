import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '../shared/Sheet';
import { StatusBadge } from '../shared/StatusBadge';
import { colors, radius, spacing } from '../shared/theme';
import { pickerHintForKind } from './relationErrorMapping';
import type { RelationErrorKind } from './relationErrorMapping';

/**
 * Why a candidate cannot be selected. The `kind` drives the default reason
 * text through the same presentation table used for commit-time feedback, so
 * picker-time hints and the "Change not allowed" sheet speak one language.
 *
 * This is presentation only: the consuming screen derives rejections from
 * application query results (archived flags, active relations, hierarchy
 * context), and commit-time service validation stays authoritative.
 */
export interface CandidateRejection {
  kind: RelationErrorKind;
  /** Optional specific override; defaults to `pickerHintForKind(kind)`. */
  reason?: string;
}

/** Resolve the visible reason for a rejected candidate. */
export function candidateRejectionReason(rejection: CandidateRejection): string {
  return rejection.reason ?? pickerHintForKind(rejection.kind);
}

export interface EndpointCandidate {
  id: string;
  title: string;
  /** Supporting line for selectable rows (e.g. purpose or target state). */
  detail?: string;
  /** When set, the row stays visible with a Rejected state and is not selectable. */
  rejection?: CandidateRejection;
}

export interface EndpointPickerSheetProps {
  visible: boolean;
  /** Sheet title, e.g. 'Choose a Goal'. */
  title: string;
  candidates: EndpointCandidate[];
  /** Called only for candidates without a rejection. */
  onSelect: (candidate: EndpointCandidate) => void;
  onClose: () => void;
  /** Shown when there are no candidates at all. */
  emptyMessage?: string;
}

/**
 * Endpoint picker matching the prototype's candidate rows: useful unavailable
 * choices remain visible with a distinct Rejected badge and a human reason
 * (archived endpoint, duplicate active relationship, invalid direction,
 * already in structure, cross-Project structure, …). Selection is only
 * possible for available rows; hints never replace commit-time validation.
 */
export function EndpointPickerSheet({
  visible,
  title,
  candidates,
  onSelect,
  onClose,
  emptyMessage = 'Nothing to choose from yet.',
}: EndpointPickerSheetProps) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Text style={styles.intro} maxFontSizeMultiplier={2}>
        Unavailable choices stay visible so the rule is understandable.
      </Text>
      {candidates.length === 0 ? (
        <Text style={styles.empty} maxFontSizeMultiplier={2}>
          {emptyMessage}
        </Text>
      ) : (
        candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            onSelect={onSelect}
          />
        ))
      )}
    </Sheet>
  );
}

function CandidateRow({
  candidate,
  onSelect,
}: {
  candidate: EndpointCandidate;
  onSelect: (candidate: EndpointCandidate) => void;
}) {
  const rejected = candidate.rejection !== undefined;
  const reason = rejected ? candidateRejectionReason(candidate.rejection!) : undefined;
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
  empty: {
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
