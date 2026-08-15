import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Project } from '../../../domain/project';
import type { MilestoneRoadmapItem } from '../../../application/projectRoadmapQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { Sheet } from '../../shared/Sheet';
import { colors, radius, spacing } from '../../shared/theme';
import { MilestoneGoalPicker } from './MilestoneGoalPicker';
import type { MilestoneGoalCandidate } from './MilestoneGoalPicker';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

export interface MilestoneFormSheetProps {
  mode: 'create' | 'edit';
  project: Project;
  /** Required in edit mode; its values prefill the form. */
  milestone?: MilestoneRoadmapItem;
  /**
   * The valid descendant Goals of the pursuit, composed from the Roadmap
   * read model by the segment; Goals assigned to another active Milestone
   * carry a disabled reason.
   */
  candidates: MilestoneGoalCandidate[];
  /** Called only after the service has committed the mutation. */
  onSaved: () => void;
  onCancel: () => void;
}

interface FieldErrors {
  title?: string;
  targetAt?: string;
  goals?: string;
  form?: string;
}

/**
 * New/Edit Milestone sheet for title, description, target date, and Goal
 * membership. Validity is decided by the Milestone application service at
 * commit time; the sheet only parses the date input format and translates
 * structured validation failures into inline feedback. Any failure preserves
 * the entered draft and keeps the sheet open.
 */
export function MilestoneFormSheet({
  mode,
  project,
  milestone,
  candidates,
  onSaved,
  onCancel,
}: MilestoneFormSheetProps) {
  const services = useAppServices();
  const [title, setTitle] = useState(milestone?.milestone.title ?? '');
  const [description, setDescription] = useState(milestone?.milestone.description ?? '');
  const [targetDate, setTargetDate] = useState(milestone?.milestone.targetAt?.slice(0, 10) ?? '');
  const [selectedGoalIds, setSelectedGoalIds] = useState<readonly string[]>(
    milestone?.goals.map((goal) => goal.assignment.goalId) ?? [],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const heading = mode === 'create' ? 'New milestone' : 'Edit milestone';

  function toggleGoal(goalId: string) {
    setSelectedGoalIds((current) =>
      current.includes(goalId)
        ? current.filter((id) => id !== goalId)
        : [...current, goalId],
    );
  }

  async function submit() {
    if (submitting) return;
    // Input-format parsing only: blank means "no target date"; anything else
    // must be a calendar date the service can store as an ISO timestamp.
    const trimmedDate = targetDate.trim();
    let targetAt: string | null = null;
    if (trimmedDate.length > 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) || Number.isNaN(Date.parse(trimmedDate))) {
        setErrors({ targetAt: 'Use a date like 2026-09-30, or leave the field empty.' });
        return;
      }
      targetAt = `${trimmedDate}T00:00:00.000Z`;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const optionalDescription = description.trim().length === 0 ? undefined : description;
      if (mode === 'create') {
        await services.milestones.createMilestone({
          projectId: project.id,
          title,
          description: optionalDescription,
          targetAt,
          goalIds: selectedGoalIds,
          actor: ACTOR,
        });
      } else {
        const current = milestone!;
        await services.milestones.updateMilestone({
          milestoneId: current.milestone.id,
          title,
          description: optionalDescription ?? null,
          targetAt,
          actor: ACTOR,
        });
        const currentGoalIds = current.goals.map((goal) => goal.assignment.goalId);
        const membershipChanged =
          selectedGoalIds.length !== currentGoalIds.length ||
          selectedGoalIds.some((goalId, index) => goalId !== currentGoalIds[index]);
        if (membershipChanged) {
          await services.milestones.assignGoal({
            milestoneId: current.milestone.id,
            goalIds: selectedGoalIds,
            actor: ACTOR,
          });
        }
      }
      onSaved();
    } catch (error) {
      setErrors(translateMilestoneError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet visible title={heading} onClose={onCancel}>
      <Text style={styles.hint} maxFontSizeMultiplier={2}>
        A Milestone groups the sub-goals that must be complete to reach it.
      </Text>
      <View style={styles.field}>
        <Text style={styles.label} maxFontSizeMultiplier={2}>
          Title *
        </Text>
        <TextInput
          style={[styles.input, errors.title !== undefined && styles.inputError]}
          value={title}
          onChangeText={setTitle}
          placeholder="Name this checkpoint"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Milestone title"
        />
        {errors.title !== undefined && (
          <Text style={styles.fieldError} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
            {errors.title}
          </Text>
        )}
      </View>
      <View style={styles.field}>
        <Text style={styles.label} maxFontSizeMultiplier={2}>
          Description
        </Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="What reaching this checkpoint means (optional)"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Milestone description"
          multiline
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label} maxFontSizeMultiplier={2}>
          Target date
        </Text>
        <TextInput
          style={[styles.input, errors.targetAt !== undefined && styles.inputError]}
          value={targetDate}
          onChangeText={setTargetDate}
          placeholder="YYYY-MM-DD (optional)"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Milestone target date"
          inputMode="numeric"
        />
        {errors.targetAt !== undefined && (
          <Text style={styles.fieldError} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
            {errors.targetAt}
          </Text>
        )}
      </View>
      <MilestoneGoalPicker
        candidates={candidates}
        selectedGoalIds={selectedGoalIds}
        onToggle={toggleGoal}
        error={errors.goals}
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
          accessibilityLabel={mode === 'create' ? 'Save new milestone' : 'Save milestone changes'}
          accessibilityState={{ busy: submitting, disabled: submitting }}
          style={[styles.button, styles.primary, submitting && styles.disabled]}
        >
          <Text style={styles.primaryText}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Create milestone' : 'Save changes'}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/**
 * Translate service-side validation failures into inline feedback. The
 * application/domain result stays authoritative — no validity is decided here.
 */
function translateMilestoneError(error: unknown): FieldErrors {
  const message = error instanceof Error
    ? error.message
    : 'The Milestone could not be saved. Your entries are unchanged.';
  if (/milestone title must not be blank/i.test(message)) {
    return { title: 'Enter a title for this Milestone.' };
  }
  if (/must name at least one goal/i.test(message)) {
    return { goals: 'Select at least one Goal.' };
  }
  if (/already actively assigned/i.test(message)) {
    return { goals: 'A selected Goal is already assigned to another Milestone.' };
  }
  if (/not a descendant of the pursued root goal/i.test(message)) {
    return { goals: 'A selected Goal is no longer inside the pursued hierarchy.' };
  }
  return { form: message };
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginBottom: spacing.md,
  },
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
