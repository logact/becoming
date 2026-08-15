import type {
  MilestoneRoadmapItem,
  ProjectRoadmap,
  ProjectRoadmapFinding,
} from '../../../application/projectRoadmapQueryService';
import type { ProjectProgressNodeStatus } from '../../../application/projectProgress';
import type { StatusBadgeTone } from '../../shared/StatusBadge';

/**
 * Pure presentation mapping for the Project Roadmap segment. Every derived
 * value (completion, reachability, counts, findings) comes from the
 * ProjectRoadmapQueryService result; this module only translates it into
 * labels, badges, dates, and sentences. It never recalculates completion.
 */

export interface GoalStatusPresentation {
  label: string;
  icon: string;
  tone: StatusBadgeTone;
}

/** Badge presentation for the snapshot-supplied classification of an assigned Goal. */
export function goalStatusPresentation(
  status: ProjectProgressNodeStatus | null,
): GoalStatusPresentation {
  if (status === null) {
    return { label: 'Unavailable', icon: '!', tone: 'danger' };
  }
  switch (status) {
    case 'complete':
      return { label: 'Complete', icon: '✓', tone: 'success' };
    case 'incomplete':
      return { label: 'Incomplete', icon: '◐', tone: 'info' };
    case 'blocked':
      return { label: 'Blocked', icon: '!', tone: 'danger' };
    case 'unmanaged':
      return { label: 'Unmanaged', icon: '◌', tone: 'neutral' };
    case 'no_machine':
      return { label: 'No machine', icon: '◌', tone: 'neutral' };
    case 'uninitialized':
      return { label: 'Uninitialized', icon: '○', tone: 'warning' };
    case 'invalid':
      return { label: 'Needs inspection', icon: '!', tone: 'danger' };
  }
}

/** Prototype date format: 'Aug 20, 2026'; a missing target is explicit. */
export function formatTargetDate(targetAt: string | null): string {
  if (targetAt === null) return 'No target date';
  const parsed = Date.parse(targetAt);
  if (Number.isNaN(parsed)) return targetAt;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Zero-padded position label, e.g. 'Milestone 02'. */
export function milestonePositionLabel(index: number): string {
  return `Milestone ${String(index + 1).padStart(2, '0')}`;
}

/** '2 of 3 assigned Goals achieved' — counts the service-supplied views only. */
export function milestoneProgressText(item: MilestoneRoadmapItem): string {
  const achieved = item.goals.filter((goal) => goal.complete).length;
  return `${achieved} of ${item.goals.length} assigned Goals achieved`;
}

/** The first unreached Milestone receives the prototype's "Next" emphasis. */
export function nextMilestoneId(roadmap: ProjectRoadmap): string | null {
  const next = roadmap.milestones.find((item) => !item.reached);
  return next?.milestone.id ?? null;
}

/** Summary sentence from the service-computed summary, verbatim. */
export function roadmapSummaryText(roadmap: ProjectRoadmap): string {
  const { reachedMilestones, totalMilestones, achievedGoals, totalGoals } = roadmap.summary;
  return (
    `${reachedMilestones} of ${totalMilestones} ` +
    `${totalMilestones === 1 ? 'milestone' : 'milestones'} reached · ` +
    `${achievedGoals} of ${totalGoals} assigned ${totalGoals === 1 ? 'Goal' : 'Goals'} achieved`
  );
}

/** VoiceOver label for one Milestone card: position, completion, emphasis. */
export function milestoneAccessibilityLabel(
  item: MilestoneRoadmapItem,
  index: number,
  total: number,
  isNext: boolean,
): string {
  const parts = [
    `Milestone ${index + 1} of ${total}`,
    `"${item.milestone.title}"`,
    milestoneProgressText(item),
  ];
  if (item.reached) parts.push('reached');
  else if (isNext) parts.push('next milestone');
  return parts.join(', ');
}

/**
 * Findings that the segment's dedicated regions already explain (per-Goal
 * status badges, the unscheduled-Goal warning) are filtered out before this
 * mapping runs, so only integrity-level problems reach the findings card.
 */
export function describeRoadmapFinding(
  finding: ProjectRoadmapFinding,
): { icon: string; text: string } {
  switch (finding.kind) {
    case 'missing_pursuit_relation':
      return {
        icon: '!',
        text: 'The Project has no usable active Goal pursuit, so no Roadmap can be composed.',
      };
    case 'duplicate_pursuit_relation':
      return {
        icon: '!',
        text: 'The stored data gives this Project several active Goal pursuits; only the first is shown.',
      };
    case 'malformed_pursuit_relation':
      return {
        icon: '!',
        text: 'A Goal pursuit relation is malformed and was excluded from the Roadmap.',
      };
    case 'missing_milestone_reference':
      return {
        icon: '!',
        text: 'A Goal assignment names a Milestone that is no longer stored.',
      };
    case 'archived_milestone_reference':
      return {
        icon: '!',
        text: 'A Goal assignment still names an archived Milestone.',
      };
    case 'assignment_pursuit_mismatch':
      return {
        icon: '!',
        text: 'A Goal assignment does not match the pursuit of its Milestone.',
      };
    case 'duplicate_active_assignment':
      return {
        icon: '!',
        text: 'A Goal is actively assigned to more than one Milestone in this pursuit.',
      };
    case 'empty_milestone':
      return {
        icon: '!',
        text: 'A Milestone has no assigned Goals; it can never be reached.',
      };
    case 'missing_goal_reference':
      return {
        icon: '!',
        text: 'A Milestone names a Goal that is no longer stored.',
      };
    case 'archived_goal_reference':
      return {
        icon: '!',
        text: 'A Milestone names an archived Goal; it cannot satisfy the Milestone.',
      };
    case 'goal_outside_hierarchy':
      return {
        icon: '!',
        text: 'A Milestone names a Goal outside the active pursued hierarchy.',
      };
    case 'goal_lifecycle_unsatisfied':
      return {
        icon: '◐',
        text: `An assigned Goal is not complete (status: ${finding.status}).`,
      };
    case 'unassigned_goal':
      return {
        icon: '○',
        text: 'A sub-goal of the pursued Goal is not scheduled in any Milestone.',
      };
    case 'hierarchy_integrity':
      return {
        icon: '!',
        text: 'The decomposition structure reported an integrity or traversal finding; the Roadmap may reflect a partial structure.',
      };
  }
}
