import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatLocalDate, formatLocalDateTime } from '../shared/dateFormat';
import { colors, radii } from '../shared/theme';

export type DatePickerMode = 'date' | 'datetime';

export interface DatePickerRowProps {
  /** Human-facing field name. It is also the base accessibility label. */
  label: string;
  /** Controlled value. Dates are always interpreted in the device's local time. */
  value?: Date;
  /** Required fields omit Clear; optional fields report `undefined` when cleared. */
  required?: boolean;
  mode?: DatePickerMode;
  onChange: (value: Date | undefined) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  locale?: string;
  disabled?: boolean;
  testID: string;
}

function localDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function localDateTime(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    value.getHours(),
    value.getMinutes(),
  );
}

function bounded(value: Date, minimumDate?: Date, maximumDate?: Date): Date {
  const timestamp = Math.min(
    maximumDate?.getTime() ?? Number.POSITIVE_INFINITY,
    Math.max(minimumDate?.getTime() ?? Number.NEGATIVE_INFINITY, value.getTime()),
  );
  return new Date(timestamp);
}

function initialDraft(
  value: Date | undefined,
  mode: DatePickerMode,
  minimumDate?: Date,
  maximumDate?: Date,
): Date {
  const initial = value === undefined ? new Date() : new Date(value.getTime());
  const normalized = mode === 'date' ? localDate(initial) : localDateTime(initial);
  const minimum = minimumDate === undefined
    ? undefined
    : mode === 'date' ? localDate(minimumDate) : minimumDate;
  const maximum = maximumDate === undefined
    ? undefined
    : mode === 'date' ? localDate(maximumDate) : maximumDate;
  return bounded(normalized, minimum, maximum);
}

function combineDate(date: Date, time: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
  );
}

function isSet(event: DateTimePickerEvent, selected?: Date): selected is Date {
  return event.type === 'set' && selected !== undefined;
}

/**
 * Controlled, cross-platform date field. iOS keeps edits in a modal panel
 * until Done. Android chains date and time dialogs and publishes only the
 * final combined value, so every Cancel path is lossless.
 */
export function DatePickerRow({
  label,
  value,
  required = false,
  mode = 'date',
  onChange,
  minimumDate,
  maximumDate,
  locale,
  disabled = false,
  testID,
}: DatePickerRowProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => initialDraft(
    value,
    mode,
    minimumDate,
    maximumDate,
  ));

  const displayValue = value === undefined
    ? (mode === 'date' ? 'Select date' : 'Select date and time')
    : mode === 'date'
      ? formatLocalDate(value, locale)
      : formatLocalDateTime(value, locale);

  const openAndroid = (): void => {
    const seed = initialDraft(value, mode, minimumDate, maximumDate);
    DateTimePickerAndroid.open({
      mode: 'date',
      value: seed,
      minimumDate,
      maximumDate,
      testID: `${testID}-native-date`,
      onChange: (dateEvent, selectedDate) => {
        if (!isSet(dateEvent, selectedDate)) return;

        if (mode === 'date') {
          const nextDate = localDate(selectedDate);
          const minimum = minimumDate === undefined ? undefined : localDate(minimumDate);
          const maximum = maximumDate === undefined ? undefined : localDate(maximumDate);
          onChange(bounded(nextDate, minimum, maximum));
          return;
        }

        const dateDraft = combineDate(selectedDate, seed);
        DateTimePickerAndroid.open({
          mode: 'time',
          value: dateDraft,
          testID: `${testID}-native-time`,
          onChange: (timeEvent, selectedTime) => {
            if (!isSet(timeEvent, selectedTime)) return;
            onChange(bounded(
              combineDate(dateDraft, selectedTime),
              minimumDate,
              maximumDate,
            ));
          },
        });
      },
    });
  };

  const open = (): void => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      openAndroid();
      return;
    }
    setDraft(initialDraft(value, mode, minimumDate, maximumDate));
    setIosOpen(true);
  };

  const commitIos = (): void => {
    onChange(mode === 'date' ? localDate(draft) : localDateTime(draft));
    setIosOpen(false);
  };

  return (
    <View testID={testID} style={[styles.row, disabled && styles.disabled]}>
      <Pressable
        testID={`${testID}-open`}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value === undefined ? 'Not set' : displayValue}`}
        accessibilityHint={`Opens the ${mode === 'date' ? 'date' : 'date and time'} picker`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [styles.field, pressed && !disabled && styles.pressed]}
      >
        <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
        <Text testID={`${testID}-value`} style={[styles.value, value === undefined && styles.placeholder]}>
          {displayValue}
        </Text>
      </Pressable>

      {!required && value !== undefined ? (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          disabled={disabled}
          onPress={() => onChange(undefined)}
          style={({ pressed }) => [styles.clear, pressed && !disabled && styles.pressed]}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      ) : null}

      {Platform.OS === 'android' ? null : (
        <Modal
          transparent
          animationType="slide"
          visible={iosOpen}
          onRequestClose={() => setIosOpen(false)}
        >
          <View testID={`${testID}-panel`} style={styles.overlay} accessibilityViewIsModal>
            <Pressable
              testID={`${testID}-backdrop`}
              accessibilityLabel={`Cancel ${label}`}
              onPress={() => setIosOpen(false)}
              style={styles.backdrop}
            />
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Pressable
                  testID={`${testID}-cancel`}
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel ${label}`}
                  onPress={() => setIosOpen(false)}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Text style={styles.panelTitle}>{label}</Text>
                <Pressable
                  testID={`${testID}-done`}
                  accessibilityRole="button"
                  accessibilityLabel={`Confirm ${label}`}
                  onPress={commitIos}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                >
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                testID={`${testID}-native`}
                accessibilityLabel={`${label} picker`}
                value={draft}
                mode={mode}
                display="spinner"
                locale={locale}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                accentColor={colors.green}
                themeVariant="light"
                onChange={(event, selected) => {
                  if (isSet(event, selected)) {
                    setDraft(mode === 'date' ? localDate(selected) : localDateTime(selected));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.chip,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  field: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 3 },
  value: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  placeholder: { color: colors.faint, fontWeight: '400' },
  clear: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
  },
  clearText: { color: colors.green, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.4 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,30,24,0.25)',
  },
  panel: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
  },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  action: { minWidth: 64, padding: 8 },
  cancelText: { color: colors.muted, fontSize: 15 },
  doneText: { color: colors.green, fontSize: 15, fontWeight: '700', textAlign: 'right' },
});
