import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  ProjectAttentionItem,
  ProjectListItem,
  ProjectsOverviewService,
  ProjectsOverviewView,
} from '../../../application/project/ProjectsOverviewService';
import type { ProjectStatus } from '../../../domain/project/Project';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { StatTile } from '../../components/StatTile';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { colors, spacing } from '../../shared/theme';
import { relativeTime } from '../dashboard/format';

/** `StatusPill` has no `planning`/`failed` states; reuse todo/conflict. */
const PROJECT_STATUS_PILL: Record<ProjectStatus, { state: StatusState; label: string }> = {
  planning: { state: 'todo', label: 'Planning' },
  active: { state: 'doing', label: 'Active' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

const STATUS_GROUP_ORDER: ProjectStatus[] = ['active', 'planning', 'paused', 'failed', 'done'];

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function attentionSubtitle(item: ProjectAttentionItem): string {
  return item.reason === 'failed'
    ? 'Failed'
    : `Target ${shortDate(item.due as Date)}`;
}

function attentionPillLabel(item: ProjectAttentionItem, now: Date): string {
  if (item.reason === 'failed') {
    return 'Failed';
  }
  const due = item.due as Date;
  return due.getTime() < now.getTime()
    ? `Overdue ${relativeTime(due, now)}`
    : `Due in ${relativeTime(due, now)}`;
}

export interface ProjectsPageProps {
  /**
   * Read service behind the screen. Passed as a prop (not pulled from
   * AppServices) so the page is testable with fakes.
   */
  overview: Pick<ProjectsOverviewService, 'getOverview'>;
}

/**
 * Projects screen, pushed from the Library hub's Projects row: headline
 * "Active projects" stat, Needs attention, Focus (active projects), By
 * status, By label and All projects grouped by status. Project rows push the
 * project detail via `navigation.pushScreen('project:<id>')`.
 */
export function ProjectsPage({ overview }: ProjectsPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ view: ProjectsOverviewView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const view = await overview.getOverview(now);
      setLoadError(null);
      setLoaded({ view, now });
    } catch (cause: unknown) {
      // Surface load failures; a silent rejection would leave a blank screen.
      console.error('Failed to load the projects overview', cause);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [overview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Minimal loading state: empty screen background until the first load.
  if (loaded === null) {
    return (
      <View testID="projects-page" style={styles.screen}>
        <InlineNavBar title="Projects" onBack={navigation.goBack} />
        {loadError === null ? null : (
          <SectionNote>Could not load the projects: {loadError}</SectionNote>
        )}
      </View>
    );
  }
  const { view, now } = loaded;

  const openProject = (projectId: string): void => navigation.pushScreen(`project:${projectId}`);

  const projectRow = (project: ProjectListItem) => (
    <ListRow
      key={project.id}
      testID={`project-row-${project.id}`}
      icon="box"
      title={project.name}
      subtitle={`${project.goalTitle}${project.due ? ` · Target ${shortDate(project.due)}` : ''}`}
      trailing={<Icon name="chevron" size={14} color={colors.chevron} />}
      onPress={() => openProject(project.id)}
    />
  );

  return (
    <ScrollView testID="projects-page" style={styles.screen}>
      <InlineNavBar title="Projects" onBack={navigation.goBack} />
      <View testID="stats-row" style={styles.statsRow}>
        <View style={styles.statCell}>
          <StatTile
            value={`${view.stats.activeProjects} / ${view.stats.totalProjects}`}
            label="Active projects"
          />
        </View>
      </View>

      <View testID="attention-section">
        <SectionHeader title="Needs attention" />
        <ListSection variant="panel">
          {view.attention.map((item) => (
            <ListRow
              key={item.id}
              testID={`attention-project-${item.id}`}
              icon={item.reason === 'failed' ? 'alert' : 'clock'}
              title={item.name}
              subtitle={attentionSubtitle(item)}
              trailing={
                <StatusPill
                  state={item.reason === 'failed' ? 'conflict' : 'blocked'}
                  label={attentionPillLabel(item, now)}
                />
              }
              onPress={() => openProject(item.id)}
            />
          ))}
        </ListSection>
        {view.attention.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="focus-section">
        <SectionHeader title="Focus" />
        <ListSection variant="panel">
          {view.focus.map((project) => (
            <ListRow
              key={project.id}
              testID={`focus-project-${project.id}`}
              icon="box"
              title={project.name}
              subtitle={
                project.due
                  ? `${project.goalTitle} · Target ${shortDate(project.due)}`
                  : project.goalTitle
              }
              trailing={<StatusPill state="doing" label="Active" />}
              onPress={() => openProject(project.id)}
            />
          ))}
        </ListSection>
        {view.focus.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="by-status-section">
        <SectionHeader title="By status" />
        <ListSection variant="panel">
          {STATUS_GROUP_ORDER.map((status) => (
            <ListRow
              key={status}
              title={PROJECT_STATUS_PILL[status].label}
              trailing={<Text style={styles.count}>{view.byStatus[status]}</Text>}
            />
          ))}
        </ListSection>
      </View>

      <View testID="by-label-section">
        <SectionHeader title="By label" />
        <ListSection variant="panel">
          {view.byLabel.map((entry) => (
            <ListRow
              key={entry.labelId}
              icon="tag"
              title={entry.name}
              trailing={<Text style={styles.count}>{entry.count}</Text>}
            />
          ))}
        </ListSection>
        {view.byLabel.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
      </View>

      <View testID="all-projects-section" style={styles.lastSection}>
        <SectionHeader title="All projects" />
        {STATUS_GROUP_ORDER.map((status) => {
          const projects = view.allProjects[status];
          if (projects.length === 0) {
            return null;
          }
          return (
            <View key={status} testID={`project-group-${status}`}>
              <Text style={styles.groupLabel}>{PROJECT_STATUS_PILL[status].label}</Text>
              <ListSection variant="panel">{projects.map(projectRow)}</ListSection>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginHorizontal: spacing.screenMargin,
  },
  statCell: { flex: 1 },
  count: { fontSize: 14, fontWeight: '700', color: colors.muted },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.faint,
    marginTop: 6,
    marginBottom: 8,
    marginHorizontal: spacing.textMargin,
  },
  lastSection: { paddingBottom: spacing.sectionTop },
});
