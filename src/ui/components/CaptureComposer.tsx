import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CaptureProjectOption } from '../../application/capture/CaptureOptionsService';
import { colors, radii, spacing } from '../shared/theme';

export type CaptureIntent = 'inbox' | 'idea' | 'task' | 'goal' | 'note';

export type CaptureComposerSubmission =
  | { intent: Exclude<CaptureIntent, 'task'>; content: string }
  | { intent: 'task'; content: string; projectId: string };

export interface CaptureComposerProps {
  visible: boolean;
  onDismiss: () => void;
  options: CaptureProjectOption[];
  optionsLoading?: boolean;
  optionsError?: string | null;
  onSubmit: (submission: CaptureComposerSubmission) => Promise<void>;
  onRequestProjectPicker?: (
    selectedProjectId: string | null,
    onSelect: (projectId: string) => void,
  ) => void;
}

const INTENTS: Array<{ intent: CaptureIntent; label: string }> = [
  { intent: 'inbox', label: 'Decide later' },
  { intent: 'idea', label: 'Idea' },
  { intent: 'task', label: 'Task' },
  { intent: 'goal', label: 'Goal' },
  { intent: 'note', label: 'Note' },
];

const COPY: Record<CaptureIntent, { placeholder: string; submit: string; hint: string }> = {
  inbox: { placeholder: 'What is on your mind?', submit: 'Save to inbox', hint: 'Sort it out later in Ideas.' },
  idea: { placeholder: 'Capture an idea…', submit: 'Capture idea', hint: 'Save it to Ideas for exploration.' },
  task: { placeholder: 'What needs doing?', submit: 'Create task', hint: 'Tasks need a Project.' },
  goal: { placeholder: 'What do you want to achieve?', submit: 'Create goal', hint: 'Creates a top-level Goal.' },
  note: { placeholder: 'Write a durable note…', submit: 'Save note', hint: 'You can organize it later.' },
};

/** Shell-level, controlled capture surface with local draft state. */
export function CaptureComposer({
  visible,
  onDismiss,
  options,
  optionsLoading = false,
  optionsError = null,
  onSubmit,
  onRequestProjectPicker,
}: CaptureComposerProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const previousVisible = useRef(visible);
  const [intent, setIntent] = useState<CaptureIntent>('inbox');
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setIntent('inbox');
    setContent('');
    setProjectId(null);
    setSubmitting(false);
    setError(null);
  };

  useEffect(() => {
    const wasVisible = previousVisible.current;
    previousVisible.current = visible;
    if (!visible) return;
    if (!wasVisible) reset();
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (intent !== 'task' || options.length === 0) return;
    if (projectId === null || !options.some((option) => option.id === projectId)) {
      setProjectId(options[0]?.id ?? null);
    }
  }, [intent, options, projectId]);

  if (!visible) return null;

  const selectedProject = options.find((option) => option.id === projectId);
  const taskUnavailable = intent === 'task' && (
    optionsLoading || optionsError !== null || selectedProject === undefined
  );
  const disabled = content.trim().length === 0 || submitting || taskUnavailable;

  const dismiss = (): void => {
    if (submitting) return;
    reset();
    onDismiss();
  };

  const submit = async (): Promise<void> => {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      if (intent === 'task') {
        if (selectedProject === undefined) return;
        await onSubmit({ intent, content, projectId: selectedProject.id });
      } else {
        await onSubmit({ intent, content });
      }
      reset();
      onDismiss();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSubmitting(false);
    }
  };

  return (
    <View testID="capture-composer-overlay" style={styles.overlay}>
      <Pressable
        testID="capture-composer-backdrop"
        accessibilityLabel="Close capture"
        accessibilityRole="button"
        disabled={submitting}
        onPress={dismiss}
        style={styles.backdrop}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
        style={styles.keyboardLayer}
      >
        <View
          testID="capture-composer"
          accessibilityViewIsModal
          style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 14) }]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Capture</Text>
              <Text style={styles.hint}>{COPY[intent].hint}</Text>
            </View>
            <Pressable
              testID="capture-close"
              accessibilityRole="button"
              accessibilityLabel="Close capture"
              disabled={submitting}
              onPress={dismiss}
              hitSlop={10}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View accessibilityRole="radiogroup" style={styles.chips}>
            {INTENTS.map((choice) => {
              const selected = choice.intent === intent;
              return (
                <Pressable
                  key={choice.intent}
                  testID={`capture-intent-${choice.intent}`}
                  accessibilityRole="radio"
                  accessibilityLabel={choice.label}
                  accessibilityState={{ selected, disabled: submitting }}
                  disabled={submitting}
                  onPress={() => {
                    setIntent(choice.intent);
                    setError(null);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            ref={inputRef}
            testID="capture-content-input"
            accessibilityLabel="Capture content"
            value={content}
            editable={!submitting}
            onChangeText={setContent}
            placeholder={COPY[intent].placeholder}
            placeholderTextColor={colors.faint}
            multiline={intent === 'inbox' || intent === 'idea' || intent === 'note'}
            returnKeyType={intent === 'task' || intent === 'goal' ? 'done' : 'default'}
            style={styles.input}
          />

          {intent === 'task' ? (
            <View style={styles.projectBlock}>
              <Text style={styles.fieldLabel}>PROJECT · REQUIRED</Text>
              {optionsLoading ? (
                <Text testID="capture-project-loading" style={styles.projectMessage}>Loading projects…</Text>
              ) : optionsError !== null ? (
                <Text testID="capture-project-error" style={styles.error}>{optionsError}</Text>
              ) : selectedProject === undefined ? (
                <Text testID="capture-project-empty" style={styles.projectMessage}>Create a project first.</Text>
              ) : (
                <Pressable
                  testID="capture-project-picker"
                  accessibilityRole="button"
                  accessibilityLabel={`Project, ${selectedProject.name}`}
                  onPress={() => onRequestProjectPicker?.(projectId, setProjectId)}
                  style={({ pressed }) => [styles.projectPicker, pressed && styles.pressed]}
                >
                  <Text style={styles.projectName}>{selectedProject.name}</Text>
                  <Text style={styles.projectStatus}>{selectedProject.status} · Change</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {error === null ? null : <Text testID="capture-submit-error" accessibilityRole="alert" style={styles.error}>{error}</Text>}

          <Pressable
            testID="capture-submit"
            accessibilityRole="button"
            accessibilityLabel={COPY[intent].submit}
            accessibilityState={{ disabled, busy: submitting }}
            disabled={disabled}
            onPress={() => { void submit(); }}
            style={({ pressed }) => [
              styles.submit,
              disabled && styles.submitDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.submitText}>{submitting ? 'Saving…' : COPY[intent].submit}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,30,24,0.38)' },
  keyboardLayer: { flex: 1, justifyContent: 'flex-end' },
  composer: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: spacing.screenMargin,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12.5, marginTop: 3 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.muted, fontSize: 26, lineHeight: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.bg,
  },
  chipSelected: { backgroundColor: colors.mint, borderColor: colors.sage },
  chipText: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  chipTextSelected: { color: colors.green },
  input: {
    minHeight: 78,
    maxHeight: 140,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.panel,
    padding: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  projectBlock: { marginTop: 12 },
  fieldLabel: { color: colors.faint, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.7 },
  projectPicker: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
  },
  projectName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  projectStatus: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
  projectMessage: { color: colors.muted, fontSize: 13, marginTop: 8 },
  error: { color: colors.conflictRed, fontSize: 12.5, marginTop: 8 },
  submit: {
    minHeight: 46,
    marginTop: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
  },
  submitDisabled: { opacity: 0.38 },
  submitText: { color: colors.primaryTextOnGreen, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.68 },
});
