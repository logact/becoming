import React from 'react';
import { type GestureResponderEvent, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii } from '../shared/theme';

export interface PrimaryChipButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  /** Keep a nested chip action from also activating its pressable parent. */
  stopPropagation?: boolean;
}

/** Filled green pill for primary actions (Resume, Plan, Add). */
export function PrimaryChipButton({
  label,
  onPress,
  disabled,
  testID,
  variant = 'primary',
  stopPropagation = false,
}: PrimaryChipButtonProps) {
  const handlePress = (event: GestureResponderEvent): void => {
    if (stopPropagation) event.stopPropagation();
    onPress?.();
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={disabled || onPress === undefined ? undefined : handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.green },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.green },
  danger: { backgroundColor: colors.conflictRed },
  label: {
    color: colors.primaryTextOnGreen,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.125,
  },
  ghostLabel: { color: colors.green },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.4 },
});
