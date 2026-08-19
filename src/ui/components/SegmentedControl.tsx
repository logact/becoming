import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../shared/theme';

export interface SegmentedControlOption<K extends string = string> {
  key: K;
  label: string;
}

export interface SegmentedControlProps<K extends string = string> {
  options: SegmentedControlOption<K>[];
  selected: K;
  onSelect: (key: K) => void;
  testID?: string;
}

/**
 * Segmented control per docs/design/design-style.md: `track` background,
 * 16px radius, 3px padding; the active segment is a white pill (13px
 * radius, soft shadow, 700 ink text), inactive segments are muted.
 */
export function SegmentedControl<K extends string = string>({
  options,
  selected,
  onSelect,
  testID,
}: SegmentedControlProps<K>) {
  return (
    <View testID={testID} style={styles.track}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            testID={testID === undefined ? undefined : `${testID}-${option.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.track,
    borderRadius: 16,
    padding: 3,
    marginTop: 14,
    marginBottom: 16,
    marginHorizontal: spacing.screenMargin,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 13,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: '600' },
  labelActive: { fontWeight: '700', color: colors.ink },
  labelInactive: { color: colors.muted },
});
