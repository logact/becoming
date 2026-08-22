import { Idea, type IdeaStatus } from '../../../domain/idea/Idea';
import { Record } from '../../../domain/record/Record';
import { makeFakeRepos } from '../../__tests__/fakes';
import { RECENT_ACTIVITY_LIMIT } from '../../dashboard/DashboardService';
import { IdeasOverviewService } from '../IdeasOverviewService';

const t0 = new Date('2026-08-01T00:00:00Z');

function restoredIdea(params: {
  id: string;
  status: IdeaStatus;
  updatedAt: Date;
  archived?: boolean;
}): Idea {
  return Idea.restore({
    id: params.id,
    content: `Content ${params.id}`,
    status: params.status,
    archived: params.archived ?? false,
    labelIds: [],
    createdAt: t0,
    updatedAt: params.updatedAt,
  });
}

describe('IdeasOverviewService', () => {
  it('excludes archived Ideas, groups and counts statuses, and sorts each group newest first', async () => {
    const { ideaRepo, recordRepo } = await makeFakeRepos();
    await Promise.all([
      ideaRepo.save(restoredIdea({ id: 'captured-old', status: 'captured', updatedAt: new Date('2026-08-02T00:00:00Z') })),
      ideaRepo.save(restoredIdea({ id: 'captured-new', status: 'captured', updatedAt: new Date('2026-08-03T00:00:00Z') })),
      ideaRepo.save(restoredIdea({ id: 'exploring', status: 'exploring', updatedAt: new Date('2026-08-04T00:00:00Z') })),
      ideaRepo.save(restoredIdea({ id: 'paused', status: 'paused', updatedAt: new Date('2026-08-05T00:00:00Z') })),
      ideaRepo.save(restoredIdea({ id: 'handled-old', status: 'handled', updatedAt: new Date('2026-08-06T00:00:00Z') })),
      ideaRepo.save(restoredIdea({ id: 'handled-new', status: 'handled', updatedAt: new Date('2026-08-07T00:00:00Z') })),
      ideaRepo.save(restoredIdea({ id: 'archived', status: 'captured', updatedAt: new Date('2026-08-08T00:00:00Z'), archived: true })),
    ]);

    const overview = await new IdeasOverviewService(ideaRepo, recordRepo).getOverview();

    expect(overview.counts).toEqual({ open: 4, handled: 2 });
    expect(overview.open.captured.map((item) => item.id)).toEqual(['captured-new', 'captured-old']);
    expect(overview.open.exploring.map((item) => item.id)).toEqual(['exploring']);
    expect(overview.open.paused.map((item) => item.id)).toEqual(['paused']);
    expect(overview.handled.map((item) => item.id)).toEqual(['handled-new', 'handled-old']);
    expect(overview.open.captured[0]).toMatchObject({
      content: 'Content captured-new', status: 'captured', labelIds: [],
    });
    expect(overview.open.captured[0].updatedAt).toEqual(new Date('2026-08-03T00:00:00Z'));
  });

  it('filters recent activity by the idea prefix before applying the display limit', async () => {
    const { ideaRepo, recordRepo } = await makeFakeRepos();
    await recordRepo.append(Record.create({
      id: 'newest-task', kind: 'taskCreated', occurredAt: new Date('2026-08-22T00:00:00Z'),
    }));
    for (let index = 0; index < RECENT_ACTIVITY_LIMIT + 2; index += 1) {
      await recordRepo.append(Record.create({
        id: `idea-${String(index).padStart(2, '0')}`,
        kind: index === 0 ? 'ideaCaptured' : 'ideaStatusChanged',
        detail: `activity-${index}`,
        occurredAt: new Date(t0.getTime() + index * 1_000),
      }));
    }

    const overview = await new IdeasOverviewService(ideaRepo, recordRepo).getOverview();

    expect(overview.recentActivity).toHaveLength(RECENT_ACTIVITY_LIMIT);
    expect(overview.recentActivity.every((record) => record.kind.startsWith('idea'))).toBe(true);
    expect(overview.recentActivity[0]).toMatchObject({ id: 'idea-11', detail: 'activity-11' });
    expect(overview.recentActivity.at(-1)?.id).toBe('idea-02');
  });
});
