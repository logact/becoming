import { Goal } from '../../../domain/goal/Goal';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import {
  CreateGoalProjectService,
  PROJECT_CREATED_RECORD_KIND,
  type CreateGoalProjectCommand,
} from '../CreateGoalProjectService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');
const goalDue = new Date('2027-05-01T00:00:00Z');
const earlierProjectDue = new Date('2027-04-01T00:00:00Z');

function command(
  overrides: Partial<CreateGoalProjectCommand> = {},
): CreateGoalProjectCommand {
  return {
    projectId: 'project-1',
    goalId: 'goal-1',
    name: 'Build trail endurance',
    recordId: 'record-1',
    goalRecordRelationId: 'goal-log-1',
    projectRecordRelationId: 'project-log-1',
    now,
    ...overrides,
  };
}

function makeService(
  repos: TestRepositories,
  relations: RelationRepository = repos.relationRepo,
): CreateGoalProjectService {
  return new CreateGoalProjectService(
    repos.goalRepo,
    repos.projectRepo,
    repos.recordRepo,
    relations,
    repos.transactionRunner,
  );
}

async function setupGoal(params: { due?: Date; archived?: boolean } = {}) {
  const repos = await makeFakeRepos();
  const goal = Goal.create({
    id: 'goal-1',
    title: 'Run a trail race',
    ...(params.due === undefined ? {} : { due: params.due }),
    now: createdAt,
  });
  if (params.archived) goal.archive(createdAt);
  await repos.goalRepo.save(goal);
  return repos;
}

async function expectNoWrites(repos: TestRepositories): Promise<void> {
  expect(await repos.projectRepo.list()).toEqual([]);
  expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  expect(await repos.relationRepo.list()).toEqual([]);
}

describe('CreateGoalProjectService', () => {
  it('creates a permanently associated planning Project with no due and returns its ID', async () => {
    const repos = await setupGoal({ due: goalDue });

    const result = await makeService(repos).create(command());

    expect(result).toEqual({ projectId: 'project-1' });
    expect(await repos.projectRepo.findById('project-1')).toMatchObject({
      id: 'project-1',
      name: 'Build trail endurance',
      goalId: 'goal-1',
      due: undefined,
      status: 'planning',
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('creates a Project due strictly earlier than its Goal due', async () => {
    const repos = await setupGoal({ due: goalDue });

    await makeService(repos).create(command({ due: earlierProjectDue }));

    expect(await repos.projectRepo.findById('project-1')).toMatchObject({
      goalId: 'goal-1',
      due: earlierProjectDue,
      status: 'planning',
    });
  });

  it('writes one immutable creation activity linked to both Goal and Project timelines', async () => {
    const repos = await setupGoal();

    await makeService(repos).create(command());

    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-1',
        kind: PROJECT_CREATED_RECORD_KIND,
        detail: 'Created Project “Build trail endurance”',
        occurredAt: now,
      }),
    ]);
    expect(await repos.relationRepo.findById('goal-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'goal',
      targetId: 'goal-1', kind: 'logs',
    });
    expect(await repos.relationRepo.findById('project-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'project',
      targetId: 'project-1', kind: 'logs',
    });
    expect((await repos.recordRepo.listByTarget('goal', 10, 'goal-1')).map(({ id }) => id))
      .toEqual(['record-1']);
    expect((await repos.recordRepo.listByTarget('project', 10, 'project-1')).map(({ id }) => id))
      .toEqual(['record-1']);
  });

  it('rejects a blank name before any write', async () => {
    const repos = await setupGoal();

    await expect(makeService(repos).create(command({ name: '   ' }))).rejects.toThrow(
      'Project name must not be empty',
    );

    await expectNoWrites(repos);
  });

  it('rejects an unknown Goal before any write', async () => {
    const repos = await makeFakeRepos();

    await expect(makeService(repos).create(command())).rejects.toThrow(
      'Unknown goal: goal-1',
    );

    await expectNoWrites(repos);
  });

  it('rejects an archived Goal before any write', async () => {
    const repos = await setupGoal({ archived: true });

    await expect(makeService(repos).create(command())).rejects.toThrow(
      'Cannot create a project for archived goal: goal-1',
    );

    await expectNoWrites(repos);
  });

  it.each([
    ['equal to', goalDue],
    ['later than', new Date('2027-06-01T00:00:00Z')],
  ])('rejects a Project due %s its Goal due before any write', async (_label, due) => {
    const repos = await setupGoal({ due: goalDue });

    await expect(makeService(repos).create(command({ due }))).rejects.toThrow(DomainError);

    await expectNoWrites(repos);
  });

  it('rolls back Project, Record, and the first timeline link when the later link fails', async () => {
    const repos = await setupGoal();
    let relationWrites = 0;
    const failingRelations: RelationRepository = {
      save: async (relation) => {
        relationWrites += 1;
        if (relationWrites === 2) throw new Error('project activity relation failed');
        await repos.relationRepo.save(relation);
      },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, failingRelations).create(command())).rejects.toThrow(
      'project activity relation failed',
    );

    await expectNoWrites(repos);
  });
});
