import type { Note } from '../../domain/note/Note';
import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import type { LabelRepository } from '../../domain/label/repository/LabelRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { LabelId, NoteId } from '../../domain/shared/ids';
import { RECENT_ACTIVITY_LIMIT, type ActivityItem } from '../dashboard/DashboardService';

export interface ResolvedNoteLabel {
  id: LabelId;
  name: string;
  color?: string;
}

export interface NoteListItem {
  id: NoteId;
  content: string;
  pinnedAt: Date | null;
  labels: ResolvedNoteLabel[];
  updatedAt: Date;
}

export interface NotesOverviewView {
  counts: { active: number; archived: number };
  pinned: NoteListItem[];
  active: NoteListItem[];
  archived: NoteListItem[];
  recentActivity: ActivityItem[];
}

const ACTIVITY_FETCH_LIMIT = 100;

function newestUpdatedFirst(a: NoteListItem, b: NoteListItem): number {
  return b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id);
}

function newestPinnedFirst(a: NoteListItem, b: NoteListItem): number {
  return (b.pinnedAt?.getTime() ?? 0) - (a.pinnedAt?.getTime() ?? 0)
    || newestUpdatedFirst(a, b);
}

/** Read model for active, pinned, and archived Notes with resolved labels. */
export class NotesOverviewService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly labels: LabelRepository,
    private readonly records: RecordRepository,
  ) {}

  async getOverview(): Promise<NotesOverviewView> {
    const [activeNotes, archivedNotes, records] = await Promise.all([
      this.notes.list({ archived: false }),
      this.notes.list({ archived: true }),
      this.records.listRecent(ACTIVITY_FETCH_LIMIT),
    ]);
    const [activeItems, archivedItems] = await Promise.all([
      Promise.all(activeNotes.map((note) => this.toListItem(note))),
      Promise.all(archivedNotes.map((note) => this.toListItem(note))),
    ]);
    const pinned = activeItems.filter((note) => note.pinnedAt !== null).sort(newestPinnedFirst);
    const active = activeItems.filter((note) => note.pinnedAt === null).sort(newestUpdatedFirst);
    const archived = archivedItems.sort(newestUpdatedFirst);

    return {
      counts: { active: activeItems.length, archived: archivedItems.length },
      pinned,
      active,
      archived,
      recentActivity: records
        .filter((record) => record.kind.startsWith('note'))
        .slice(0, RECENT_ACTIVITY_LIMIT)
        .map((record) => ({
          id: record.id,
          kind: record.kind,
          ...(record.detail === undefined ? {} : { detail: record.detail }),
          occurredAt: record.occurredAt,
        })),
    };
  }

  private async toListItem(note: Note): Promise<NoteListItem> {
    const labels = await Promise.all(note.labelIds.map((labelId) => this.labels.findById(labelId)));
    return {
      id: note.id,
      content: note.content,
      pinnedAt: note.pinnedAt,
      labels: labels.flatMap((label) => label === null ? [] : [{
        id: label.id,
        name: label.name,
        ...(label.color === undefined ? {} : { color: label.color }),
      }]),
      updatedAt: note.updatedAt,
    };
  }
}
