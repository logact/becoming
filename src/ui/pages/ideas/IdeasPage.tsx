import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CaptureIdeaService } from '../../../application/idea/CaptureIdeaService';
import type { CreateGoalFromIdeaService } from '../../../application/idea/CreateGoalFromIdeaService';
import type { CreateTaskFromIdeaService } from '../../../application/idea/CreateTaskFromIdeaService';
import type { IdeaDerivationOptionsService } from '../../../application/idea/IdeaDerivationOptionsService';
import type {
  IdeaListItem,
  IdeasOverviewService,
  IdeasOverviewView,
} from '../../../application/idea/IdeasOverviewService';
import type { ExtractNoteFromIdeaService } from '../../../application/note/ExtractNoteFromIdeaService';
import type { IdeaStatus } from '../../../domain/idea/Idea';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { useCaptureRevision } from '../../navigation/CaptureRevision';
import { createId } from '../../shared/id';
import { colors, radii, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';
import { CreateFromIdeaSheet } from './CreateFromIdeaSheet';

type Segment = 'open' | 'handled';

const STATUS: Record<IdeaStatus, { state: StatusState; label: string }> = {
  captured: { state: 'captured', label: 'Captured' },
  exploring: { state: 'exploring', label: 'Exploring' },
  paused: { state: 'paused', label: 'Paused' },
  handled: { state: 'done', label: 'Handled' },
};

export interface IdeasPageProps {
  overview: Pick<IdeasOverviewService, 'getOverview'>;
  capture: Pick<CaptureIdeaService, 'capture'>;
  derivationOptions: Pick<IdeaDerivationOptionsService, 'getOptions'>;
  createGoal: Pick<CreateGoalFromIdeaService, 'create'>;
  createTask: Pick<CreateTaskFromIdeaService, 'create'>;
  extractNote: Pick<ExtractNoteFromIdeaService, 'extract'>;
}

function ideaTitle(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? '';
  return firstLine.length > 68 ? `${firstLine.slice(0, 65)}…` : firstLine;
}

/** Ideas workflow overview with capture, status groups, derivation quick actions and activity. */
export function IdeasPage({
  overview,
  capture,
  derivationOptions,
  createGoal,
  createTask,
  extractNote,
}: IdeasPageProps) {
  const navigation = useShellNavigation();
  const captureRevision = useCaptureRevision();
  const [loaded, setLoaded] = useState<{ view: IdeasOverviewView; now: Date } | null>(null);
  const [segment, setSegment] = useState<Segment>('open');
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

  useEffect(() => { void refresh(); }, [refresh, captureRevision]);

  const submitCapture = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setCaptureError(null);
    try {
      await capture.capture({
        ideaId: createId(), content, recordId: createId(), recordRelationId: createId(), now: new Date(),
      });
      setContent('');
      setSegment('open');
      await refresh();
    } catch (cause: unknown) {
      setCaptureError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (loaded === null) {
    return (
      <View testID="ideas-page" style={styles.screen}>
        <InlineNavBar title="Ideas" onBack={navigation.goBack} />
        {loadError === null ? null : <SectionNote>Could not load ideas: {loadError}</SectionNote>}
      </View>
    );
  }

  const { view, now } = loaded;
  const openDerivation = (idea: IdeaListItem): void => {
    navigation.presentSheet(
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
      />,
    );
  };

  const row = (idea: IdeaListItem) => {
    const status = STATUS[idea.status];
    return (
      <ListRow
        key={idea.id}
        testID={`idea-row-${idea.id}`}
        icon="bulb"
        title={ideaTitle(idea.content)}
        subtitle={`Updated ${relativeTime(idea.updatedAt, now)}`}
        trailing={
          <View style={styles.trailing}>
            <StatusPill state={status.state} label={status.label} />
            <Pressable
              testID={`idea-quick-create-${idea.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Create from ${ideaTitle(idea.content)}`}
              onPress={() => openDerivation(idea)}
              style={({ pressed }) => [styles.quickCreate, pressed && styles.pressed]}
            >
              <Icon name="plus" size={14} />
            </Pressable>
          </View>
        }
        onPress={() => navigation.pushScreen(`idea:${idea.id}`)}
      />
    );
  };

  const group = (testID: string, title: string, items: IdeaListItem[]) => (
    <View testID={testID}>
      <SectionHeader title={title} />
      <ListSection variant="panel">{items.map(row)}</ListSection>
      {items.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
    </View>
  );

  return (
    <ScrollView testID="ideas-page" style={styles.screen} keyboardShouldPersistTaps="handled">
      <InlineNavBar title="Ideas" onBack={navigation.goBack} />
      <View testID="idea-capture-panel" style={styles.capturePanel}>
        <TextInput
          testID="idea-capture-input"
          value={content}
          onChangeText={setContent}
          placeholder="Capture an idea…"
          placeholderTextColor={colors.faint}
          multiline
          style={styles.captureInput}
        />
        <Pressable
          testID="idea-capture-submit"
          disabled={submitting}
          onPress={() => { void submitCapture(); }}
          style={({ pressed }) => [styles.captureButton, submitting && styles.disabled, pressed && styles.pressed]}
        >
          <Icon name="arrowUpRight" size={17} color={colors.primaryTextOnGreen} />
        </Pressable>
      </View>
      {captureError === null ? null : <Text testID="idea-capture-error" style={styles.error}>{captureError}</Text>}

      <SegmentedControl<Segment>
        testID="ideas-segmented"
        options={[
          { key: 'open', label: `Open · ${view.counts.open}` },
          { key: 'handled', label: `Handled · ${view.counts.handled}` },
        ]}
        selected={segment}
        onSelect={setSegment}
      />

      {segment === 'open' ? (
        <>
          {group('idea-group-captured', 'To process', view.open.captured)}
          {group('idea-group-exploring', 'Exploring', view.open.exploring)}
          {group('idea-group-paused', 'Paused', view.open.paused)}
        </>
      ) : group('idea-group-handled', 'Handled', view.handled)}

      <View testID="idea-activity-section" style={styles.lastSection}>
        <SectionHeader title="Recent activity" />
        <ListSection variant="panel">
          {view.recentActivity.map((item) => (
            <ListRow key={item.id} icon={activityIcon(item.kind)} title={item.detail ?? item.kind} trailing={<Text style={styles.meta}>{relativeTime(item.occurredAt, now)}</Text>} />
          ))}
        </ListSection>
        {view.recentActivity.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  capturePanel: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radii.panel, marginHorizontal: spacing.screenMargin, padding: 14 },
  captureInput: { flex: 1, minHeight: 42, maxHeight: 100, color: colors.ink, fontSize: 15, textAlignVertical: 'top' },
  captureButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  quickCreate: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  error: { color: colors.conflictRed, fontSize: 12.5, marginHorizontal: spacing.screenMargin, marginTop: 7 },
  meta: { fontSize: 12.5, color: colors.faint },
  lastSection: { paddingBottom: spacing.sectionTop },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.4 },
});
