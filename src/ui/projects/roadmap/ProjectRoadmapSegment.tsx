import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  MilestoneRoadmapItem,
  ProjectRoadmap,
} from '../../../application/projectRoadmapQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { StatusBadge } from '../../shared/StatusBadge';
import { useToast } from '../../shared/Toast';
import { colors, fonts, radius, spacing } from '../../shared/theme';
import type { ProjectDetailSegmentContext } from '../projectDetailSlots';
import { ProjectPursuitActions } from '../pursuit/ProjectPursuitActions';
import { MilestoneActions } from './MilestoneActions';
import { MilestoneFormSheet } from './MilestoneFormSheet';
import type { MilestoneGoalCandidate } from './MilestoneGoalPicker';
import {
  describeRoadmapFinding,
  formatTargetDate,
  goalStatusPresentation,
  milestoneAccessibilityLabel,
  milestonePositionLabel,
  milestoneProgressText,
  nextMilestoneId,
  roadmapSummaryText,
} from './roadmapPresentation';

type RoadmapState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; roadmap: ProjectRoadmap };

/**
 * The Project detail Roadmap segment: the ordered Milestones of the Project's
 * exact active Goal pursuit, each grouping its assigned sub-goals. Renders
 * ONLY the ProjectRoadmapQueryService result — reached flags, per-Goal
 * completion, summary counts, unassigned-Goal detection, and integrity
 * findings all arrive from the read model; this segment formats dates and
 * findings but never recalculates completion.
 *
 * Explicit states (prototype): no pursued Goal; pursued Goal with no
 * sub-goals; sub-goals with no Milestones; ordered Milestones with nested Goal
 * sets; unscheduled Goal warning; next-Milestone emphasis; reached Milestone;
 * complete Roadmap; loading, retry, and integrity findings; add/edit/remove/
 * reorder flows for active Projects.
 */
export function ProjectRoadmapSegment({ project, refresh }: ProjectDetailSegmentContext) {
  const services = useAppServices();
  const navigation = useShellNavigation();
  const { showToast } = useToast();

  const [state, setState] = useState<RoadmapState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      try {
        const roadmap = await services.roadmaps.getProjectRoadmap(project.id);
        if (!cancelled) setState({ status: 'ready', roadmap });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The Roadmap could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    // A late response from a superseded load is dropped, never rendered.
    return () => {
      cancelled = true;
    };
  }, [project.id, reloadToken, services]);

  /** After a committed mutation: re-run the Roadmap and the detail's projections. */
  const afterMutation = useCallback(() => {
    reload();
    refresh();
  }, [reload, refresh]);

  function openAddMilestone(roadmap: ProjectRoadmap) {
    navigation.presentSheet(
      <MilestoneFormSheet
        mode="create"
        project={project}
        candidates={buildGoalCandidates(roadmap)}
        onSaved={() => {
          navigation.dismissSheet();
          showToast('Milestone created');
          afterMutation();
        }}
        onCancel={navigation.dismissSheet}
      />,
    );
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.stateBlock} accessibilityLabel="Loading roadmap">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.stateText}>Loading roadmap…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.stateBlock}>
        <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
          !
        </Text>
        <Text style={styles.stateTitle} maxFontSizeMultiplier={2}>
          Roadmap unavailable
        </Text>
        <Text style={styles.stateText} maxFontSizeMultiplier={2}>
          {state.message}
        </Text>
        <Text style={styles.stateText} maxFontSizeMultiplier={2}>
          The Roadmap is a read model — no mutation was attempted.
        </Text>
        <Pressable
          onPress={reload}
          accessibilityRole="button"
          accessibilityLabel="Retry loading roadmap"
          style={styles.retryButton}
        >
          <Text style={styles.retryText} maxFontSizeMultiplier={2}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  const { roadmap } = state;
  const archived = project.archivedAt !== null;

  if (roadmap.pursuit === null) {
    return (
      <View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon} accessibilityElementsHidden importantForAccessibility="no">
            ◇
          </Text>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={2}>
            No roadmap yet
          </Text>
          <Text style={styles.emptyMessage} maxFontSizeMultiplier={2}>
            Connect a Goal first, then split its target state into required sub-goals.
          </Text>
          {!archived && (
            <View style={styles.emptyActions}>
              <ProjectPursuitActions project={project} pursuits={[]} onChanged={afterMutation} />
            </View>
          )}
        </View>
        <FindingsCard roadmap={roadmap} />
      </View>
    );
  }

  const hasSubGoals =
    roadmap.unassignedGoals.length > 0 ||
    roadmap.milestones.some((item) => item.goals.length > 0);
  const nextId = nextMilestoneId(roadmap);
  const complete =
    roadmap.summary.totalMilestones > 0 &&
    roadmap.summary.reachedMilestones === roadmap.summary.totalMilestones;

  return (
    <View>
      {roadmap.milestones.length === 0 && !hasSubGoals && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon} accessibilityElementsHidden importantForAccessibility="no">
            ◇
          </Text>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={2}>
            No sub-goals to schedule
          </Text>
          <Text style={styles.emptyMessage} maxFontSizeMultiplier={2}>
            Decompose the pursued Goal in Structure before grouping its Goals into milestones.
          </Text>
        </View>
      )}

      {roadmap.milestones.length === 0 && hasSubGoals && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon} accessibilityElementsHidden importantForAccessibility="no">
            ◇
          </Text>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={2}>
            No milestones yet
          </Text>
          <Text style={styles.emptyMessage} maxFontSizeMultiplier={2}>
            Group one or more sub-goals into a checkpoint on the road to the pursued Goal.
          </Text>
          {!archived && <AddMilestoneButton onPress={() => openAddMilestone(roadmap)} />}
        </View>
      )}

      {roadmap.milestones.length > 0 && (
        <View style={styles.summary} accessible accessibilityLabel={`Roadmap summary: ${roadmapSummaryText(roadmap)}`}>
          <Text style={styles.summaryTitle} maxFontSizeMultiplier={2}>
            {`${roadmap.summary.totalMilestones} ${
              roadmap.summary.totalMilestones === 1 ? 'milestone' : 'milestones'
            }`}
          </Text>
          <Text style={styles.summaryText} maxFontSizeMultiplier={2}>
            {roadmapSummaryText(roadmap)}
          </Text>
        </View>
      )}

      {complete && (
        <View style={[styles.note, styles.noteSuccess]} accessibilityLabel="Roadmap complete">
          <Text style={styles.noteIcon} accessibilityElementsHidden importantForAccessibility="no">
            ✓
          </Text>
          <View style={styles.noteBody}>
            <Text style={styles.noteTitle} maxFontSizeMultiplier={2}>
              Roadmap complete
            </Text>
            <Text style={styles.noteText} maxFontSizeMultiplier={2}>
              Every milestone is reached — all assigned Goals are complete.
            </Text>
          </View>
        </View>
      )}

      {roadmap.unassignedGoals.length > 0 && (
        <View
          style={[styles.note, styles.noteWarning]}
          accessibilityLabel="Unscheduled sub-goals warning"
        >
          <Text style={styles.noteIcon} accessibilityElementsHidden importantForAccessibility="no">
            ○
          </Text>
          <View style={styles.noteBody}>
            <Text style={styles.noteTitle} maxFontSizeMultiplier={2}>
              {`${roadmap.unassignedGoals.length} ${
                roadmap.unassignedGoals.length === 1 ? 'sub-goal' : 'sub-goals'
              } not scheduled`}
            </Text>
            <Text style={styles.noteText} maxFontSizeMultiplier={2}>
              {`${roadmap.unassignedGoals
                .map((node) => (node.type === 'goal' ? (node.goal?.title ?? 'Missing endpoint') : 'Missing endpoint'))
                .join(', ')} — assign each sub-goal to a Milestone to complete the plan.`}
            </Text>
          </View>
        </View>
      )}

      {roadmap.milestones.map((item, index) => (
        <MilestoneCard
          key={item.milestone.id}
          project={project}
          roadmap={roadmap}
          item={item}
          index={index}
          isNext={item.milestone.id === nextId}
          archived={archived}
          onChanged={afterMutation}
        />
      ))}

      {!archived && roadmap.milestones.length > 0 && hasSubGoals && (
        <AddMilestoneButton onPress={() => openAddMilestone(roadmap)} />
      )}

      <FindingsCard roadmap={roadmap} />
    </View>
  );
}

/**
 * Compose the Goal-picker candidates from the Roadmap read model: the editing
 * Milestone's own Goals stay selectable, unassigned descendant Goals are
 * available, and Goals assigned to another active Milestone remain visible
 * but disabled with the conflict explanation.
 */
function buildGoalCandidates(
  roadmap: ProjectRoadmap,
  editing?: MilestoneRoadmapItem,
): MilestoneGoalCandidate[] {
  const candidates: MilestoneGoalCandidate[] = [];
  if (editing !== undefined) {
    for (const goal of editing.goals) {
      candidates.push({
        goalId: goal.assignment.goalId,
        title: goal.goal?.title ?? 'Missing endpoint',
        detail: goal.goal?.targetState ?? null,
        disabledReason: null,
      });
    }
  }
  const ownGoalIds = new Set(candidates.map((candidate) => candidate.goalId));
  for (const node of roadmap.unassignedGoals) {
    const goal = node.type === 'goal' ? node.goal : null;
    candidates.push({
      goalId: node.id,
      title: goal?.title ?? 'Missing endpoint',
      detail: goal?.targetState ?? null,
      disabledReason: null,
    });
  }
  for (const item of roadmap.milestones) {
    if (editing !== undefined && item.milestone.id === editing.milestone.id) continue;
    for (const goal of item.goals) {
      if (ownGoalIds.has(goal.assignment.goalId)) continue;
      candidates.push({
        goalId: goal.assignment.goalId,
        title: goal.goal?.title ?? 'Missing endpoint',
        detail: goal.goal?.targetState ?? null,
        disabledReason: `Already assigned to "${item.milestone.title}"`,
      });
    }
  }
  return candidates;
}

function AddMilestoneButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add milestone"
      style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
    >
      <Text style={styles.addButtonText} maxFontSizeMultiplier={2}>
        Add milestone
      </Text>
    </Pressable>
  );
}

function MilestoneCard({
  project,
  roadmap,
  item,
  index,
  isNext,
  archived,
  onChanged,
}: {
  project: ProjectDetailSegmentContext['project'];
  roadmap: ProjectRoadmap;
  item: MilestoneRoadmapItem;
  index: number;
  isNext: boolean;
  archived: boolean;
  onChanged: () => void;
}) {
  return (
    <View
      style={[
        styles.milestone,
        isNext && styles.milestoneNext,
        item.reached && styles.milestoneReached,
      ]}
    >
      <View
        style={styles.milestoneHeader}
        accessible
        accessibilityRole="text"
        accessibilityLabel={milestoneAccessibilityLabel(
          item,
          index,
          roadmap.milestones.length,
          isNext,
        )}
      >
        <View style={styles.milestoneKicker}>
          <Text style={styles.milestoneMark} accessibilityElementsHidden
            importantForAccessibility="no">
            {item.reached ? '✓' : '◇'}
          </Text>
          <Text style={styles.milestonePosition} maxFontSizeMultiplier={2}>
            {`${isNext && !item.reached ? 'Next · ' : ''}${milestonePositionLabel(index)}`}
          </Text>
          <Text style={styles.milestoneDate} maxFontSizeMultiplier={2}>
            {formatTargetDate(item.milestone.targetAt)}
          </Text>
        </View>
        <Text style={styles.milestoneTitle} accessibilityRole="header" maxFontSizeMultiplier={2}>
          {item.milestone.title}
        </Text>
        {item.milestone.description !== null && (
          <Text style={styles.milestoneDescription} maxFontSizeMultiplier={2}>
            {item.milestone.description}
          </Text>
        )}
        <Text style={styles.milestoneProgress} maxFontSizeMultiplier={2}>
          {milestoneProgressText(item)}
        </Text>
      </View>

      <View style={styles.goalList}>
        {item.goals.map((goal) => {
          const status = goalStatusPresentation(goal.status);
          const title = goal.goal?.title ?? 'Missing endpoint';
          return (
            <View
              key={goal.assignment.id}
              style={styles.goalRow}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${title}: ${status.label}`}
            >
              <Text
                style={[
                  styles.goalTitle,
                  goal.goal === null && styles.goalTitleMissing,
                  goal.complete && styles.goalTitleComplete,
                ]}
                maxFontSizeMultiplier={2}
                numberOfLines={2}
              >
                {title}
              </Text>
              <StatusBadge label={status.label} icon={status.icon} tone={status.tone} />
            </View>
          );
        })}
      </View>

      {!archived && (
        <MilestoneActions
          project={project}
          roadmap={roadmap}
          item={item}
          index={index}
          candidates={buildGoalCandidates(roadmap, item)}
          onChanged={onChanged}
        />
      )}
    </View>
  );
}

/**
 * Integrity-level findings, as supplied. Per-Goal lifecycle findings render
 * as the Goal rows' status badges and unassigned-Goal findings as the
 * unscheduled warning, so neither repeats here.
 */
function FindingsCard({ roadmap }: { roadmap: ProjectRoadmap }) {
  const findings = roadmap.findings.filter(
    (finding) =>
      finding.kind !== 'goal_lifecycle_unsatisfied' && finding.kind !== 'unassigned_goal',
  );
  if (findings.length === 0) return null;
  return (
    <View style={styles.findings}>
      <Text style={styles.findingsTitle} maxFontSizeMultiplier={2}>
        {`Roadmap findings · ${findings.length}`}
      </Text>
      {findings.map((finding, index) => {
        const item = describeRoadmapFinding(finding);
        return (
          <View key={`${finding.kind}-${index}`} style={styles.findingRow}>
            <Text style={styles.findingIcon} accessibilityElementsHidden
              importantForAccessibility="no">
              {item.icon}
            </Text>
            <Text style={styles.findingText} maxFontSizeMultiplier={2}>
              {item.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stateBlock: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.red,
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 26,
    color: colors.brand,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: spacing.sm,
  },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  summaryTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  noteWarning: {
    backgroundColor: colors.amberSoft,
  },
  noteSuccess: {
    backgroundColor: colors.brandSoft,
  },
  noteIcon: {
    fontSize: 14,
    color: colors.ink,
  },
  noteBody: {
    flex: 1,
    gap: spacing.xs,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  milestone: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  milestoneNext: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  milestoneReached: {
    backgroundColor: colors.paper,
  },
  milestoneHeader: {
    gap: spacing.xs,
  },
  milestoneKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  milestoneMark: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.brand,
  },
  milestonePosition: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  milestoneDate: {
    fontSize: 12,
    color: colors.muted,
  },
  milestoneTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
  },
  milestoneDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  milestoneProgress: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  goalList: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 44,
  },
  goalTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  goalTitleMissing: {
    color: colors.muted,
    fontStyle: 'italic',
  },
  goalTitleComplete: {
    color: colors.muted,
  },
  addButton: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  addButtonText: {
    color: colors.brand,
    fontWeight: '700',
  },
  findings: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  findingsTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  findingRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  findingIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.amber,
  },
  findingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
});
