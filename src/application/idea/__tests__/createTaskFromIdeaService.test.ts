import { Goal } from '../../../domain/goal/Goal';
import { Idea } from '../../../domain/idea/Idea';
import { Project } from '../../../domain/project/Project';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import {
  CreateTaskFromIdeaService,
  type CreateTaskFromIdeaCommand,
} from '../CreateTaskFromIdeaService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function command(
  overrides: Partial<CreateTaskFromIdeaCommand> = {},
): CreateTaskFromIdeaCommand {
  return {
    ideaId: 'idea-1',
    taskId: 'task-1',
    projectId: 'project-1',
    goalId: 'goal-sub',
    title: 'Schedule weekly trail training',
    derivedRelationId: 'derived-1',
    recordId: 'record-1',
    ideaRecordRelationId: 'idea-log-1',
    taskRecordRelationId: 'task-log-1',
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
    content: 'Train consistently, then finish the full mountain course.',
    status: params.status ?? 'paused',
    archived: params.archived ?? false,
    labelIds: params.labelIds ?? [],
    createdAt,
    updatedAt: createdAt,
  }));
}

async function seedProjectTree(repos: TestRepositories): Promise<void> {
  await repos.goalRepo.save(Goal.create({ id: 'goal-root', title: 'Finish a trail race', now: createdAt }));
  await repos.goalRepo.save(Goal.create({
    id: 'goal-sub', title: 'Build endurance', projectId: 'project-1',
    parentGoalId: 'goal-root', now: createdAt,
  }));
  await repos.projectRepo.save(Project.create({
    id: 'project-1', name: 'Trail training', goalId: 'goal-root', now: createdAt,
  }));
}

function makeService(repos: TestRepositories, relations = repos.relationRepo) {
  return new CreateTaskFromIdeaService(
    repos.ideaRepo, repos.projectRepo, repos.goalRepo, repos.taskRepo,
    repos.recordRepo, relations, repos.transactionRunner,
  );
}

describe('CreateTaskFromIdeaService', () => {
  it('creates a labeled Task in the project tree, derives it, and logs one record to both', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos, { labelIds: ['health', 'weekly'] });
    await seedProjectTree(repos);

    await makeService(repos).create(command());

    expect(await repos.taskRepo.findById('task-1')).toMatchObject({
      id: 'task-1',
      title: 'Schedule weekly trail training',
      description: 'Train consistently, then finish the full mountain course.',
      status: 'todo',
      archived: false,
      labelIds: ['health', 'weekly'],
      projectId: 'project-1',
      goalId: 'goal-sub',
    });
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({ status: 'handled', updatedAt: now });
    expect(await repos.relationRepo.findById('derived-1')).toMatchObject({
      sourceType: 'task', sourceId: 'task-1', targetType: 'idea',
      targetId: 'idea-1', kind: 'derivedFrom',
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-1', kind: 'ideaDerivedTask',
        detail: 'Created Task “Schedule weekly trail training” from Idea', occurredAt: now,
      }),
    ]);
    expect((await repos.recordRepo.listByTarget('idea', 10, 'idea-1')).map(({ id }) => id))
      .toEqual(['record-1']);
    expect((await repos.recordRepo.listByTarget('task', 10, 'task-1')).map(({ id }) => id))
      .toEqual(['record-1']);
  });

  it('accepts the serving goal, no goal, and an already handled Idea', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos, { status: 'handled' });
    await seedProjectTree(repos);
    const service = makeService(repos);

    await service.create(command({ goalId: 'goal-root' }));
    const noGoalCommand = command({
      taskId: 'task-2', derivedRelationId: 'derived-2', recordId: 'record-2',
      ideaRecordRelationId: 'idea-log-2', taskRecordRelationId: 'task-log-2',
    });
    delete noGoalCommand.goalId;
    await service.create(noGoalCommand);

    expect((await repos.taskRepo.findById('task-1'))?.goalId).toBe('goal-root');
    expect((await repos.taskRepo.findById('task-2'))?.goalId).toBeUndefined();
    expect((await repos.ideaRepo.findById('idea-1'))?.updatedAt).toEqual(createdAt);
    expect((await repos.recordRepo.listRecent(10)).map(({ kind }) => kind))
      .toEqual(['ideaDerivedTask', 'ideaDerivedTask']);
  });

  it('rejects an unknown or archived Idea without creating a Task', async () => {
    const unknownRepos = await makeFakeRepos();
    await seedProjectTree(unknownRepos);
    await expect(makeService(unknownRepos).create(command())).rejects.toThrow(
      'Unknown idea: idea-1',
    );
    expect(await unknownRepos.taskRepo.list()).toEqual([]);

    const archivedRepos = await makeFakeRepos();
    await seedIdea(archivedRepos, { archived: true });
    await seedProjectTree(archivedRepos);
    await expect(makeService(archivedRepos).create(command())).rejects.toThrow(DomainError);
    expect(await archivedRepos.taskRepo.list()).toEqual([]);
  });

  it('requires an existing, non-archived Project', async () => {
    const unknownRepos = await makeFakeRepos();
    await seedIdea(unknownRepos);
    await expect(makeService(unknownRepos).create(command())).rejects.toThrow(
      'Unknown project: project-1',
    );
    expect(await unknownRepos.taskRepo.list()).toEqual([]);

    const archivedRepos = await makeFakeRepos();
    await seedIdea(archivedRepos);
    await seedProjectTree(archivedRepos);
    const project = await archivedRepos.projectRepo.findById('project-1');
    if (project === null) throw new Error('Expected seeded project');
    project.archive(now);
    await archivedRepos.projectRepo.save(project);
    await expect(makeService(archivedRepos).create(command())).rejects.toThrow(
      'Cannot create a task in archived project: project-1',
    );
    expect(await archivedRepos.taskRepo.list()).toEqual([]);
  });

  it('rejects an unknown goal or a goal outside the selected Project tree', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos);
    await seedProjectTree(repos);

    await expect(makeService(repos).create(command({ goalId: 'missing' }))).rejects.toThrow(
      'Goal missing does not belong to the goal tree of project project-1',
    );
    await repos.goalRepo.save(Goal.create({ id: 'goal-other', title: 'Other goal', now: createdAt }));
    await expect(makeService(repos).create(command({ goalId: 'goal-other' }))).rejects.toThrow(
      'Goal goal-other does not belong to the goal tree of project project-1',
    );
    expect(await repos.taskRepo.list()).toEqual([]);
  });

  it('rejects a blank title without any derivation writes', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos);
    await seedProjectTree(repos);

    await expect(makeService(repos).create(command({ title: '   ' }))).rejects.toThrow(
      'Task title must not be empty',
    );

    expect(await repos.taskRepo.list()).toEqual([]);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('rolls back the Task, handled state, record, and relations after a late write failure', async () => {
    const repos = await makeFakeRepos();
    await seedIdea(repos);
    await seedProjectTree(repos);
    let relationWrites = 0;
    const failingRelations: RelationRepository = {
      save: async (relation) => {
        relationWrites += 1;
        if (relationWrites === 3) throw new Error('task activity relation failed');
        await repos.relationRepo.save(relation);
      },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, failingRelations).create(command())).rejects.toThrow(
      'task activity relation failed',
    );

    expect(await repos.taskRepo.findById('task-1')).toBeNull();
    expect(await repos.ideaRepo.findById('idea-1')).toMatchObject({
      status: 'paused', updatedAt: createdAt,
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });
});
