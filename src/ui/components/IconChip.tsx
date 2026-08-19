import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '../shared/theme';
import { Icon, IconName } from './Icon';

export interface IconChipProps {
  name: IconName;
  /** `md` is 32×32 (17px glyph); `lg` is 46×46 (24px glyph). */
  size?: 'md' | 'lg';
}

/** Mint rounded-square chip with a green glyph, leading list rows and cards. */
export function IconChip({ name, size = 'md' }: IconChipProps) {
  const lg = size === 'lg';
  return (
    <View style={[styles.chip, lg ? styles.lg : styles.md]}>
      <Icon name={name} size={lg ? 24 : 17} color={colors.green} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { width: 32, height: 32, borderRadius: radii.chip },
  lg: { width: 46, height: 46, borderRadius: radii.chipLg },
});
