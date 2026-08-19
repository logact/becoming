import type { Goal, GoalStatus } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { GoalId, LabelId } from '../../domain/shared/ids';
import { GOAL_DUE_WINDOW_MS } from '../dashboard/DashboardService';

export interface GoalListItem {
  id: GoalId;
  title: string;
  status: GoalStatus;
  labelIds: LabelId[];
  due?: Date;
}

/** Goals-only counterpart of the dashboard's `AttentionItem`. */
export interface GoalAttentionItem {
  id: GoalId;
  title: string;
  reason: 'failed' | 'overdue';
  due?: Date;
}

export interface GoalsOverviewStats {
  /** Goals with status `doing` (non-archived). */
  activeGoals: number;
  /** All non-archived goals. */
  totalGoals: number;
}

export interface LabelGoalCount {
  labelId: LabelId;
  /** Resolved label name; falls back to the id when the label is unknown. */
  name: string;
  count: number;
}

export type GoalsByStatus = Record<GoalStatus, GoalListItem[]>;

export interface GoalsOverviewView {
  stats: GoalsOverviewStats;
  attention: GoalAttentionItem[];
  /** Doing goals, each with its labels and due. */
  focus: GoalListItem[];
  /** Non-archived goal count per status. */
  byStatus: Record<GoalStatus, number>;
  /** Non-archived goal count per label, most-used first. */
  byLabel: LabelGoalCount[];
  /** Non-archived goals grouped by status. */
  allGoals: GoalsByStatus;
}

const GOAL_STATUSES: GoalStatus[] = ['todo', 'doing', 'paused', 'failed', 'done'];

function toListItem(goal: Goal): GoalListItem {
  return {
    id: goal.id,
    title: goal.title,
    status: goal.status,
    labelIds: [...goal.labelIds],
    ...(goal.due === undefined ? {} : { due: goal.due }),
  };
}

/**
 * Read model for the goals overview screen: headline stats, goals needing
 * attention (failed or due-imminent), the doing goals in focus, counts per
 * status and per label, and every non-archived goal grouped by status.
 */
export class GoalsOverviewService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly labels: LabelRepository,
  ) {}

  async getOverview(now: Date): Promise<GoalsOverviewView> {
    const all = await this.goals.list({ archived: false });
    const allGoals = this.groupByStatus(all);
    return {
      stats: { activeGoals: allGoals.doing.length, totalGoals: all.length },
      attention: this.listAttention(all, now),
      focus: allGoals.doing,
      byStatus: this.countByStatus(allGoals),
      byLabel: await this.countByLabel(all),
      allGoals,
    };
  }

  /** Failed goals first, then due-imminent ones ordered by soonest due. */
  private listAttention(goals: Goal[], now: Date): GoalAttentionItem[] {
    const attention: GoalAttentionItem[] = [];
    for (const goal of goals) {
      if (goal.status === 'failed') {
        attention.push({
          id: goal.id,
          title: goal.title,
          reason: 'failed',
          ...(goal.due === undefined ? {} : { due: goal.due }),
        });
      }
    }
    const overdue = goals
      .filter((goal) => goal.isDueImminent(GOAL_DUE_WINDOW_MS, now))
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        reason: 'overdue' as const,
        // `isDueImminent` guarantees a due.
        due: goal.due as Date,
      }))
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    return [...attention, ...overdue];
  }

  private groupByStatus(goals: Goal[]): GoalsByStatus {
    const grouped: GoalsByStatus = { todo: [], doing: [], paused: [], failed: [], done: [] };
    for (const goal of goals) {
      grouped[goal.status].push(toListItem(goal));
    }
    return grouped;
  }

  private countByStatus(grouped: GoalsByStatus): Record<GoalStatus, number> {
    const counts = {} as Record<GoalStatus, number>;
    for (const status of GOAL_STATUSES) {
      counts[status] = grouped[status].length;
    }
    return counts;
  }

  /** A goal counts once towards each of its labels. */
  private async countByLabel(goals: Goal[]): Promise<LabelGoalCount[]> {
    const counts = new Map<LabelId, number>();
    for (const goal of goals) {
      for (const labelId of goal.labelIds) {
        counts.set(labelId, (counts.get(labelId) ?? 0) + 1);
      }
    }
    const entries: LabelGoalCount[] = [];
    for (const [labelId, count] of counts) {
      const label = await this.labels.findById(labelId);
      entries.push({ labelId, name: label?.name ?? labelId, count });
    }
    entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return entries;
  }
}
