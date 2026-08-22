import { DomainError } from '../../../domain/shared/errors';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { makeFakeRepos } from '../../__tests__/fakes';
import { CaptureIdeaService } from '../CaptureIdeaService';

const now = new Date('2026-08-22T10:00:00Z');

describe('CaptureIdeaService', () => {
  it('atomically saves a trimmed Idea, capture record, and logs relation', async () => {
    const repos = await makeFakeRepos();
    const service = new CaptureIdeaService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await service.capture({
      ideaId: 'idea-1', content: '  Try trail running  ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      id: 'idea-1', content: 'Try trail running', status: 'captured', archived: false,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-1', kind: 'ideaCaptured', detail: 'Captured “Try trail running”', occurredAt: now,
      }),
    ]);
    expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'idea',
      targetId: 'idea-1', kind: 'logs',
    });
  });

  it('rejects blank content before the transaction and performs no writes', async () => {
    const repos = await makeFakeRepos();
    const service = new CaptureIdeaService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await expect(service.capture({
      ideaId: 'idea-1', content: '  ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow(DomainError);

    expect(await repos.ideaRepo.list()).toEqual([]);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the Idea and record when relation persistence fails', async () => {
    const repos = await makeFakeRepos();
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };
    const service = new CaptureIdeaService(
      repos.ideaRepo, repos.recordRepo, failingRelations, repos.transactionRunner,
    );

    await expect(service.capture({
      ideaId: 'idea-1', content: 'Will roll back', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('relation write failed');

    expect(await repos.ideaRepo.findById('idea-1')).toBeNull();
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });
});
