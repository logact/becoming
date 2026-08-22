import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ArchiveNoteService } from '../../../application/note/ArchiveNoteService';
import type { DeleteNoteService } from '../../../application/note/DeleteNoteService';
import type { EditNoteService } from '../../../application/note/EditNoteService';
import type { LinkNoteService } from '../../../application/note/LinkNoteService';
import type { NoteDetailService, NoteDetailView, NoteLink } from '../../../application/note/NoteDetailService';
import type { NoteLinkOption, NoteLinkOptionsService } from '../../../application/note/NoteLinkOptionsService';
import type { SetNotePinService } from '../../../application/note/SetNotePinService';
import type { NoteId } from '../../../domain/shared/ids';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { createId } from '../../shared/id';
import { useToast } from '../../shared/Toast';
import { colors, radii, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';

export interface NoteDetailPageProps {
  noteId: NoteId;
  detail: Pick<NoteDetailService, 'getDetail'>;
  edit: Pick<EditNoteService, 'edit'>;
  setPin: Pick<SetNotePinService, 'setPinned'>;
  archive: Pick<ArchiveNoteService, 'setArchived'>;
  link: Pick<LinkNoteService, 'link'>;
  linkOptions: Pick<NoteLinkOptionsService, 'getOptions'>;
  deleteNote: Pick<DeleteNoteService, 'delete'>;
}

function statusText(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Note content, source/plan links, organization controls, and activity. */
export function NoteDetailPage({
  noteId, detail, edit, setPin, archive, link, linkOptions, deleteNote,
}: NoteDetailPageProps) {
  const navigation = useShellNavigation();
  const toast = useToast();
  const [loaded, setLoaded] = useState<{ view: NoteDetailView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      setLoaded({ view: await detail.getDetail(noteId), now });
      setLoadError(null);
    } catch (cause: unknown) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [detail, noteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loaded === null) {
    return (
      <View testID="note-detail-page" style={styles.screen}>
        <InlineNavBar title="Note" onBack={navigation.goBack} />
        {loadError === null ? null : <SectionNote>Could not load note: {loadError}</SectionNote>}
      </View>
    );
  }
  if (loaded.view.note === null) {
    return (
      <View testID="note-detail-page" style={styles.screen}>
        <InlineNavBar title="Note" onBack={navigation.goBack} />
        <SectionNote>Unknown note.</SectionNote>
      </View>
    );
  }

  const { view, now } = loaded;
  const { note } = view;
  const runAction = async (work: () => Promise<void>, message: string): Promise<void> => {
    setActionError(null);
    try {
      await work();
      toast.show(message);
      await refresh();
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const presentEdit = (): void => navigation.presentSheet(
    <EditNoteSheet
      content={note.content}
      onSave={async (content) => {
        await edit.edit({ noteId, content, recordId: createId(), recordRelationId: createId(), now: new Date() });
        navigation.dismissSheet();
        toast.show('Note updated.');
        await refresh();
      }}
    />,
  );
  const presentLinkPicker = (): void => navigation.presentSheet(
    <NoteLinkPickerSheet
      options={linkOptions}
      onSelect={async (option) => {
        await link.link({
          noteId,
          relationId: createId(),
          targetType: option.type,
          targetId: option.id,
          recordId: createId(),
          recordRelationId: createId(),
          now: new Date(),
        });
        navigation.dismissSheet();
        toast.show(`Linked ${option.type}.`);
        await refresh();
      }}
    />,
  );
  const presentDelete = (): void => navigation.presentSheet(
    <DeleteNoteSheet
      onConfirm={async () => {
        await deleteNote.delete(noteId);
        navigation.dismissSheet();
        navigation.goBack();
      }}
    />,
  );
  const openLink = (item: NoteLink): void => {
    if (item.type === 'goal') navigation.openDetail(item.id);
    else navigation.pushScreen(`project:${item.id}`);
  };

  return (
    <View testID="note-detail-page" style={styles.screen}>
      <InlineNavBar
        title="Note"
        onBack={navigation.goBack}
        right={
          <Pressable testID="note-edit-open" accessibilityLabel="Edit note" onPress={presentEdit} style={styles.navButton}>
            <Icon name="pencil" size={17} />
          </Pressable>
        }
      />
      <ScrollView>
        <View testID="note-detail-header" style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.largeIcon}><Icon name="doc" size={24} /></View>
            {note.archived ? null : (
              <Pressable
                testID="note-pin-toggle"
                accessibilityLabel={note.pinnedAt === null ? 'Pin note' : 'Unpin note'}
                onPress={() => { void runAction(
                  () => setPin.setPinned({
                    noteId, pinned: note.pinnedAt === null, recordId: createId(), recordRelationId: createId(), now: new Date(),
                  }),
                  note.pinnedAt === null ? 'Note pinned.' : 'Note unpinned.',
                ); }}
                style={[styles.pinButton, note.pinnedAt !== null && styles.pinButtonActive]}
              >
                <Icon name="pin" size={16} color={note.pinnedAt === null ? colors.muted : colors.primaryTextOnGreen} />
              </Pressable>
            )}
          </View>
          <Text style={styles.content}>{note.content}</Text>
          <Text style={styles.meta}>Updated {relativeTime(note.updatedAt, now)}</Text>
          {view.labels.length === 0 ? null : (
            <View testID="note-labels" style={styles.labels}>
              {view.labels.map((label) => <Text key={label.id} style={styles.label}>{label.name}</Text>)}
            </View>
          )}
        </View>
        {actionError === null ? null : <Text testID="note-action-error" style={styles.error}>{actionError}</Text>}

        <View testID="note-linked-section">
          <SectionHeader title="Linked" />
          <ListSection variant="panel">
            {view.source === null ? null : (
              <ListRow
                testID={`note-source-idea-${view.source.ideaId}`}
                icon="bulb"
                title={view.source.content}
                subtitle="Idea · source, extracted from"
                trailing={<Icon name="chevron" size={12} color={colors.chevron} />}
                onPress={() => navigation.pushScreen(`idea:${view.source?.ideaId ?? ''}`)}
              />
            )}
            {view.links.map((item) => (
              <ListRow
                key={`${item.type}-${item.id}`}
                testID={`note-link-${item.type}-${item.id}`}
                icon={item.type === 'goal' ? 'target' : 'box'}
                title={item.title}
                subtitle={`${statusText(item.type)} · ${statusText(item.status)}`}
                trailing={<Icon name="chevron" size={12} color={colors.chevron} />}
                onPress={() => openLink(item)}
              />
            ))}
            {note.archived ? null : (
              <ListRow
                testID="note-link-add"
                icon="plus"
                title="Link a goal or project"
                titleStyle={styles.linkTitle}
                onPress={presentLinkPicker}
              />
            )}
          </ListSection>
          {view.source === null && view.links.length === 0 && note.archived
            ? <SectionNote>Nothing linked.</SectionNote> : null}
          <SectionNote>Links connect this note to its source and the plans it supports.</SectionNote>
        </View>

        <View testID="note-actions-section">
          <SectionHeader title="Actions" />
          <ListSection variant="panel">
            <ListRow
              testID="note-archive-toggle"
              icon="archive"
              title={note.archived ? 'Unarchive note' : 'Archive note'}
              subtitle="Labels and links stay intact"
              onPress={() => { void runAction(
                () => archive.setArchived({
                  noteId, archived: !note.archived, recordId: createId(), recordRelationId: createId(), now: new Date(),
                }),
                note.archived ? 'Note restored.' : 'Note archived.',
              ); }}
            />
            <ListRow testID="note-delete-open" icon="minus" title="Delete note" titleStyle={styles.dangerText} onPress={presentDelete} />
          </ListSection>
        </View>

        <View testID="note-activity-section" style={styles.lastSection}>
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

function EditNoteSheet({ content, onSave }: { content: string; onSave: (content: string) => Promise<void> }) {
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
    <View testID="note-edit-sheet">
      <Text style={sheetStyles.title}>Edit note</Text>
      <TextInput testID="note-edit-input" value={value} onChangeText={setValue} multiline style={sheetStyles.input} />
      {error === null ? null : <Text testID="note-edit-error" style={sheetStyles.error}>{error}</Text>}
      <View style={sheetStyles.actions}>
        <PrimaryChipButton label="Cancel" variant="ghost" onPress={navigation.dismissSheet} />
        <PrimaryChipButton testID="note-edit-submit" label="Save" disabled={submitting} onPress={() => { void submit(); }} />
      </View>
    </View>
  );
}

function NoteLinkPickerSheet({
  options, onSelect,
}: {
  options: Pick<NoteLinkOptionsService, 'getOptions'>;
  onSelect: (option: NoteLinkOption) => Promise<void>;
}) {
  const navigation = useShellNavigation();
  const [items, setItems] = useState<NoteLinkOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let active = true;
    options.getOptions().then((next) => { if (active) setItems(next); }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [options]);
  const select = async (item: NoteLinkOption): Promise<void> => {
    if (submitting) return;
    setSubmitting(true); setError(null);
    try { await onSelect(item); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSubmitting(false); }
  };
  return (
    <View testID="note-link-picker">
      <Text style={sheetStyles.title}>Link a goal or project</Text>
      {items === null && error === null ? <Text style={sheetStyles.note}>Loading…</Text> : null}
      {items?.map((item) => (
        <Pressable key={`${item.type}-${item.id}`} testID={`note-link-option-${item.type}-${item.id}`} disabled={submitting} onPress={() => { void select(item); }} style={sheetStyles.option}>
          <Icon name={item.type === 'goal' ? 'target' : 'box'} size={17} />
          <View style={sheetStyles.optionText}>
            <Text style={sheetStyles.optionTitle}>{item.title}</Text>
            <Text style={sheetStyles.note}>{statusText(item.type)} · {statusText(item.status)}</Text>
          </View>
        </Pressable>
      ))}
      {items?.length === 0 ? <Text style={sheetStyles.note}>No active goals or projects.</Text> : null}
      {error === null ? null : <Text testID="note-link-error" style={sheetStyles.error}>{error}</Text>}
      <View style={sheetStyles.actions}><PrimaryChipButton label="Cancel" variant="ghost" onPress={navigation.dismissSheet} /></View>
    </View>
  );
}

function DeleteNoteSheet({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const navigation = useShellNavigation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirm = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true); setError(null);
    try { await onConfirm(); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)); setSubmitting(false); }
  };
  return (
    <View testID="note-delete-confirmation">
      <Text style={sheetStyles.title}>Delete this note?</Text>
      <Text style={sheetStyles.note}>This cannot be undone.</Text>
      {error === null ? null : <Text testID="note-delete-error" style={sheetStyles.error}>{error}</Text>}
      <View style={sheetStyles.actions}>
        <PrimaryChipButton label="Cancel" variant="ghost" onPress={navigation.dismissSheet} />
        <PrimaryChipButton testID="note-delete-confirm" label="Delete" variant="danger" disabled={submitting} onPress={() => { void confirm(); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  navButton: { padding: 8 },
  header: { marginHorizontal: spacing.screenMargin, padding: 20, borderRadius: radii.panel, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  largeIcon: { width: 48, height: 48, borderRadius: radii.chipLg, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  pinButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  pinButtonActive: { backgroundColor: colors.green },
  content: { marginTop: 15, fontSize: 19, lineHeight: 27, fontWeight: '700', color: colors.ink },
  meta: { marginTop: 7, fontSize: 12.5, color: colors.faint },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  label: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.mint, color: colors.green, fontSize: 11.5, fontWeight: '700' },
  linkTitle: { color: colors.green },
  dangerText: { color: colors.conflictRed },
  error: { color: colors.conflictRed, fontSize: 12.5, marginHorizontal: spacing.screenMargin, marginTop: 8 },
  lastSection: { paddingBottom: spacing.sectionTop },
});

const sheetStyles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  input: { minHeight: 100, maxHeight: 220, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  error: { color: colors.conflictRed, fontSize: 12.5, marginTop: 8 },
  note: { color: colors.muted, fontSize: 13 },
  option: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 12 },
  optionText: { flex: 1, marginLeft: 11 },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
});
