import React from 'react';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from './theme';

export interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional VoiceOver label for the sheet container. */
  accessibilityLabel?: string;
}

/**
 * Modal bottom-sheet wrapper matching the prototype's sheet presentation:
 * dimmed backdrop, drag handle, title row with a close affordance, and
 * scrollable content. Used by forms, pickers, confirmations, and relation
 * feedback in the M2 screens.
 */
export function Sheet({ visible, title, onClose, children, accessibilityLabel }: SheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropDismiss} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.sheet} accessibilityLabel={accessibilityLabel ?? title}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} maxFontSizeMultiplier={2}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              hitSlop={8}
              style={styles.close}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 49, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    maxHeight: '88%',
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  close: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: 24,
    color: colors.muted,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
});
