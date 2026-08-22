import { Goal } from '../../../domain/goal/Goal';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import {
  GOAL_SCHEDULE_RECORD_KIND,
  ScheduleGoalService,
  type ScheduleGoalCommand,
} from '../ScheduleGoalService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');
const originalStart = new Date('2026-08-10T00:00:00Z');
const originalDue = new Date('2026-08-20T00:00:00Z');
const replacementStart = new Date('2026-09-01T00:00:00Z');
const replacementDue = new Date('2026-09-30T00:00:00Z');

function command(overrides: Partial<ScheduleGoalCommand> = {}): ScheduleGoalCommand {
  return {
    goalId: 'goal-1',
    recordId: 'record-1',
    relationId: 'relation-1',
    now,
    ...overrides,
  };
}

async function setup(relations?: RelationRepository) {
  const repos = await makeFakeRepos();
  await repos.goalRepo.save(Goal.create({
    id: 'goal-1', title: 'Run a trail race', startAt: originalStart,
    due: originalDue, now: createdAt,
  }));
  return {
    repos,
    service: new ScheduleGoalService(
      repos.goalRepo, repos.recordRepo, relations ?? repos.relationRepo,
      repos.transactionRunner,
    ),
  };
}

async function expectSchedule(
  repos: TestRepositories,
  expected: { startAt?: Date; due?: Date },
): Promise<void> {
  const goal = await repos.goalRepo.findById('goal-1');
  expect(goal?.startAt).toEqual(expected.startAt);
  expect(goal?.due).toEqual(expected.due);
  expect(goal?.updatedAt).toEqual(now);
  expect(await repos.recordRepo.listRecent(10)).toEqual([
    expect.objectContaining({
      id: 'record-1',
      kind: GOAL_SCHEDULE_RECORD_KIND,
      detail: 'Changed schedule for “Run a trail race”',
      occurredAt: now,
    }),
  ]);
  expect(await repos.relationRepo.findById('relation-1')).toMatchObject({
    sourceType: 'record', sourceId: 'record-1', targetType: 'goal',
    targetId: 'goal-1', kind: 'logs',
  });
  expect((await repos.recordRepo.listByTarget('goal', 10, 'goal-1')).map(({ id }) => id))
    .toEqual(['record-1']);
}

describe('ScheduleGoalService', () => {
  it.each([
    ['clears both dates', {}, {}],
    ['keeps only Start', { startAt: replacementStart }, { startAt: replacementStart }],
    ['keeps only Due', { due: replacementDue }, { due: replacementDue }],
    [
      'replaces both dates',
      { startAt: replacementStart, due: replacementDue },
      { startAt: replacementStart, due: replacementDue },
    ],
  ] as const)('%s and writes one linked immutable record', async (_label, values, expected) => {
    const { repos, service } = await setup();

    await service.schedule(command(values));

    await expectSchedule(repos, expected);
  });

  it('accepts Start and Due on the same local calendar day regardless of time', async () => {
    const { repos, service } = await setup();
    const startAt = new Date(2026, 8, 15, 23, 30);
    const due = new Date(2026, 8, 15, 1, 0);

    await service.schedule(command({ startAt, due }));

    await expectSchedule(repos, { startAt, due });
  });

  it('rejects a Start on a later local date without mutation or activity writes', async () => {
    const { repos, service } = await setup();
    const startAt = new Date(2026, 8, 16, 0, 0);
    const due = new Date(2026, 8, 15, 23, 59);

    await expect(service.schedule(command({ startAt, due }))).rejects.toThrow(DomainError);

    expect(await repos.goalRepo.findById('goal-1')).toMatchObject({
      startAt: originalStart, due: originalDue, updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rejects unknown and archived Goals before mutation', async () => {
    const unknownRepos = await makeFakeRepos();
    const unknownService = new ScheduleGoalService(
      unknownRepos.goalRepo, unknownRepos.recordRepo, unknownRepos.relationRepo,
      unknownRepos.transactionRunner,
    );
    await expect(unknownService.schedule(command())).rejects.toThrow('Unknown goal: goal-1');
    expect(await unknownRepos.recordRepo.listRecent(10)).toEqual([]);

    const { repos, service } = await setup();
    const goal = await repos.goalRepo.findById('goal-1');
    if (goal === null) throw new Error('Expected seeded Goal');
    goal.archive(createdAt);
    await repos.goalRepo.save(goal);

    await expect(service.schedule(command({ startAt: replacementStart }))).rejects.toThrow(
      'Cannot schedule archived goal: goal-1',
    );
    expect(await repos.goalRepo.findById('goal-1')).toMatchObject({
      archived: true, startAt: originalStart, due: originalDue,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the Goal and Record when the later Relation write fails', async () => {
    const repos = await makeFakeRepos();
    await repos.goalRepo.save(Goal.create({
      id: 'goal-1', title: 'Run a trail race', startAt: originalStart,
      due: originalDue, now: createdAt,
    }));
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('goal schedule relation failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };
    const service = new ScheduleGoalService(
      repos.goalRepo, repos.recordRepo, failingRelations, repos.transactionRunner,
    );

    await expect(service.schedule(command({
      startAt: replacementStart, due: replacementDue,
    }))).rejects.toThrow('goal schedule relation failed');

    expect(await repos.goalRepo.findById('goal-1')).toMatchObject({
      startAt: originalStart, due: originalDue, updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });
});
