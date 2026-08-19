import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, serif } from '../shared/theme';
import { Icon } from './Icon';

export interface InlineNavBarProps {
  title: string;
  onBack: () => void;
  /** Optional right-hand action (e.g. a plus/pencil icon button). */
  right?: React.ReactNode;
}

/**
 * Pushed-screen header: chevron-only back button on the left, centered
 * serif title, optional right action slot.
 */
export function InlineNavBar({ title, onBack, right }: InlineNavBarProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="back" size={12} color={colors.green} />
      </Pressable>
      <Text style={styles.title} pointerEvents="none" numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
  title: {
    position: 'absolute',
    left: 70,
    right: 70,
    textAlign: 'center',
    fontFamily: serif,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  right: { marginLeft: 'auto' },
});
