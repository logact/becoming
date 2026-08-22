import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import type { RecordRepository } from '../../../domain/record/repository/RecordRepository';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import type { TransactionRunner } from '../../shared/TransactionRunner';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import { CAPTURE_RECORD_KIND } from '../captureRecordKinds';
import {
  QuickCaptureService,
  type QuickCaptureCommand,
} from '../QuickCaptureService';

const now = new Date('2026-08-22T10:00:00Z');

function makeService(
  repos: TestRepositories,
  overrides: {
    records?: RecordRepository;
    relations?: RelationRepository;
    transactionRunner?: TransactionRunner;
  } = {},
): QuickCaptureService {
  return new QuickCaptureService(
    repos.ideaRepo,
    repos.goalRepo,
    repos.taskRepo,
    repos.noteRepo,
    repos.projectRepo,
    overrides.records ?? repos.recordRepo,
    overrides.relations ?? repos.relationRepo,
    overrides.transactionRunner ?? repos.transactionRunner,
  );
}

async function seedProject(repos: TestRepositories, archived = false): Promise<void> {
  await repos.goalRepo.save(Goal.create({ id: 'project-goal', title: 'Project goal', now }));
  const project = Project.create({
    id: 'project-1', name: 'Project one', goalId: 'project-goal', now,
  });
  if (archived) project.archive(now);
  await repos.projectRepo.save(project);
}

function common(id: string) {
  return { entityId: id, recordId: `record-${id}`, recordRelationId: `relation-${id}`, now };
}

describe('QuickCaptureService', () => {
  it('keeps inbox and explicit Idea intents distinct while creating captured Ideas', async () => {
    const repos = await makeFakeRepos();
    const service = makeService(repos);

    const inbox = await service.capture({
      intent: 'inbox', content: '  Decide this later  ', ...common('inbox-idea'),
    });
    const idea = await service.capture({
      intent: 'idea', content: '  Build a garden  ', ...common('explicit-idea'),
    });

    expect(inbox).toEqual({ intent: 'inbox', entityType: 'idea', entityId: 'inbox-idea' });
    expect(idea).toEqual({ intent: 'idea', entityType: 'idea', entityId: 'explicit-idea' });
    expect(await repos.ideaRepo.findById('inbox-idea')).toMatchObject({
      content: 'Decide this later', status: 'captured', archived: false,
    });
    expect(await repos.ideaRepo.findById('explicit-idea')).toMatchObject({
      content: 'Build a garden', status: 'captured', archived: false,
    });
    expect((await repos.recordRepo.listRecent(10)).map(({ kind }) => kind))
      .toEqual([CAPTURE_RECORD_KIND.quickCapturedIdea, CAPTURE_RECORD_KIND.quickCapturedIdea]);
  });

  it('creates a trimmed top-level todo Goal and logs it', async () => {
    const repos = await makeFakeRepos();

    const result = await makeService(repos).capture({
      intent: 'goal', content: '  Run a marathon  ', ...common('goal-1'),
    });

    expect(result).toEqual({ intent: 'goal', entityType: 'goal', entityId: 'goal-1' });
    expect(await repos.goalRepo.findById('goal-1')).toMatchObject({
      title: 'Run a marathon', status: 'todo', archived: false,
      projectId: undefined, parentGoalId: undefined, due: undefined,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-goal-1', kind: CAPTURE_RECORD_KIND.quickCapturedGoal,
        detail: 'Quick captured “Run a marathon”', occurredAt: now,
      }),
    ]);
    expect(await repos.relationRepo.findById('relation-goal-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-goal-1', targetType: 'goal',
      targetId: 'goal-1', kind: 'logs',
    });
  });

  it('creates a todo Task in the required non-archived Project', async () => {
    const repos = await makeFakeRepos();
    await seedProject(repos);

    const result = await makeService(repos).capture({
      intent: 'task', projectId: 'project-1', content: '  Book the venue  ', ...common('task-1'),
    });

    expect(result).toEqual({ intent: 'task', entityType: 'task', entityId: 'task-1' });
    expect(await repos.taskRepo.findById('task-1')).toMatchObject({
      title: 'Book the venue', status: 'todo', archived: false, projectId: 'project-1',
      goalId: undefined, milestoneId: undefined, due: undefined,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      kind: CAPTURE_RECORD_KIND.quickCapturedTask,
    });
    expect(await repos.relationRepo.findById('relation-task-1')).toMatchObject({
      targetType: 'task', targetId: 'task-1', kind: 'logs',
    });
  });

  it('creates a trimmed, unarchived and unpinned Note', async () => {
    const repos = await makeFakeRepos();

    const result = await makeService(repos).capture({
      intent: 'note', content: '  Review every Friday  ', ...common('note-1'),
    });

    expect(result).toEqual({ intent: 'note', entityType: 'note', entityId: 'note-1' });
    expect(await repos.noteRepo.findById('note-1')).toMatchObject({
      content: 'Review every Friday', archived: false, pinnedAt: null,
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      kind: CAPTURE_RECORD_KIND.quickCapturedNote,
    });
    expect(await repos.relationRepo.findById('relation-note-1')).toMatchObject({
      targetType: 'note', targetId: 'note-1', kind: 'logs',
    });
  });

  it('rejects blank content for every intent before starting a transaction', async () => {
    const repos = await makeFakeRepos();
    let transactionRuns = 0;
    const countingRunner: TransactionRunner = {
      async run<T>(work: () => Promise<T>): Promise<T> {
        transactionRuns += 1;
        return repos.transactionRunner.run(work);
      },
    };
    const service = makeService(repos, { transactionRunner: countingRunner });
    const commands: QuickCaptureCommand[] = [
      { intent: 'inbox', content: ' ', ...common('blank-inbox') },
      { intent: 'idea', content: '\n ', ...common('blank-idea') },
      { intent: 'goal', content: '\t', ...common('blank-goal') },
      { intent: 'task', projectId: 'missing', content: '  ', ...common('blank-task') },
      { intent: 'note', content: '', ...common('blank-note') },
    ];

    for (const command of commands) {
      await expect(service.capture(command)).rejects.toThrow(DomainError);
    }

    expect(transactionRuns).toBe(0);
    expect(await repos.ideaRepo.list()).toEqual([]);
    expect(await repos.goalRepo.list()).toEqual([]);
    expect(await repos.taskRepo.list()).toEqual([]);
    expect(await repos.noteRepo.list()).toEqual([]);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rejects unknown and archived Task Projects with zero capture writes', async () => {
    const unknownRepos = await makeFakeRepos();
    await expect(makeService(unknownRepos).capture({
      intent: 'task', projectId: 'missing', content: 'Task', ...common('unknown-task'),
    })).rejects.toThrow('Unknown project: missing');

    const archivedRepos = await makeFakeRepos();
    await seedProject(archivedRepos, true);
    await expect(makeService(archivedRepos).capture({
      intent: 'task', projectId: 'project-1', content: 'Task', ...common('archived-task'),
    })).rejects.toThrow('Cannot create a task in archived project: project-1');

    for (const repos of [unknownRepos, archivedRepos]) {
      expect(await repos.taskRepo.list()).toEqual([]);
      expect(await repos.recordRepo.listRecent(10)).toEqual([]);
      expect(await repos.relationRepo.list()).toEqual([]);
    }
  });

  it('rolls back the entity when the second write, Record append, fails', async () => {
    const repos = await makeFakeRepos();
    const failingRecords: RecordRepository = {
      append: async () => { throw new Error('record write failed'); },
      listByTarget: (targetType, limit, targetId) =>
        repos.recordRepo.listByTarget(targetType, limit, targetId),
      listRecent: (limit) => repos.recordRepo.listRecent(limit),
    };

    await expect(makeService(repos, { records: failingRecords }).capture({
      intent: 'idea', content: 'Rollback me', ...common('record-failure'),
    })).rejects.toThrow('record write failed');

    expect(await repos.ideaRepo.findById('record-failure')).toBeNull();
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the entity and Record when the third write, logs Relation, fails', async () => {
    const repos = await makeFakeRepos();
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('relation write failed'); },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, { relations: failingRelations }).capture({
      intent: 'note', content: 'Rollback me', ...common('relation-failure'),
    })).rejects.toThrow('relation write failed');

    expect(await repos.noteRepo.findById('relation-failure')).toBeNull();
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });
});
