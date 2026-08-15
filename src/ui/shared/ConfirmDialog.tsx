import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from './Sheet';
import { colors, radius, spacing } from './theme';

export interface ConfirmDialogProps {
  visible: boolean;
  /** Question-style title, e.g. 'Archive this Goal?'. */
  title: string;
  /** Explanation of what changes and what remains in history. */
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions (archive, end relation) style the confirm button red. */
  destructive?: boolean;
}

/**
 * Confirmed-action dialog presented as a bottom sheet, matching the
 * prototype's archive/end-relation confirmations. The action is described
 * in text on the button itself; destructiveness is never color-only.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Sheet visible={visible} title={title} onClose={onCancel}>
      <Text style={styles.message} maxFontSizeMultiplier={2}>
        {message}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          style={[styles.button, styles.cancel]}
        >
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={[styles.button, destructive ? styles.destructive : styles.primary]}
        >
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  button: {
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 96,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: colors.canvas,
  },
  cancelText: {
    color: colors.ink,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: colors.brand,
  },
  destructive: {
    backgroundColor: colors.red,
  },
  confirmText: {
    color: colors.white,
    fontWeight: '700',
  },
});
