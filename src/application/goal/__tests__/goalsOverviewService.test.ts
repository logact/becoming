import { Goal } from '../../../domain/goal/Goal';
import { Label } from '../../../domain/label/Label';
import { GoalsOverviewService } from '../GoalsOverviewService';
import { GOAL_DUE_WINDOW_MS } from '../../dashboard/DashboardService';
import { makeFakeRepos } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');
const HOUR = 60 * 60 * 1000;
const after = (hours: number): Date => new Date(t0.getTime() + hours * HOUR);

async function makeService() {
  const { goalRepo: goals, labelRepo: labels } = await makeFakeRepos();
  const service = new GoalsOverviewService(goals, labels);
  return { service, goals, labels };
}

function goal(id: string, due?: Date): Goal {
  return Goal.create({ id, title: `Goal ${id}`, due, now: t0 });
}

function doingGoal(id: string, due?: Date): Goal {
  const g = goal(id, due);
  g.start(t0);
  return g;
}

function failedGoal(id: string, due?: Date): Goal {
  const g = doingGoal(id, due);
  g.fail(t0);
  return g;
}

function scheduledGoal(id: string, startAt: Date, due?: Date): Goal {
  return Goal.create({ id, title: `Goal ${id}`, startAt, due, now: t0 });
}

describe('GoalsOverviewService.getOverview', () => {
  it('counts active and total non-archived goals in stats', async () => {
    const { service, goals } = await makeService();
    await goals.save(goal('g1'));
    await goals.save(doingGoal('g2'));
    const archived = doingGoal('g3');
    archived.archive(t0);
    await goals.save(archived);

    const view = await service.getOverview(t0);

    expect(view.stats).toEqual({ activeGoals: 1, totalGoals: 2 });
  });

  it('lists failed goals and due-imminent goals in attention, failed first', async () => {
    const { service, goals } = await makeService();
    await goals.save(failedGoal('g1'));
    await goals.save(doingGoal('g2', after(12))); // due within the window
    await goals.save(doingGoal('g3', after(GOAL_DUE_WINDOW_MS / HOUR + 1))); // outside
    await goals.save(goal('g4')); // no due

    const view = await service.getOverview(t0);

    expect(view.attention).toEqual([
      { id: 'g1', title: 'Goal g1', reason: 'failed' },
      { id: 'g2', title: 'Goal g2', reason: 'overdue', due: after(12) },
    ]);
  });

  it('orders overdue attention items by soonest due', async () => {
    const { service, goals } = await makeService();
    await goals.save(doingGoal('g1', after(20)));
    await goals.save(doingGoal('g2', after(2)));

    const view = await service.getOverview(t0);

    expect(view.attention.map((item) => item.id)).toEqual(['g2', 'g1']);
  });

  it('excludes archived goals from attention', async () => {
    const { service, goals } = await makeService();
    const archived = failedGoal('g1');
    archived.archive(t0);
    await goals.save(archived);

    const view = await service.getOverview(t0);

    expect(view.attention).toEqual([]);
  });

  it('lists doing goals in focus with labels and due', async () => {
    const { service, goals } = await makeService();
    const doing = doingGoal('g1', after(48));
    doing.addLabel('l1');
    await goals.save(doing);
    await goals.save(goal('g2'));

    const view = await service.getOverview(t0);

    expect(view.focus).toEqual([
      { id: 'g1', title: 'Goal g1', status: 'doing', labelIds: ['l1'], due: after(48) },
    ]);
  });

  it('exposes startAt in flattened focus and all-goal items', async () => {
    const { service, goals } = await makeService();
    const startAt = after(48);
    const doing = scheduledGoal('g1', startAt, after(72));
    doing.start(t0);
    await goals.save(doing);
    await goals.save(scheduledGoal('g2', startAt));

    const view = await service.getOverview(t0);

    expect(view.focus[0]).toMatchObject({ id: 'g1', startAt, due: after(72) });
    expect(view.allGoals.todo[0]).toMatchObject({ id: 'g2', startAt });
  });

  it('adds ready goals after due warnings, deduplicates overlaps, and sorts oldest start first', async () => {
    const { service, goals } = await makeService();
    await goals.save(scheduledGoal('g-due-ready', after(-72), after(2)));
    await goals.save(scheduledGoal('g-ready-newer', after(-24), after(48)));
    await goals.save(scheduledGoal('g-ready-older', after(-48)));

    const view = await service.getOverview(t0);

    expect(view.attention).toEqual([
      expect.objectContaining({ id: 'g-due-ready', reason: 'overdue', startAt: after(-72) }),
      expect.objectContaining({ id: 'g-ready-older', reason: 'readyToStart', startAt: after(-48) }),
      expect.objectContaining({ id: 'g-ready-newer', reason: 'readyToStart', startAt: after(-24) }),
    ]);
  });

  it('does not present future, doing, paused, done, or archived scheduled goals as ready', async () => {
    const { service, goals } = await makeService();
    await goals.save(scheduledGoal('future', after(24)));
    const doing = scheduledGoal('doing', after(-24));
    doing.start(t0);
    await goals.save(doing);
    const paused = scheduledGoal('paused', after(-24));
    paused.start(t0);
    paused.pause(t0);
    await goals.save(paused);
    const done = scheduledGoal('done', after(-24));
    done.start(t0);
    done.complete(t0);
    await goals.save(done);
    const archived = scheduledGoal('archived', after(-24));
    archived.archive(t0);
    await goals.save(archived);

    const view = await service.getOverview(t0);

    expect(view.attention).toEqual([]);
    expect(view.focus.map((item) => item.id)).toEqual(['doing']);
  });

  it('counts non-archived goals per status', async () => {
    const { service, goals } = await makeService();
    await goals.save(goal('g1'));
    await goals.save(doingGoal('g2'));
    const done = doingGoal('g3');
    done.complete(t0);
    await goals.save(done);
    const archived = goal('g4');
    archived.archive(t0);
    await goals.save(archived);

    const view = await service.getOverview(t0);

    expect(view.byStatus).toEqual({ todo: 1, doing: 1, paused: 0, failed: 0, done: 1 });
  });

  it('counts non-archived goals per label with resolved names, most-used first', async () => {
    const { service, goals, labels } = await makeService();
    await labels.save(Label.create({ id: 'l1', name: 'Health' }));
    await labels.save(Label.create({ id: 'l2', name: 'Work' }));
    const g1 = doingGoal('g1');
    g1.addLabel('l1');
    g1.addLabel('l2');
    await goals.save(g1);
    const g2 = goal('g2');
    g2.addLabel('l1');
    await goals.save(g2);
    const g3 = goal('g3');
    g3.addLabel('l-unknown');
    await goals.save(g3);

    const view = await service.getOverview(t0);

    expect(view.byLabel).toEqual([
      { labelId: 'l1', name: 'Health', count: 2 },
      { labelId: 'l-unknown', name: 'l-unknown', count: 1 },
      { labelId: 'l2', name: 'Work', count: 1 },
    ]);
  });

  it('groups all non-archived goals by status', async () => {
    const { service, goals } = await makeService();
    await goals.save(goal('g1'));
    await goals.save(doingGoal('g2'));
    const paused = doingGoal('g3');
    paused.pause(t0);
    await goals.save(paused);
    const archived = goal('g4');
    archived.archive(t0);
    await goals.save(archived);

    const view = await service.getOverview(t0);

    expect(view.allGoals.todo.map((g) => g.id)).toEqual(['g1']);
    expect(view.allGoals.doing.map((g) => g.id)).toEqual(['g2']);
    expect(view.allGoals.paused.map((g) => g.id)).toEqual(['g3']);
    expect(view.allGoals.failed).toEqual([]);
    expect(view.allGoals.done).toEqual([]);
  });
});
