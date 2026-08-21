import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AddMilestoneService } from '../../../application/project/AddMilestoneService';
import type { AddSubGoalService } from '../../../application/project/AddSubGoalService';
import type { AddTaskService } from '../../../application/project/AddTaskService';
import type {
  ProjectDetailService,
  ProjectDetailView,
  ProjectGoalNode,
} from '../../../application/project/ProjectDetailService';
import type { GoalId, MilestoneId, ProjectId } from '../../../domain/shared/ids';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionNote } from '../../components/SectionNote';
import { SegmentedControl, type SegmentedControlOption } from '../../components/SegmentedControl';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { parseDateText } from '../../shared/dateText';
import { createId } from '../../shared/id';
import { colors, spacing } from '../../shared/theme';
import { FormPickerRow, FormTextRow } from './formRows';
import { shortDate } from './planShared';

export type AddPlanItemTab = 'subgoal' | 'task' | 'milestone';

type TabKey = AddPlanItemTab;

const TAB_OPTIONS: SegmentedControlOption<TabKey>[] = [
  { key: 'subgoal', label: 'Sub-goal' },
  { key: 'task', label: 'Task' },
  { key: 'milestone', label: 'Milestone' },
];

/** A goal of the plan tree as an Under/Goal picker option. */
interface GoalOption {
  id: GoalId;
  title: string;
  /** Title of the parent goal; undefined for the root. */
  parentTitle?: string;
}

/** Depth-first flattening of the plan tree for the Under/Goal pickers. */
function flattenGoals(node: ProjectGoalNode, parentTitle: string | undefined, into: GoalOption[]): void {
  into.push({ id: node.id, title: node.title, ...(parentTitle === undefined ? {} : { parentTitle }) });
  for (const child of node.children) {
    flattenGoals(child, node.title, into);
  }
}

interface SheetOption {
  key: string;
  label: string;
  sublabel?: string;
}

interface OptionSheetProps {
  title: string;
  options: SheetOption[];
  /** Key of the currently selected option; rendered with a check. */
  selectedKey?: string;
  onSelect: (key: string) => void;
}

/**
 * Bottom-sheet option list behind the Under/Goal/Milestone pickers: one row
 * per option (check on the selected one) plus a Cancel row. Presented via
 * the shell's presentSheet; picking an option dismisses the sheet.
 */
function OptionSheet({ title, options, selectedKey, onSelect }: OptionSheetProps) {
  const navigation = useShellNavigation();
  const pick = (key: string): void => {
    onSelect(key);
    navigation.dismissSheet();
  };
  return (
    <View testID="option-sheet">
      <Text style={sheetStyles.title}>{title}</Text>
      {options.map((option) => (
        <Pressable
          key={option.key}
          testID={`option-${option.key}`}
          accessibilityRole="button"
          onPress={() => pick(option.key)}
          style={({ pressed }) => [sheetStyles.row, pressed && sheetStyles.pressed]}
        >
          <View style={sheetStyles.rowMain}>
            <Text style={sheetStyles.rowTitle}>{option.label}</Text>
            {option.sublabel === undefined ? null : (
              <Text style={sheetStyles.rowSub}>{option.sublabel}</Text>
            )}
          </View>
          {option.key === selectedKey ? (
            <Icon name="check" size={15} color={colors.sage} />
          ) : null}
        </Pressable>
      ))}
      <Pressable
        testID="option-cancel"
        accessibilityRole="button"
        onPress={navigation.dismissSheet}
        style={({ pressed }) => [sheetStyles.row, pressed && sheetStyles.pressed]}
      >
        <Text style={sheetStyles.cancel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: colors.faint,
    marginBottom: 6,
    marginHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  pressed: { opacity: 0.5 },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.faint, marginTop: 2 },
  cancel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.muted },
});

export interface AddPlanItemPageProps {
  projectId: ProjectId;
  /**
   * Read service behind the pickers (goal tree + milestones). Passed as a
   * prop (not pulled from AppServices) so the page is testable with fakes.
   */
  detail: Pick<ProjectDetailService, 'getDetail'>;
  addSubGoal: Pick<AddSubGoalService, 'add'>;
  addTask: Pick<AddTaskService, 'add'>;
  addMilestone: Pick<AddMilestoneService, 'add'>;
  /** Preselected Under/Goal parent — the tree node whose add-row was tapped. */
  initialParentGoalId?: GoalId;
  /** Preselected tab — the roadmap's "Add milestone" row passes `milestone`. */
  initialTab?: AddPlanItemTab;
}

/**
 * "Add to plan" pushed screen (`project:<id>:add-plan-item`): a segmented
 * Sub-goal / Task / Milestone form. Parent-goal, goal and milestone pickers
 * present a bottom-sheet option list; dates are `YYYY-MM-DD` text inputs
 * (empty due = none). Submit calls the matching command service and pops
 * back on success; validation failures show inline.
 */
export function AddPlanItemPage({
  projectId,
  detail,
  addSubGoal,
  addTask,
  addMilestone,
  initialParentGoalId,
  initialTab,
}: AddPlanItemPageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<ProjectDetailView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'subgoal');
  const [title, setTitle] = useState('');
  const [parentGoalId, setParentGoalId] = useState<GoalId | null>(initialParentGoalId ?? null);
  const [goalId, setGoalId] = useState<GoalId | null>(null);
  const [dueText, setDueText] = useState('');
  const [milestoneId, setMilestoneId] = useState<MilestoneId | null>(null);
  const [dateText, setDateText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detail.getDetail(projectId, new Date()).then(
      (view) => {
        if (!cancelled) {
          setLoaded(view);
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [detail, projectId]);

  // Minimal loading state: navbar plus an optional load-error note.
  if (loaded === null) {
    return (
      <View testID="add-plan-item-page" style={styles.screen}>
        <InlineNavBar title="Add to plan" onBack={navigation.goBack} />
        {loadError === null ? null : (
          <SectionNote>Could not load the project: {loadError}</SectionNote>
        )}
      </View>
    );
  }

  const { project, plan, milestones } = loaded;
  if (project === null || plan === null) {
    return (
      <View testID="add-plan-item-page" style={styles.screen}>
        <InlineNavBar title="Add to plan" onBack={navigation.goBack} />
        <SectionNote>Unknown project.</SectionNote>
      </View>
    );
  }

  const goalOptions: GoalOption[] = [];
  flattenGoals(plan, undefined, goalOptions);
  const goalTitle = (id: GoalId): string =>
    goalOptions.find((option) => option.id === id)?.title ?? 'Unknown goal';
  // Both pickers fall back to the plan root (the goal the project serves)
  // when no parent was preselected via `initialParentGoalId` or the sheet.
  const effectiveParentGoalId = parentGoalId ?? plan.id;
  const effectiveGoalId = goalId ?? plan.id;
  const milestoneTitle =
    milestoneId === null
      ? 'None'
      : (milestones.find((milestone) => milestone.id === milestoneId)?.title ?? 'Unknown milestone');

  const presentGoalPicker = (
    sheetTitle: string,
    selected: GoalId,
    onSelect: (id: GoalId) => void,
  ): void =>
    navigation.presentSheet(
      <OptionSheet
        title={sheetTitle}
        options={goalOptions.map((option) => ({
          key: option.id,
          label: option.title,
          ...(option.parentTitle === undefined
            ? {}
            : { sublabel: `Under ${option.parentTitle}` }),
        }))}
        selectedKey={selected}
        onSelect={(key) => onSelect(key)}
      />,
    );

  const presentMilestonePicker = (): void =>
    navigation.presentSheet(
      <OptionSheet
        title="Milestone"
        options={[
          { key: 'none', label: 'None' },
          ...milestones.map((milestone) => ({
            key: milestone.id,
            label: milestone.title,
            sublabel: shortDate(milestone.date),
          })),
        ]}
        selectedKey={milestoneId ?? 'none'}
        onSelect={(key) => setMilestoneId(key === 'none' ? null : key)}
      />,
    );

  const submit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const now = new Date();
      if (tab === 'milestone') {
        const date = parseDateText(dateText);
        if (date === null) {
          setError('Date must match YYYY-MM-DD.');
          return;
        }
        await addMilestone.add({ id: createId(), projectId, title, date, now });
      } else {
        const trimmedDue = dueText.trim();
        const due = trimmedDue === '' ? null : parseDateText(trimmedDue);
        if (trimmedDue !== '' && due === null) {
          setError('Due must match YYYY-MM-DD.');
          return;
        }
        const shared = {
          projectId,
          title,
          ...(due === null ? {} : { due }),
          ...(milestoneId === null ? {} : { milestoneId }),
          now,
        };
        if (tab === 'subgoal') {
          await addSubGoal.add({ id: createId(), parentGoalId: effectiveParentGoalId, ...shared });
        } else {
          await addTask.add({
            id: createId(),
            recordId: createId(),
            relationId: createId(),
            goalId: effectiveGoalId,
            ...shared,
          });
        }
      }
      navigation.goBack();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel =
    tab === 'subgoal' ? 'Add sub-goal' : tab === 'task' ? 'Add task' : 'Add milestone';

  const formRows: React.ReactNode[] =
    tab === 'milestone'
      ? [
          <FormTextRow
            key="name"
            testID="milestone-name"
            label="Name"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Race week"
          />,
          <FormTextRow
            key="date"
            testID="milestone-date"
            label="Date"
            value={dateText}
            onChangeText={setDateText}
            placeholder="YYYY-MM-DD"
          />,
        ]
      : [
          <FormTextRow
            key="title"
            testID="plan-item-title"
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder={
              tab === 'subgoal' ? 'e.g. 15 km under 75:00' : 'e.g. Cruise intervals 4 × 1600 m'
            }
          />,
          <FormPickerRow
            key="goal"
            testID="plan-item-goal"
            label={tab === 'subgoal' ? 'Under' : 'Goal'}
            value={goalTitle(tab === 'subgoal' ? effectiveParentGoalId : effectiveGoalId)}
            subtitle={
              tab === 'subgoal'
                ? 'Parent goal — tap to move it in the tree'
                : 'The goal this task implements — any level of the tree'
            }
            onPress={() =>
              tab === 'subgoal'
                ? presentGoalPicker('Under (parent goal)', effectiveParentGoalId, setParentGoalId)
                : presentGoalPicker('Goal', effectiveGoalId, setGoalId)
            }
          />,
          <FormTextRow
            key="due"
            testID="plan-item-due"
            label="Due"
            value={dueText}
            onChangeText={setDueText}
            placeholder="YYYY-MM-DD · optional"
          />,
          <FormPickerRow
            key="milestone"
            testID="plan-item-milestone"
            label="Milestone"
            value={milestoneTitle}
            subtitle="Optional — groups it on the roadmap"
            onPress={presentMilestonePicker}
          />,
        ];

  return (
    <View testID="add-plan-item-page" style={styles.screen}>
      <InlineNavBar title="Add to plan" onBack={navigation.goBack} />
      {/* Explicit type argument: without `strictFunctionTypes` (expo base
          config) K would otherwise widen to string. */}
      <SegmentedControl<TabKey>
        testID="add-plan-item-segmented"
        options={TAB_OPTIONS}
        selected={tab}
        onSelect={setTab}
      />
      <ScrollView>
        <ListSection variant="panel">{formRows}</ListSection>
        {tab === 'milestone' ? (
          <SectionNote>
            A milestone is just a named date inside the project. Assign sub-goals and tasks to it
            from their own tabs above.
          </SectionNote>
        ) : null}
        {error === null ? null : (
          <Text testID="add-plan-item-error" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={styles.submit}>
          <PrimaryChipButton
            testID="add-plan-item-submit"
            label={submitLabel}
            disabled={submitting}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  error: {
    marginTop: 12,
    marginHorizontal: spacing.textMargin,
    fontSize: 13,
    fontWeight: '500',
    color: colors.conflictRed,
  },
  submit: {
    marginTop: 18,
    marginHorizontal: spacing.screenMargin,
    paddingBottom: 30,
    alignItems: 'center',
  },
});
