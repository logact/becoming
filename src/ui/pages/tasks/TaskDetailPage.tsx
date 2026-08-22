import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TaskDetailService, TaskDetailView } from '../../../application/task/TaskDetailService';
import type { TaskLifecycleService } from '../../../application/task/TaskLifecycleService';
import type { ScheduleTaskService } from '../../../application/task/ScheduleTaskService';
import type { TaskStatus } from '../../../domain/task/Task';
import type { TaskId } from '../../../domain/shared/ids';
import { Icon } from '../../components/Icon';
import { IconChip } from '../../components/IconChip';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { ScheduleEditor } from '../../components/ScheduleEditor';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { createId } from '../../shared/id';
import { colors, radii, serif, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';

const TASK_STATUS_PILL: Record<TaskStatus, { state: StatusState; label: string }> = {
  todo: { state: 'todo', label: 'Todo' },
  doing: { state: 'doing', label: 'Doing' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

type LifecycleMethod = 'start' | 'pause' | 'resume' | 'complete' | 'fail' | 'reopen';
type LifecyclePort = Pick<TaskLifecycleService, LifecycleMethod>;

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface TaskDetailPageProps {
  taskId: TaskId;
  detail: Pick<TaskDetailService, 'getDetail'>;
  lifecycle: LifecyclePort;
  schedule: Pick<ScheduleTaskService, 'schedule'>;
}

/** Task detail with lifecycle actions and immutable execution records. */
export function TaskDetailPage({ taskId, detail, lifecycle, schedule }: TaskDetailPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ view: TaskDetailView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      setLoaded({ view: await detail.getDetail(taskId), now });
      setLoadError(null);
    } catch (cause: unknown) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [detail, taskId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (method: LifecycleMethod): Promise<void> => {
    setSubmitting(true);
    setActionError(null);
    try {
      await lifecycle[method]({
        taskId,
        recordId: createId(),
        relationId: createId(),
        now: new Date(),
      });
      await refresh();
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (loaded === null) {
    return (
      <View testID="task-detail-page" style={styles.screen}>
        <InlineNavBar title="Task" onBack={navigation.goBack} />
        {loadError === null ? null : <SectionNote>Could not load task: {loadError}</SectionNote>}
      </View>
    );
  }
  if (loaded.view.task === null) {
    return (
      <View testID="task-detail-page" style={styles.screen}>
        <InlineNavBar title="Task" onBack={navigation.goBack} />
        <SectionNote>Unknown task.</SectionNote>
      </View>
    );
  }

  const { view, now } = loaded;
  const { task } = view;
  const pill = TASK_STATUS_PILL[task.status];
  const presentSchedule = (): void => navigation.presentSheet(
    <ScheduleEditor
      entityLabel="Task"
      initialStartAt={task.startAt}
      initialDue={task.due}
      testID="task-schedule-editor"
      onCancel={navigation.dismissSheet}
      onSave={async (startAt, due) => {
        await schedule.schedule({
          taskId: task.id,
          ...(startAt === undefined ? {} : { startAt }),
          ...(due === undefined ? {} : { due }),
          recordId: createId(),
          relationId: createId(),
          now: new Date(),
        });
        navigation.dismissSheet();
        await refresh();
      }}
    />,
  );
  const button = (method: LifecycleMethod, label: string, variant: 'primary' | 'ghost' | 'danger' = 'primary') => (
    <PrimaryChipButton
      key={method}
      testID={`task-action-${method}`}
      label={label}
      variant={variant}
      disabled={submitting}
      onPress={() => { void run(method); }}
    />
  );
  const actions = task.status === 'todo'
    ? [button('start', 'Start')]
    : task.status === 'doing'
      ? [button('complete', 'Complete'), button('pause', 'Pause', 'ghost'), button('fail', 'Fail', 'danger')]
      : task.status === 'paused'
        ? [button('resume', 'Resume'), button('fail', 'Fail', 'danger')]
        : [button('reopen', 'Reopen')];

  return (
    <View testID="task-detail-page" style={styles.screen}>
      <InlineNavBar title="Task" onBack={navigation.goBack} />
      <ScrollView>
        <View testID="task-detail-header" style={styles.header}>
          <IconChip name="checkCircle" size="lg" />
          <View style={styles.headerBody}>
            <Text style={styles.title}>{task.title}</Text>
            <View style={styles.metaRow}>
              <StatusPill state={pill.state} label={pill.label} />
              <Text testID="task-schedule-summary" style={styles.meta}>
                {task.startAt === undefined && task.due === undefined
                  ? 'No schedule'
                  : [
                    task.startAt === undefined ? 'Start not set' : `Start ${shortDate(task.startAt)}`,
                    task.due === undefined ? 'Due not set' : `Due ${shortDate(task.due)}`,
                  ].join(' · ')}
              </Text>
            </View>
          </View>
        </View>

        <View testID="task-actions-section" style={styles.actionSection}>
          <View style={styles.actions}>
            {actions}
            <PrimaryChipButton testID="task-schedule-action" label="Schedule" variant="ghost" onPress={presentSchedule} />
          </View>
          {actionError === null ? null : <Text style={styles.error}>{actionError}</Text>}
        </View>

        <View testID="task-belongs-section">
          <SectionHeader title="Belongs to" />
          <ListSection variant="panel">
            <ListRow
              testID="task-project-row"
              icon="box"
              title={view.projectName ?? task.projectId}
              subtitle="Project"
              trailing={<Icon name="chevron" size={14} color={colors.chevron} />}
              onPress={() => navigation.pushScreen(`project:${task.projectId}`)}
            />
            {task.goalId === undefined ? null : (
              <ListRow
                testID="task-goal-row"
                icon="target"
                title={view.goalTitle ?? task.goalId}
                subtitle={view.goalParentTitle === undefined ? 'Goal' : `${view.goalParentTitle} · Goal`}
                trailing={<Icon name="chevron" size={14} color={colors.chevron} />}
                onPress={() => navigation.openDetail(task.goalId as string)}
              />
            )}
          </ListSection>
        </View>

        <View testID="task-description-section">
          <SectionHeader title="Description" />
          {task.description === undefined || task.description.trim() === '' ? (
            <SectionNote>No description.</SectionNote>
          ) : (
            <View style={styles.descriptionPanel}><Text style={styles.description}>{task.description}</Text></View>
          )}
        </View>

        <View testID="task-records-section" style={styles.lastSection}>
          <SectionHeader title="Execution records" />
          <ListSection variant="panel">
            {view.records.map((record) => (
              <ListRow
                key={record.id}
                icon={activityIcon(record.kind)}
                title={record.detail ?? record.kind}
                trailing={<Text style={styles.meta}>{relativeTime(record.occurredAt, now)}</Text>}
              />
            ))}
          </ListSection>
          {view.records.length === 0 ? <SectionNote>No execution records yet.</SectionNote> : null}
          <SectionNote>Execution records are immutable.</SectionNote>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', gap: 14, marginTop: 8, marginHorizontal: spacing.screenMargin, alignItems: 'flex-start' },
  headerBody: { flex: 1 },
  title: { fontFamily: serif, fontSize: 26, fontWeight: '700', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  meta: { fontSize: 12.5, fontWeight: '500', color: colors.faint },
  actionSection: { marginHorizontal: spacing.screenMargin, marginTop: 18 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  error: { color: colors.conflictRed, marginTop: 8, fontSize: 12.5 },
  descriptionPanel: { marginHorizontal: spacing.screenMargin, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radii.panel, padding: 18 },
  description: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  lastSection: { paddingBottom: spacing.sectionTop },
});
