import { DomainError } from '../../../domain/shared/errors';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { AddTaskService } from '../AddTaskService';
import {
  FakeGoalRepository,
  FakeProjectRepository,
  FakeTaskRepository,
} from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');

function makeService(): {
  service: AddTaskService;
  projects: FakeProjectRepository;
  goals: FakeGoalRepository;
  tasks: FakeTaskRepository;
} {
  const projects = new FakeProjectRepository();
  const goals = new FakeGoalRepository();
  const tasks = new FakeTaskRepository();
  return { service: new AddTaskService(projects, goals, tasks), projects, goals, tasks };
}

/** Project p1 serving goal g-root, plus sub-goal g-sub inside the tree. */
async function seedProject(
  projects: FakeProjectRepository,
  goals: FakeGoalRepository,
): Promise<void> {
  await goals.save(Goal.create({ id: 'g-root', title: 'Root goal', now: t0 }));
  await goals.save(
    Goal.create({ id: 'g-sub', title: 'Sub goal', projectId: 'p1', parentGoalId: 'g-root', now: t0 }),
  );
  await projects.save(Project.create({ id: 'p1', name: 'Project One', goalId: 'g-root', now: t0 }));
}

describe('AddTaskService', () => {
  it('saves a task assigned to a goal of the project tree', async () => {
    const { service, projects, goals, tasks } = makeService();
    await seedProject(projects, goals);

    await service.add({
      id: 't1',
      projectId: 'p1',
      goalId: 'g-sub',
      title: 'Write spec',
      due: new Date('2026-03-01T00:00:00Z'),
      milestoneId: 'm1',
      now: t0,
    });

    expect(tasks.items).toHaveLength(1);
    const task = tasks.items[0];
    expect(task.id).toBe('t1');
    expect(task.title).toBe('Write spec');
    expect(task.projectId).toBe('p1');
    expect(task.goalId).toBe('g-sub');
    expect(task.due).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(task.milestoneId).toBe('m1');
    expect(task.status).toBe('todo');
  });

  it('accepts the serving goal as the task goal', async () => {
    const { service, projects, goals, tasks } = makeService();
    await seedProject(projects, goals);

    await service.add({ id: 't1', projectId: 'p1', goalId: 'g-root', title: 'Root task', now: t0 });

    expect(tasks.items[0].goalId).toBe('g-root');
  });

  it('accepts no goal (the task sits at the root level)', async () => {
    const { service, projects, goals, tasks } = makeService();
    await seedProject(projects, goals);

    await service.add({ id: 't1', projectId: 'p1', title: 'Loose task', now: t0 });

    expect(tasks.items[0].goalId).toBeUndefined();
  });

  it('rejects an empty title', async () => {
    const { service, projects, goals, tasks } = makeService();
    await seedProject(projects, goals);

    await expect(
      service.add({ id: 't1', projectId: 'p1', title: ' ', now: t0 }),
    ).rejects.toThrow(DomainError);
    expect(tasks.items).toHaveLength(0);
  });

  it('rejects a goal outside the project goal tree', async () => {
    const { service, projects, goals, tasks } = makeService();
    await seedProject(projects, goals);
    await goals.save(Goal.create({ id: 'g-other', title: 'Other tree', now: t0 }));

    await expect(
      service.add({ id: 't1', projectId: 'p1', goalId: 'g-other', title: 'Task', now: t0 }),
    ).rejects.toThrow(DomainError);
    expect(tasks.items).toHaveLength(0);
  });

  it('rejects an unknown goal', async () => {
    const { service, projects, goals } = makeService();
    await seedProject(projects, goals);

    await expect(
      service.add({ id: 't1', projectId: 'p1', goalId: 'g-missing', title: 'Task', now: t0 }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects an unknown project', async () => {
    const { service } = makeService();

    await expect(
      service.add({ id: 't1', projectId: 'missing', title: 'Task', now: t0 }),
    ).rejects.toThrow(DomainError);
  });
});
