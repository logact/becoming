import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../shared/theme';

export interface SectionHeaderProps {
  title: string;
}

/** Uppercase faint section label: 26px above, 10px below, 24px horizontal. */
export function SectionHeader({ title }: SectionHeaderProps) {
  return <Text style={styles.header}>{title}</Text>;
}

const styles = StyleSheet.create({
  header: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: colors.faint,
    marginTop: spacing.sectionTop,
    marginBottom: spacing.sectionBottom,
    marginHorizontal: spacing.textMargin,
  },
});
