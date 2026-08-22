import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CaptureNoteService } from '../../../application/note/CaptureNoteService';
import type {
  NoteListItem,
  NotesOverviewService,
  NotesOverviewView,
} from '../../../application/note/NotesOverviewService';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { createId } from '../../shared/id';
import { colors, radii, spacing } from '../../shared/theme';
import { relativeTime } from '../dashboard/format';

type Segment = 'active' | 'archived';

export interface NotesPageProps {
  overview: Pick<NotesOverviewService, 'getOverview'>;
  capture: Pick<CaptureNoteService, 'capture'>;
}

function noteTitle(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? '';
  return firstLine.length > 68 ? `${firstLine.slice(0, 65)}…` : firstLine;
}

/** Notes overview with quick capture and active/archived organization. */
export function NotesPage({ overview, capture }: NotesPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ view: NotesOverviewView; now: Date } | null>(null);
  const [segment, setSegment] = useState<Segment>('active');
  const [content, setContent] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      setLoaded({ view: await overview.getOverview(), now });
      setLoadError(null);
    } catch (cause: unknown) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [overview]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submitCapture = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setCaptureError(null);
    try {
      await capture.capture({
        noteId: createId(), content, recordId: createId(), recordRelationId: createId(), now: new Date(),
      });
      setContent('');
      setSegment('active');
      await refresh();
    } catch (cause: unknown) {
      setCaptureError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (loaded === null) {
    return (
      <View testID="notes-page" style={styles.screen}>
        <InlineNavBar title="Notes" onBack={navigation.goBack} />
        {loadError === null ? null : <SectionNote>Could not load notes: {loadError}</SectionNote>}
      </View>
    );
  }

  const { view, now } = loaded;
  const row = (note: NoteListItem, archived = false) => {
    const labels = note.labels.map((label) => label.name).join(', ');
    const pinned = note.pinnedAt !== null && !archived;
    const time = pinned
      ? `Pinned ${relativeTime(note.pinnedAt, now)}`
      : `${archived ? 'Archived' : 'Updated'} ${relativeTime(note.updatedAt, now)}`;
    return (
      <View key={note.id} style={archived ? styles.archived : undefined}>
        <ListRow
          testID={`note-row-${note.id}`}
          icon={archived ? 'archive' : 'doc'}
          title={noteTitle(note.content)}
          subtitle={labels.length === 0 ? time : `${labels} · ${time}`}
          trailing={(
            <View style={styles.rowTrailing}>
              {pinned ? (
                <View testID={`note-pin-marker-${note.id}`}>
                  <Icon name="pin" size={12} color={colors.sage} />
                </View>
              ) : null}
              <Icon name="chevron" size={12} color={colors.chevron} />
            </View>
          )}
          onPress={() => navigation.pushScreen(`note:${note.id}`)}
        />
      </View>
    );
  };
  const group = (testID: string, title: string, items: NoteListItem[], archived = false) => (
    <View testID={testID}>
      <SectionHeader title={title} />
      <ListSection variant="panel">{items.map((note) => row(note, archived))}</ListSection>
      {items.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
    </View>
  );

  return (
    <ScrollView testID="notes-page" style={styles.screen} keyboardShouldPersistTaps="handled">
      <InlineNavBar title="Notes" onBack={navigation.goBack} />
      <View testID="note-capture-panel" style={styles.capturePanel}>
        <TextInput
          testID="note-capture-input"
          value={content}
          onChangeText={setContent}
          placeholder="Extract a thought…"
          placeholderTextColor={colors.faint}
          multiline
          style={styles.captureInput}
        />
        <Pressable
          testID="note-capture-submit"
          disabled={submitting}
          onPress={() => { void submitCapture(); }}
          style={({ pressed }) => [styles.captureButton, submitting && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.captureButtonText}>Add</Text>
        </Pressable>
      </View>
      {captureError === null ? null : <Text testID="note-capture-error" style={styles.error}>{captureError}</Text>}

      <SegmentedControl<Segment>
        testID="notes-segmented"
        options={[
          { key: 'active', label: `Active · ${view.counts.active}` },
          { key: 'archived', label: `Archived · ${view.counts.archived}` },
        ]}
        selected={segment}
        onSelect={setSegment}
      />

      {segment === 'active' ? (
        <>
          {group('note-group-pinned', 'Pinned', view.pinned)}
          {group('note-group-active', 'All notes', view.active)}
          <SectionNote>Pinned notes stay on top; everything else sorts by last update.</SectionNote>
        </>
      ) : (
        <>
          {group('note-group-archived', 'Archived', view.archived, true)}
          <SectionNote>Archive keeps labels and links; archived notes ignore pinning.</SectionNote>
        </>
      )}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  capturePanel: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radii.panel, marginHorizontal: spacing.screenMargin, padding: 14 },
  captureInput: { flex: 1, minHeight: 38, maxHeight: 100, color: colors.ink, fontSize: 15, textAlignVertical: 'top' },
  captureButton: { borderRadius: radii.pill, paddingVertical: 8, paddingHorizontal: 15, backgroundColor: colors.green },
  captureButtonText: { color: colors.primaryTextOnGreen, fontSize: 12.5, fontWeight: '700' },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  archived: { opacity: 0.62 },
  error: { color: colors.conflictRed, fontSize: 12.5, marginHorizontal: spacing.screenMargin, marginTop: 7 },
  bottomSpace: { height: spacing.sectionTop },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.4 },
});
