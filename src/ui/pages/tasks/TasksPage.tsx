import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  TaskAttentionItem,
  TaskListItem,
  TasksOverviewService,
  TasksOverviewView,
} from '../../../application/task/TasksOverviewService';
import type { TaskStatus } from '../../../domain/task/Task';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { StatTile } from '../../components/StatTile';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { useCaptureRevision } from '../../navigation/CaptureRevision';
import { colors, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';

const TASK_STATUS_PILL: Record<TaskStatus, { state: StatusState; label: string }> = {
  todo: { state: 'todo', label: 'Todo' },
  doing: { state: 'doing', label: 'Doing' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};
const STATUS_GROUP_ORDER: TaskStatus[] = ['doing', 'todo', 'paused', 'failed', 'done'];

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function taskSubtitle(item: TaskListItem): string {
  return `${item.projectName}${item.due === undefined ? '' : ` · Due ${shortDate(item.due)}`}`;
}

function attentionText(item: TaskAttentionItem, now: Date): string {
  if (item.reason === 'failed') return 'Failed';
  if (item.due === undefined) return item.reason === 'overdue' ? 'Overdue' : 'Due soon';
  return item.reason === 'overdue'
    ? `Overdue ${relativeTime(item.due, now)}`
    : `Due in ${relativeTime(item.due, now)}`;
}

export interface TasksPageProps {
  overview: Pick<TasksOverviewService, 'getOverview'>;
}

/** All-tasks dashboard, pushed from the Library hub. */
export function TasksPage({ overview }: TasksPageProps) {
  const navigation = useShellNavigation();
  const captureRevision = useCaptureRevision();
  const [loaded, setLoaded] = useState<{ view: TasksOverviewView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      setLoaded({ view: await overview.getOverview(now), now });
      setLoadError(null);
    } catch (cause: unknown) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [overview]);

  useEffect(() => { void refresh(); }, [refresh, captureRevision]);

  if (loaded === null) {
    return (
      <View testID="tasks-page" style={styles.screen}>
        <InlineNavBar title="Tasks" onBack={navigation.goBack} />
        {loadError === null ? null : <SectionNote>Could not load tasks: {loadError}</SectionNote>}
      </View>
    );
  }
  const { view, now } = loaded;
  const openTask = (taskId: string): void => navigation.pushScreen(`task:${taskId}`);
  const taskRow = (task: TaskListItem) => {
    const pill = TASK_STATUS_PILL[task.status];
    return (
      <ListRow
        key={task.id}
        testID={`task-row-${task.id}`}
        icon="checkCircle"
        title={task.title}
        subtitle={taskSubtitle(task)}
        trailing={<StatusPill state={pill.state} label={pill.label} />}
        onPress={() => openTask(task.id)}
      />
    );
  };

  return (
    <ScrollView testID="tasks-page" style={styles.screen}>
      <InlineNavBar title="Tasks" onBack={navigation.goBack} />
      <View testID="task-stats" style={styles.statsRow}>
        <View style={styles.statCell}><StatTile value={view.stats.doing} label="Doing" /></View>
        <View style={styles.statCell}><StatTile value={view.stats.todo} label="Todo" /></View>
        <View style={styles.statCell}><StatTile value={view.stats.done} label="Done" /></View>
        <View style={styles.statCell}><StatTile value={view.stats.overdue} label="Overdue" /></View>
      </View>

      <View testID="task-attention-section">
        <SectionHeader title="Needs attention" />
        <ListSection variant="panel">
          {view.attention.map((item) => (
            <ListRow
              key={item.id}
              testID={`task-attention-${item.id}`}
              icon={item.reason === 'dueSoon' ? 'clock' : 'alert'}
              title={item.title}
              subtitle={`${item.projectName} · ${attentionText(item, now)}`}
              trailing={<StatusPill
                state={item.reason === 'dueSoon' ? 'blocked' : 'conflict'}
                label={item.reason === 'dueSoon' ? 'Due soon' : item.reason === 'failed' ? 'Failed' : 'Overdue'}
              />}
              onPress={() => openTask(item.id)}
            />
          ))}
        </ListSection>
        {view.attention.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
        <SectionNote>Failed tasks first, then overdue and due-soon tasks.</SectionNote>
      </View>

      <View testID="doing-now-section">
        <SectionHeader title="Doing now" />
        <ListSection variant="borderless">{view.doingNow.map(taskRow)}</ListSection>
        {view.doingNow.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="task-by-status-section">
        <SectionHeader title="By status" />
        <ListSection variant="panel">
          {STATUS_GROUP_ORDER.map((status) => (
            <ListRow key={status} title={TASK_STATUS_PILL[status].label} trailing={<Text style={styles.count}>{view.byStatus[status]}</Text>} />
          ))}
        </ListSection>
      </View>

      <View testID="task-by-label-section">
        <SectionHeader title="By label" />
        <ListSection variant="panel">
          {view.byLabel.map((entry) => (
            <ListRow key={entry.labelId} icon="tag" title={entry.name} trailing={<Text style={styles.count}>{entry.count}</Text>} />
          ))}
        </ListSection>
        {view.byLabel.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="all-tasks-section">
        <SectionHeader title="All tasks" />
        {STATUS_GROUP_ORDER.map((status) => view.allTasks[status].length === 0 ? null : (
          <View key={status} testID={`task-group-${status}`}>
            <Text style={styles.groupLabel}>{TASK_STATUS_PILL[status].label}</Text>
            <ListSection variant="panel">{view.allTasks[status].map(taskRow)}</ListSection>
          </View>
        ))}
      </View>

      <View testID="task-activity-section" style={styles.lastSection}>
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
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginHorizontal: spacing.screenMargin },
  statCell: { flex: 1 },
  count: { fontSize: 14, fontWeight: '700', color: colors.muted },
  meta: { fontSize: 12.5, fontWeight: '500', color: colors.faint },
  groupLabel: { fontSize: 12, fontWeight: '700', color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 8, marginHorizontal: spacing.textMargin },
  lastSection: { paddingBottom: spacing.sectionTop },
});
