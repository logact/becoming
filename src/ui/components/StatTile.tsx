import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, serif } from '../shared/theme';

export interface StatTileProps {
  value: string | number;
  label: string;
}

/** Panel stat tile: serif green number above a small muted label. */
export function StatTile({ value, label }: StatTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.tile,
    paddingTop: 13,
    paddingHorizontal: 14,
    paddingBottom: 11,
  },
  value: {
    fontFamily: serif,
    fontSize: 24,
    fontWeight: '700',
    color: colors.green,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 3,
    letterSpacing: 0.33,
  },
});
