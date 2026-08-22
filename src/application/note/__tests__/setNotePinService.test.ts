import { Note } from '../../../domain/note/Note';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { makeFakeRepos } from '../../__tests__/fakes';
import { SetNotePinService } from '../SetNotePinService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function makeService(repos: Awaited<ReturnType<typeof makeFakeRepos>>, relations = repos.relationRepo) {
  return new SetNotePinService(repos.noteRepo, repos.recordRepo, relations, repos.transactionRunner);
}

describe('SetNotePinService', () => {
  it('pins without changing updatedAt and saves a pin record and logs relation', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'A note', now: createdAt }));

    await makeService(repos).setPinned({
      noteId: 'note-1', pinned: true, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      pinnedAt: now, updatedAt: createdAt,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      id: 'record-1', kind: 'notePinned', detail: 'Pinned note', occurredAt: now,
    });
    expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'note',
      targetId: 'note-1', kind: 'logs',
    });
  });

  it('re-pins to refresh pinnedAt, then unpins, without changing updatedAt', async () => {
    const repos = await makeFakeRepos();
    const note = Note.create({ id: 'note-1', content: 'A note', now: createdAt });
    note.pin(new Date('2026-08-02T00:00:00Z'));
    await repos.noteRepo.save(note);
    const service = makeService(repos);

    await service.setPinned({
      noteId: 'note-1', pinned: true, recordId: 'record-pin',
      recordRelationId: 'relation-pin', now,
    });
    expect((await repos.noteRepo.findById('note-1'))?.pinnedAt).toEqual(now);

    const unpinAt = new Date('2026-08-23T10:00:00Z');
    await service.setPinned({
      noteId: 'note-1', pinned: false, recordId: 'record-unpin',
      recordRelationId: 'relation-unpin', now: unpinAt,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      pinnedAt: null, updatedAt: createdAt,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      id: 'record-unpin', kind: 'noteUnpinned', detail: 'Unpinned note', occurredAt: unpinAt,
    });
  });

  it('allows pinning an archived Note while preserving archive state', async () => {
    const repos = await makeFakeRepos();
    const archivedAt = new Date('2026-08-10T00:00:00Z');
    const note = Note.create({ id: 'note-1', content: 'Archived note', now: createdAt });
    note.archive(archivedAt);
    await repos.noteRepo.save(note);

    await makeService(repos).setPinned({
      noteId: 'note-1', pinned: true, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      archived: true, pinnedAt: now, updatedAt: archivedAt,
    });
  });

  it('treats unpinning an already-unpinned Note as a no-op', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'A note', now: createdAt }));

    await makeService(repos).setPinned({
      noteId: 'note-1', pinned: false, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rejects an unknown Note without activity', async () => {
    const repos = await makeFakeRepos();

    await expect(makeService(repos).setPinned({
      noteId: 'missing', pinned: true, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('Unknown note: missing');
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });

  it('rolls back pin state and record when logs relation persistence fails', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'A note', now: createdAt }));
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, failingRelations).setPinned({
      noteId: 'note-1', pinned: true, recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('relation write failed');

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      pinnedAt: null, updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });
});
