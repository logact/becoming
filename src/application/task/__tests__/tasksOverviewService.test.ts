import { Label } from '../../../domain/label/Label';
import { Project } from '../../../domain/project/Project';
import { Record as DomainRecord } from '../../../domain/record/Record';
import { Task, type TaskStatus } from '../../../domain/task/Task';
import { makeFakeRepos } from '../../__tests__/fakes';
import { RECENT_ACTIVITY_LIMIT } from '../../dashboard/DashboardService';
import { TasksOverviewService } from '../TasksOverviewService';

const now = new Date('2026-08-21T12:00:00Z');

function task(id: string, status: TaskStatus, due?: Date, archived = false): Task {
  const value = Task.create({ id, title: id, projectId: 'p1', due, now });
  if (status === 'doing') value.start(now);
  if (status === 'paused') { value.start(now); value.pause(now); }
  if (status === 'done') { value.start(now); value.complete(now); }
  if (status === 'failed') { value.start(now); value.fail(now); }
  if (archived) value.archive(now);
  return value;
}

describe('TasksOverviewService', () => {
  it('builds non-archived stats, groups, labels, attention ordering and activity', async () => {
    const repos = await makeFakeRepos();
    await repos.projectRepo.save(Project.create({ id: 'p1', name: 'Alpha', goalId: 'g1', now }));
    await repos.labelRepo.save(Label.create({ id: 'l1', name: 'Important', color: '#f00' }));
    await repos.labelRepo.save(Label.create({ id: 'l2', name: 'Later', color: '#0f0' }));

    const values = [
      task('todo', 'todo'),
      task('doing', 'doing'),
      task('paused', 'paused'),
      task('done', 'done'),
      task('failed-late', 'failed', new Date('2026-08-20T12:00:00Z')),
      task('failed-early', 'failed', new Date('2026-08-19T12:00:00Z')),
      task('overdue-late', 'todo', new Date('2026-08-21T11:00:00Z')),
      task('overdue-early', 'todo', new Date('2026-08-20T11:00:00Z')),
      task('due-soon', 'todo', new Date('2026-08-21T13:00:00Z')),
      task('archived', 'todo', undefined, true),
    ];
    values[0].addLabel('l1');
    values[1].addLabel('l1');
    values[1].addLabel('l2');
    for (const value of values) await repos.taskRepo.save(value);

    for (let index = 0; index < RECENT_ACTIVITY_LIMIT + 2; index += 1) {
      await repos.recordRepo.append(DomainRecord.create({
        id: `task-record-${index}`,
        kind: 'taskStarted',
        occurredAt: new Date(now.getTime() - index),
      }));
    }
    await repos.recordRepo.append(DomainRecord.create({
      id: 'goal-record', kind: 'goalStarted', occurredAt: now,
    }));

    const view = await new TasksOverviewService(
      repos.taskRepo, repos.projectRepo, repos.labelRepo, repos.recordRepo,
    ).getOverview(now);

    expect(view.stats).toEqual({ doing: 1, todo: 4, done: 1, overdue: 2 });
    expect(view.doingNow.map((item) => item.id)).toEqual(['doing', 'paused']);
    expect(view.allTasks.todo.map((item) => item.id)).not.toContain('archived');
    expect(view.byStatus).toEqual({ todo: 4, doing: 1, paused: 1, failed: 2, done: 1 });
    expect(view.byLabel).toEqual([
      { labelId: 'l1', name: 'Important', count: 2 },
      { labelId: 'l2', name: 'Later', count: 1 },
    ]);
    expect(view.attention.map((item) => item.id)).toEqual([
      'failed-early', 'failed-late', 'overdue-early', 'overdue-late', 'due-soon',
    ]);
    expect(view.attention.every((item) => item.projectName === 'Alpha')).toBe(true);
    expect(view.recentActivity).toHaveLength(RECENT_ACTIVITY_LIMIT);
    expect(view.recentActivity.every((item) => item.kind.startsWith('task'))).toBe(true);
  });

  it('falls back to project and label ids when related rows are missing', async () => {
    const repos = await makeFakeRepos();
    const value = Task.create({ id: 't1', title: 'Task', projectId: 'missing-project', now });
    value.addLabel('missing-label');
    await repos.taskRepo.save(value);
    const view = await new TasksOverviewService(
      repos.taskRepo, repos.projectRepo, repos.labelRepo, repos.recordRepo,
    ).getOverview(now);
    expect(view.allTasks.todo[0].projectName).toBe('missing-project');
    expect(view.byLabel[0].name).toBe('missing-label');
  });
});
