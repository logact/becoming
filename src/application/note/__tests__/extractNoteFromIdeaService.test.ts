import { Idea } from '../../../domain/idea/Idea';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import {
  ExtractNoteFromIdeaService,
  type ExtractNoteFromIdeaCommand,
} from '../ExtractNoteFromIdeaService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function command(
  overrides: Partial<ExtractNoteFromIdeaCommand> = {},
): ExtractNoteFromIdeaCommand {
  return {
    ideaId: 'idea-1',
    noteId: 'note-1',
    content: 'Review progress every Friday.',
    derivedRelationId: 'derived-1',
    recordId: 'record-1',
    ideaRecordRelationId: 'idea-log-1',
    noteRecordRelationId: 'note-log-1',
    now,
    ...overrides,
  };
}

async function seedIdea(
  repos: TestRepositories,
  params: {
    status?: 'captured' | 'exploring' | 'paused' | 'handled';
    archived?: boolean;
    labelIds?: string[];
  } = {},
): Promise<void> {
  await repos.ideaRepo.save(Idea.restore({
    id: 'idea-1',
    content: 'Keep the weekly review concise and actionable.',
    status: params.status ?? 'exploring',
    archived: params.archived ?? false,
    labelIds: params.labelIds ?? [],
    createdAt,
    updatedAt: createdAt,
  }));
}

function makeService(repos: TestRepositories, relations = repos.relationRepo) {
  return new ExtractNoteFromIdeaService(
    repos.ideaRepo,
    repos.noteRepo,
    repos.recordRepo,
    relations,
    repos.transactionRunner,
  );
}

describe('ExtractNoteFromIdeaService', () => {
  it('copies labels, creates note --derivedFrom--> idea, handles the Idea, and logs once to both', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos, { labelIds: ['reflection', 'weekly'] });

    await makeService(repos).extract(command({ content: '  Review progress every Friday.  ' }));

    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      id: 'note-1',
      content: 'Review progress every Friday.',
      archived: false,
      pinnedAt: null,
      labelIds: ['reflection', 'weekly'],
      createdAt: now,
      updatedAt: now,
    });
    expect(await repos.relationRepo.findById('derived-1')).toMatchObject({
      sourceType: 'note',
      sourceId: 'note-1',
      targetType: 'idea',
      targetId: 'idea-1',
      kind: 'derivedFrom',
    });
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      status: 'handled',
      updatedAt: now,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-1',
        kind: 'noteDerivedFromIdea',
        detail: 'Extracted Note “Review progress every Friday.” from Idea',
        occurredAt: now,
      }),
    ]);
    expect((await repos.recordRepo.listByTarget('idea', 10, 'idea-1')).map(({ id }) => id))
      .toEqual(['record-1']);
    expect((await repos.recordRepo.listByTarget('note', 10, 'note-1')).map(({ id }) => id))
      .toEqual(['record-1']);
    expect(await repos.relationRepo.findById('idea-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'idea',
      targetId: 'idea-1', kind: 'logs',
    });
    expect(await repos.relationRepo.findById('note-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'note',
      targetId: 'note-1', kind: 'logs',
    });
  });

  it('allows repeated extraction from a handled Idea without refreshing status or adding a status record', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos, { status: 'handled' });
    const service = makeService(repos);

    await service.extract(command());
    await service.extract(command({
      noteId: 'note-2',
      content: 'Choose next week\'s priority.',
      derivedRelationId: 'derived-2',
      recordId: 'record-2',
      ideaRecordRelationId: 'idea-log-2',
      noteRecordRelationId: 'note-log-2',
      now: new Date('2026-08-22T11:00:00Z'),
    }));

    expect((await repos.noteRepo.list()).map(({ id }) => id).sort()).toEqual(['note-1', 'note-2']);
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      status: 'handled',
      updatedAt: createdAt,
    });
    expect((await repos.recordRepo.listRecent(10)).map(({ kind }) => kind))
      .toEqual(['noteDerivedFromIdea', 'noteDerivedFromIdea']);
  });

  it('rejects an unknown or archived Idea without writes', async () => {
    const unknownRepos = await makeFakeRepos();
    await expect(makeService(unknownRepos).extract(command())).rejects.toThrow(
      'Unknown idea: idea-1',
    );
    expect(await unknownRepos.noteRepo.list()).toEqual([]);
    expect(await unknownRepos.recordRepo.listRecent(10)).toEqual([]);
    expect(await unknownRepos.relationRepo.list()).toEqual([]);

    const archivedRepos = await makeFakeRepos();
    await seedIdea(archivedRepos, { archived: true });
    await expect(makeService(archivedRepos).extract(command())).rejects.toThrow(DomainError);
    expect(await archivedRepos.noteRepo.list()).toEqual([]);
    expect(await archivedRepos.recordRepo.listRecent(10)).toEqual([]);
    expect(await archivedRepos.relationRepo.list()).toEqual([]);
  });

  it('rejects blank Note content without derivation writes or handling the Idea', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos);

    await expect(makeService(repos).extract(command({ content: '   ' }))).rejects.toThrow(
      'Note content must not be empty',
    );

    expect(await repos.noteRepo.list()).toEqual([]);
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      status: 'exploring', updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the Note, handled state, record, and all relations after a late failure', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos);
    let relationWrites = 0;
    const failingRelations: RelationRepository = {
      save: async (relation) => {
        relationWrites += 1;
        if (relationWrites === 3) throw new Error('note activity relation failed');
        await repos.relationRepo.save(relation);
      },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, failingRelations).extract(command())).rejects.toThrow(
      'note activity relation failed',
    );

    expect(await repos.noteRepo.findById('note-1')).toBeNull();
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      status: 'exploring', updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });
});
