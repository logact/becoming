import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

import { colors, spacing } from '../shared/theme';
import { IconName } from './Icon';
import { IconChip } from './IconChip';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** When set, leads the row with a mint icon chip. */
  icon?: IconName;
  /** Right-hand slot: pill, value, meta or chevron. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Dense padding (14/18) for rows inside a panel ListSection. */
  dense?: boolean;
  /** Overrides the title text style (e.g. the green "Pin an item…" add-row). */
  titleStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * Row anatomy: chip · title + subtitle · trailing. Renders inside a
 * ListSection (which injects separators) or standalone on `bg`.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  dense,
  titleStyle,
  testID,
}: ListRowProps) {
  const body = (
    <>
      {icon ? (
        <View style={styles.chipWrap}>
          <IconChip name={icon} />
        </View>
      ) : null}
      <View style={styles.middle}>
        <Text style={[styles.title, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.row, dense && styles.dense, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return <View testID={testID} style={[styles.row, dense && styles.dense]}>{body}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    minHeight: 52,
  },
  dense: { paddingVertical: 14, paddingHorizontal: 18 },
  pressed: { opacity: 0.5 },
  chipWrap: { marginRight: 13 },
  middle: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.ink,
  },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  trailing: { marginLeft: spacing.stackGap, flexDirection: 'row', alignItems: 'center' },
});
