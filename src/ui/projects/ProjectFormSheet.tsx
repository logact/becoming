import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Project } from '../../domain/project';
import { useAppServices } from '../composition/AppServicesProvider';
import { Sheet } from '../shared/Sheet';
import { colors, radius, spacing } from '../shared/theme';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface ProjectFormSheetProps {
  mode: 'create' | 'edit';
  /** Required in edit mode; its values prefill the form. */
  project?: Project;
  /** Called only after the service has committed the mutation. */
  onSaved: (project: Project) => void;
  onCancel: () => void;
}

interface FieldErrors {
  title?: string;
  form?: string;
}

/**
 * New/Edit Project sheet for title, purpose, and description. Validity is
 * decided by the Project application service at commit time; the sheet only
 * translates structured validation failures into inline feedback and
 * preserves the entered draft on any failure.
 */
export function ProjectFormSheet({ mode, project, onSaved, onCancel }: ProjectFormSheetProps) {
  const services = useAppServices();
  const [title, setTitle] = useState(project?.title ?? '');
  const [purpose, setPurpose] = useState(project?.purpose ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const heading = mode === 'create' ? 'New project' : 'Edit project';

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      // Blank optional fields normalize to "absent", matching the domain's
      // nullable TEXT columns; entered values are otherwise stored as typed.
      const optionalPurpose = purpose.trim().length === 0 ? undefined : purpose;
      const optionalDescription = description.trim().length === 0 ? undefined : description;
      const saved = mode === 'create'
        ? await services.projects.createProject({
            actor: ACTOR,
            title,
            purpose: optionalPurpose,
            description: optionalDescription,
          })
        : await services.projects.updateProject({
            id: project!.id,
            changes: {
              title,
              purpose: optionalPurpose ?? null,
              description: optionalDescription ?? null,
            },
            actor: ACTOR,
          });
      onSaved(saved);
    } catch (error) {
      setErrors(translateProjectError(error));
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
        placeholder="Name the effort"
        error={errors.title}
        accessibilityLabel="Project title"
      />
      <Field
        label="Purpose"
        value={purpose}
        onChangeText={setPurpose}
        placeholder="Why this Project exists (optional)"
        multiline
        accessibilityLabel="Project purpose"
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What this Project involves (optional)"
        multiline
        accessibilityLabel="Project description"
      />

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
          accessibilityLabel={mode === 'create' ? 'Save new project' : 'Save project changes'}
          accessibilityState={{ busy: submitting, disabled: submitting }}
          style={[styles.button, styles.primary, submitting && styles.disabled]}
        >
          <Text style={styles.primaryText}>{submitting ? 'Saving…' : 'Save project'}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/**
 * Translate service-side validation failures into inline feedback. The
 * application/domain result stays authoritative — no validity is decided here.
 */
function translateProjectError(error: unknown): FieldErrors {
  const message = error instanceof Error
    ? error.message
    : 'The Project could not be saved. Your entries are unchanged.';
  if (/project title must not be blank/i.test(message)) {
    return { title: 'Enter a title for this Project.' };
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
