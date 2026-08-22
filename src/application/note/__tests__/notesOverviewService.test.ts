import { Label } from '../../../domain/label/Label';
import { Note } from '../../../domain/note/Note';
import { Record } from '../../../domain/record/Record';
import { makeFakeRepos } from '../../__tests__/fakes';
import { RECENT_ACTIVITY_LIMIT } from '../../dashboard/DashboardService';
import { NotesOverviewService } from '../NotesOverviewService';

const t0 = new Date('2026-08-01T00:00:00Z');

function restoredNote(params: {
  id: string;
  updatedAt: Date;
  pinnedAt?: Date | null;
  archived?: boolean;
  labelIds?: string[];
}): Note {
  return Note.restore({
    id: params.id,
    content: `Content ${params.id}`,
    archived: params.archived ?? false,
    pinnedAt: params.pinnedAt ?? null,
    labelIds: params.labelIds ?? [],
    createdAt: t0,
    updatedAt: params.updatedAt,
  });
}

describe('NotesOverviewService', () => {
  it('groups and counts Notes, sorts pinned by pinnedAt, and sorts active by updatedAt', async () => {
    const repos = await makeFakeRepos();
    await Promise.all([
      repos.noteRepo.save(restoredNote({
        id: 'pinned-old', pinnedAt: new Date('2026-08-03T00:00:00Z'),
        updatedAt: new Date('2026-08-09T00:00:00Z'),
      })),
      repos.noteRepo.save(restoredNote({
        id: 'pinned-new', pinnedAt: new Date('2026-08-05T00:00:00Z'),
        updatedAt: new Date('2026-08-02T00:00:00Z'),
      })),
      repos.noteRepo.save(restoredNote({ id: 'active-old', updatedAt: new Date('2026-08-04T00:00:00Z') })),
      repos.noteRepo.save(restoredNote({ id: 'active-new', updatedAt: new Date('2026-08-08T00:00:00Z') })),
    ]);

    const view = await new NotesOverviewService(
      repos.noteRepo, repos.labelRepo, repos.recordRepo,
    ).getOverview();

    expect(view.counts).toEqual({ active: 4, archived: 0 });
    expect(view.pinned.map((note) => note.id)).toEqual(['pinned-new', 'pinned-old']);
    expect(view.active.map((note) => note.id)).toEqual(['active-new', 'active-old']);
  });

  it('sorts archived Notes only by updatedAt even when they retain pinnedAt', async () => {
    const repos = await makeFakeRepos();
    await Promise.all([
      repos.noteRepo.save(restoredNote({
        id: 'older-but-pinned-newest', archived: true,
        pinnedAt: new Date('2026-08-20T00:00:00Z'), updatedAt: new Date('2026-08-03T00:00:00Z'),
      })),
      repos.noteRepo.save(restoredNote({
        id: 'newer-unpinned', archived: true, updatedAt: new Date('2026-08-10T00:00:00Z'),
      })),
    ]);

    const view = await new NotesOverviewService(
      repos.noteRepo, repos.labelRepo, repos.recordRepo,
    ).getOverview();

    expect(view.counts).toEqual({ active: 0, archived: 2 });
    expect(view.pinned).toEqual([]);
    expect(view.active).toEqual([]);
    expect(view.archived.map((note) => note.id)).toEqual([
      'newer-unpinned', 'older-but-pinned-newest',
    ]);
  });

  it('resolves label names and colors and skips dangling label ids', async () => {
    const repos = await makeFakeRepos();
    await repos.labelRepo.save(Label.create({ id: 'label-a', name: 'Practice', color: '#008800' }));
    await repos.labelRepo.save(Label.create({ id: 'label-b', name: 'Reference' }));
    await repos.noteRepo.save(restoredNote({
      id: 'note-1', updatedAt: t0, labelIds: ['label-a', 'missing', 'label-b'],
    }));

    const view = await new NotesOverviewService(
      repos.noteRepo, repos.labelRepo, repos.recordRepo,
    ).getOverview();

    expect(view.active[0].labels).toEqual([
      { id: 'label-a', name: 'Practice', color: '#008800' },
      { id: 'label-b', name: 'Reference' },
    ]);
  });

  it('returns only Note activity and applies the display limit after filtering', async () => {
    const repos = await makeFakeRepos();
    await repos.recordRepo.append(Record.create({
      id: 'newest-task', kind: 'taskCreated', occurredAt: new Date('2026-08-22T00:00:00Z'),
    }));
    for (let index = 0; index < RECENT_ACTIVITY_LIMIT + 2; index += 1) {
      await repos.recordRepo.append(Record.create({
        id: `note-${String(index).padStart(2, '0')}`,
        kind: index === 0 ? 'noteCaptured' : 'noteEdited',
        detail: `activity-${index}`,
        occurredAt: new Date(t0.getTime() + index * 1_000),
      }));
    }

    const view = await new NotesOverviewService(
      repos.noteRepo, repos.labelRepo, repos.recordRepo,
    ).getOverview();

    expect(view.recentActivity).toHaveLength(RECENT_ACTIVITY_LIMIT);
    expect(view.recentActivity.every((record) => record.kind.startsWith('note'))).toBe(true);
    expect(view.recentActivity[0]).toMatchObject({ id: 'note-11', detail: 'activity-11' });
    expect(view.recentActivity.at(-1)?.id).toBe('note-02');
  });
});
