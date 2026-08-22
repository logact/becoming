import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CreateGoalFromIdeaService } from '../../../application/idea/CreateGoalFromIdeaService';
import type { CreateTaskFromIdeaService } from '../../../application/idea/CreateTaskFromIdeaService';
import type {
  IdeaDerivationOptionsService,
  IdeaDerivationProjectOption,
} from '../../../application/idea/IdeaDerivationOptionsService';
import type { ExtractNoteFromIdeaService } from '../../../application/note/ExtractNoteFromIdeaService';
import type { GoalId, IdeaId, ProjectId } from '../../../domain/shared/ids';
import { Icon, type IconName } from '../../components/Icon';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { parseDateText } from '../../shared/dateText';
import { createId } from '../../shared/id';
import { useToast } from '../../shared/Toast';
import { colors, radii } from '../../shared/theme';

type DerivationType = 'goal' | 'task' | 'note';
type Picker = 'project' | 'goal' | null;

export interface CreateFromIdeaResult {
  type: DerivationType;
  id: string;
}

export interface CreateFromIdeaSheetProps {
  ideaId: IdeaId;
  content: string;
  options: Pick<IdeaDerivationOptionsService, 'getOptions'>;
  createGoal: Pick<CreateGoalFromIdeaService, 'create'>;
  createTask: Pick<CreateTaskFromIdeaService, 'create'>;
  extractNote: Pick<ExtractNoteFromIdeaService, 'extract'>;
  onCreated: (result: CreateFromIdeaResult) => void | Promise<void>;
  /** Detail-page shortcuts can open directly on one form; list quick actions start at the chooser. */
  initialType?: DerivationType;
}

function preview(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? '';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
}

const CHOICES: Array<{ type: DerivationType; label: string; detail: string; icon: IconName }> = [
  { type: 'goal', label: 'Goal', detail: 'Turn this thought into a target', icon: 'target' },
  { type: 'task', label: 'Task', detail: 'Add an action to an existing project', icon: 'checkCircle' },
  { type: 'note', label: 'Note', detail: 'Extract a thought or method', icon: 'doc' },
];

/** Shared bottom-sheet flow used by both Ideas list quick actions and Idea detail. */
export function CreateFromIdeaSheet({
  ideaId,
  content,
  options,
  createGoal,
  createTask,
  extractNote,
  onCreated,
  initialType,
}: CreateFromIdeaSheetProps) {
  const navigation = useShellNavigation();
  const toast = useToast();
  const initialTitle = useMemo(() => preview(content), [content]);
  const [type, setType] = useState<DerivationType | null>(initialType ?? null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(content);
  const [dueText, setDueText] = useState('');
  const [noteContent, setNoteContent] = useState(content);
  const [projects, setProjects] = useState<IdeaDerivationProjectOption[]>([]);
  const [projectId, setProjectId] = useState<ProjectId | null>(null);
  const [goalId, setGoalId] = useState<GoalId | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    options.getOptions().then(
      (value) => { if (!cancelled) setProjects(value); },
      (cause: unknown) => {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : String(cause));
      },
    );
    return () => { cancelled = true; };
  }, [options]);

  const project = projects.find((candidate) => candidate.id === projectId);
  const goal = project?.goals.find((candidate) => candidate.id === goalId);

  const finish = async (result: CreateFromIdeaResult): Promise<void> => {
    navigation.dismissSheet();
    toast.show(`${result.type === 'note' ? 'Note extracted' : `${result.type === 'goal' ? 'Goal' : 'Task'} created`}.`);
    await onCreated(result);
  };

  const submit = async (): Promise<void> => {
    if (submitting || type === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      if (type === 'goal') {
        const due = dueText.trim() === '' ? undefined : parseDateText(dueText);
        if (dueText.trim() !== '' && due === null) {
          setError('Target date must match YYYY-MM-DD.');
          return;
        }
        const id = createId();
        await createGoal.create({
          ideaId, goalId: id, title, description,
          ...(due == null ? {} : { due }),
          derivedRelationId: createId(), recordId: createId(),
          ideaRecordRelationId: createId(), goalRecordRelationId: createId(), now,
        });
        await finish({ type, id });
      } else if (type === 'task') {
        if (projectId === null) {
          setError('Choose a project.');
          return;
        }
        const id = createId();
        await createTask.create({
          ideaId, taskId: id, projectId,
          ...(goalId === null ? {} : { goalId }),
          title, description, derivedRelationId: createId(), recordId: createId(),
          ideaRecordRelationId: createId(), taskRecordRelationId: createId(), now,
        });
        await finish({ type, id });
      } else {
        const id = createId();
        await extractNote.extract({
          ideaId, noteId: id, content: noteContent, derivedRelationId: createId(),
          recordId: createId(), ideaRecordRelationId: createId(),
          noteRecordRelationId: createId(), now,
        });
        await finish({ type, id });
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (picker === 'project') {
    return (
      <OptionList
        title="Project"
        options={projects.map((item) => ({ key: item.id, label: item.name }))}
        selectedKey={projectId ?? undefined}
        onBack={() => setPicker(null)}
        onSelect={(key) => { setProjectId(key); setGoalId(null); setPicker(null); }}
      />
    );
  }
  if (picker === 'goal') {
    return (
      <OptionList
        title="Goal"
        options={[
          { key: 'none', label: 'None', sublabel: 'Create the task directly in the project' },
          ...(project?.goals.map((item) => ({ key: item.id, label: item.title })) ?? []),
        ]}
        selectedKey={goalId ?? 'none'}
        onBack={() => setPicker(null)}
        onSelect={(key) => { setGoalId(key === 'none' ? null : key); setPicker(null); }}
      />
    );
  }

  return (
    <View testID="create-from-idea-sheet" style={styles.sheet}>
      <View style={styles.headingRow}>
        {type === null ? <View style={styles.headingSpacer} /> : (
          <Pressable testID="create-from-back" onPress={() => setType(null)} style={styles.iconButton}>
            <Icon name="back" size={13} />
          </Pressable>
        )}
        <Text style={styles.heading}>{type === null ? 'Create from Idea' : `Create ${type === 'note' ? 'Note' : type === 'goal' ? 'Goal' : 'Task'}`}</Text>
        <Pressable testID="create-from-cancel" onPress={navigation.dismissSheet} style={styles.iconButton}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      {type === null ? (
        <View>
          <Text style={styles.preview} numberOfLines={2}>{content}</Text>
          {CHOICES.map((choice) => (
            <Pressable
              key={choice.type}
              testID={`create-choice-${choice.type}`}
              onPress={() => setType(choice.type)}
              style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
            >
              <Icon name={choice.icon} size={20} />
              <View style={styles.choiceBody}>
                <Text style={styles.choiceTitle}>{choice.label}</Text>
                <Text style={styles.choiceDetail}>{choice.detail}</Text>
              </View>
              <Icon name="chevron" size={11} color={colors.chevron} />
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          {type === 'note' ? (
            <Field label="Content">
              <TextInput testID="create-note-content" value={noteContent} onChangeText={setNoteContent} multiline style={[styles.input, styles.multiline]} />
            </Field>
          ) : (
            <>
              <Field label="Title">
                <TextInput testID="create-derived-title" value={title} onChangeText={setTitle} style={styles.input} />
              </Field>
              <Field label="Description">
                <TextInput testID="create-derived-description" value={description} onChangeText={setDescription} multiline style={[styles.input, styles.multiline]} />
              </Field>
              {type === 'goal' ? (
                <Field label="Target date">
                  <TextInput testID="create-goal-due" value={dueText} onChangeText={setDueText} placeholder="YYYY-MM-DD · optional" placeholderTextColor={colors.faint} style={styles.input} />
                </Field>
              ) : (
                <>
                  <PickerButton testID="create-task-project" label="Project" value={project?.name ?? 'Choose a project'} onPress={() => setPicker('project')} />
                  <PickerButton testID="create-task-goal" label="Goal" value={goal?.title ?? 'None'} disabled={project === undefined} onPress={() => setPicker('goal')} />
                </>
              )}
            </>
          )}
          {loadError === null ? null : <Text style={styles.error}>Could not load project options: {loadError}</Text>}
          {error === null ? null : <Text testID="create-from-error" style={styles.error}>{error}</Text>}
          <View style={styles.submit}>
            <PrimaryChipButton testID="create-from-submit" label={type === 'note' ? 'Extract note' : `Create ${type}`} disabled={submitting} onPress={() => { void submit(); }} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function PickerButton({ testID, label, value, disabled, onPress }: {
  testID: string; label: string; value: string; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.field, styles.picker, disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.choiceBody}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.pickerValue}>{value}</Text></View>
      <Icon name="chevron" size={11} color={colors.chevron} />
    </Pressable>
  );
}

function OptionList({ title, options, selectedKey, onSelect, onBack }: {
  title: string;
  options: Array<{ key: string; label: string; sublabel?: string }>;
  selectedKey?: string;
  onSelect: (key: string) => void;
  onBack: () => void;
}) {
  return (
    <View testID={`create-${title.toLowerCase()}-options`} style={styles.sheet}>
      <View style={styles.headingRow}>
        <Pressable onPress={onBack} style={styles.iconButton}><Icon name="back" size={13} /></Pressable>
        <Text style={styles.heading}>{title}</Text><View style={styles.headingSpacer} />
      </View>
      {options.length === 0 ? <Text style={styles.empty}>No options available.</Text> : options.map((option) => (
        <Pressable key={option.key} testID={`create-option-${option.key}`} onPress={() => onSelect(option.key)} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
          <View style={styles.choiceBody}><Text style={styles.choiceTitle}>{option.label}</Text>{option.sublabel === undefined ? null : <Text style={styles.choiceDetail}>{option.sublabel}</Text>}</View>
          {option.key === selectedKey ? <Icon name="check" size={15} color={colors.sage} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: 620 },
  headingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 38, marginBottom: 8 },
  heading: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.ink },
  headingSpacer: { width: 58 },
  iconButton: { minWidth: 58, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  cancel: { color: colors.green, fontSize: 13, fontWeight: '700' },
  preview: { color: colors.muted, fontSize: 13.5, lineHeight: 19, margin: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: colors.line },
  choiceBody: { flex: 1 },
  choiceTitle: { color: colors.ink, fontSize: 15.5, fontWeight: '700' },
  choiceDetail: { color: colors.faint, fontSize: 12.5, marginTop: 2 },
  formScroll: { maxHeight: 520 },
  field: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radii.panel, padding: 13, marginTop: 9 },
  fieldLabel: { color: colors.faint, fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  input: { color: colors.ink, fontSize: 15, padding: 0 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  picker: { flexDirection: 'row', alignItems: 'center' },
  pickerValue: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  error: { color: colors.conflictRed, fontSize: 12.5, marginTop: 9 },
  submit: { alignItems: 'flex-end', marginTop: 14, marginBottom: 8 },
  empty: { textAlign: 'center', color: colors.faint, padding: 20 },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.45 },
});
