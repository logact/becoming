import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from './theme';

export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusBadgeProps {
  /** Visible status text; always rendered, never color-only. */
  label: string;
  /**
   * Short non-color cue shown before the label (e.g. '✓', '!', '↺').
   * Required so the tone color is never the only signal.
   */
  icon: string;
  tone?: StatusBadgeTone;
  /** Overrides the default VoiceOver label (`${label}`); the icon is decorative. */
  accessibilityLabel?: string;
}

const TONE_STYLES: Record<StatusBadgeTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.canvas, color: colors.muted },
  info: { backgroundColor: colors.blueSoft, color: colors.blue },
  success: { backgroundColor: colors.brandSoft, color: colors.brand },
  warning: { backgroundColor: colors.amberSoft, color: colors.amber },
  danger: { backgroundColor: colors.redSoft, color: colors.red },
};

/**
 * Compact status pill used across lists, details, and findings. The label
 * and icon carry the meaning; the tone only reinforces them.
 */
export function StatusBadge({ label, icon, tone = 'neutral', accessibilityLabel }: StatusBadgeProps) {
  const toneStyle = TONE_STYLES[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: toneStyle.backgroundColor }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.text, { color: toneStyle.color }]} maxFontSizeMultiplier={2}>
        {icon} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
