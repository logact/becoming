import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, serif, spacing } from '../shared/theme';

export interface PlaceholderPageProps {
  title: string;
}

/**
 * Stand-in page for destinations that are not implemented yet:
 * large serif title over a muted "Nothing here yet." line.
 */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>
        <Text style={styles.hint}>Nothing here yet.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontFamily: serif,
    fontSize: 35,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
    marginHorizontal: spacing.textMargin,
    marginTop: spacing.sectionTop,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, color: colors.muted },
});
