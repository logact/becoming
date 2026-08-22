import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos } from '../../__tests__/fakes';
import { CaptureNoteService } from '../CaptureNoteService';

const now = new Date('2026-08-22T10:00:00Z');

describe('CaptureNoteService', () => {
  it('atomically saves a trimmed Note, capture record, and logs relation', async () => {
    const repos = await makeFakeRepos();
    const service = new CaptureNoteService(
      repos.noteRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await service.capture({
      noteId: 'note-1', content: '  Review every Friday  ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      id: 'note-1', content: 'Review every Friday', archived: false, pinnedAt: null,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      id: 'record-1', kind: 'noteCaptured',
      detail: 'Captured “Review every Friday”', occurredAt: now,
    });
    expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'note',
      targetId: 'note-1', kind: 'logs',
    });
  });

  it('rejects blank content before the transaction and performs no writes', async () => {
    const repos = await makeFakeRepos();
    const service = new CaptureNoteService(
      repos.noteRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await expect(service.capture({
      noteId: 'note-1', content: ' ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow(DomainError);

    expect(await repos.noteRepo.list()).toEqual([]);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the Note and record when logs relation persistence fails', async () => {
    const repos = await makeFakeRepos();
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };
    const service = new CaptureNoteService(
      repos.noteRepo, repos.recordRepo, failingRelations, repos.transactionRunner,
    );

    await expect(service.capture({
      noteId: 'note-1', content: 'Will roll back', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('relation write failed');

    expect(await repos.noteRepo.findById('note-1')).toBeNull();
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });
});
