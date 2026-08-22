import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ChangeIdeaStatusService } from '../../../application/idea/ChangeIdeaStatusService';
import type { CreateGoalFromIdeaService } from '../../../application/idea/CreateGoalFromIdeaService';
import type { CreateTaskFromIdeaService } from '../../../application/idea/CreateTaskFromIdeaService';
import type { EditIdeaService } from '../../../application/idea/EditIdeaService';
import type { IdeaDerivationOptionsService } from '../../../application/idea/IdeaDerivationOptionsService';
import type { IdeaDetailService, IdeaDetailView } from '../../../application/idea/IdeaDetailService';
import type { ExtractNoteFromIdeaService } from '../../../application/note/ExtractNoteFromIdeaService';
import type { IdeaStatus } from '../../../domain/idea/Idea';
import type { IdeaId } from '../../../domain/shared/ids';
import { Icon, type IconName } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { createId } from '../../shared/id';
import { useToast } from '../../shared/Toast';
import { colors, radii, serif, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';
import { CreateFromIdeaSheet } from './CreateFromIdeaSheet';

const STATUS: Record<IdeaStatus, { state: StatusState; label: string }> = {
  captured: { state: 'captured', label: 'Captured' },
  exploring: { state: 'exploring', label: 'Exploring' },
  paused: { state: 'paused', label: 'Paused' },
  handled: { state: 'done', label: 'Handled' },
};
const STATUS_ORDER: IdeaStatus[] = ['captured', 'exploring', 'paused', 'handled'];

export interface IdeaDetailPageProps {
  ideaId: IdeaId;
  detail: Pick<IdeaDetailService, 'getDetail'>;
  edit: Pick<EditIdeaService, 'edit'>;
  changeStatus: Pick<ChangeIdeaStatusService, 'change'>;
  derivationOptions: Pick<IdeaDerivationOptionsService, 'getOptions'>;
  createGoal: Pick<CreateGoalFromIdeaService, 'create'>;
  createTask: Pick<CreateTaskFromIdeaService, 'create'>;
  extractNote: Pick<ExtractNoteFromIdeaService, 'extract'>;
}

/** Idea detail with direct status/edit controls and all three derivation paths. */
export function IdeaDetailPage({
  ideaId,
  detail,
  edit,
  changeStatus,
  derivationOptions,
  createGoal,
  createTask,
  extractNote,
}: IdeaDetailPageProps) {
  const navigation = useShellNavigation();
  const toast = useToast();
  const [loaded, setLoaded] = useState<{ view: IdeaDetailView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      setLoaded({ view: await detail.getDetail(ideaId), now });
      setLoadError(null);
    } catch (cause: unknown) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [detail, ideaId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loaded === null) {
    return (
      <View testID="idea-detail-page" style={styles.screen}>
        <InlineNavBar title="Idea" onBack={navigation.goBack} />
        {loadError === null ? null : <SectionNote>Could not load idea: {loadError}</SectionNote>}
      </View>
    );
  }
  if (loaded.view.idea === null) {
    return (
      <View testID="idea-detail-page" style={styles.screen}>
        <InlineNavBar title="Idea" onBack={navigation.goBack} />
        <SectionNote>Unknown idea.</SectionNote>
      </View>
    );
  }

  const { view, now } = loaded;
  const { idea } = view;
  const status = STATUS[idea.status];

  const presentEdit = (): void => navigation.presentSheet(
    <EditIdeaSheet
      content={idea.content}
      onSave={async (content) => {
        await edit.edit({ ideaId, content, recordId: createId(), recordRelationId: createId(), now: new Date() });
        navigation.dismissSheet();
        toast.show('Idea updated.');
        await refresh();
      }}
    />,
  );
  const presentStatus = (): void => navigation.presentSheet(
    <IdeaStatusSheet
      selected={idea.status}
      onSelect={async (next) => {
        await changeStatus.change({ ideaId, status: next, recordId: createId(), recordRelationId: createId(), now: new Date() });
        navigation.dismissSheet();
        toast.show(`Idea marked ${STATUS[next].label.toLowerCase()}.`);
        await refresh();
      }}
    />,
  );
  const presentCreate = (initialType?: 'goal' | 'task' | 'note'): void => navigation.presentSheet(
    <CreateFromIdeaSheet
      ideaId={idea.id}
      content={idea.content}
      options={derivationOptions}
      createGoal={createGoal}
      createTask={createTask}
      extractNote={extractNote}
      onCreated={async (result) => {
        await refresh();
        if (result.type === 'note') navigation.pushScreen(`note:${result.id}`);
      }}
      {...(initialType === undefined ? {} : { initialType })}
    />,
  );

  const openDerived = (type: 'goal' | 'task' | 'note', id: string): void => {
    if (type === 'goal') navigation.openDetail(id);
    else navigation.pushScreen(`${type}:${id}`);
  };
  const derivedIcon: Record<'goal' | 'task' | 'note', IconName> = {
    goal: 'target', task: 'checkCircle', note: 'doc',
  };

  return (
    <View testID="idea-detail-page" style={styles.screen}>
      <InlineNavBar
        title="Idea"
        onBack={navigation.goBack}
        right={
          <Pressable testID="idea-edit-open" accessibilityLabel="Edit idea" onPress={presentEdit} style={styles.navButton}>
            <Icon name="pencil" size={17} />
          </Pressable>
        }
      />
      <ScrollView>
        <View testID="idea-detail-header" style={styles.header}>
          <Text style={styles.content}>{idea.content}</Text>
          <View style={styles.metaRow}>
            <Pressable testID="idea-status-open" onPress={presentStatus} style={({ pressed }) => [styles.statusButton, pressed && styles.pressed]}>
              <StatusPill state={status.state} label={status.label} />
              <Icon name="pencil" size={12} color={colors.muted} />
            </Pressable>
            <Text style={styles.meta}>Updated {relativeTime(idea.updatedAt, now)}</Text>
          </View>
          {view.labels.length === 0 ? null : (
            <View testID="idea-labels" style={styles.labels}>
              {view.labels.map((label) => <Text key={label.id} style={styles.label}>{label.name}</Text>)}
            </View>
          )}
        </View>

        <View testID="idea-create-section">
          <SectionHeader title="Create from this idea" />
          <View style={styles.createButtons}>
            <PrimaryChipButton testID="idea-create-goal" label="Goal" onPress={() => presentCreate('goal')} />
            <PrimaryChipButton testID="idea-create-task" label="Task" variant="ghost" onPress={() => presentCreate('task')} />
            <PrimaryChipButton testID="idea-create-note" label="Note" variant="ghost" onPress={() => presentCreate('note')} />
          </View>
        </View>

        <View testID="idea-derived-section">
          <SectionHeader title="Created from this idea" />
          <ListSection variant="panel">
            {view.derivedItems.map((item) => (
              <ListRow
                key={`${item.type}-${item.id}`}
                testID={`idea-derived-${item.type}-${item.id}`}
                icon={derivedIcon[item.type]}
                title={item.title}
                subtitle={item.type === 'task' ? `${item.context} · Task` : item.type === 'goal' ? 'Goal' : 'Note'}
                trailing={<Icon name="chevron" size={12} color={colors.chevron} />}
                onPress={() => openDerived(item.type, item.id)}
              />
            ))}
          </ListSection>
          {view.derivedItems.length === 0 ? <SectionNote>Nothing created yet.</SectionNote> : null}
        </View>

        <View testID="idea-detail-activity" style={styles.lastSection}>
          <SectionHeader title="Recent activity" />
          <ListSection variant="panel">
            {view.recentActivity.map((item) => (
              <ListRow key={item.id} icon={activityIcon(item.kind)} title={item.detail ?? item.kind} trailing={<Text style={styles.meta}>{relativeTime(item.occurredAt, now)}</Text>} />
            ))}
          </ListSection>
          {view.recentActivity.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function EditIdeaSheet({ content, onSave }: { content: string; onSave: (content: string) => Promise<void> }) {
  const navigation = useShellNavigation();
  const [value, setValue] = useState(content);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true); setError(null);
    try { await onSave(value); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSubmitting(false); }
  };
  return (
    <View testID="idea-edit-sheet">
      <Text style={sheetStyles.title}>Edit idea</Text>
      <TextInput testID="idea-edit-input" value={value} onChangeText={setValue} multiline style={sheetStyles.input} />
      {error === null ? null : <Text testID="idea-edit-error" style={sheetStyles.error}>{error}</Text>}
      <View style={sheetStyles.actions}>
        <PrimaryChipButton label="Cancel" variant="ghost" onPress={navigation.dismissSheet} />
        <PrimaryChipButton testID="idea-edit-submit" label="Save" disabled={submitting} onPress={() => { void submit(); }} />
      </View>
    </View>
  );
}

function IdeaStatusSheet({ selected, onSelect }: { selected: IdeaStatus; onSelect: (status: IdeaStatus) => Promise<void> }) {
  const navigation = useShellNavigation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async (status: IdeaStatus): Promise<void> => {
    if (submitting) return;
    setSubmitting(true); setError(null);
    try { await onSelect(status); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)); setSubmitting(false); }
  };
  return (
    <View testID="idea-status-sheet">
      <Text style={sheetStyles.title}>Idea status</Text>
      {STATUS_ORDER.map((status) => (
        <Pressable key={status} testID={`idea-status-${status}`} disabled={submitting} onPress={() => { void choose(status); }} style={({ pressed }) => [sheetStyles.statusRow, pressed && styles.pressed]}>
          <StatusPill state={STATUS[status].state} label={STATUS[status].label} />
          {status === selected ? <Icon name="check" size={15} color={colors.sage} /> : null}
        </Pressable>
      ))}
      {error === null ? null : <Text testID="idea-status-error" style={sheetStyles.error}>{error}</Text>}
      <PrimaryChipButton label="Cancel" variant="ghost" onPress={navigation.dismissSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  header: { marginHorizontal: spacing.screenMargin, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radii.panel, padding: 18 },
  content: { fontFamily: serif, fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  statusButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: colors.faint, fontSize: 12.5 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  label: { color: colors.green, backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11.5, fontWeight: '700' },
  createButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginHorizontal: spacing.screenMargin },
  lastSection: { paddingBottom: spacing.sectionTop },
  pressed: { opacity: 0.5 },
});

const sheetStyles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, textAlign: 'center', marginBottom: 12 },
  input: { minHeight: 110, color: colors.ink, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radii.panel, padding: 14, textAlignVertical: 'top', fontSize: 15 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  error: { color: colors.conflictRed, fontSize: 12.5, marginVertical: 8 },
  statusRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 9, paddingHorizontal: 4 },
});
