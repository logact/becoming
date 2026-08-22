import { Idea } from '../../../domain/idea/Idea';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos } from '../../__tests__/fakes';
import {
  CreateGoalFromIdeaService,
  type CreateGoalFromIdeaCommand,
} from '../CreateGoalFromIdeaService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function command(
  overrides: Partial<CreateGoalFromIdeaCommand> = {},
): CreateGoalFromIdeaCommand {
  return {
    ideaId: 'idea-1',
    goalId: 'goal-1',
    title: 'Run a trail race',
    due: new Date('2027-05-01T00:00:00Z'),
    derivedRelationId: 'derived-1',
    recordId: 'record-1',
    ideaRecordRelationId: 'idea-log-1',
    goalRecordRelationId: 'goal-log-1',
    now,
    ...overrides,
  };
}

async function setupIdea(params: {
  status?: 'captured' | 'exploring' | 'paused' | 'handled';
  archived?: boolean;
  labelIds?: string[];
} = {}) {
  const repos = await makeFakeRepos();
  await repos.ideaRepo.save(Idea.restore({
    id: 'idea-1',
    content: 'Train consistently, then finish the full mountain course.',
    status: params.status ?? 'exploring',
    archived: params.archived ?? false,
    labelIds: params.labelIds ?? [],
    createdAt,
    updatedAt: createdAt,
  }));
  return repos;
}

describe('CreateGoalFromIdeaService', () => {
  it('creates a labeled top-level Goal, derives it from the Idea, and logs one record to both', async () => {
    const repos = await setupIdea({ labelIds: ['health', 'outdoors'] });
    const service = new CreateGoalFromIdeaService(
      repos.ideaRepo, repos.goalRepo, repos.recordRepo, repos.relationRepo,
      repos.transactionRunner,
    );

    await service.create(command());

    expect(await repos.goalRepo.findById('goal-1')).toMatchObject({
      id: 'goal-1',
      title: 'Run a trail race',
      description: 'Train consistently, then finish the full mountain course.',
      due: new Date('2027-05-01T00:00:00Z'),
      status: 'todo',
      archived: false,
      labelIds: ['health', 'outdoors'],
      projectId: undefined,
      parentGoalId: undefined,
    });
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({ status: 'handled', updatedAt: now });
    expect(await repos.relationRepo.findById('derived-1')).toMatchObject({
      sourceType: 'goal', sourceId: 'goal-1', targetType: 'idea',
      targetId: 'idea-1', kind: 'derivedFrom',
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-1', kind: 'ideaDerivedGoal',
        detail: 'Created Goal “Run a trail race” from Idea', occurredAt: now,
      }),
    ]);
    expect((await repos.recordRepo.listByTarget('idea', 10, 'idea-1')).map(({ id }) => id))
      .toEqual(['record-1']);
    expect((await repos.recordRepo.listByTarget('goal', 10, 'goal-1')).map(({ id }) => id))
      .toEqual(['record-1']);
    expect(await repos.relationRepo.findById('idea-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'idea',
      targetId: 'idea-1', kind: 'logs',
    });
    expect(await repos.relationRepo.findById('goal-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'goal',
      targetId: 'goal-1', kind: 'logs',
    });
  });

  it('uses an explicit description instead of the full Idea content', async () => {
    const repos = await setupIdea();
    const service = new CreateGoalFromIdeaService(
      repos.ideaRepo, repos.goalRepo, repos.recordRepo, repos.relationRepo,
      repos.transactionRunner,
    );

    await service.create(command({ description: 'A deliberately narrower outcome.' }));

    expect((await repos.goalRepo.findById('goal-1'))?.description)
      .toBe('A deliberately narrower outcome.');
  });

  it('allows repeated derivation from an already handled Idea without a status record', async () => {
    const repos = await setupIdea({ status: 'handled' });
    const service = new CreateGoalFromIdeaService(
      repos.ideaRepo, repos.goalRepo, repos.recordRepo, repos.relationRepo,
      repos.transactionRunner,
    );

    await service.create(command());
    await service.create(command({
      goalId: 'goal-2', title: 'Run an ultramarathon', derivedRelationId: 'derived-2',
      recordId: 'record-2', ideaRecordRelationId: 'idea-log-2',
      goalRecordRelationId: 'goal-log-2',
    }));

    expect((await repos.goalRepo.list()).map(({ id }) => id).sort()).toEqual(['goal-1', 'goal-2']);
    expect((await repos.ideaRepo.findById('idea-1'))?.updatedAt).toEqual(createdAt);
    expect((await repos.recordRepo.listRecent(10)).map(({ kind }) => kind))
      .toEqual(['ideaDerivedGoal', 'ideaDerivedGoal']);
  });

  it('rejects an unknown Idea without writes', async () => {
    const repos = await makeFakeRepos();
    const service = new CreateGoalFromIdeaService(
      repos.ideaRepo, repos.goalRepo, repos.recordRepo, repos.relationRepo,
      repos.transactionRunner,
    );

    await expect(service.create(command())).rejects.toThrow('Unknown idea: idea-1');
    expect(await repos.goalRepo.list()).toEqual([]);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rejects an archived Idea and a blank title without writes', async () => {
    const archivedRepos = await setupIdea({ archived: true });
    const archivedService = new CreateGoalFromIdeaService(
      archivedRepos.ideaRepo, archivedRepos.goalRepo, archivedRepos.recordRepo,
      archivedRepos.relationRepo, archivedRepos.transactionRunner,
    );
    await expect(archivedService.create(command())).rejects.toThrow(DomainError);
    expect(await archivedRepos.goalRepo.list()).toEqual([]);

    const blankRepos = await setupIdea();
    const blankService = new CreateGoalFromIdeaService(
      blankRepos.ideaRepo, blankRepos.goalRepo, blankRepos.recordRepo,
      blankRepos.relationRepo, blankRepos.transactionRunner,
    );
    await expect(blankService.create(command({ title: '   ' }))).rejects.toThrow(
      'Goal title must not be empty',
    );
    expect(await blankRepos.goalRepo.list()).toEqual([]);
  });

  it('rolls back the Goal, handled state, record, and relations after a late write failure', async () => {
    const repos = await setupIdea();
    let relationWrites = 0;
    const failingRelations: RelationRepository = {
      save: async (relation) => {
        relationWrites += 1;
        if (relationWrites === 3) throw new Error('goal activity relation failed');
        await repos.relationRepo.save(relation);
      },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };
    const service = new CreateGoalFromIdeaService(
      repos.ideaRepo, repos.goalRepo, repos.recordRepo, failingRelations,
      repos.transactionRunner,
    );

    await expect(service.create(command())).rejects.toThrow('goal activity relation failed');

    expect(await repos.goalRepo.findById('goal-1')).toBeNull();
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      status: 'exploring', updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });
});
