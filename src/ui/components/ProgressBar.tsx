import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../shared/theme';

export interface ProgressBarProps {
  /** 0..1; values outside the range are clamped. */
  progress: number;
  /** Track height: 5px normally, 7px on detail headers. */
  height?: 5 | 7;
}

/** Thin progress bar: `green` fill on a track, `sage` fill when complete. */
export function ProgressBar({ progress, height = 5 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: clamped >= 1 ? colors.sage : colors.green,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.progressTrack,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
});
