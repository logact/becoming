import type { AttentionEntry } from '../../domain/attention/AttentionEntry';
import type { AttentionEntryRepository } from '../../domain/attention/repository/AttentionEntryRepository';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import type { ProjectId } from '../../domain/shared/ids';
import { sumConsumedAmount } from '../resource/consumption';

/** Due-soon window for goals; an already-passed due also counts. */
export const GOAL_DUE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Due-soon window for projects; an already-passed due also counts. */
export const PROJECT_DUE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Due-soon window for tasks; an already-passed due also counts. */
export const TASK_DUE_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Share of an allocation that must be consumed before it counts as exhausted. */
export const RESOURCE_EXHAUSTION_THRESHOLD = 0.9;
/** How many records the recent activity section shows. */
export const RECENT_ACTIVITY_LIMIT = 10;

export interface DoingItem {
  type: 'goal' | 'task' | 'idea';
  id: string;
  /** Idea content is mapped to title. */
  title: string;
  status: string;
  due?: Date;
}

export type AttentionReason = 'failed' | 'overdue' | 'resourceExhausted' | 'pinned';

export interface AttentionItem {
  /** Rule-derived items are goals/tasks/projects; pins may also target ideas. */
  type: 'goal' | 'task' | 'project' | 'idea';
  id: string;
  /** Idea content is mapped to title. */
  title: string;
  reason: AttentionReason;
  due?: Date;
}

export interface ActivityItem {
  id: string;
  kind: string;
  detail?: string;
  occurredAt: Date;
}

export interface DashboardStats {
  /** Number of items in the doing list (doing goals/tasks + captured ideas). */
  doingNow: number;
  /**
   * Non-archived goals/tasks completed on the local calendar day of `now`.
   * This is a proxy: it infers the completion day from `updatedAt` because no
   * completion-record producer exists yet; revisit when completion services
   * land.
   */
  doneToday: number;
  /**
   * Non-archived goals/tasks/projects, not done/failed, whose due falls on
   * the local calendar day of `now`.
   */
  dueToday: number;
}

export interface DashboardView {
  doing: DoingItem[];
  attention: AttentionItem[];
  recentActivity: ActivityItem[];
  stats: DashboardStats;
}

/** Sort rank of each attention reason; lower comes first. */
const REASON_ORDER: Record<AttentionReason, number> = {
  failed: 0,
  overdue: 1,
  resourceExhausted: 2,
  pinned: 3,
};

function attentionKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function withDue(due: Date | undefined): { due?: Date } {
  return due === undefined ? {} : { due };
}

/**
 * Read model for the dashboard screen: doing items (doing goals/tasks,
 * captured ideas), attention items (rule-derived plus user-pinned, minus
 * user-dismissed), the latest records, and headline stats.
 */
export class DashboardService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly ideas: IdeaRepository,
    private readonly projects: ProjectRepository,
    private readonly resources: ResourceRepository,
    private readonly relations: RelationRepository,
    private readonly records: RecordRepository,
    private readonly attentionEntries: AttentionEntryRepository,
  ) {}

  async getDashboard(now: Date): Promise<DashboardView> {
    const [doing, attention, recentActivity] = await Promise.all([
      this.listDoing(),
      this.listAttention(now),
      this.listRecentActivity(),
    ]);
    const stats = await this.listStats(now, doing.length);
    return { doing, attention, recentActivity, stats };
  }

  /**
   * Headline counts. `doneToday` is a proxy: it infers the completion day
   * from `updatedAt` of done goals/tasks because no completion-record
   * producer exists yet; revisit when completion services land.
   */
  private async listStats(now: Date, doingNow: number): Promise<DashboardStats> {
    const [goals, tasks, projects] = await Promise.all([
      this.goals.list({ archived: false }),
      this.tasks.list({ archived: false }),
      this.projects.list({ archived: false }),
    ]);
    // Local calendar-day boundaries of `now`.
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const isWithinToday = (date: Date): boolean =>
      date.getTime() >= startOfDay.getTime() && date.getTime() < startOfNextDay.getTime();

    const doneToday =
      [...goals, ...tasks].filter(
        (item) => item.status === 'done' && isWithinToday(item.updatedAt),
      ).length;

    const dueToday = [...goals, ...tasks, ...projects].filter(
      (item) =>
        item.status !== 'done' &&
        item.status !== 'failed' &&
        item.due !== undefined &&
        isWithinToday(item.due),
    ).length;

    return { doingNow, doneToday, dueToday };
  }

  private async listDoing(): Promise<DoingItem[]> {
    const [goals, tasks, ideas] = await Promise.all([
      this.goals.list({ status: 'doing', archived: false }),
      this.tasks.list({ status: 'doing', archived: false }),
      this.ideas.list({ status: 'captured', archived: false }),
    ]);
    const entries: { item: DoingItem; updatedAt: Date }[] = [
      ...goals.map((goal) => ({
        item: {
          type: 'goal' as const,
          id: goal.id,
          title: goal.title,
          status: goal.status,
          ...withDue(goal.due),
        },
        updatedAt: goal.updatedAt,
      })),
      ...tasks.map((task) => ({
        item: {
          type: 'task' as const,
          id: task.id,
          title: task.title,
          status: task.status,
          ...withDue(task.due),
        },
        updatedAt: task.updatedAt,
      })),
      ...ideas.map((idea) => ({
        item: {
          type: 'idea' as const,
          id: idea.id,
          title: idea.content,
          status: idea.status,
        },
        updatedAt: idea.updatedAt,
      })),
    ];
    entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return entries.map((entry) => entry.item);
  }

  private async listAttention(now: Date): Promise<AttentionItem[]> {
    // Candidates are added in priority order (failed, overdue, exhausted,
    // pinned); the first entry for a target wins, so an item qualifying for
    // several reasons appears once with the highest-priority one.
    const candidates = new Map<string, AttentionItem>();
    const add = (item: AttentionItem): void => {
      const key = attentionKey(item.type, item.id);
      if (!candidates.has(key)) {
        candidates.set(key, item);
      }
    };

    await this.addRuleCandidates(now, add);
    await this.addPinnedCandidates(add);

    const dismissed = new Set(
      (await this.attentionEntries.list({ kind: 'dismiss' })).map((entry) =>
        attentionKey(entry.targetType, entry.targetId),
      ),
    );

    return [...candidates.values()]
      .filter((item) => !dismissed.has(attentionKey(item.type, item.id)))
      .sort((a, b) => {
        const order = REASON_ORDER[a.reason] - REASON_ORDER[b.reason];
        if (order !== 0) {
          return order;
        }
        if (a.reason === 'overdue') {
          return (
            (a.due?.getTime() ?? Number.POSITIVE_INFINITY) -
            (b.due?.getTime() ?? Number.POSITIVE_INFINITY)
          );
        }
        return 0;
      });
  }

  private async addRuleCandidates(
    now: Date,
    add: (item: AttentionItem) => void,
  ): Promise<void> {
    const [failedGoals, failedTasks, goals, tasks, projects] = await Promise.all([
      this.goals.list({ status: 'failed', archived: false }),
      this.tasks.list({ status: 'failed', archived: false }),
      this.goals.list({ archived: false }),
      this.tasks.list({ archived: false }),
      this.projects.list({ archived: false }),
    ]);

    for (const goal of failedGoals) {
      add({ type: 'goal', id: goal.id, title: goal.title, reason: 'failed', ...withDue(goal.due) });
    }
    for (const task of failedTasks) {
      add({ type: 'task', id: task.id, title: task.title, reason: 'failed', ...withDue(task.due) });
    }

    for (const goal of goals) {
      if (goal.isDueImminent(GOAL_DUE_WINDOW_MS, now)) {
        add({ type: 'goal', id: goal.id, title: goal.title, reason: 'overdue', ...withDue(goal.due) });
      }
    }
    for (const task of tasks) {
      if (task.isDueImminent(TASK_DUE_WINDOW_MS, now)) {
        add({ type: 'task', id: task.id, title: task.title, reason: 'overdue', ...withDue(task.due) });
      }
    }
    for (const project of projects) {
      if (project.isDueImminent(PROJECT_DUE_WINDOW_MS, now)) {
        add({
          type: 'project',
          id: project.id,
          title: project.name,
          reason: 'overdue',
          ...withDue(project.due),
        });
      }
    }

    for (const project of projects) {
      if (project.status !== 'active') {
        continue;
      }
      if (await this.hasExhaustedAllocation(project.id)) {
        add({
          type: 'project',
          id: project.id,
          title: project.name,
          reason: 'resourceExhausted',
          ...withDue(project.due),
        });
      }
    }
  }

  /** True when any quantity allocation to the project is ≥ threshold consumed. */
  private async hasExhaustedAllocation(projectId: ProjectId): Promise<boolean> {
    const resources = await this.resources.list({
      projectId,
      kind: 'quantity',
      archived: false,
    });
    for (const resource of resources) {
      const allocation = resource.allocations.find((a) => a.projectId === projectId);
      if (allocation === undefined) {
        continue;
      }
      const consumed = await sumConsumedAmount(this.relations, resource.id, projectId);
      // Compare as a ratio: `0.9 * 100` is 90.00000000000001 in IEEE-754,
      // which would wrongly exclude an exactly-90%-consumed allocation.
      if (consumed / allocation.amount >= RESOURCE_EXHAUSTION_THRESHOLD) {
        return true;
      }
    }
    return false;
  }

  private async addPinnedCandidates(add: (item: AttentionItem) => void): Promise<void> {
    const pins = await this.attentionEntries.list({ kind: 'pin' });
    for (const pin of pins) {
      const item = await this.loadPinnedItem(pin);
      if (item !== null) {
        add(item);
      }
    }
  }

  /** Resolves a pin to an item; missing or archived targets are skipped. */
  private async loadPinnedItem(pin: AttentionEntry): Promise<AttentionItem | null> {
    switch (pin.targetType) {
      case 'goal': {
        const goal = await this.goals.findById(pin.targetId);
        if (goal === null || goal.archived) {
          return null;
        }
        return { type: 'goal', id: goal.id, title: goal.title, reason: 'pinned', ...withDue(goal.due) };
      }
      case 'task': {
        const task = await this.tasks.findById(pin.targetId);
        if (task === null || task.archived) {
          return null;
        }
        return { type: 'task', id: task.id, title: task.title, reason: 'pinned', ...withDue(task.due) };
      }
      case 'project': {
        const project = await this.projects.findById(pin.targetId);
        if (project === null || project.archived) {
          return null;
        }
        return {
          type: 'project',
          id: project.id,
          title: project.name,
          reason: 'pinned',
          ...withDue(project.due),
        };
      }
      case 'idea': {
        const idea = await this.ideas.findById(pin.targetId);
        if (idea === null || idea.archived) {
          return null;
        }
        return { type: 'idea', id: idea.id, title: idea.content, reason: 'pinned' };
      }
    }
  }

  private async listRecentActivity(): Promise<ActivityItem[]> {
    const records = await this.records.listRecent(RECENT_ACTIVITY_LIMIT);
    return records.map((record) => ({
      id: record.id,
      kind: record.kind,
      ...(record.detail === undefined ? {} : { detail: record.detail }),
      occurredAt: record.occurredAt,
    }));
  }
}
