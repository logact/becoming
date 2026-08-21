import { Task, type TaskStatus } from '../../../domain/task/Task';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos } from '../../__tests__/fakes';
import { TASK_RECORD_KIND, TaskLifecycleService } from '../TaskLifecycleService';

const now = new Date('2026-08-21T12:00:00Z');

function atStatus(status: TaskStatus): Task {
  const task = Task.create({ id: 't1', title: 'Ship', projectId: 'p1', now });
  if (status === 'doing') task.start(now);
  if (status === 'paused') { task.start(now); task.pause(now); }
  if (status === 'done') { task.start(now); task.complete(now); }
  if (status === 'failed') { task.start(now); task.fail(now); }
  return task;
}

describe('TaskLifecycleService', () => {
  it.each([
    ['start', 'todo', 'doing', TASK_RECORD_KIND.started],
    ['pause', 'doing', 'paused', TASK_RECORD_KIND.paused],
    ['resume', 'paused', 'doing', TASK_RECORD_KIND.resumed],
    ['complete', 'doing', 'done', TASK_RECORD_KIND.completed],
    ['fail', 'doing', 'failed', TASK_RECORD_KIND.failed],
    ['reopen', 'done', 'todo', TASK_RECORD_KIND.reopened],
  ] as const)('%s transitions, records and relates the task', async (method, from, to, kind) => {
    const repos = await makeFakeRepos();
    await repos.taskRepo.save(atStatus(from));
    const service = new TaskLifecycleService(repos.taskRepo, repos.recordRepo, repos.relationRepo);
    await service[method]({ taskId: 't1', recordId: 'r1', relationId: 'rel1', note: 'Because', now });
    expect((await repos.taskRepo.findById('t1'))?.status).toBe(to);
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({ kind, detail: 'Because' });
    expect(await repos.relationRepo.findById('rel1')).toMatchObject({
      sourceType: 'record', sourceId: 'r1', targetType: 'task', targetId: 't1', kind: 'logs',
    });
  });

  it('supports failing a paused task and generates default detail', async () => {
    const repos = await makeFakeRepos();
    await repos.taskRepo.save(atStatus('paused'));
    const service = new TaskLifecycleService(repos.taskRepo, repos.recordRepo, repos.relationRepo);
    await service.fail({ taskId: 't1', recordId: 'r1', relationId: 'rel1', now });
    expect((await repos.recordRepo.listRecent(10))[0].detail).toContain('Ship');
  });

  it('rejects an unknown task without records or relations', async () => {
    const repos = await makeFakeRepos();
    const service = new TaskLifecycleService(repos.taskRepo, repos.recordRepo, repos.relationRepo);
    await expect(service.start({ taskId: 'missing', recordId: 'r1', relationId: 'rel1', now }))
      .rejects.toThrow(DomainError);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.list()).toEqual([]);
  });

  it('lets domain transition errors escape without writing a record', async () => {
    const repos = await makeFakeRepos();
    await repos.taskRepo.save(atStatus('todo'));
    const service = new TaskLifecycleService(repos.taskRepo, repos.recordRepo, repos.relationRepo);
    await expect(service.complete({ taskId: 't1', recordId: 'r1', relationId: 'rel1', now }))
      .rejects.toThrow(DomainError);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });
});
