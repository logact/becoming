import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type {
  ProjectGoalNode,
  ProjectTaskItem,
} from '../../../application/project/ProjectDetailService';
import type { GoalId } from '../../../domain/shared/ids';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { StatusPill } from '../../components/StatusPill';
import { colors } from '../../shared/theme';
import {
  GOAL_STATUS_PILL,
  TaskStatusMeta,
  countTasks,
  planViewStyles,
  shortDate,
} from './planShared';

export interface PlanListViewProps {
  /** Plan tree; sub-goals are flattened out of it (the root goal is skipped). */
  plan: ProjectGoalNode;
  /** Flat task list, each with its owning goal's title when targeted. */
  tasks: ProjectTaskItem[];
  onOpenGoal: (goalId: GoalId) => void;
}

interface FlatSubGoal {
  node: ProjectGoalNode;
  /** Parent goal title; undefined for direct children of the root goal. */
  parentTitle?: string;
}

/** Pre-order flattening; parent context is only kept below the root goal. */
function flattenSubGoals(root: ProjectGoalNode): FlatSubGoal[] {
  const rows: FlatSubGoal[] = [];
  const walk = (node: ProjectGoalNode, isRoot: boolean): void => {
    for (const child of node.children) {
      rows.push({ node: child, ...(isRoot ? {} : { parentTitle: node.title }) });
      walk(child, false);
    }
  };
  walk(root, true);
  return rows;
}

function taskSubtitle(task: ProjectTaskItem): string | undefined {
  const parts: string[] = [];
  if (task.goalTitle !== undefined) {
    parts.push(task.goalTitle);
  }
  if (task.due !== undefined) {
    parts.push(`Due ${shortDate(task.due)}`);
  }
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/**
 * List panel of the plan section: a flat view of the whole tree — a Sub-goals
 * group (each row shows its parent context) and a Tasks group (each row shows
 * the goal it targets). Task rows don't navigate yet.
 */
export function PlanListView({ plan, tasks, onOpenGoal }: PlanListViewProps) {
  const subGoals = flattenSubGoals(plan);
  return (
    <View testID="plan-list-view">
      <ListSection variant="panel">
        <Text style={styles.groupLabel}>Sub-goals</Text>
        {subGoals.map(({ node, parentTitle }) => {
          const pill = GOAL_STATUS_PILL[node.status];
          const counts = countTasks(node);
          const parts: string[] = [];
          if (parentTitle !== undefined) {
            parts.push(`under ${parentTitle}`);
          }
          parts.push(`${counts.done} / ${counts.total} tasks`);
          return (
            <ListRow
              key={node.id}
              testID={`list-goal-${node.id}`}
              title={node.title}
              subtitle={parts.join(' · ')}
              trailing={<StatusPill state={pill.state} label={pill.label} />}
              onPress={() => onOpenGoal(node.id)}
            />
          );
        })}
        <Text style={styles.groupLabel}>Tasks</Text>
        {tasks.map((task) => (
          <ListRow
            key={task.id}
            testID={`list-task-${task.id}`}
            icon="checkCircle"
            title={task.title}
            {...(task.status === 'done' ? { titleStyle: planViewStyles.doneTitle } : {})}
            {...(taskSubtitle(task) === undefined
              ? {}
              : { subtitle: taskSubtitle(task) as string })}
            trailing={<TaskStatusMeta status={task.status} />}
          />
        ))}
      </ListSection>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Prototype `.group-label`: uppercase faint label splitting panel groups. */
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: colors.faint,
    paddingTop: 13,
    paddingBottom: 6,
    paddingHorizontal: 18,
  },
});
