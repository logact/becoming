import React from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  ProjectGoalNode,
  ProjectTaskItem,
} from '../../../application/project/ProjectDetailService';
import type { GoalId } from '../../../domain/shared/ids';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { StatusPill } from '../../components/StatusPill';
import {
  GOAL_STATUS_PILL,
  TaskStatusMeta,
  countSubGoals,
  countTasks,
  planViewStyles,
  shortDate,
} from './planShared';

/** Indent per nesting level in the plan tree. */
const LEVEL_INDENT = 20;

export interface PlanTreeViewProps {
  /** Plan tree rooted at the goal the project serves. */
  plan: ProjectGoalNode;
  onOpenGoal: (goalId: GoalId) => void;
  /** Pushes the add-plan-item screen; the tapped node preselects the parent. */
  onAddPlanItem: (parentGoalId: GoalId) => void;
}

function taskRow(task: ProjectTaskItem): React.ReactNode {
  return (
    <ListRow
      key={task.id}
      testID={`plan-task-${task.id}`}
      icon="checkCircle"
      title={task.title}
      {...(task.status === 'done' ? { titleStyle: planViewStyles.doneTitle } : {})}
      {...(task.due === undefined ? {} : { subtitle: `Due ${shortDate(task.due)}` })}
      trailing={<TaskStatusMeta status={task.status} />}
    />
  );
}

/**
 * Tree panel of the plan section: the serving goal plus nested sub-goals
 * (indented per level), each node's task rows under it and an "Add task or
 * sub-goal" row closing every level. Task rows don't navigate yet; goal rows
 * open the goal detail.
 */
export function PlanTreeView({ plan, onOpenGoal, onAddPlanItem }: PlanTreeViewProps) {
  const renderNode = (node: ProjectGoalNode, depth: number): React.ReactNode => {
    const pill = GOAL_STATUS_PILL[node.status];
    const counts = countTasks(node);
    const subtitle =
      depth === 0
        ? `Goal · ${countSubGoals(node)} sub-goals · ${counts.total} tasks`
        : `Sub-goal · ${counts.done} / ${counts.total} tasks`;
    const rowIndent = depth === 0 ? undefined : { paddingLeft: depth * LEVEL_INDENT };
    const childIndent = { paddingLeft: (depth + 1) * LEVEL_INDENT };
    return (
      <View key={node.id}>
        <View style={rowIndent}>
          <ListRow
            testID={`plan-goal-${node.id}`}
            {...(depth === 0 ? { icon: 'target' as const } : {})}
            title={node.title}
            subtitle={subtitle}
            trailing={<StatusPill state={pill.state} label={pill.label} />}
            onPress={() => onOpenGoal(node.id)}
          />
        </View>
        {node.tasks.length === 0 ? null : (
          <View style={childIndent}>{node.tasks.map(taskRow)}</View>
        )}
        {node.children.map((child) => renderNode(child, depth + 1))}
        <View style={childIndent}>
          <ListRow
            testID={`add-plan-item-${node.id}`}
            icon="plus"
            title="Add task or sub-goal"
            titleStyle={planViewStyles.addRowTitle}
            onPress={() => onAddPlanItem(node.id)}
          />
        </View>
      </View>
    );
  };

  return (
    <View testID="plan-tree-view" style={styles.container}>
      <ListSection variant="panel">{renderNode(plan, 0)}</ListSection>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
