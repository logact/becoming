import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radii } from '../shared/theme';

export interface CaptureFloatingButtonProps {
  bottomOffset: number;
  onPress: () => void;
}

/** Fixed 50px app-shell capture pill; positioning is supplied by NavigationShell. */
export function CaptureFloatingButton({ bottomOffset, onPress }: CaptureFloatingButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID="capture-floating-button"
      accessibilityRole="button"
      accessibilityLabel="Open capture"
      hitSlop={8}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { bottom: bottomOffset },
        pressed && styles.pressed,
        focused && styles.focused,
      ]}
    >
      <View style={styles.plusChip}>
        <Icon name="plus" size={18} color={colors.green} />
      </View>
      <Text style={styles.label}>Capture</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 18,
    height: 50,
    borderRadius: radii.pill,
    paddingLeft: 6,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.green,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
    zIndex: 20,
  },
  plusChip: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.primaryTextOnGreen, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  focused: { borderWidth: 2, borderColor: colors.mint },
});
