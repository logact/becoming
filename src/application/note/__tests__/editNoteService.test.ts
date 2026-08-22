import { Note } from '../../../domain/note/Note';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos } from '../../__tests__/fakes';
import { EditNoteService } from '../EditNoteService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function makeService(repos: Awaited<ReturnType<typeof makeFakeRepos>>, relations = repos.relationRepo) {
  return new EditNoteService(repos.noteRepo, repos.recordRepo, relations, repos.transactionRunner);
}

describe('EditNoteService', () => {
  it('atomically edits content and saves an edit record with its logs relation', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'Old content', now: createdAt }));

    await makeService(repos).edit({
      noteId: 'note-1', content: '  New content  ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      content: 'New content', updatedAt: now,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      id: 'record-1', kind: 'noteEdited', detail: 'Edited note to “New content”', occurredAt: now,
    });
    expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'note',
      targetId: 'note-1', kind: 'logs',
    });
  });

  it('treats equal trimmed content as a no-op', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'Same', now: createdAt }));

    await makeService(repos).edit({
      noteId: 'note-1', content: '  Same ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect((await repos.noteRepo.findById('note-1'))?.updatedAt).toEqual(createdAt);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rejects blank content and unknown Notes without activity', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'Keep me', now: createdAt }));
    const service = makeService(repos);

    await expect(service.edit({
      noteId: 'note-1', content: ' ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow(DomainError);
    await expect(service.edit({
      noteId: 'missing', content: 'New', recordId: 'record-2',
      recordRelationId: 'relation-2', now,
    })).rejects.toThrow('Unknown note: missing');

    expect((await repos.noteRepo.findById('note-1'))?.content).toBe('Keep me');
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back content and record when logs relation persistence fails', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'Original', now: createdAt }));
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, failingRelations).edit({
      noteId: 'note-1', content: 'Changed', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('relation write failed');

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      content: 'Original', updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });
});
