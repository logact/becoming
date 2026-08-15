import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Project } from '../../domain/project';
import { useAppServices } from '../composition/AppServicesProvider';
import { useShellNavigation } from '../navigation/NavigationShell';
import { EntityListScaffold } from '../shared/EntityListScaffold';
import type { EntityListFilter } from '../shared/EntityListScaffold';
import { StatusBadge } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { colors, spacing } from '../shared/theme';
import { ProjectFormSheet } from './ProjectFormSheet';

interface ProjectRow {
  project: Project;
  /** Active member-Task count, from the membership query. */
  memberTaskCount: number;
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: ProjectRow[] };

/**
 * The Projects destination list: planning hero, title search, Active/Archived
 * filter, populated rows with purpose and member-Task-count context, explicit
 * empty/loading/recoverable-error states, and an active-only New Project
 * action. All data comes from the application services; the screen never
 * derives membership or archive rules itself.
 */
export function ProjectListScreen() {
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
        const projects = filter === 'active'
          ? await services.projects.listActiveProjects()
          : await services.projects.listProjects({ status: 'archived' });
        const rows = await Promise.all(projects.map(async (project) => ({
          project,
          memberTaskCount:
            (await services.taskMembershipQueries.listActiveTasksForProject(project.id)).length,
        })));
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
    : rows.filter((row) => row.project.title.toLowerCase().includes(query));

  function openCreateSheet() {
    navigation.presentSheet(
      <ProjectFormSheet
        mode="create"
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Project created');
          reload();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  return (
    <EntityListScaffold<ProjectRow>
      title="Projects"
      heroTitle="Where intent becomes work"
      heroCopy="Projects organize effort without owning the Goal."
      heroKicker="Milestone 2 planning"
      searchPlaceholder="Search projects"
      status={state.status}
      errorMessage={state.status === 'error' ? state.message : undefined}
      onRetry={state.status === 'error' ? reload : undefined}
      items={visibleRows}
      keyExtractor={(row) => row.project.id}
      renderRow={(row) => (
        <ProjectRowView row={row} onOpen={() => navigation.openDetail(row.project.id)} />
      )}
      filter={filter}
      onFilterChange={setFilter}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      emptyTitle={emptyTitle(filter, query)}
      emptyMessage={emptyMessage(filter, query)}
      createLabel="New project"
      onCreate={openCreateSheet}
    />
  );
}

function emptyTitle(filter: EntityListFilter, query: string): string {
  if (query.length > 0) return 'No matching projects';
  return filter === 'active' ? 'No projects yet' : 'No archived projects';
}

function emptyMessage(filter: EntityListFilter, query: string): string {
  if (query.length > 0) return 'Try a different search.';
  return filter === 'active'
    ? 'Organize effort toward a Goal.'
    : 'Archived Projects remain inspectable here.';
}

function ProjectRowView({ row, onOpen }: { row: ProjectRow; onOpen: () => void }) {
  const { project, memberTaskCount } = row;
  const archived = project.archivedAt !== null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.title}`}
      style={styles.row}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} maxFontSizeMultiplier={2}>
          {project.title}
        </Text>
        <Text style={styles.rowSub} maxFontSizeMultiplier={2}>
          {project.purpose ?? project.description ?? 'No purpose defined yet'}
        </Text>
      </View>
      {archived ? (
        <StatusBadge label="Archived" icon="▣" />
      ) : (
        <StatusBadge
          label={`${memberTaskCount} task${memberTaskCount === 1 ? '' : 's'}`}
          icon="✓"
          tone={memberTaskCount > 0 ? 'info' : 'neutral'}
        />
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
