import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { colors } from '../../shared/theme';

/**
 * Form rows for the add-plan-item / allocate-resource panels (the prototype's
 * `.row` with `.flabel` + `.finput`): a small muted label, then an inline
 * text input or a tappable value with a trailing chevron. Rendered inside a
 * panel ListSection, which injects the separators between rows.
 */

export interface FormTextRowProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Trailing meta text (e.g. the `≤ available` hint on amount inputs). */
  hint?: string;
  keyboardType?: 'default' | 'numeric';
  testID?: string;
}

export function FormTextRow({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  keyboardType,
  testID,
}: FormTextRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        {...(placeholder === undefined ? {} : { placeholder })}
        placeholderTextColor={colors.faint}
        {...(keyboardType === undefined ? {} : { keyboardType })}
      />
      {hint === undefined ? null : <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export interface FormPickerRowProps {
  label: string;
  /** Title of the currently selected option. */
  value: string;
  subtitle?: string;
  onPress: () => void;
  testID?: string;
}

export function FormPickerRow({ label, value, subtitle, onPress, testID }: FormPickerRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueBox}>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Icon name="chevron" size={9} color={colors.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 52,
  },
  pressed: { opacity: 0.5 },
  label: { width: 78, fontSize: 13, fontWeight: '600', color: colors.muted },
  input: { flex: 1, padding: 0, fontSize: 15.5, fontWeight: '600', color: colors.ink },
  hint: { fontSize: 12.5, fontWeight: '500', color: colors.faint },
  valueBox: { flex: 1 },
  value: { fontSize: 15.5, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 12.5, color: colors.faint, marginTop: 2 },
});
