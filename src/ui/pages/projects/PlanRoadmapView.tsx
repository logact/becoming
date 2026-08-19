import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  ProjectMilestone,
  ProjectMilestoneItem,
} from '../../../application/project/ProjectDetailService';
import type { GoalId } from '../../../domain/shared/ids';
import { IconChip } from '../../components/IconChip';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { StatusPill } from '../../components/StatusPill';
import { colors } from '../../shared/theme';
import {
  GOAL_STATUS_PILL,
  TaskStatusMeta,
  planViewStyles,
  shortDate,
  weekday,
} from './planShared';

export interface PlanRoadmapViewProps {
  /** Project milestones sorted by date. */
  milestones: ProjectMilestone[];
  /** Reference "today": positions the today marker between the milestones. */
  now: Date;
  /** Project due date; closes the roadmap when set. */
  projectDue?: Date;
  projectName: string;
  onOpenGoal: (goalId: GoalId) => void;
  /** Pushes the add-plan-item screen on its milestone tab. */
  onAddMilestone: () => void;
}

function milestoneSubtitle(milestone: ProjectMilestone): string {
  const goals = milestone.items.filter((item) => item.kind === 'goal').length;
  const tasks = milestone.items.length - goals;
  const parts = ['Milestone'];
  if (goals > 0) {
    parts.push(`${goals} sub-goal${goals === 1 ? '' : 's'}`);
  }
  if (tasks > 0) {
    parts.push(`${tasks} task${tasks === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

function DateColumn({ date }: { date: Date }) {
  return (
    <View style={styles.date}>
      <Text style={styles.dateDay}>{shortDate(date)}</Text>
      <Text style={styles.dateWeekday}>{weekday(date)}</Text>
    </View>
  );
}

function MilestoneRow({ milestone }: { milestone: ProjectMilestone }) {
  return (
    <View testID={`milestone-${milestone.id}`} style={styles.row}>
      <DateColumn date={milestone.date} />
      <View style={styles.main}>
        <Text style={styles.milestoneTitle} numberOfLines={1}>
          {milestone.title}
        </Text>
        <Text style={styles.subtitle}>{milestoneSubtitle(milestone)}</Text>
      </View>
      {milestone.reached ? (
        <StatusPill state="done" label="Reached" />
      ) : (
        <StatusPill state="todo" label="Upcoming" />
      )}
    </View>
  );
}

function MilestoneItemRow({
  item,
  onOpenGoal,
}: {
  item: ProjectMilestoneItem;
  onOpenGoal: (goalId: GoalId) => void;
}) {
  const subtitle =
    item.kind === 'goal'
      ? `Sub-goal${item.context === undefined ? '' : ` · under ${item.context}`}`
      : `Task${item.context === undefined ? '' : ` · ${item.context}`}`;
  const trailing =
    item.kind === 'goal' ? (
      <StatusPill
        state={GOAL_STATUS_PILL[item.status].state}
        label={GOAL_STATUS_PILL[item.status].label}
      />
    ) : (
      <TaskStatusMeta status={item.status} />
    );
  const body = (
    <>
      <View style={styles.main}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {trailing}
    </>
  );
  if (item.kind === 'goal') {
    return (
      <Pressable
        testID={`milestone-item-${item.id}`}
        onPress={() => onOpenGoal(item.id)}
        style={({ pressed }) => [styles.row, styles.itemRow, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View testID={`milestone-item-${item.id}`} style={[styles.row, styles.itemRow]}>
      {body}
    </View>
  );
}

/** Dashed sage "Today" marker (prototype `.rm-today`). */
function TodayMarker() {
  return (
    <View testID="roadmap-today" style={styles.today}>
      <Text style={styles.todayLabel}>Today</Text>
      <View style={styles.todayLine} />
    </View>
  );
}

/**
 * Roadmap panel of the plan section: milestones ordered by date with a
 * Reached/Upcoming pill and their linked goals/tasks, the "Today" marker
 * inserted at `now`, then the "Project due" row and an "Add milestone" row.
 */
export function PlanRoadmapView({
  milestones,
  now,
  projectDue,
  projectName,
  onOpenGoal,
  onAddMilestone,
}: PlanRoadmapViewProps) {
  const todayIndex = milestones.findIndex((milestone) => milestone.date.getTime() > now.getTime());

  const rows: React.ReactNode[] = [];
  milestones.forEach((milestone, index) => {
    if (index === todayIndex) {
      rows.push(<TodayMarker key="today" />);
    }
    rows.push(
      <View key={milestone.id}>
        <MilestoneRow milestone={milestone} />
        {milestone.items.map((item) => (
          <MilestoneItemRow key={`${item.kind}-${item.id}`} item={item} onOpenGoal={onOpenGoal} />
        ))}
      </View>,
    );
  });
  if (todayIndex === -1 && milestones.length > 0) {
    rows.push(<TodayMarker key="today" />);
  }

  return (
    <View testID="plan-roadmap-view">
      <ListSection variant="panel">
        {rows}
        {projectDue === undefined ? null : (
          <View testID="project-due-row" style={styles.row}>
            <DateColumn date={projectDue} />
            <View style={styles.main}>
              <Text style={styles.milestoneTitle}>Project due</Text>
              <Text style={styles.subtitle}>{projectName} ends</Text>
            </View>
            <IconChip name="box" />
          </View>
        )}
        <ListRow
          testID="add-milestone"
          icon="plus"
          title="Add milestone"
          titleStyle={planViewStyles.addRowTitle}
          onPress={onAddMilestone}
        />
      </ListSection>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  itemRow: { paddingLeft: 18 + 46 + 11 },
  pressed: { opacity: 0.5 },
  date: { width: 46 },
  dateDay: { fontSize: 13, fontWeight: '700', color: colors.ink },
  dateWeekday: { fontSize: 11, fontWeight: '500', color: colors.faint, marginTop: 1 },
  main: { flex: 1, justifyContent: 'center' },
  milestoneTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: colors.ink },
  itemTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  today: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18 },
  todayLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: colors.sage,
  },
  todayLine: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sage },
});
