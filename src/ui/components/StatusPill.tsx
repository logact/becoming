import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../shared/theme';
import { Icon, IconName } from './Icon';

export type StatusState =
  | 'doing'
  | 'todo'
  | 'done'
  | 'paused'
  | 'exploring'
  | 'captured'
  | 'active'
  | 'planning'
  | 'blocked'
  | 'conflict';

export interface StatusPillProps {
  state: StatusState;
  label: string;
}

const STATE_COLOR: Record<StatusState, string> = {
  doing: colors.doingBlue,
  exploring: colors.doingBlue,
  todo: colors.todoGray,
  captured: colors.todoGray,
  done: colors.doneSage,
  active: colors.doneSage,
  paused: colors.pausedAmber,
  planning: colors.pausedAmber,
  blocked: colors.pausedAmber,
  conflict: colors.conflictRed,
};

const STATE_ICON: Record<StatusState, IconName> = {
  doing: 'circle',
  exploring: 'circle',
  todo: 'circle',
  captured: 'circle',
  active: 'circle',
  planning: 'circle',
  done: 'check',
  paused: 'pause',
  blocked: 'alert',
  conflict: 'alert',
};

/**
 * Outlined state pill: 1.5px border in the state color, transparent
 * background, tiny state icon + 12px/700 label. Never filled.
 */
export function StatusPill({ state, label }: StatusPillProps) {
  const color = STATE_COLOR[state];
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Icon name={STATE_ICON[state]} size={11} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.12 },
});
