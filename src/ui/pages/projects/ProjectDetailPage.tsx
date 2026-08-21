import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  ProjectDetailService,
  ProjectDetailView,
  ProjectResourceItem,
} from '../../../application/project/ProjectDetailService';
import type { ProjectStatus } from '../../../domain/project/Project';
import type { ProjectId } from '../../../domain/shared/ids';
import { Icon } from '../../components/Icon';
import { IconChip } from '../../components/IconChip';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { ProgressBar } from '../../components/ProgressBar';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { SegmentedControl, type SegmentedControlOption } from '../../components/SegmentedControl';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { colors, serif, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';
import { PlanListView } from './PlanListView';
import { PlanRoadmapView } from './PlanRoadmapView';
import { PlanTreeView } from './PlanTreeView';
import { planViewStyles, shortDate } from './planShared';

/** `StatusPill` has no `planning`/`failed` states; reuse todo/conflict. */
const PROJECT_STATUS_PILL: Record<ProjectStatus, { state: StatusState; label: string }> = {
  planning: { state: 'todo', label: 'Planning' },
  active: { state: 'doing', label: 'Active' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

type PlanViewKey = 'tree' | 'list' | 'roadmap';

const PLAN_VIEW_OPTIONS: SegmentedControlOption<PlanViewKey>[] = [
  { key: 'tree', label: 'Tree' },
  { key: 'list', label: 'List' },
  { key: 'roadmap', label: 'Roadmap' },
];

/**
 * Quantity resources show their amount; time resources show the allocated
 * span's duration in hours (falling back to the amount, held in minutes).
 */
function resourceAmount(resource: ProjectResourceItem): string {
  if (resource.kind !== 'time') {
    return `${resource.amount}`;
  }
  const minutes =
    resource.span === undefined
      ? resource.amount
      : (resource.span.endAt.getTime() - resource.span.startAt.getTime()) / 60_000;
  return `${Number((minutes / 60).toFixed(1))} h`;
}

export interface ProjectDetailPageProps {
  projectId: ProjectId;
  /**
   * Read service behind the screen. Passed as a prop (not pulled from
   * AppServices) so the page is testable with fakes.
   */
  detail: Pick<ProjectDetailService, 'getDetail'>;
}

/**
 * Project detail, pushed as the `project:<id>` screen: header (name, status
 * pill, week-of-due meta, progress bar and stats), the plan section with
 * Tree/List/Roadmap views, the resources allocated to the project, and
 * project-scoped recent activity. The add-plan-item / allocate-resource
 * screens are pushed from the plan and resources sections.
 */
export function ProjectDetailPage({ projectId, detail }: ProjectDetailPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ view: ProjectDetailView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planView, setPlanView] = useState<PlanViewKey>('tree');

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const view = await detail.getDetail(projectId, now);
      setLoadError(null);
      setLoaded({ view, now });
    } catch (cause: unknown) {
      // Surface load failures; a silent rejection would leave a blank screen.
      console.error('Failed to load the project detail', cause);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [detail, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Minimal loading state: empty screen background until the first load.
  if (loaded === null) {
    return (
      <View testID="project-detail-page" style={styles.screen}>
        <InlineNavBar title="Project" onBack={navigation.goBack} />
        {loadError === null ? null : (
          <SectionNote>Could not load the project: {loadError}</SectionNote>
        )}
      </View>
    );
  }
  const { view, now } = loaded;

  if (view.project === null) {
    return (
      <View testID="project-detail-page" style={styles.screen}>
        <InlineNavBar title="Project" onBack={navigation.goBack} />
        <SectionNote>Unknown project.</SectionNote>
      </View>
    );
  }

  const { project } = view;
  const statusPill = PROJECT_STATUS_PILL[project.status];
  const { progress } = view;

  const openGoal = (goalId: string): void => navigation.openDetail(goalId);
  // The tree add-row carries its node so the Under picker defaults to it.
  const addPlanItem = (parentGoalId: string): void =>
    navigation.pushScreen(`project:${projectId}:add-plan-item:parent=${parentGoalId}`);
  const addMilestone = (): void =>
    navigation.pushScreen(`project:${projectId}:add-plan-item:tab=milestone`);
  const allocateResource = (): void =>
    navigation.pushScreen(`project:${projectId}:allocate-resource`);

  return (
    <View testID="project-detail-page" style={styles.screen}>
      <InlineNavBar title="Project" onBack={navigation.goBack} />
      <ScrollView>
        <View testID="project-detail-header" style={styles.header}>
          <IconChip name="box" size="lg" />
          <Text style={styles.title}>{project.name}</Text>
          <View style={styles.metaRow}>
            <StatusPill state={statusPill.state} label={statusPill.label} />
            {view.weeks !== null && project.due !== undefined ? (
              <Text style={styles.meta}>
                {`Week ${view.weeks.current} of ${view.weeks.total} · ends ${shortDate(project.due)}`}
              </Text>
            ) : null}
          </View>
          {progress === null ? null : (
            <View testID="project-progress" style={styles.progress}>
              <ProgressBar progress={progress.percent / 100} height={7} />
              <View style={styles.progressLabelRow}>
                <Text style={styles.meta}>
                  <Text style={styles.progressPercent}>{progress.percent}%</Text> complete
                </Text>
                <Text style={styles.meta}>
                  {`${progress.doneSubGoals} of ${progress.totalSubGoals} sub-goals · ${progress.doneTasks} of ${progress.totalTasks} tasks`}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View testID="plan-section">
          <SectionHeader title="Plan — goal · sub-goals · tasks" />
          {/* Explicit type argument: without `strictFunctionTypes` (expo base
              config) K would otherwise widen to string. */}
          <SegmentedControl<PlanViewKey>
            testID="plan-segmented"
            options={PLAN_VIEW_OPTIONS}
            selected={planView}
            onSelect={setPlanView}
          />
          {view.plan === null ? <SectionNote>No plan yet.</SectionNote> : null}
          {planView === 'tree' && view.plan !== null ? (
            <PlanTreeView plan={view.plan} onOpenGoal={openGoal} onAddPlanItem={addPlanItem} />
          ) : null}
          {planView === 'list' && view.plan !== null ? (
            <PlanListView plan={view.plan} tasks={view.tasks} onOpenGoal={openGoal} />
          ) : null}
          {planView === 'roadmap' ? (
            <PlanRoadmapView
              milestones={view.milestones}
              now={now}
              {...(project.due === undefined ? {} : { projectDue: project.due })}
              projectName={project.name}
              onOpenGoal={openGoal}
              onAddMilestone={addMilestone}
            />
          ) : null}
        </View>

        <View testID="resources-section">
          <SectionHeader title="Resources — allocated to this project" />
          <ListSection variant="panel">
            {view.resources.map((resource) => (
              <ListRow
                key={resource.id}
                testID={`resource-row-${resource.id}`}
                icon={resource.kind === 'time' ? 'clock' : 'banknote'}
                title={resource.name}
                trailing={<Text style={styles.value}>{resourceAmount(resource)}</Text>}
              />
            ))}
            <ListRow
              testID="allocate-resource"
              icon="plus"
              title="Allocate resource"
              titleStyle={planViewStyles.addRowTitle}
              onPress={allocateResource}
            />
          </ListSection>
          {view.resources.length === 0 ? <SectionNote>No resource allocated.</SectionNote> : null}
        </View>

        <View testID="activity-section" style={styles.lastSection}>
          <SectionHeader title="Recent activity" />
          <ListSection variant="panel">
            {view.recentActivity.map((item) => (
              <ListRow
                key={item.id}
                icon={activityIcon(item.kind)}
                title={item.detail ?? item.kind}
                trailing={<Text style={styles.meta}>{relativeTime(item.occurredAt, now)}</Text>}
              />
            ))}
          </ListSection>
          {view.recentActivity.length === 0 ? <SectionNote>Nothing here.</SectionNote> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { marginTop: 4, marginHorizontal: spacing.screenMargin },
  title: {
    fontFamily: serif,
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 10,
    marginHorizontal: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginHorizontal: 6,
  },
  meta: { fontSize: 12.5, fontWeight: '500', color: colors.faint },
  progress: { marginTop: 15, marginHorizontal: 6 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 7,
  },
  progressPercent: { fontWeight: '700', color: colors.ink },
  value: { fontSize: 14, fontWeight: '700', color: colors.muted },
  lastSection: { paddingBottom: spacing.sectionTop },
});
