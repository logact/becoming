import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Task } from '../../domain/task';
import { useAppServices } from '../composition/AppServicesProvider';
import { useShellNavigation } from '../navigation/NavigationShell';
import { EntityListScaffold } from '../shared/EntityListScaffold';
import type { EntityListFilter } from '../shared/EntityListScaffold';
import { StatusBadge } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { colors, spacing } from '../shared/theme';
import { TaskFormSheet } from './TaskFormSheet';
import {
  STANDALONE_TASK_LIFECYCLE,
  taskLifecycleFromSnapshot,
} from './taskLifecycle';
import type { TaskLifecyclePresentation } from './taskLifecycle';

interface TaskRow {
  task: Task;
  /** Lifecycle badge from the Task's active Project execution snapshot. */
  lifecycle: TaskLifecyclePresentation | null;
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: TaskRow[] };

/**
 * The Tasks destination list: planning hero, title search, Active/Archived
 * filter, populated rows with target/priority context and a lifecycle-status
 * badge from the authoritative Project execution snapshot, explicit
 * empty/loading/recoverable-error states, and an active-only New Task action.
 * All data comes from the application services; the screen never derives
 * membership, archive, or lifecycle rules itself.
 */
export function TaskListScreen() {
  const services = useAppServices();
  const navigation = useShellNavigation();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<EntityListFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      try {
        const tasks = filter === 'active'
          ? await services.tasks.listActive()
          : (await services.tasks.listHistory()).filter((task) => task.archivedAt !== null);
        const memberships = await Promise.all(
          tasks.map((task) => services.taskMembershipQueries.listActiveProjectsForTask(task.id)),
        );
        // One execution snapshot per distinct active Project context; the
        // snapshot is the only source of lifecycle meaning for the badges.
        const projectIds = [
          ...new Set(
            memberships.flatMap((views) => (views.length > 0 ? [views[0].projectId] : [])),
          ),
        ];
        const snapshots = new Map(
          await Promise.all(
            projectIds.map(
              async (projectId) =>
                [projectId, await services.executionSnapshots.getSnapshot(projectId)] as const,
            ),
          ),
        );
        const rows = tasks.map((task, index) => {
          const membership = memberships[index][0] ?? null;
          const lifecycle = task.archivedAt !== null
            ? null
            : membership === null
              ? STANDALONE_TASK_LIFECYCLE
              : taskLifecycleFromSnapshot(snapshots.get(membership.projectId)!, task.id);
          return { task, lifecycle };
        });
        if (!cancelled) setState({ status: 'ready', rows });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The list could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [filter, reloadToken, services]);

  const query = searchQuery.trim().toLowerCase();
  const rows = state.status === 'ready' ? state.rows : [];
  const visibleRows = query.length === 0
    ? rows
    : rows.filter((row) => row.task.title.toLowerCase().includes(query));

  function openCreateSheet() {
    navigation.presentSheet(
      <TaskFormSheet
        mode="create"
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Task created');
          reload();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  return (
    <EntityListScaffold<TaskRow>
      title="Tasks"
      heroTitle="The work in front of you"
      heroCopy="Tasks can stand alone or belong to a Project."
      heroKicker="Milestone 2 planning"
      searchPlaceholder="Search tasks"
      status={state.status}
      errorMessage={state.status === 'error' ? state.message : undefined}
      onRetry={state.status === 'error' ? reload : undefined}
      items={visibleRows}
      keyExtractor={(row) => row.task.id}
      renderRow={(row) => (
        <TaskRowView row={row} onOpen={() => navigation.openDetail(row.task.id)} />
      )}
      filter={filter}
      onFilterChange={setFilter}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      emptyTitle={emptyTitle(filter, query)}
      emptyMessage={emptyMessage(filter, query)}
      createLabel="New task"
      onCreate={openCreateSheet}
    />
  );
}

function emptyTitle(filter: EntityListFilter, query: string): string {
  if (query.length > 0) return 'No matching tasks';
  return filter === 'active' ? 'No tasks yet' : 'No archived tasks';
}

function emptyMessage(filter: EntityListFilter, query: string): string {
  if (query.length > 0) return 'Try a different search.';
  return filter === 'active'
    ? 'Define the work that moves a Goal forward.'
    : 'Archived Tasks remain inspectable here.';
}

function TaskRowView({ row, onOpen }: { row: TaskRow; onOpen: () => void }) {
  const { task, lifecycle } = row;
  const archived = task.archivedAt !== null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open task ${task.title}`}
      style={styles.row}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} maxFontSizeMultiplier={2}>
          {task.title}
        </Text>
        <Text style={styles.rowSub} maxFontSizeMultiplier={2}>
          {task.targetDescription}
          {task.priority !== null ? ` · P${task.priority}` : ''}
        </Text>
      </View>
      {archived ? (
        <StatusBadge label="Archived" icon="▣" />
      ) : (
        lifecycle !== null && (
          <StatusBadge
            label={lifecycle.badgeLabel}
            icon={lifecycle.badgeIcon}
            tone={lifecycle.badgeTone}
          />
        )
      )}
      <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  rowSub: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.muted,
  },
  chevron: {
    fontSize: 18,
    color: colors.muted,
  },
});
