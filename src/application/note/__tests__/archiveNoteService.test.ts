import { Note } from '../../../domain/note/Note';
import { Relation } from '../../../domain/relation/Relation';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { makeFakeRepos } from '../../__tests__/fakes';
import { ArchiveNoteService } from '../ArchiveNoteService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const pinnedAt = new Date('2026-08-05T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function makeService(repos: Awaited<ReturnType<typeof makeFakeRepos>>, relations = repos.relationRepo) {
  return new ArchiveNoteService(repos.noteRepo, repos.recordRepo, relations, repos.transactionRunner);
}

async function savePinnedNote(repos: Awaited<ReturnType<typeof makeFakeRepos>>): Promise<void> {
  const note = Note.create({ id: 'note-1', content: 'A note', now: createdAt });
  note.pin(pinnedAt);
  await repos.noteRepo.save(note);
}

describe('ArchiveNoteService', () => {
  it('archives while retaining pinnedAt and saves an archive record and logs relation', async () => {
    const repos = await makeFakeRepos();
    await savePinnedNote(repos);

    await makeService(repos).setArchived({
      noteId: 'note-1', archived: true, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      archived: true, pinnedAt, updatedAt: now,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      id: 'record-1', kind: 'noteArchived', detail: 'Archived note', occurredAt: now,
    });
    expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'note',
      targetId: 'note-1', kind: 'logs',
    });
  });

  it('archives without removing labels or existing links', async () => {
    const repos = await makeFakeRepos();
    const note = Note.create({ id: 'note-1', content: 'A linked note', now: createdAt });
    note.addLabel('label-1');
    await repos.noteRepo.save(note);
    await repos.relationRepo.save(Relation.create({
      id: 'existing-link',
      sourceType: 'note',
      sourceId: 'note-1',
      targetType: 'goal',
      targetId: 'goal-1',
      kind: 'relatesTo',
      now: createdAt,
    }));

    await makeService(repos).setArchived({
      noteId: 'note-1', archived: true, recordId: 'record-1',
      recordRelationId: 'archive-log', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      archived: true, labelIds: ['label-1'],
    });
    expect(await repos.relationRepo.findById('existing-link')).toMatchObject({
      sourceType: 'note', sourceId: 'note-1', targetType: 'goal',
      targetId: 'goal-1', kind: 'relatesTo',
    });
  });

  it('unarchives while retaining pinnedAt and records the transition', async () => {
    const repos = await makeFakeRepos();
    await savePinnedNote(repos);
    const archivedAt = new Date('2026-08-10T00:00:00Z');
    const note = await repos.noteRepo.findById('note-1');
    note!.archive(archivedAt);
    await repos.noteRepo.save(note!);

    await makeService(repos).setArchived({
      noteId: 'note-1', archived: false, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      archived: false, pinnedAt, updatedAt: now,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      kind: 'noteUnarchived', detail: 'Unarchived note',
    });
  });

  it('treats the current archive state as a no-op', async () => {
    const repos = await makeFakeRepos();
    await savePinnedNote(repos);

    await makeService(repos).setArchived({
      noteId: 'note-1', archived: false, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      archived: false, pinnedAt, updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rejects an unknown Note without activity', async () => {
    const repos = await makeFakeRepos();

    await expect(makeService(repos).setArchived({
      noteId: 'missing', archived: true, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('Unknown note: missing');
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });

  it('rolls back archive state and record when logs relation persistence fails', async () => {
    const repos = await makeFakeRepos();
    await savePinnedNote(repos);
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, failingRelations).setArchived({
      noteId: 'note-1', archived: true, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('relation write failed');

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      archived: false, pinnedAt, updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });
});
