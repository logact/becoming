import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors } from '../shared/theme';

export interface SectionNoteProps {
  children: React.ReactNode;
}

/** Small faint caption sitting under a section (10px top, 26px horizontal). */
export function SectionNote({ children }: SectionNoteProps) {
  return <Text style={styles.note}>{children}</Text>;
}

const styles = StyleSheet.create({
  note: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.faint,
    marginTop: 10,
    marginHorizontal: 26,
  },
});
