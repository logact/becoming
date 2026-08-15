import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Project } from '../../domain/project';
import type { TimelineEvent } from '../../domain/timelineEvent';
import type { ProjectGoalPursuitView } from '../../application/projectGoalPursuitQueryService';
import type { TaskProjectMembershipView } from '../../application/taskProjectMembershipQueryService';
import { formatActivityTime } from '../goals/goalActivity';
import { useShellNavigation } from '../navigation/NavigationShell';
import { StatusBadge } from '../shared/StatusBadge';
import { colors, radius, spacing } from '../shared/theme';
import { describeProjectActivity } from './projectActivity';
import { requestCrossDestinationDetail } from './crossDestinationDetail';
import { ProjectPursuitActions } from './pursuit/ProjectPursuitActions';

export interface ProjectOverviewProps {
  project: Project;
  /** Active Project -> Goal pursuits, from the pursuit query. */
  pursuits: ProjectGoalPursuitView[];
  /** Active Task memberships, from the membership query (read-only here). */
  memberTasks: TaskProjectMembershipView[];
  /** Persisted Project activity, newest first. */
  activity: TimelineEvent[];
  /** Re-run the detail queries after a committed mutation. */
  refresh: () => void;
}

/**
 * The Project detail Overview segment: pursued-Goal and member-Task facts,
 * pursued Goal rows (or their explicit empty state), member Task rows (or
 * their explicit empty state), and recent persisted Project activity. Task
 * membership is displayed read-only — membership mutation belongs to #132.
 * Rows navigate to the corresponding Goal or Task detail.
 */
export function ProjectOverview({
  project,
  pursuits,
  memberTasks,
  activity,
  refresh,
}: ProjectOverviewProps) {
  const navigation = useShellNavigation();
  const archived = project.archivedAt !== null;

  function openGoal(goalId: string) {
    requestCrossDestinationDetail({ destination: 'goals', entityId: goalId });
    navigation.switchDestination('goals');
  }

  function openTask(taskId: string) {
    requestCrossDestinationDetail({ destination: 'tasks', entityId: taskId });
    navigation.switchDestination('tasks');
  }

  return (
    <View>
      <View style={styles.factGrid}>
        <Fact label="Pursued goals" value={`${pursuits.length}`} />
        <Fact label="Member tasks" value={`${memberTasks.length}`} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
          Pursued goals
        </Text>
        {!archived && (
          <ProjectPursuitActions project={project} pursuits={pursuits} onChanged={refresh} />
        )}
      </View>
      {pursuits.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={2}>
            No pursued Goals
          </Text>
          <Text style={styles.emptyMessage} maxFontSizeMultiplier={2}>
            Connect a Goal to explain why this Project exists.
          </Text>
        </View>
      ) : (
        <View style={styles.sectionRows}>
          {pursuits.map((pursuit) => (
            <Pressable
              key={pursuit.relationId}
              onPress={() => openGoal(pursuit.goalId)}
              accessibilityRole="button"
              accessibilityLabel={`Open goal ${pursuit.goal?.title ?? 'unavailable'}`}
              style={({ pressed }) => [styles.sectionRow, pressed && styles.rowPressed]}
            >
              <Text style={styles.sectionRowIcon} accessibilityElementsHidden
                importantForAccessibility="no">
                ◎
              </Text>
              <View style={styles.sectionRowMain}>
                <Text style={styles.sectionRowTitle} maxFontSizeMultiplier={2}>
                  {pursuit.goal?.title ?? 'Goal unavailable'}
                </Text>
                {pursuit.goal !== null && (
                  <Text style={styles.sectionRowSub} maxFontSizeMultiplier={2}>
                    {pursuit.goal.targetState}
                  </Text>
                )}
              </View>
              <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
                ›
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
          Member tasks
        </Text>
      </View>
      {memberTasks.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={2}>
            No member Tasks
          </Text>
          <Text style={styles.emptyMessage} maxFontSizeMultiplier={2}>
            Tasks join this Project through membership, added by the Task planning flow.
          </Text>
        </View>
      ) : (
        <View style={styles.sectionRows}>
          {memberTasks.map((membership) => (
            <Pressable
              key={membership.relationId}
              onPress={() => openTask(membership.taskId)}
              accessibilityRole="button"
              accessibilityLabel={`Open task ${membership.task?.title ?? 'unavailable'}`}
              style={({ pressed }) => [styles.sectionRow, pressed && styles.rowPressed]}
            >
              <Text style={styles.sectionRowIcon} accessibilityElementsHidden
                importantForAccessibility="no">
                ✓
              </Text>
              <View style={styles.sectionRowMain}>
                <Text style={styles.sectionRowTitle} maxFontSizeMultiplier={2}>
                  {membership.task?.title ?? 'Task unavailable'}
                </Text>
                {membership.task !== null && (
                  <Text style={styles.sectionRowSub} maxFontSizeMultiplier={2}>
                    {membership.task.targetDescription}
                  </Text>
                )}
              </View>
              {membership.task?.priority !== null && membership.task?.priority !== undefined && (
                <StatusBadge label={`P${membership.task.priority}`} icon="↑" />
              )}
              <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
                ›
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
          Recent activity
        </Text>
      </View>
      {activity.length === 0 ? (
        <Text style={styles.emptyActivity} maxFontSizeMultiplier={2}>
          No recorded activity yet.
        </Text>
      ) : (
        <View style={styles.sectionRows}>
          {activity.map((event) => {
            const item = describeProjectActivity(event);
            return (
              <View key={event.recordId} style={styles.sectionRow}>
                <Text style={styles.sectionRowIcon} accessibilityElementsHidden
                  importantForAccessibility="no">
                  {item.icon}
                </Text>
                <View style={styles.sectionRowMain}>
                  <Text style={styles.sectionRowTitle} maxFontSizeMultiplier={2}>
                    {item.text}
                  </Text>
                  <Text style={styles.sectionRowSub} maxFontSizeMultiplier={2}>
                    {formatActivityTime(event.occurredAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <Text style={styles.factValue} maxFontSizeMultiplier={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  factGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  fact: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  factValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  emptySection: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  emptyActivity: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionRows: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowPressed: {
    backgroundColor: colors.canvas,
  },
  sectionRowIcon: {
    fontSize: 14,
    color: colors.brand,
  },
  sectionRowMain: {
    flex: 1,
    minWidth: 0,
  },
  sectionRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  sectionRowSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  chevron: {
    fontSize: 18,
    color: colors.muted,
  },
});
