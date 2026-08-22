import { Idea, type IdeaStatus } from '../../../domain/idea/Idea';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { makeFakeRepos } from '../../__tests__/fakes';
import { ChangeIdeaStatusService } from '../ChangeIdeaStatusService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

describe('ChangeIdeaStatusService', () => {
  it.each<IdeaStatus>(['captured', 'exploring', 'paused', 'handled'])(
    'changes directly to %s and saves a transition record and logs relation',
    async (status) => {
      const repos = await makeFakeRepos();
      const original = status === 'captured' ? 'handled' : 'captured';
      await repos.ideaRepo.save(Idea.restore({
        id: 'idea-1', content: 'An idea', status: original, archived: false,
        labelIds: [], createdAt, updatedAt: createdAt,
      }));
      const service = new ChangeIdeaStatusService(
        repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
      );

      await service.change({
        ideaId: 'idea-1', status, recordId: 'record-1',
        recordRelationId: 'relation-1', now,
      });

      expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({ status, updatedAt: now });
      expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
        id: 'record-1', kind: 'ideaStatusChanged', detail: `${original} → ${status}`, occurredAt: now,
      });
      expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
        sourceType: 'record', sourceId: 'record-1', targetType: 'idea',
        targetId: 'idea-1', kind: 'logs',
      });
    },
  );

  it('treats the current status as a no-op with no timestamp or activity change', async () => {
    const repos = await makeFakeRepos();
    await repos.ideaRepo.save(Idea.create({ id: 'idea-1', content: 'An idea', now: createdAt }));
    const service = new ChangeIdeaStatusService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await service.change({
      ideaId: 'idea-1', status: 'captured', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect((await repos.ideaRepo.findById('idea-1'))?.updatedAt).toEqual(createdAt);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('throws DomainError for an unknown Idea without writing activity', async () => {
    const repos = await makeFakeRepos();
    const service = new ChangeIdeaStatusService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await expect(service.change({
      ideaId: 'missing', status: 'handled', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('Unknown idea: missing');
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the status and record when relation persistence fails', async () => {
    const repos = await makeFakeRepos();
    await repos.ideaRepo.save(Idea.create({ id: 'idea-1', content: 'An idea', now: createdAt }));
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };
    const service = new ChangeIdeaStatusService(
      repos.ideaRepo, repos.recordRepo, failingRelations, repos.transactionRunner,
    );

    await expect(service.change({
      ideaId: 'idea-1', status: 'handled', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('relation write failed');

    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      status: 'captured', updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });
});
