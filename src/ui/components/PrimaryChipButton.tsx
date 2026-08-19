import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii } from '../shared/theme';

export interface PrimaryChipButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

/** Filled green pill for primary actions (Resume, Plan, Add). */
export function PrimaryChipButton({ label, onPress, disabled, testID }: PrimaryChipButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.primaryTextOnGreen,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.125,
  },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.4 },
});
