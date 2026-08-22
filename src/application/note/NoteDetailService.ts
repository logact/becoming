import type { GoalStatus } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { Note } from '../../domain/note/Note';
import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import type { ProjectStatus } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { GoalId, IdeaId, NoteId, ProjectId } from '../../domain/shared/ids';
import { RECENT_ACTIVITY_LIMIT, type ActivityItem } from '../dashboard/DashboardService';
import type { ResolvedNoteLabel } from './NotesOverviewService';

export interface NoteSourceIdea {
  ideaId: IdeaId;
  content: string;
}

export interface NoteGoalLink {
  type: 'goal';
  id: GoalId;
  title: string;
  status: GoalStatus;
}

export interface NoteProjectLink {
  type: 'project';
  id: ProjectId;
  title: string;
  status: ProjectStatus;
}

export type NoteLink = NoteGoalLink | NoteProjectLink;

export interface NoteDetailView {
  note: Note | null;
  labels: ResolvedNoteLabel[];
  source: NoteSourceIdea | null;
  links: NoteLink[];
  recentActivity: ActivityItem[];
}

/** Read model for a Note, its source Idea, linked plans, labels, and activity. */
export class NoteDetailService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly labels: LabelRepository,
    private readonly relations: RelationRepository,
    private readonly ideas: IdeaRepository,
    private readonly goals: GoalRepository,
    private readonly projects: ProjectRepository,
    private readonly records: RecordRepository,
  ) {}

  async getDetail(noteId: NoteId): Promise<NoteDetailView> {
    const note = await this.notes.findById(noteId);
    if (note === null) {
      return { note: null, labels: [], source: null, links: [], recentActivity: [] };
    }

    const [labels, sourceRelations, linkRelations, records] = await Promise.all([
      this.resolveLabels(note),
      // Frozen direction: note --derivedFrom--> idea.
      this.relations.list({ sourceType: 'note', sourceId: noteId, kind: 'derivedFrom' }),
      this.relations.list({ sourceType: 'note', sourceId: noteId, kind: 'relatesTo' }),
      this.records.listByTarget('note', RECENT_ACTIVITY_LIMIT, noteId),
    ]);
    const [source, links] = await Promise.all([
      this.resolveSource(sourceRelations),
      this.resolveLinks(linkRelations),
    ]);

    return {
      note,
      labels,
      source,
      links,
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

  private async resolveLabels(note: Note): Promise<ResolvedNoteLabel[]> {
    const labels = await Promise.all(note.labelIds.map((labelId) => this.labels.findById(labelId)));
    return labels.flatMap((label) => label === null ? [] : [{
      id: label.id,
      name: label.name,
      ...(label.color === undefined ? {} : { color: label.color }),
    }]);
  }

  private async resolveSource(relations: Relation[]): Promise<NoteSourceIdea | null> {
    const candidates = relations
      .filter((relation) => relation.targetType === 'idea')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const relation of candidates) {
      const idea = await this.ideas.findById(relation.targetId);
      if (idea !== null) return { ideaId: idea.id, content: idea.content };
    }
    return null;
  }

  private async resolveLinks(relations: Relation[]): Promise<NoteLink[]> {
    const resolved = await Promise.all(relations.map(async (relation) => {
      if (relation.targetType === 'goal') {
        const goal = await this.goals.findById(relation.targetId);
        return goal === null ? null : {
          item: { type: 'goal', id: goal.id, title: goal.title, status: goal.status } as NoteGoalLink,
          createdAt: relation.createdAt,
        };
      }
      if (relation.targetType === 'project') {
        const project = await this.projects.findById(relation.targetId);
        return project === null ? null : {
          item: {
            type: 'project', id: project.id, title: project.name, status: project.status,
          } as NoteProjectLink,
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
