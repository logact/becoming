import type { Idea, IdeaStatus } from '../../domain/idea/Idea';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import type { IdeaId, LabelId } from '../../domain/shared/ids';
import { RECENT_ACTIVITY_LIMIT, type ActivityItem } from '../dashboard/DashboardService';

export interface IdeaListItem {
  id: IdeaId;
  content: string;
  status: IdeaStatus;
  labelIds: LabelId[];
  updatedAt: Date;
}

export interface IdeasOverviewView {
  counts: { open: number; handled: number };
  open: {
    captured: IdeaListItem[];
    exploring: IdeaListItem[];
    paused: IdeaListItem[];
  };
  handled: IdeaListItem[];
  recentActivity: ActivityItem[];
}

const ACTIVITY_FETCH_LIMIT = 100;

function toListItem(idea: Idea): IdeaListItem {
  return {
    id: idea.id,
    content: idea.content,
    status: idea.status,
    labelIds: [...idea.labelIds],
    updatedAt: idea.updatedAt,
  };
}

function newestFirst(a: IdeaListItem, b: IdeaListItem): number {
  return b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id);
}

/** Read model for open and handled Ideas, plus Ideas-only recent activity. */
export class IdeasOverviewService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly records: RecordRepository,
  ) {}

  async getOverview(): Promise<IdeasOverviewView> {
    const [ideas, records] = await Promise.all([
      this.ideas.list({ archived: false }),
      this.records.listRecent(ACTIVITY_FETCH_LIMIT),
    ]);
    const open: IdeasOverviewView['open'] = { captured: [], exploring: [], paused: [] };
    const handled: IdeaListItem[] = [];

    for (const idea of ideas) {
      const item = toListItem(idea);
      if (idea.status === 'handled') handled.push(item);
      else open[idea.status].push(item);
    }
    for (const group of Object.values(open)) group.sort(newestFirst);
    handled.sort(newestFirst);

    return {
      counts: {
        open: open.captured.length + open.exploring.length + open.paused.length,
        handled: handled.length,
      },
      open,
      handled,
      recentActivity: records
        .filter((record) => record.kind.startsWith('idea'))
        .slice(0, RECENT_ACTIVITY_LIMIT)
        .map((record) => ({
          id: record.id,
          kind: record.kind,
          ...(record.detail === undefined ? {} : { detail: record.detail }),
          occurredAt: record.occurredAt,
        })),
    };
  }
}
