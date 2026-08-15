import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Task } from '../../domain/task';
import type { CreateTaskCommand } from '../../application/taskService';
import { useAppServices } from '../composition/AppServicesProvider';
import { Sheet } from '../shared/Sheet';
import { colors, radius, spacing } from '../shared/theme';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface TaskFormSheetProps {
  mode: 'create' | 'edit';
  /** Required in edit mode; its values prefill the form. */
  task?: Task;
  /** Optional create command override for contextual compound mutations. */
  createTask?: (command: CreateTaskCommand) => Promise<Task>;
  /** Contextual create heading; list creation keeps the default. */
  createHeading?: string;
  /** Called only after the service has committed the mutation. */
  onSaved: (task: Task) => void;
  onCancel: () => void;
}

interface FieldErrors {
  title?: string;
  targetDescription?: string;
  priority?: string;
  form?: string;
}

/**
 * New/Edit Task sheet for title, target description, description, exit
 * criteria, and optional whole-number priority 1–5. Validity is decided by
 * the Task application service at commit time; the sheet only translates
 * structured validation failures into inline feedback and preserves the
 * entered draft on any failure.
 */
export function TaskFormSheet({
  mode,
  task,
  createTask,
  createHeading,
  onSaved,
  onCancel,
}: TaskFormSheetProps) {
  const services = useAppServices();
  const [title, setTitle] = useState(task?.title ?? '');
  const [targetDescription, setTargetDescription] = useState(task?.targetDescription ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [exitCriteria, setExitCriteria] = useState(task?.exitCriteria ?? '');
  const [priority, setPriority] = useState(task?.priority !== null && task?.priority !== undefined ? `${task.priority}` : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const heading = mode === 'create' ? (createHeading ?? 'New task') : 'Edit task';

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      // Blank optional fields normalize to "absent", matching the domain's
      // nullable columns. A non-blank priority is passed through as a number
      // (NaN included) so the application contract — not this form — decides
      // what a valid whole-number 1–5 priority is.
      const optionalDescription = description.trim().length === 0 ? undefined : description;
      const optionalExitCriteria = exitCriteria.trim().length === 0 ? undefined : exitCriteria;
      const parsedPriority = priority.trim().length === 0 ? undefined : Number(priority.trim());
      const saved = mode === 'create'
        ? await (createTask ?? ((command) => services.tasks.createTask(command)))({
            actor: ACTOR,
            title,
            targetDescription,
            description: optionalDescription,
            exitCriteria: optionalExitCriteria,
            priority: parsedPriority,
          })
        : await services.tasks.updateTask(
            task!.id,
            {
              title,
              targetDescription,
              description: optionalDescription ?? null,
              exitCriteria: optionalExitCriteria ?? null,
              priority: parsedPriority ?? null,
            },
            ACTOR,
          );
      onSaved(saved);
    } catch (error) {
      setErrors(translateTaskError(error));
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
        placeholder="Name the work"
        error={errors.title}
        accessibilityLabel="Task title"
      />
      <Field
        label="Target description"
        required
        value={targetDescription}
        onChangeText={setTargetDescription}
        placeholder="Describe the outcome this work aims for"
        error={errors.targetDescription}
        accessibilityLabel="Task target description"
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Context and notes for this work (optional)"
        multiline
        accessibilityLabel="Task description"
      />
      <Field
        label="Exit criteria"
        value={exitCriteria}
        onChangeText={setExitCriteria}
        placeholder="Observable signs the work is done (optional)"
        multiline
        accessibilityLabel="Task exit criteria"
      />
      <Field
        label="Priority"
        value={priority}
        onChangeText={setPriority}
        placeholder="Whole number 1 (highest) to 5 (lowest), optional"
        error={errors.priority}
        accessibilityLabel="Task priority"
      />
      <Text style={styles.hint} maxFontSizeMultiplier={2}>
        Priority is optional — leave it blank when this Task has no explicit ordering.
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
          accessibilityLabel={mode === 'create' ? 'Save new task' : 'Save task changes'}
          accessibilityState={{ busy: submitting, disabled: submitting }}
          style={[styles.button, styles.primary, submitting && styles.disabled]}
        >
          <Text style={styles.primaryText}>{submitting ? 'Saving…' : 'Save task'}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/**
 * Translate service-side validation failures into inline feedback. The
 * application/domain result stays authoritative — no validity is decided here.
 */
function translateTaskError(error: unknown): FieldErrors {
  const message = error instanceof Error
    ? error.message
    : 'The Task could not be saved. Your entries are unchanged.';
  if (/task title must not be blank/i.test(message)) {
    return { title: 'Enter a title for this Task.' };
  }
  if (/task targetdescription must not be blank/i.test(message)) {
    return { targetDescription: 'Describe the outcome this work aims for.' };
  }
  if (/task priority must be an integer/i.test(message)) {
    return { priority: 'Priority must be a whole number from 1 (highest) to 5 (lowest), or blank.' };
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
