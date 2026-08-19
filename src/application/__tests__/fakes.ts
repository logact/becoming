/**
 * In-memory fake repositories for application-service tests. Each fake keeps
 * its entities in a plain array and implements the filter semantics of its
 * repository interface.
 */
import type { AttentionEntry } from '../../domain/attention/AttentionEntry';
import type {
  AttentionEntryFilter,
  AttentionEntryRepository,
} from '../../domain/attention/repository/AttentionEntryRepository';
import type { Goal } from '../../domain/goal/Goal';
import type { GoalFilter, GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { Idea } from '../../domain/idea/Idea';
import type { IdeaFilter, IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { Project } from '../../domain/project/Project';
import type {
  ProjectFilter,
  ProjectRepository,
} from '../../domain/project/repository/ProjectRepository';
import type { Label } from '../../domain/label/Label';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { Milestone } from '../../domain/milestone/Milestone';
import type {
  MilestoneFilter,
  MilestoneRepository,
} from '../../domain/milestone/repository/MilestoneRepository';
import type { Record as DomainRecord, RecordTargetType } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { Relation } from '../../domain/relation/Relation';
import type {
  RelationFilter,
  RelationRepository,
} from '../../domain/relation/repository/RelationRepository';
import type { Resource } from '../../domain/resource/Resource';
import type {
  ResourceFilter,
  ResourceRepository,
} from '../../domain/resource/repository/ResourceRepository';
import type { Task } from '../../domain/task/Task';
import type { TaskFilter, TaskRepository } from '../../domain/task/repository/TaskRepository';

function upsert<T extends { readonly id: string }>(items: T[], item: T): void {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
}

function remove<T extends { readonly id: string }>(items: T[], id: string): void {
  const index = items.findIndex((existing) => existing.id === id);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

export class FakeGoalRepository implements GoalRepository {
  readonly items: Goal[] = [];

  async save(goal: Goal): Promise<void> {
    upsert(this.items, goal);
  }

  async findById(id: string): Promise<Goal | null> {
    return this.items.find((goal) => goal.id === id) ?? null;
  }

  async list(filter?: GoalFilter): Promise<Goal[]> {
    return this.items.filter(
      (goal) =>
        (filter?.status === undefined || goal.status === filter.status) &&
        (filter?.archived === undefined || goal.archived === filter.archived) &&
        (filter?.labelId === undefined || goal.labelIds.includes(filter.labelId)) &&
        (filter?.projectId === undefined || goal.projectId === filter.projectId) &&
        (filter?.parentGoalId === undefined || goal.parentGoalId === filter.parentGoalId),
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeTaskRepository implements TaskRepository {
  readonly items: Task[] = [];

  async save(task: Task): Promise<void> {
    upsert(this.items, task);
  }

  async findById(id: string): Promise<Task | null> {
    return this.items.find((task) => task.id === id) ?? null;
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    return this.items.filter(
      (task) =>
        (filter?.status === undefined || task.status === filter.status) &&
        (filter?.archived === undefined || task.archived === filter.archived) &&
        (filter?.labelId === undefined || task.labelIds.includes(filter.labelId)) &&
        (filter?.projectId === undefined || task.projectId === filter.projectId) &&
        (filter?.goalId === undefined || task.goalId === filter.goalId),
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeIdeaRepository implements IdeaRepository {
  readonly items: Idea[] = [];

  async save(idea: Idea): Promise<void> {
    upsert(this.items, idea);
  }

  async findById(id: string): Promise<Idea | null> {
    return this.items.find((idea) => idea.id === id) ?? null;
  }

  async list(filter?: IdeaFilter): Promise<Idea[]> {
    return this.items.filter(
      (idea) =>
        (filter?.status === undefined || idea.status === filter.status) &&
        (filter?.archived === undefined || idea.archived === filter.archived) &&
        (filter?.labelId === undefined || idea.labelIds.includes(filter.labelId)),
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeProjectRepository implements ProjectRepository {
  readonly items: Project[] = [];

  async save(project: Project): Promise<void> {
    upsert(this.items, project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.items.find((project) => project.id === id) ?? null;
  }

  async list(filter?: ProjectFilter): Promise<Project[]> {
    return this.items.filter(
      (project) =>
        (filter?.status === undefined || project.status === filter.status) &&
        (filter?.archived === undefined || project.archived === filter.archived) &&
        (filter?.labelId === undefined || project.labelIds.includes(filter.labelId)) &&
        (filter?.goalId === undefined || project.goalId === filter.goalId),
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeResourceRepository implements ResourceRepository {
  readonly items: Resource[] = [];

  async save(resource: Resource): Promise<void> {
    upsert(this.items, resource);
  }

  async findById(id: string): Promise<Resource | null> {
    return this.items.find((resource) => resource.id === id) ?? null;
  }

  async list(filter?: ResourceFilter): Promise<Resource[]> {
    return this.items.filter(
      (resource) =>
        (filter?.typeId === undefined || resource.typeId === filter.typeId) &&
        (filter?.kind === undefined || resource.kind === filter.kind) &&
        (filter?.projectId === undefined ||
          resource.allocations.some((a) => a.projectId === filter.projectId)) &&
        (filter?.archived === undefined || resource.archived === filter.archived) &&
        (filter?.labelId === undefined || resource.labelIds.includes(filter.labelId)),
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeRelationRepository implements RelationRepository {
  readonly items: Relation[] = [];

  async save(relation: Relation): Promise<void> {
    upsert(this.items, relation);
  }

  async findById(id: string): Promise<Relation | null> {
    return this.items.find((relation) => relation.id === id) ?? null;
  }

  async list(filter?: RelationFilter): Promise<Relation[]> {
    return this.items.filter(
      (relation) =>
        (filter?.sourceType === undefined || relation.sourceType === filter.sourceType) &&
        (filter?.sourceId === undefined || relation.sourceId === filter.sourceId) &&
        (filter?.targetType === undefined || relation.targetType === filter.targetType) &&
        (filter?.targetId === undefined || relation.targetId === filter.targetId) &&
        (filter?.kind === undefined || relation.kind === filter.kind),
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeRecordRepository implements RecordRepository {
  readonly items: DomainRecord[] = [];

  /**
   * Record-to-model links live in relations, so the fake resolves
   * `listByTarget` through a relation repository (empty by default).
   */
  constructor(private readonly relations: FakeRelationRepository = new FakeRelationRepository()) {}

  async append(record: DomainRecord): Promise<void> {
    this.items.push(record);
  }

  /**
   * Records linked to the target through a relation in either direction;
   * newest first, a record linked in both directions appears once.
   */
  async listByTarget(targetType: RecordTargetType, targetId: string): Promise<DomainRecord[]> {
    const linkedRecordIds = new Set<string>();
    for (const relation of this.relations.items) {
      if (relation.sourceType === 'record' && relation.targetType === targetType && relation.targetId === targetId) {
        linkedRecordIds.add(relation.sourceId);
      }
      if (relation.targetType === 'record' && relation.sourceType === targetType && relation.sourceId === targetId) {
        linkedRecordIds.add(relation.targetId);
      }
    }
    return this.items
      .filter((record) => linkedRecordIds.has(record.id))
      .sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id),
      );
  }

  /** Newest first, capped at `limit`. */
  async listRecent(limit: number): Promise<DomainRecord[]> {
    return this.items.slice(-limit).reverse();
  }
}

export class FakeAttentionEntryRepository implements AttentionEntryRepository {
  readonly items: AttentionEntry[] = [];

  async save(entry: AttentionEntry): Promise<void> {
    upsert(this.items, entry);
  }

  async findById(id: string): Promise<AttentionEntry | null> {
    return this.items.find((entry) => entry.id === id) ?? null;
  }

  async list(filter?: AttentionEntryFilter): Promise<AttentionEntry[]> {
    return this.items.filter(
      (entry) =>
        (filter?.kind === undefined || entry.kind === filter.kind) &&
        (filter?.targetType === undefined || entry.targetType === filter.targetType) &&
        (filter?.targetId === undefined || entry.targetId === filter.targetId),
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeLabelRepository implements LabelRepository {
  readonly items: Label[] = [];

  async save(label: Label): Promise<void> {
    upsert(this.items, label);
  }

  async findById(id: string): Promise<Label | null> {
    return this.items.find((label) => label.id === id) ?? null;
  }

  async list(): Promise<Label[]> {
    return [...this.items];
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}

export class FakeMilestoneRepository implements MilestoneRepository {
  readonly items: Milestone[] = [];

  async save(milestone: Milestone): Promise<void> {
    upsert(this.items, milestone);
  }

  async findById(id: string): Promise<Milestone | null> {
    return this.items.find((milestone) => milestone.id === id) ?? null;
  }

  async list(filter?: MilestoneFilter): Promise<Milestone[]> {
    return this.items.filter(
      (milestone) => filter?.projectId === undefined || milestone.projectId === filter.projectId,
    );
  }

  async delete(id: string): Promise<void> {
    remove(this.items, id);
  }
}
