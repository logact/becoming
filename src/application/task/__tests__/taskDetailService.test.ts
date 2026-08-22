import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { Record as DomainRecord } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { Task } from '../../../domain/task/Task';
import { makeFakeRepos } from '../../__tests__/fakes';
import { TaskDetailService } from '../TaskDetailService';

const now = new Date('2026-08-21T12:00:00Z');

describe('TaskDetailService', () => {
  it('returns an explicit unknown-task view', async () => {
    const repos = await makeFakeRepos();
    const view = await new TaskDetailService(
      repos.taskRepo, repos.projectRepo, repos.goalRepo, repos.recordRepo,
    ).getDetail('missing');
    expect(view).toEqual({ task: null, records: [] });
  });

  it('resolves project, child and parent goal context plus scoped records', async () => {
    const repos = await makeFakeRepos();
    await repos.goalRepo.save(Goal.create({ id: 'root', title: 'Root', now }));
    await repos.goalRepo.save(Goal.create({
      id: 'child', title: 'Child', projectId: 'p1', parentGoalId: 'root', now,
    }));
    await repos.projectRepo.save(Project.create({ id: 'p1', name: 'Project', goalId: 'root', now }));
    await repos.taskRepo.save(Task.create({
      id: 't1', title: 'Task', projectId: 'p1', goalId: 'child', now,
    }));
    await repos.recordRepo.append(DomainRecord.create({
      id: 'r1', kind: 'taskStarted', detail: 'Started', occurredAt: now,
    }));
    await repos.relationRepo.save(Relation.create({
      id: 'rel1', sourceType: 'record', sourceId: 'r1', targetType: 'task',
      targetId: 't1', kind: 'logs', now,
    }));

    const view = await new TaskDetailService(
      repos.taskRepo, repos.projectRepo, repos.goalRepo, repos.recordRepo,
    ).getDetail('t1');
    expect(view.projectName).toBe('Project');
    expect(view.goalTitle).toBe('Child');
    expect(view.goalParentTitle).toBe('Root');
    expect(view.records).toEqual([{ id: 'r1', kind: 'taskStarted', detail: 'Started', occurredAt: now }]);
  });

  it('supports a task without a goal', async () => {
    const repos = await makeFakeRepos();
    await repos.projectRepo.save(Project.create({ id: 'p1', name: 'Project', goalId: 'root', now }));
    await repos.taskRepo.save(Task.create({ id: 't1', title: 'Task', projectId: 'p1', now }));
    const view = await new TaskDetailService(
      repos.taskRepo, repos.projectRepo, repos.goalRepo, repos.recordRepo,
    ).getDetail('t1');
    expect(view.goalTitle).toBeUndefined();
    expect(view.goalParentTitle).toBeUndefined();
  });

  it('returns the task entity with its startAt schedule metadata', async () => {
    const repos = await makeFakeRepos();
    const startAt = new Date('2026-08-22T12:00:00Z');
    await repos.taskRepo.save(Task.create({
      id: 't1', title: 'Task', projectId: 'p1', startAt, now,
    }));

    const view = await new TaskDetailService(
      repos.taskRepo, repos.projectRepo, repos.goalRepo, repos.recordRepo,
    ).getDetail('t1');

    expect(view.task?.startAt).toEqual(startAt);
  });
});
