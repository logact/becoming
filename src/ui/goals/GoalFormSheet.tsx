import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Goal } from '../../domain/goal';
import type { CreateGoalCommand } from '../../application/goalService';
import { useAppServices } from '../composition/AppServicesProvider';
import { Sheet } from '../shared/Sheet';
import { colors, radius, spacing } from '../shared/theme';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface GoalFormSheetProps {
  mode: 'create' | 'edit';
  /** Required in edit mode; its values prefill the form. */
  goal?: Goal;
  /** Optional create command override for contextual compound mutations. */
  createGoal?: (command: CreateGoalCommand) => Promise<Goal>;
  /** Contextual create heading; list creation keeps the default. */
  createHeading?: string;
  /** Called only after the service has committed the mutation. */
  onSaved: (goal: Goal) => void;
  onCancel: () => void;
}

interface FieldErrors {
  title?: string;
  targetState?: string;
  form?: string;
}

/**
 * New/Edit Goal sheet for title, target state, description, and success
 * criteria. Validity is decided by the Goal application service at commit
 * time; the sheet only translates structured validation failures into inline
 * feedback and preserves the entered draft on any failure.
 */
export function GoalFormSheet({
  mode,
  goal,
  createGoal,
  createHeading,
  onSaved,
  onCancel,
}: GoalFormSheetProps) {
  const services = useAppServices();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [targetState, setTargetState] = useState(goal?.targetState ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [successCriteria, setSuccessCriteria] = useState(goal?.successCriteria ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const heading = mode === 'create' ? (createHeading ?? 'New goal') : 'Edit goal';

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      // Blank optional fields normalize to "absent", matching the domain's
      // nullable TEXT columns; entered values are otherwise stored as typed.
      const optionalDescription = description.trim().length === 0 ? undefined : description;
      const optionalCriteria = successCriteria.trim().length === 0 ? undefined : successCriteria;
      const saved = mode === 'create'
        ? await (createGoal ?? ((command) => services.goals.createGoal(command)))({
            actor: ACTOR,
            title,
            targetState,
            description: optionalDescription,
            successCriteria: optionalCriteria,
          })
        : await services.goals.updateGoal(
            goal!.id,
            {
              title,
              targetState,
              description: optionalDescription ?? null,
              successCriteria: optionalCriteria ?? null,
            },
            ACTOR,
          );
      onSaved(saved);
    } catch (error) {
      setErrors(translateGoalError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet visible title={heading} onClose={onCancel}>
      <Field
        label="Title"
        required
        value={title}
        onChangeText={setTitle}
        placeholder="Name the outcome"
        error={errors.title}
        accessibilityLabel="Goal title"
      />
      <Field
        label="Target state"
        required
        value={targetState}
        onChangeText={setTargetState}
        placeholder="Describe the state you want to reach"
        error={errors.targetState}
        accessibilityLabel="Goal target state"
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Why this outcome matters (optional)"
        multiline
        accessibilityLabel="Goal description"
      />
      <Field
        label="Success criteria"
        value={successCriteria}
        onChangeText={setSuccessCriteria}
        placeholder="Observable signs the outcome is achieved (optional)"
        multiline
        accessibilityLabel="Goal success criteria"
      />
      <Text style={styles.hint} maxFontSizeMultiplier={2}>
        Success criteria are plain text — numbers are optional, never required.
      </Text>

      {errors.form !== undefined && (
        <Text style={styles.formError} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
          {errors.form}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={[styles.button, styles.cancel]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void submit();
          }}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={mode === 'create' ? 'Save new goal' : 'Save goal changes'}
          accessibilityState={{ busy: submitting, disabled: submitting }}
          style={[styles.button, styles.primary, submitting && styles.disabled]}
        >
          <Text style={styles.primaryText}>{submitting ? 'Saving…' : 'Save goal'}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/**
 * Translate service-side validation failures into inline feedback. The
 * application/domain result stays authoritative — no validity is decided here.
 */
function translateGoalError(error: unknown): FieldErrors {
  const message = error instanceof Error
    ? error.message
    : 'The Goal could not be saved. Your entries are unchanged.';
  if (/goal title must not be blank/i.test(message)) {
    return { title: 'Enter a title for this Goal.' };
  }
  if (/goal targetstate must not be blank/i.test(message)) {
    return { targetState: 'Describe the state you want to reach.' };
  }
  return { form: message };
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  required?: boolean;
  multiline?: boolean;
  error?: string;
}

function Field({
  label, value, onChangeText, placeholder, accessibilityLabel,
  required = false, multiline = false, error,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label} maxFontSizeMultiplier={2}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline, error !== undefined && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={accessibilityLabel}
        multiline={multiline}
      />
      {error !== undefined && (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.red,
  },
  fieldError: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
    color: colors.red,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  formError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.red,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 96,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: colors.canvas,
  },
  cancelText: {
    color: colors.ink,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.white,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
