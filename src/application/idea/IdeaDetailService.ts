import type { GoalStatus } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { Idea } from '../../domain/idea/Idea';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { GoalId, IdeaId, LabelId, ProjectId, TaskId } from '../../domain/shared/ids';
import type { TaskStatus } from '../../domain/task/Task';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import { RECENT_ACTIVITY_LIMIT, type ActivityItem } from '../dashboard/DashboardService';

export interface ResolvedIdeaLabel {
  id: LabelId;
  name: string;
  color?: string;
}

export interface IdeaDerivedGoalItem {
  type: 'goal';
  id: GoalId;
  title: string;
  status: GoalStatus;
}

export interface IdeaDerivedTaskItem {
  type: 'task';
  id: TaskId;
  title: string;
  status: TaskStatus;
  projectId: ProjectId;
  /** Resolved project display name, falling back to its id if it is dangling. */
  projectName: string;
  /** Shared display field consumed by a derived-item row. */
  context: string;
}

export type IdeaDerivedItem = IdeaDerivedGoalItem | IdeaDerivedTaskItem;

export interface IdeaDetailView {
  idea: Idea | null;
  labels: ResolvedIdeaLabel[];
  derivedItems: IdeaDerivedItem[];
  recentActivity: ActivityItem[];
}

/** Read model for an Idea, its labels, derived entities, and scoped activity. */
export class IdeaDetailService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly labels: LabelRepository,
    private readonly relations: RelationRepository,
    private readonly records: RecordRepository,
  ) {}

  async getDetail(ideaId: IdeaId): Promise<IdeaDetailView> {
    const idea = await this.ideas.findById(ideaId);
    if (idea === null) {
      return { idea: null, labels: [], derivedItems: [], recentActivity: [] };
    }

    const [labels, relations, records] = await Promise.all([
      this.resolveLabels(idea.labelIds),
      this.relations.list({ targetType: 'idea', targetId: ideaId, kind: 'derivedFrom' }),
      this.records.listByTarget('idea', RECENT_ACTIVITY_LIMIT, ideaId),
    ]);
    const derivedItems = await this.resolveDerivedItems(relations.map((relation) => ({
      sourceType: relation.sourceType,
      sourceId: relation.sourceId,
      createdAt: relation.createdAt,
    })));

    return {
      idea,
      labels,
      derivedItems,
      recentActivity: records
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id))
        .slice(0, RECENT_ACTIVITY_LIMIT)
        .map((record) => ({
          id: record.id,
          kind: record.kind,
          ...(record.detail === undefined ? {} : { detail: record.detail }),
          occurredAt: record.occurredAt,
        })),
    };
  }

  private async resolveLabels(labelIds: LabelId[]): Promise<ResolvedIdeaLabel[]> {
    const labels = await Promise.all(labelIds.map((labelId) => this.labels.findById(labelId)));
    return labels.flatMap((label) => label === null ? [] : [{
      id: label.id,
      name: label.name,
      ...(label.color === undefined ? {} : { color: label.color }),
    }]);
  }

  private async resolveDerivedItems(relations: Array<{
    sourceType: string;
    sourceId: string;
    createdAt: Date;
  }>): Promise<IdeaDerivedItem[]> {
    const resolved = await Promise.all(relations.map(async (relation) => {
      if (relation.sourceType === 'goal') {
        const goal = await this.goals.findById(relation.sourceId);
        return goal === null ? null : {
          item: { type: 'goal', id: goal.id, title: goal.title, status: goal.status } as IdeaDerivedGoalItem,
          createdAt: relation.createdAt,
        };
      }
      if (relation.sourceType === 'task') {
        const task = await this.tasks.findById(relation.sourceId);
        if (task === null) return null;
        const project = await this.projects.findById(task.projectId);
        const projectName = project?.name ?? task.projectId;
        return {
          item: {
            type: 'task',
            id: task.id,
            title: task.title,
            status: task.status,
            projectId: task.projectId,
            projectName,
            context: projectName,
          } as IdeaDerivedTaskItem,
          createdAt: relation.createdAt,
        };
      }
      return null;
    }));

    return resolved
      .flatMap((entry) => entry === null ? [] : [entry])
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((entry) => entry.item);
  }
}
