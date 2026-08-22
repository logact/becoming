import { DomainError } from '../../../domain/shared/errors';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { AddTaskService } from '../AddTaskService';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');

async function makeService() {
  const {
    projectRepo: projects,
    goalRepo: goals,
    taskRepo: tasks,
    recordRepo: records,
    relationRepo: relations,
  } = await makeFakeRepos();
  return {
    service: new AddTaskService(projects, goals, tasks, records, relations),
    projects, goals, tasks, records, relations,
  };
}

/** Project p1 serving goal g-root, plus sub-goal g-sub inside the tree. */
async function seedProject(
  projects: TestRepositories['projectRepo'],
  goals: TestRepositories['goalRepo'],
): Promise<void> {
  await goals.save(Goal.create({ id: 'g-root', title: 'Root goal', now: t0 }));
  await goals.save(
    Goal.create({ id: 'g-sub', title: 'Sub goal', projectId: 'p1', parentGoalId: 'g-root', now: t0 }),
  );
  await projects.save(Project.create({ id: 'p1', name: 'Project One', goalId: 'g-root', now: t0 }));
}

describe('AddTaskService', () => {
  it('saves a task assigned to a goal of the project tree', async () => {
    const { service, projects, goals, tasks, records, relations } = await makeService();
    await seedProject(projects, goals);

    await service.add({
      id: 't1',
      projectId: 'p1',
      goalId: 'g-sub',
      title: 'Write spec',
      startAt: new Date('2026-02-15T00:00:00Z'),
      due: new Date('2026-03-01T00:00:00Z'),
      milestoneId: 'm1',
      recordId: 'record-1',
      relationId: 'relation-1',
      now: t0,
    });

    const task = await tasks.findById('t1');
    expect(task).not.toBeNull();
    expect(task.id).toBe('t1');
    expect(task.title).toBe('Write spec');
    expect(task.projectId).toBe('p1');
    expect(task.goalId).toBe('g-sub');
    expect(task.startAt).toEqual(new Date('2026-02-15T00:00:00Z'));
    expect(task.due).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(task.milestoneId).toBe('m1');
    expect(task.status).toBe('todo');
    expect((await records.listRecent(10))[0]).toMatchObject({
      id: 'record-1', kind: 'taskCreated', detail: 'Created “Write spec”',
    });
    expect(await relations.findById('relation-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'task', targetId: 't1', kind: 'logs',
    });
  });

  it('accepts the serving goal as the task goal', async () => {
    const { service, projects, goals, tasks } = await makeService();
    await seedProject(projects, goals);

    await service.add({ id: 't1', projectId: 'p1', goalId: 'g-root', title: 'Root task', recordId: 'r1', relationId: 'rel1', now: t0 });

    expect((await tasks.findById('t1'))?.goalId).toBe('g-root');
  });

  it('accepts no goal (the task sits at the root level)', async () => {
    const { service, projects, goals, tasks } = await makeService();
    await seedProject(projects, goals);

    await service.add({ id: 't1', projectId: 'p1', title: 'Loose task', recordId: 'r1', relationId: 'rel1', now: t0 });

    expect((await tasks.findById('t1'))?.goalId).toBeUndefined();
    expect((await tasks.findById('t1'))?.startAt).toBeUndefined();
    expect((await tasks.findById('t1'))?.due).toBeUndefined();
  });

  it('rejects an empty title', async () => {
    const { service, projects, goals, tasks } = await makeService();
    await seedProject(projects, goals);

    await expect(
      service.add({ id: 't1', projectId: 'p1', title: ' ', recordId: 'r1', relationId: 'rel1', now: t0 }),
    ).rejects.toThrow(DomainError);
    expect(await tasks.list()).toHaveLength(0);
  });

  it('rejects a goal outside the project goal tree', async () => {
    const { service, projects, goals, tasks } = await makeService();
    await seedProject(projects, goals);
    await goals.save(Goal.create({ id: 'g-other', title: 'Other tree', now: t0 }));

    await expect(
      service.add({ id: 't1', projectId: 'p1', goalId: 'g-other', title: 'Task', recordId: 'r1', relationId: 'rel1', now: t0 }),
    ).rejects.toThrow(DomainError);
    expect(await tasks.list()).toHaveLength(0);
  });

  it('rejects an unknown goal', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals);

    await expect(
      service.add({ id: 't1', projectId: 'p1', goalId: 'g-missing', title: 'Task', recordId: 'r1', relationId: 'rel1', now: t0 }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects an unknown project', async () => {
    const { service } = await makeService();

    await expect(
      service.add({ id: 't1', projectId: 'missing', title: 'Task', recordId: 'r1', relationId: 'rel1', now: t0 }),
    ).rejects.toThrow(DomainError);
  });
});
