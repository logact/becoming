import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  CaptureOptions,
  CaptureProjectOption,
} from '../../application/capture/CaptureOptionsService';
import { CaptureComposer, type CaptureComposerSubmission } from '../components/CaptureComposer';
import { useOptionalAppServices } from '../composition/AppServicesProvider';
import { createId } from '../shared/id';
import { colors } from '../shared/theme';
import { useOptionalToast } from '../shared/Toast';
import { useCaptureRevisionActions } from './CaptureRevision';
import { useShellNavigation } from './NavigationShell';

export interface GlobalCaptureProps {
  visible: boolean;
  onDismiss: () => void;
}

const TOAST: Record<CaptureComposerSubmission['intent'], string> = {
  inbox: 'Saved to inbox',
  idea: 'Idea captured',
  task: 'Task created',
  goal: 'Goal created',
  note: 'Note saved',
};

/** Converts capture UI state to application commands and owns option loading. */
export function GlobalCapture({ visible, onDismiss }: GlobalCaptureProps) {
  const services = useOptionalAppServices();
  const toast = useOptionalToast();
  const navigation = useShellNavigation();
  const captureRevision = useCaptureRevisionActions();
  const [options, setOptions] = useState<CaptureOptions>({ projects: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || services?.captureOptions === undefined) return;
    let cancelled = false;
    setOptions({ projects: [] });
    setOptionsError(null);
    setOptionsLoading(true);
    services.captureOptions.getOptions()
      .then((loaded) => {
        if (!cancelled) setOptions(loaded);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setOptionsError(`Could not load projects: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [services, visible]);

  if (services?.quickCapture === undefined || services.captureOptions === undefined || toast === null) {
    return null;
  }

  const submit = async (submission: CaptureComposerSubmission): Promise<void> => {
    const base = {
      entityId: createId(),
      content: submission.content,
      recordId: createId(),
      recordRelationId: createId(),
      now: new Date(),
    };
    if (submission.intent === 'task') {
      await services.quickCapture.capture({
        ...base,
        intent: 'task',
        projectId: submission.projectId,
      });
    } else {
      await services.quickCapture.capture({ ...base, intent: submission.intent });
    }
    captureRevision.increment();
    toast.show(TOAST[submission.intent]);
  };

  const showProjectPicker = (
    selectedProjectId: string | null,
    onSelect: (projectId: string) => void,
  ): void => {
    navigation.presentSheet(
      <ProjectPickerSheet
        projects={options.projects}
        selectedProjectId={selectedProjectId}
        onSelect={(projectId) => {
          onSelect(projectId);
          navigation.dismissSheet();
        }}
        onDismiss={navigation.dismissSheet}
      />,
    );
  };

  return (
    <CaptureComposer
      visible={visible}
      onDismiss={onDismiss}
      options={options.projects}
      optionsLoading={optionsLoading}
      optionsError={optionsError}
      onSubmit={submit}
      onRequestProjectPicker={showProjectPicker}
    />
  );
}

interface ProjectPickerSheetProps {
  projects: CaptureProjectOption[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  onDismiss: () => void;
}

function ProjectPickerSheet({ projects, selectedProjectId, onSelect, onDismiss }: ProjectPickerSheetProps) {
  return (
    <View testID="capture-project-sheet">
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Choose a Project</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close project picker" onPress={onDismiss}>
          <Text style={styles.close}>×</Text>
        </Pressable>
      </View>
      {projects.map((project) => (
        <Pressable
          key={project.id}
          testID={`capture-project-option-${project.id}`}
          accessibilityRole="radio"
          accessibilityState={{ selected: project.id === selectedProjectId }}
          onPress={() => onSelect(project.id)}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        >
          <Text style={styles.optionName}>{project.name}</Text>
          <Text style={styles.optionStatus}>{project.status}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  close: { color: colors.muted, fontSize: 26 },
  option: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  optionStatus: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
  pressed: { opacity: 0.6 },
});
