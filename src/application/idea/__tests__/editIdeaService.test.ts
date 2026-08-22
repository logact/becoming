import { Idea } from '../../../domain/idea/Idea';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos } from '../../__tests__/fakes';
import { EditIdeaService } from '../EditIdeaService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

describe('EditIdeaService', () => {
  it('atomically edits content and saves an edit record with its logs relation', async () => {
    const repos = await makeFakeRepos();
    await repos.ideaRepo.save(Idea.create({ id: 'idea-1', content: 'Old content', now: createdAt }));
    const service = new EditIdeaService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await service.edit({
      ideaId: 'idea-1', content: '  New content  ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      content: 'New content', updatedAt: now,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      id: 'record-1', kind: 'ideaEdited', detail: 'Edited idea to “New content”', occurredAt: now,
    });
    expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'idea',
      targetId: 'idea-1', kind: 'logs',
    });
  });

  it('treats content equal after trimming as a no-op with no timestamp or activity change', async () => {
    const repos = await makeFakeRepos();
    await repos.ideaRepo.save(Idea.create({ id: 'idea-1', content: 'Same content', now: createdAt }));
    const service = new EditIdeaService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await service.edit({
      ideaId: 'idea-1', content: '  Same content ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    });

    expect((await repos.ideaRepo.findById('idea-1'))?.updatedAt).toEqual(createdAt);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rejects blank content and preserves the existing Idea without activity', async () => {
    const repos = await makeFakeRepos();
    await repos.ideaRepo.save(Idea.create({ id: 'idea-1', content: 'Keep me', now: createdAt }));
    const service = new EditIdeaService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await expect(service.edit({
      ideaId: 'idea-1', content: ' ', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow(DomainError);

    expect((await repos.ideaRepo.findById('idea-1'))?.content).toBe('Keep me');
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('throws DomainError for an unknown Idea without writing activity', async () => {
    const repos = await makeFakeRepos();
    const service = new EditIdeaService(
      repos.ideaRepo, repos.recordRepo, repos.relationRepo, repos.transactionRunner,
    );

    await expect(service.edit({
      ideaId: 'missing', content: 'New', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('Unknown idea: missing');
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the content and record when relation persistence fails', async () => {
    const repos = await makeFakeRepos();
    await repos.ideaRepo.save(Idea.create({ id: 'idea-1', content: 'Original', now: createdAt }));
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };
    const service = new EditIdeaService(
      repos.ideaRepo, repos.recordRepo, failingRelations, repos.transactionRunner,
    );

    await expect(service.edit({
      ideaId: 'idea-1', content: 'Changed', recordId: 'record-1',
      recordRelationId: 'relation-1', now,
    })).rejects.toThrow('relation write failed');

    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      content: 'Original', updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });
});
