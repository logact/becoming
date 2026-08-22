import { Goal } from '../../../domain/goal/Goal';
import { Project, type ProjectStatus } from '../../../domain/project/Project';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import {
  PROJECT_ACTIVATED_RECORD_KIND,
  SelectCurrentPlanService,
  type SelectCurrentPlanCommand,
} from '../SelectCurrentPlanService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const activatedAt = new Date('2026-08-10T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function command(overrides: Partial<SelectCurrentPlanCommand> = {}): SelectCurrentPlanCommand {
  return {
    goalId: 'goal-1',
    selectedProjectId: 'project-selected',
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
): SelectCurrentPlanService {
  return new SelectCurrentPlanService(
    repos.goalRepo,
    repos.projectRepo,
    repos.recordRepo,
    relations,
    repos.transactionRunner,
  );
}

function project(params: {
  id?: string;
  name?: string;
  goalId?: string;
  status?: ProjectStatus;
  archived?: boolean;
} = {}): Project {
  const value = Project.create({
    id: params.id ?? 'project-selected',
    name: params.name ?? 'Trail intervals',
    goalId: params.goalId ?? 'goal-1',
    now: createdAt,
  });
  if (params.status === 'active') value.activate(activatedAt);
  if (params.status === 'paused') {
    value.activate(activatedAt);
    value.pause(activatedAt);
  }
  if (params.status === 'done') {
    value.activate(activatedAt);
    value.complete(activatedAt);
  }
  if (params.status === 'failed') {
    value.activate(activatedAt);
    value.fail(activatedAt);
  }
  if (params.archived) value.archive(activatedAt);
  return value;
}

async function setup(params: { archivedGoal?: boolean } = {}): Promise<TestRepositories> {
  const repos = await makeFakeRepos();
  const goal = Goal.create({ id: 'goal-1', title: 'Run a trail race', now: createdAt });
  if (params.archivedGoal) goal.archive(activatedAt);
  await repos.goalRepo.save(goal);
  return repos;
}

async function expectNoActivity(repos: TestRepositories): Promise<void> {
  expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  expect(await repos.relationRepo.list()).toEqual([]);
}

describe('SelectCurrentPlanService', () => {
  it('activates the first planning Project for a Goal', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project());

    await makeService(repos).select(command());

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'active',
      updatedAt: now,
    });
    expect(await repos.projectRepo.list({ goalId: 'goal-1', status: 'active' }))
      .toHaveLength(1);
  });

  it('reactivates a paused Project when there is no current plan', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project({ status: 'paused' }));

    await makeService(repos).select(command());

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'active',
      updatedAt: now,
    });
  });

  it('switches plans by activating the selected Project and pausing the former active one', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project());
    await repos.projectRepo.save(project({
      id: 'project-current', name: 'Long easy runs', status: 'active',
    }));

    await makeService(repos).select(command());

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'active', updatedAt: now,
    });
    expect(await repos.projectRepo.findById('project-current')).toMatchObject({
      status: 'paused', updatedAt: now,
    });
    expect(await repos.projectRepo.list({ goalId: 'goal-1', status: 'active' }))
      .toHaveLength(1);
  });

  it('includes an archived active Project when switching so it is still paused', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project());
    await repos.projectRepo.save(project({
      id: 'project-current', name: 'Archived plan', status: 'active', archived: true,
    }));

    await makeService(repos).select(command());

    expect(await repos.projectRepo.findById('project-current')).toMatchObject({
      archived: true, status: 'paused', updatedAt: now,
    });
    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'active', updatedAt: now,
    });
  });

  it('writes an immutable activation activity visible in both Goal and selected Project timelines', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project());

    await makeService(repos).select(command());

    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-1',
        kind: PROJECT_ACTIVATED_RECORD_KIND,
        detail: 'Selected Project “Trail intervals” as current plan',
        occurredAt: now,
      }),
    ]);
    expect(await repos.relationRepo.findById('goal-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'goal',
      targetId: 'goal-1', kind: 'logs',
    });
    expect(await repos.relationRepo.findById('project-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'project',
      targetId: 'project-selected', kind: 'logs',
    });
    expect((await repos.recordRepo.listByTarget('goal', 10, 'goal-1')).map(({ id }) => id))
      .toEqual(['record-1']);
    expect((await repos.recordRepo.listByTarget('project', 10, 'project-selected')).map(({ id }) => id))
      .toEqual(['record-1']);
  });

  it('identifies both the selected and replaced Project in switch activity', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project());
    await repos.projectRepo.save(project({
      id: 'project-current', name: 'Long easy runs', status: 'active',
    }));

    await makeService(repos).select(command());

    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        kind: PROJECT_ACTIVATED_RECORD_KIND,
        detail: 'Selected Project “Trail intervals” as current plan, replacing “Long easy runs”',
      }),
    ]);
  });

  it('rejects an already-active selected Project without mutation', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project({ status: 'active' }));

    await expect(makeService(repos).select(command())).rejects.toThrow(
      'Project is already the current plan: project-selected',
    );

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'active', updatedAt: activatedAt,
    });
    await expectNoActivity(repos);
  });

  it.each([
    ['archived', { archived: true }, 'Cannot select archived project: project-selected'],
    ['done', { status: 'done' as const }, 'Cannot select Project from done'],
    ['failed', { status: 'failed' as const }, 'Cannot select Project from failed'],
  ])('rejects a %s Project without mutating it or the current plan', async (_label, values, message) => {
    const repos = await setup();
    await repos.projectRepo.save(project(values));
    await repos.projectRepo.save(project({ id: 'project-current', status: 'active' }));

    await expect(makeService(repos).select(command())).rejects.toThrow(message);

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject(values);
    expect(await repos.projectRepo.findById('project-current')).toMatchObject({
      status: 'active', updatedAt: activatedAt,
    });
    await expectNoActivity(repos);
  });

  it('rejects a foreign Project without mutating it or the current plan', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project({ goalId: 'goal-2' }));
    await repos.projectRepo.save(project({ id: 'project-current', status: 'active' }));

    await expect(makeService(repos).select(command())).rejects.toThrow(
      'Project does not belong to this goal',
    );

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      goalId: 'goal-2', status: 'planning', updatedAt: createdAt,
    });
    expect(await repos.projectRepo.findById('project-current')).toMatchObject({
      status: 'active', updatedAt: activatedAt,
    });
    await expectNoActivity(repos);
  });

  it('rejects an unknown Project without mutating the current plan', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project({ id: 'project-current', status: 'active' }));

    await expect(makeService(repos).select(command())).rejects.toThrow(
      'Unknown project: project-selected',
    );

    expect(await repos.projectRepo.findById('project-current')).toMatchObject({
      status: 'active', updatedAt: activatedAt,
    });
    await expectNoActivity(repos);
  });

  it('rejects an unknown Goal before loading or mutating the selected Project', async () => {
    const repos = await makeFakeRepos();
    await repos.projectRepo.save(project());

    await expect(makeService(repos).select(command())).rejects.toThrow('Unknown goal: goal-1');

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'planning', updatedAt: createdAt,
    });
    await expectNoActivity(repos);
  });

  it('rejects an archived Goal without mutating the selected Project', async () => {
    const repos = await setup({ archivedGoal: true });
    await repos.projectRepo.save(project());

    await expect(makeService(repos).select(command())).rejects.toThrow(
      'Cannot select a plan for archived goal: goal-1',
    );

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'planning', updatedAt: createdAt,
    });
    await expectNoActivity(repos);
  });

  it('rolls back both status changes and all activity when the later relation write fails', async () => {
    const repos = await setup();
    await repos.projectRepo.save(project());
    await repos.projectRepo.save(project({
      id: 'project-current', name: 'Long easy runs', status: 'active',
    }));
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

    await expect(makeService(repos, failingRelations).select(command())).rejects.toThrow(
      'project activity relation failed',
    );

    expect(await repos.projectRepo.findById('project-selected')).toMatchObject({
      status: 'planning', updatedAt: createdAt,
    });
    expect(await repos.projectRepo.findById('project-current')).toMatchObject({
      status: 'active', updatedAt: activatedAt,
    });
    await expectNoActivity(repos);
  });
});
