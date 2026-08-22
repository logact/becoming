import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../shared/theme';
import { DatePickerRow } from './DatePickerRow';
import { PrimaryChipButton } from './PrimaryChipButton';

export interface ScheduleEditorProps {
  entityLabel: 'Goal' | 'Task';
  initialStartAt?: Date;
  initialDue?: Date;
  onCancel: () => void;
  onSave: (startAt: Date | undefined, due: Date | undefined) => Promise<void>;
  testID: string;
}

function localDayNumber(value: Date): number {
  return value.getFullYear() * 10_000 + (value.getMonth() + 1) * 100 + value.getDate();
}

function localDate(value: Date | undefined): Date | undefined {
  return value === undefined
    ? undefined
    : new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** Focused, shared editor for atomically replacing an entity's optional schedule. */
export function ScheduleEditor({
  entityLabel,
  initialStartAt,
  initialDue,
  onCancel,
  onSave,
  testID,
}: ScheduleEditorProps) {
  const [startAt, setStartAt] = useState<Date | undefined>(initialStartAt);
  const [due, setDue] = useState<Date | undefined>(initialDue);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const writeInFlight = useRef(false);

  const submit = async (): Promise<void> => {
    if (writeInFlight.current) return;
    if (startAt !== undefined && due !== undefined && localDayNumber(startAt) > localDayNumber(due)) {
      setError('Start date must be on or before the due date.');
      return;
    }
    writeInFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onSave(startAt, due);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      writeInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View testID={testID}>
      <Text style={styles.title}>Schedule {entityLabel.toLowerCase()}</Text>
      <Text style={styles.note}>Start plans when work becomes actionable. Lifecycle status changes only through its own actions.</Text>
      <View style={styles.fields}>
        <DatePickerRow
          testID={`${testID}-start`}
          label="Start"
          value={startAt}
          maximumDate={localDate(due)}
          disabled={submitting}
          onChange={(value) => { setStartAt(value); setError(null); }}
        />
        <DatePickerRow
          testID={`${testID}-due`}
          label="Due"
          value={due}
          minimumDate={localDate(startAt)}
          disabled={submitting}
          onChange={(value) => { setDue(value); setError(null); }}
        />
      </View>
      {error === null ? null : <Text testID={`${testID}-error`} style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <PrimaryChipButton
          testID={`${testID}-cancel`}
          label="Cancel"
          variant="ghost"
          disabled={submitting}
          onPress={onCancel}
        />
        <PrimaryChipButton
          testID={`${testID}-save`}
          label={submitting ? 'Saving…' : 'Save schedule'}
          disabled={submitting}
          onPress={() => { void submit(); }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  fields: { gap: 10, marginTop: spacing.sectionTop },
  error: { color: colors.conflictRed, marginTop: 10, fontSize: 12.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
});
