import React from 'react';
import { StyleSheet, Text } from 'react-native';

import type { ProjectGoalNode } from '../../../application/project/ProjectDetailService';
import type { GoalStatus } from '../../../domain/goal/Goal';
import type { TaskStatus } from '../../../domain/task/Task';
import type { StatusState } from '../../components/StatusPill';
import { colors } from '../../shared/theme';

/** `StatusPill` has no `failed` state; the prototype renders it as conflict. */
export const GOAL_STATUS_PILL: Record<GoalStatus, { state: StatusState; label: string }> = {
  todo: { state: 'todo', label: 'Todo' },
  doing: { state: 'doing', label: 'Doing' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

/** Same status union as goals, so milestone items can share these maps. */
export const TASK_STATUS_PILL: Record<TaskStatus, { state: StatusState; label: string }> = {
  todo: { state: 'todo', label: 'Todo' },
  doing: { state: 'doing', label: 'Doing' },
  paused: { state: 'paused', label: 'Paused' },
  failed: { state: 'conflict', label: 'Failed' },
  done: { state: 'done', label: 'Done' },
};

export function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function weekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/** Recursive done/total task count across a goal node's subtree. */
export function countTasks(node: ProjectGoalNode): { done: number; total: number } {
  let done = node.tasks.filter((task) => task.status === 'done').length;
  let total = node.tasks.length;
  for (const child of node.children) {
    const childCounts = countTasks(child);
    done += childCounts.done;
    total += childCounts.total;
  }
  return { done, total };
}

/** Number of descendant sub-goals of a node. */
export function countSubGoals(node: ProjectGoalNode): number {
  return node.children.reduce((count, child) => count + 1 + countSubGoals(child), 0);
}

/** Trailing status meta text for task rows (the prototype's `row-meta`). */
export function TaskStatusMeta({ status }: { status: TaskStatus }) {
  return <Text style={planViewStyles.meta}>{TASK_STATUS_PILL[status].label}</Text>;
}

/** Styles shared by the plan views. */
export const planViewStyles = StyleSheet.create({
  /** Green "Add …" row label (prototype `.add-row`). */
  addRowTitle: { fontSize: 13.5, fontWeight: '700', color: colors.green },
  /** Done task titles are struck through in faint (prototype `.t-done`). */
  doneTitle: { color: colors.faint, textDecorationLine: 'line-through' },
  /** Meta / timestamps: 12.5px / 500, faint. */
  meta: { fontSize: 12.5, fontWeight: '500', color: colors.faint },
});
