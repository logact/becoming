import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { GoalDetailService, GoalDetailView } from '../../../application/goal/GoalDetailService';
import type { ScheduleGoalService } from '../../../application/goal/ScheduleGoalService';
import type { SelectCurrentPlanService } from '../../../application/goal/SelectCurrentPlanService';
import type { CreateGoalProjectService } from '../../../application/project/CreateGoalProjectService';
import type { GoalStatus } from '../../../domain/goal/Goal';
import type { ProjectStatus } from '../../../domain/project/Project';
import type { GoalId } from '../../../domain/shared/ids';
import { DatePickerRow } from '../../components/DatePickerRow';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { ScheduleEditor } from '../../components/ScheduleEditor';
import { StatTile } from '../../components/StatTile';
import { StatusPill, type StatusState } from '../../components/StatusPill';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { createId } from '../../shared/id';
import { colors, radii, serif, spacing } from '../../shared/theme';
import { activityIcon } from '../activityIcon';
import { relativeTime } from '../dashboard/format';

/** `StatusPill` has no `failed` state; the prototype renders it as conflict. */
const GOAL_STATUS_PILL: Record<GoalStatus, { state: StatusState; label: string }> = {
  todo: { state: 'todo', label: 'Todo' },
  doing: { state: 'doing', label: 'Doing' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

const PROJECT_STATUS_PILL: Record<ProjectStatus, { state: StatusState; label: string }> = {
  planning: { state: 'planning', label: 'Planning' },
  active: { state: 'active', label: 'Active' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface GoalDetailPageProps {
  goalId: GoalId;
  /**
   * Read service behind the screen. Passed as a prop (not pulled from
   * AppServices) so the page is testable with fakes before the composition
   * wiring lands.
   */
  detail: Pick<GoalDetailService, 'getDetail'>;
  createProject: Pick<CreateGoalProjectService, 'create'>;
  selectCurrentPlan: Pick<SelectCurrentPlanService, 'select'>;
  schedule: Pick<ScheduleGoalService, 'schedule'>;
}

/**
 * Goal detail, pushed via the shell's `renderDetail(goalId)` mechanism:
 * header (title, status pill, target date, labels, Active projects count),
 * the goal's projects with a "Current plan" tag on the active one, and
 * goal-scoped recent activity. Project rows push the project detail screen;
 * management sheets create alternatives and choose the current plan.
 */
export function GoalDetailPage({
  goalId,
  detail,
  createProject,
  selectCurrentPlan,
  schedule,
}: GoalDetailPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ view: GoalDetailView; now: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const view = await detail.getDetail(goalId);
      setLoadError(null);
      setLoaded({ view, now });
    } catch (cause: unknown) {
      // Surface load failures; a silent rejection would leave a blank screen.
      console.error('Failed to load the goal detail', cause);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [detail, goalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Minimal loading state: empty screen background until the first load.
  if (loaded === null) {
    return (
      <View testID="goal-detail-page" style={styles.screen}>
        <InlineNavBar title="Goal" onBack={navigation.goBack} />
        {loadError === null ? null : (
          <SectionNote>Could not load the goal: {loadError}</SectionNote>
        )}
      </View>
    );
  }
  const { view, now } = loaded;

  if (view.goal === null) {
    return (
      <View testID="goal-detail-page" style={styles.screen}>
        <InlineNavBar title="Goal" onBack={navigation.goBack} />
        <SectionNote>Unknown goal.</SectionNote>
      </View>
    );
  }

  const { goal } = view;
  const statusPill = GOAL_STATUS_PILL[goal.status];
  const activeProjects = view.activeProjectId === null ? 0 : 1;
  const hasSelectableProject = view.projects.some((project) => project.canSelectAsCurrentPlan);

  const presentCreateProject = (): void => navigation.presentSheet(
    <CreateGoalProjectSheet
      goalId={goal.id}
      goalDue={goal.due}
      createProject={createProject}
      onCreated={refresh}
    />,
  );
  const presentCurrentPlanPicker = (): void => navigation.presentSheet(
    <CurrentPlanPickerSheet
      goalId={goal.id}
      projects={view.projects}
      activeProjectId={view.activeProjectId}
      selectCurrentPlan={selectCurrentPlan}
      onSelected={refresh}
    />,
  );
  const presentSchedule = (): void => navigation.presentSheet(
    <ScheduleEditor
      entityLabel="Goal"
      initialStartAt={goal.startAt}
      initialDue={goal.due}
      testID="goal-schedule-editor"
      onCancel={navigation.dismissSheet}
      onSave={async (startAt, due) => {
        await schedule.schedule({
          goalId: goal.id,
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

  return (
    <View testID="goal-detail-page" style={styles.screen}>
      <InlineNavBar title="Goal" onBack={navigation.goBack} />
      <ScrollView>
        <View testID="goal-detail-header" style={styles.header}>
          <Text style={styles.title}>{goal.title}</Text>
          <View style={styles.metaRow}>
            <StatusPill state={statusPill.state} label={statusPill.label} />
            <Text testID="goal-schedule-summary" style={styles.meta}>
              {goal.startAt === undefined && goal.due === undefined
                ? 'No schedule'
                : [
                  goal.startAt === undefined ? 'Start not set' : `Start ${shortDate(goal.startAt)}`,
                  goal.due === undefined ? 'Due not set' : `Due ${shortDate(goal.due)}`,
                ].join(' · ')}
            </Text>
          </View>
          <View style={styles.scheduleAction}>
            <PrimaryChipButton testID="goal-schedule-action" label="Schedule" variant="ghost" onPress={presentSchedule} />
          </View>
          {goal.labelIds.length > 0 ? (
            <Text testID="goal-detail-labels" style={styles.labels}>
              {goal.labelIds.join(' · ')}
            </Text>
          ) : null}
          <View style={styles.statCell}>
            <StatTile
              value={`${activeProjects} / ${view.projects.length}`}
              label="Active projects"
            />
          </View>
        </View>

        <View testID="projects-section">
          <SectionHeader title="Projects — plans for this goal" />
          <ListSection variant="panel">
            {view.projects.map((project) => {
              const pill = PROJECT_STATUS_PILL[project.status];
              const isCurrentPlan = project.id === view.activeProjectId;
              return (
                <ListRow
                  key={project.id}
                  testID={`project-row-${project.id}`}
                  icon="box"
                  title={project.name}
                  subtitle={`${project.subGoalCount} sub-goal${project.subGoalCount === 1 ? '' : 's'}`}
                  trailing={
                    <View style={styles.trailing}>
                      {isCurrentPlan ? (
                        <Text testID={`current-plan-${project.id}`} style={styles.currentPlan}>
                          Current plan
                        </Text>
                      ) : null}
                      <StatusPill state={pill.state} label={pill.label} />
                    </View>
                  }
                  onPress={() => navigation.pushScreen(`project:${project.id}`)}
                />
              );
            })}
            <ListRow
              testID="new-goal-project"
              icon="plus"
              title="New project — another way to reach this goal"
              titleStyle={styles.actionTitle}
              onPress={presentCreateProject}
            />
            {hasSelectableProject ? (
              <ListRow
                testID="choose-current-plan"
                icon="checkCircle"
                title="Choose current plan"
                titleStyle={styles.actionTitle}
                onPress={presentCurrentPlanPicker}
              />
            ) : null}
          </ListSection>
          {view.projects.length === 0 ? <SectionNote>No project yet.</SectionNote> : null}
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

function previousLocalDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() - 1);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

interface CreateGoalProjectSheetProps {
  goalId: GoalId;
  goalDue?: Date;
  createProject: Pick<CreateGoalProjectService, 'create'>;
  onCreated: () => Promise<void>;
}

function CreateGoalProjectSheet({
  goalId,
  goalDue,
  createProject,
  onCreated,
}: CreateGoalProjectSheetProps) {
  const navigation = useShellNavigation();
  const [name, setName] = useState('');
  const [due, setDue] = useState<Date | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    if (submitting) return;
    if (name.trim() === '') {
      setError('Project name is required.');
      return;
    }
    if (due !== undefined && goalDue !== undefined && due.getTime() >= goalDue.getTime()) {
      setError('Project due date must be earlier than the Goal due date.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createProject.create({
        projectId: createId(),
        goalId,
        name: name.trim(),
        ...(due === undefined ? {} : { due }),
        recordId: createId(),
        goalRecordRelationId: createId(),
        projectRecordRelationId: createId(),
        now: new Date(),
      });
      navigation.dismissSheet();
      await onCreated();
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View testID="create-goal-project-sheet">
      <Text style={sheetStyles.title}>New project</Text>
      <Text style={sheetStyles.note}>Create another plan for reaching this goal.</Text>
      <TextInput
        testID="goal-project-name"
        accessibilityLabel="Project name"
        placeholder="Project name"
        placeholderTextColor={colors.faint}
        value={name}
        editable={!submitting}
        onChangeText={setName}
        style={sheetStyles.input}
      />
      <DatePickerRow
        testID="goal-project-due"
        label="Due"
        value={due}
        maximumDate={goalDue === undefined ? undefined : previousLocalDate(goalDue)}
        disabled={submitting}
        onChange={setDue}
      />
      {error === null ? null : (
        <Text testID="goal-project-error" style={sheetStyles.error}>{error}</Text>
      )}
      <View style={sheetStyles.actions}>
        <PrimaryChipButton
          testID="goal-project-cancel"
          label="Cancel"
          variant="ghost"
          disabled={submitting}
          onPress={navigation.dismissSheet}
        />
        <PrimaryChipButton
          testID="goal-project-submit"
          label={submitting ? 'Creating…' : 'Create project'}
          disabled={submitting}
          onPress={() => { void submit(); }}
        />
      </View>
    </View>
  );
}

interface CurrentPlanPickerSheetProps {
  goalId: GoalId;
  projects: GoalDetailView['projects'];
  activeProjectId: string | null;
  selectCurrentPlan: Pick<SelectCurrentPlanService, 'select'>;
  onSelected: () => Promise<void>;
}

function CurrentPlanPickerSheet({
  goalId,
  projects,
  activeProjectId,
  selectCurrentPlan,
  onSelected,
}: CurrentPlanPickerSheetProps) {
  const navigation = useShellNavigation();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const candidates = projects.filter(
    (project) => project.id === activeProjectId || project.canSelectAsCurrentPlan,
  );
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const confirmingProject = projects.find((project) => project.id === confirmingId);

  const select = async (projectId: string): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await selectCurrentPlan.select({
        goalId,
        selectedProjectId: projectId,
        recordId: createId(),
        goalRecordRelationId: createId(),
        projectRecordRelationId: createId(),
        now: new Date(),
      });
      navigation.dismissSheet();
      await onSelected();
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmingProject !== undefined && activeProject !== undefined) {
    return (
      <View testID="replace-current-plan-confirmation">
        <Text style={sheetStyles.title}>Replace current plan?</Text>
        <Text style={sheetStyles.note}>
          Choosing {confirmingProject.name} will pause {activeProject.name}.
        </Text>
        {error === null ? null : (
          <Text testID="current-plan-error" style={sheetStyles.error}>{error}</Text>
        )}
        <View style={sheetStyles.actions}>
          <PrimaryChipButton
            testID="replace-current-plan-cancel"
            label="Back"
            variant="ghost"
            disabled={submitting}
            onPress={() => { setConfirmingId(null); setError(null); }}
          />
          <PrimaryChipButton
            testID="replace-current-plan-confirm"
            label={submitting ? 'Choosing…' : 'Choose plan'}
            disabled={submitting}
            onPress={() => { void select(confirmingProject.id); }}
          />
        </View>
      </View>
    );
  }

  return (
    <View testID="current-plan-picker">
      <Text style={sheetStyles.title}>Choose current plan</Text>
      <Text style={sheetStyles.note}>One project can be active for this goal.</Text>
      <View style={sheetStyles.options}>
        {candidates.map((project) => {
          const selected = project.id === activeProjectId;
          return (
            <Pressable
              key={project.id}
              testID={`current-plan-option-${project.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: selected || submitting }}
              disabled={selected || submitting}
              onPress={() => {
                if (activeProjectId === null) void select(project.id);
                else setConfirmingId(project.id);
              }}
              style={({ pressed }) => [
                sheetStyles.option,
                selected && sheetStyles.selectedOption,
                pressed && sheetStyles.pressed,
              ]}
            >
              <View style={sheetStyles.optionText}>
                <Text style={sheetStyles.optionTitle}>{project.name}</Text>
                <Text style={sheetStyles.note}>
                  {selected ? 'Current plan' : PROJECT_STATUS_PILL[project.status].label}
                </Text>
              </View>
              {selected ? <Icon name="checkCircle" size={18} color={colors.sage} /> : null}
            </Pressable>
          );
        })}
      </View>
      {error === null ? null : (
        <Text testID="current-plan-error" style={sheetStyles.error}>{error}</Text>
      )}
      <View style={sheetStyles.actions}>
        <PrimaryChipButton label="Cancel" variant="ghost" onPress={navigation.dismissSheet} />
      </View>
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
  scheduleAction: { flexDirection: 'row', marginTop: 10 },
  labels: { fontSize: 12.5, fontWeight: '600', color: colors.muted, marginTop: 10, marginHorizontal: 6 },
  statCell: { marginTop: 12 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentPlan: { fontSize: 11.5, fontWeight: '700', color: colors.sage },
  actionTitle: { color: colors.green, fontSize: 15 },
  lastSection: { paddingBottom: spacing.sectionTop },
});

const sheetStyles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '700', color: colors.ink, marginBottom: 5 },
  note: { color: colors.muted, fontSize: 13 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.chip,
    paddingHorizontal: 14,
    color: colors.ink,
    marginTop: 14,
    marginBottom: 10,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  error: { color: colors.conflictRed, fontSize: 12.5, marginTop: 8 },
  options: { marginTop: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  selectedOption: { opacity: 0.65 },
  optionText: { flex: 1 },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  pressed: { opacity: 0.5 },
});
