import { AttentionEntry } from '../../../domain/attention/AttentionEntry';
import { Goal } from '../../../domain/goal/Goal';
import { Idea } from '../../../domain/idea/Idea';
import { Project } from '../../../domain/project/Project';
import { Record as DomainRecord } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { Resource } from '../../../domain/resource/Resource';
import { Task } from '../../../domain/task/Task';
import {
  DashboardService,
  GOAL_DUE_WINDOW_MS,
  TASK_DUE_WINDOW_MS,
  type AttentionItem,
} from '../DashboardService';
import { formatConsumptionDetail } from '../../resource/consumption';
import {
  FakeAttentionEntryRepository,
  FakeGoalRepository,
  FakeIdeaRepository,
  FakeProjectRepository,
  FakeRecordRepository,
  FakeRelationRepository,
  FakeResourceRepository,
  FakeTaskRepository,
} from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');
const HOUR = 60 * 60 * 1000;
const after = (hours: number): Date => new Date(t0.getTime() + hours * HOUR);

function makeService() {
  const goals = new FakeGoalRepository();
  const tasks = new FakeTaskRepository();
  const ideas = new FakeIdeaRepository();
  const projects = new FakeProjectRepository();
  const resources = new FakeResourceRepository();
  const relations = new FakeRelationRepository();
  const records = new FakeRecordRepository();
  const attentionEntries = new FakeAttentionEntryRepository();
  const service = new DashboardService(
    goals,
    tasks,
    ideas,
    projects,
    resources,
    relations,
    records,
    attentionEntries,
  );
  return {
    service,
    goals,
    tasks,
    ideas,
    projects,
    resources,
    relations,
    records,
    attentionEntries,
  };
}

function goalWithDue(id: string, due?: Date): Goal {
  return Goal.create({ id, title: `Goal ${id}`, due, now: t0 });
}

function taskWithDue(id: string, due?: Date): Task {
  return Task.create({ id, title: `Task ${id}`, due, projectId: 'p1', now: t0 });
}

function doingGoal(id: string, at: Date): Goal {
  const goal = goalWithDue(id);
  goal.start(at);
  return goal;
}

function doingTask(id: string, at: Date): Task {
  const task = taskWithDue(id);
  task.start(at);
  return task;
}

function failedGoal(id: string): Goal {
  const goal = goalWithDue(id);
  goal.start(t0);
  goal.fail(t0);
  return goal;
}

function failedTask(id: string): Task {
  const task = taskWithDue(id);
  task.start(t0);
  task.fail(t0);
  return task;
}

function activeProject(id: string, due?: Date): Project {
  const project = Project.create({ id, name: `Project ${id}`, goalId: 'g0', due, now: t0 });
  project.activate(t0);
  return project;
}

function pin(id: string, targetType: 'goal' | 'task' | 'project' | 'idea', targetId: string): AttentionEntry {
  return AttentionEntry.create({ id, targetType, targetId, kind: 'pin', now: t0 });
}

function dismiss(id: string, targetType: 'goal' | 'task' | 'project' | 'idea', targetId: string): AttentionEntry {
  return AttentionEntry.create({ id, targetType, targetId, kind: 'dismiss', now: t0 });
}

type Ctx = ReturnType<typeof makeService>;

/** A quantity resource fully allocated to `projectId`, `consumed` already used. */
async function allocatedResource(
  ctx: Ctx,
  id: string,
  projectId: string,
  allocated: number,
  consumed: number,
): Promise<void> {
  const resource = Resource.create({
    id,
    typeId: `rt-${id}`,
    kind: 'quantity',
    name: `Resource ${id}`,
    amount: allocated,
    now: t0,
  });
  resource.allocate({ id: `al-${id}`, projectId, amount: allocated }, t0);
  await ctx.resources.save(resource);
  if (consumed > 0) {
    await ctx.relations.save(
      Relation.create({
        id: `rel-${id}`,
        sourceType: 'record',
        sourceId: `rec-${id}`,
        targetType: 'resource',
        targetId: id,
        kind: 'consumes',
        now: t0,
        detail: formatConsumptionDetail({ projectId, amount: consumed }),
      }),
    );
  }
}

const attentionIds = (items: AttentionItem[]): string[] => items.map((item) => item.id);

describe('DashboardService doing', () => {
  it('mixes doing goals, doing tasks, and captured ideas sorted by updatedAt desc', async () => {
    const ctx = makeService();
    await ctx.goals.save(doingGoal('g1', after(1)));
    await ctx.tasks.save(doingTask('t1', after(3)));
    await ctx.ideas.save(Idea.create({ id: 'i1', content: 'Idea i1', now: after(2) }));
    // Archived doing goal and done task are excluded.
    const archived = doingGoal('g-archived', after(4));
    archived.archive(after(4));
    await ctx.goals.save(archived);
    const done = doingTask('t-done', after(5));
    done.complete(after(5));
    await ctx.tasks.save(done);

    const view = await ctx.service.getDashboard(t0);

    expect(view.doing.map((item) => item.id)).toEqual(['t1', 'i1', 'g1']);
    expect(view.doing[0]).toMatchObject({ type: 'task', title: 'Task t1', status: 'doing' });
    expect(view.doing[1]).toMatchObject({ type: 'idea', title: 'Idea i1', status: 'captured' });
    expect(view.doing[1].due).toBeUndefined();
    expect(view.doing[2]).toMatchObject({ type: 'goal', title: 'Goal g1', status: 'doing' });
  });

  it('includes the due of doing goals and tasks when set', async () => {
    const ctx = makeService();
    const due = after(10);
    const goal = goalWithDue('g1', due);
    goal.start(t0);
    await ctx.goals.save(goal);

    const view = await ctx.service.getDashboard(t0);

    expect(view.doing[0].due).toBe(due);
  });
});

describe('DashboardService attention: failed rule', () => {
  it('flags failed goals and tasks, excluding archived ones', async () => {
    const ctx = makeService();
    await ctx.goals.save(failedGoal('g1'));
    await ctx.tasks.save(failedTask('t1'));
    const archived = failedGoal('g-archived');
    archived.archive(t0);
    await ctx.goals.save(archived);

    const view = await ctx.service.getDashboard(t0);

    expect(attentionIds(view.attention)).toEqual(['g1', 't1']);
    expect(view.attention[0]).toMatchObject({ type: 'goal', title: 'Goal g1', reason: 'failed' });
    expect(view.attention[1]).toMatchObject({ type: 'task', title: 'Task t1', reason: 'failed' });
  });
});

describe('DashboardService attention: overdue rule', () => {
  it('flags due-imminent goals, tasks, and projects ordered by due asc', async () => {
    const ctx = makeService();
    await ctx.goals.save(goalWithDue('g-past', after(-1))); // already past due
    await ctx.goals.save(goalWithDue('g-in', after(23))); // within 24h window
    await ctx.goals.save(goalWithDue('g-edge', new Date(t0.getTime() + GOAL_DUE_WINDOW_MS)));
    await ctx.goals.save(goalWithDue('g-out', after(25))); // outside the window
    const done = goalWithDue('g-done', after(1));
    done.start(t0);
    done.complete(t0);
    await ctx.goals.save(done); // done is excluded
    const archived = goalWithDue('g-archived', after(1));
    archived.archive(t0);
    await ctx.goals.save(archived); // archived is excluded
    await ctx.goals.save(goalWithDue('g-nodue')); // no due is excluded
    await ctx.tasks.save(taskWithDue('t-in', after(1)));
    await ctx.tasks.save(taskWithDue('t-edge', new Date(t0.getTime() + TASK_DUE_WINDOW_MS)));
    await ctx.tasks.save(taskWithDue('t-out', after(3))); // outside the 2h window
    await ctx.projects.save(activeProject('p-in', after(22)));

    const view = await ctx.service.getDashboard(t0);

    expect(attentionIds(view.attention)).toEqual([
      'g-past',
      't-in',
      't-edge',
      'p-in',
      'g-in',
      'g-edge',
    ]);
    for (const item of view.attention) {
      expect(item.reason).toBe('overdue');
    }
    expect(view.attention[0].due).toEqual(after(-1));
  });

  it('does not flag a due just outside the window boundary', async () => {
    const ctx = makeService();
    await ctx.goals.save(goalWithDue('g1', new Date(t0.getTime() + GOAL_DUE_WINDOW_MS + 1)));
    await ctx.tasks.save(taskWithDue('t1', new Date(t0.getTime() + TASK_DUE_WINDOW_MS + 1)));

    const view = await ctx.service.getDashboard(t0);

    expect(view.attention).toEqual([]);
  });
});

describe('DashboardService attention: resource exhaustion rule', () => {
  it('flags an active project whose allocation is consumed at exactly 90%', async () => {
    const ctx = makeService();
    await ctx.projects.save(activeProject('p1'));
    // Two exhausted allocations still yield a single item for the project.
    await allocatedResource(ctx, 'r1', 'p1', 100, 90);
    await allocatedResource(ctx, 'r2', 'p1', 100, 95);

    const view = await ctx.service.getDashboard(t0);

    expect(view.attention).toHaveLength(1);
    expect(view.attention[0]).toMatchObject({
      type: 'project',
      id: 'p1',
      title: 'Project p1',
      reason: 'resourceExhausted',
    });
  });

  it('does not flag a project consumed at only 89%', async () => {
    const ctx = makeService();
    await ctx.projects.save(activeProject('p1'));
    await allocatedResource(ctx, 'r1', 'p1', 100, 89);

    const view = await ctx.service.getDashboard(t0);

    expect(view.attention).toEqual([]);
  });

  it('does not flag a paused project even when exhausted', async () => {
    const ctx = makeService();
    const project = activeProject('p1');
    project.pause(t0);
    await ctx.projects.save(project);
    await allocatedResource(ctx, 'r1', 'p1', 100, 100);

    const view = await ctx.service.getDashboard(t0);

    expect(view.attention).toEqual([]);
  });
});

describe('DashboardService attention: pinned', () => {
  it('shows pinned targets, skipping archived or missing ones', async () => {
    const ctx = makeService();
    const due = after(5);
    await ctx.tasks.save(taskWithDue('t1', due));
    const archivedGoal = goalWithDue('g-archived');
    archivedGoal.archive(t0);
    await ctx.goals.save(archivedGoal);
    await ctx.ideas.save(Idea.create({ id: 'i1', content: 'Pinned idea content', now: t0 }));
    await ctx.attentionEntries.save(pin('a1', 'task', 't1'));
    await ctx.attentionEntries.save(pin('a2', 'goal', 'g-archived'));
    await ctx.attentionEntries.save(pin('a3', 'goal', 'missing'));
    await ctx.attentionEntries.save(pin('a4', 'idea', 'i1'));

    const view = await ctx.service.getDashboard(t0);

    expect(attentionIds(view.attention)).toEqual(['t1', 'i1']);
    expect(view.attention[0]).toMatchObject({ type: 'task', reason: 'pinned', due });
    expect(view.attention[1]).toMatchObject({
      type: 'idea',
      title: 'Pinned idea content',
      reason: 'pinned',
    });
    expect(view.attention[1].due).toBeUndefined();
  });
});

describe('DashboardService attention: dismissed', () => {
  it('hides a dismissed rule-derived item', async () => {
    const ctx = makeService();
    await ctx.goals.save(failedGoal('g1'));
    await ctx.attentionEntries.save(dismiss('a1', 'goal', 'g1'));

    const view = await ctx.service.getDashboard(t0);

    expect(view.attention).toEqual([]);
  });

  it('hides a dismissed pinned item', async () => {
    const ctx = makeService();
    await ctx.tasks.save(taskWithDue('t1'));
    // Pin and dismiss coexist only when seeded directly; dismissal wins.
    await ctx.attentionEntries.save(pin('a1', 'task', 't1'));
    await ctx.attentionEntries.save(dismiss('a2', 'task', 't1'));

    const view = await ctx.service.getDashboard(t0);

    expect(view.attention).toEqual([]);
  });
});

describe('DashboardService attention: priority and ordering', () => {
  it('shows an item matching several rules once, with the highest-priority reason', async () => {
    const ctx = makeService();
    // Failed and pinned: failed wins. (A failed goal can never also be
    // overdue: isDueImminent is false for failed items.)
    await ctx.goals.save(failedGoal('g1'));
    await ctx.attentionEntries.save(pin('a1', 'goal', 'g1'));
    // Due-imminent and resource-exhausted: overdue wins.
    await ctx.projects.save(activeProject('p1', after(1)));
    await allocatedResource(ctx, 'r1', 'p1', 100, 100);
    // Due-imminent and pinned: overdue wins.
    await ctx.tasks.save(taskWithDue('t1', after(2)));
    await ctx.attentionEntries.save(pin('a2', 'task', 't1'));

    const view = await ctx.service.getDashboard(t0);

    expect(attentionIds(view.attention)).toEqual(['g1', 'p1', 't1']);
    expect(view.attention.map((item) => item.reason)).toEqual([
      'failed',
      'overdue',
      'overdue',
    ]);
  });

  it('orders failed, overdue by due asc, resourceExhausted, then pinned', async () => {
    const ctx = makeService();
    await ctx.goals.save(failedGoal('g-failed'));
    await ctx.goals.save(goalWithDue('g-late', after(10)));
    await ctx.goals.save(goalWithDue('g-soon', after(5)));
    await ctx.projects.save(activeProject('p-exhausted'));
    await allocatedResource(ctx, 'r1', 'p-exhausted', 100, 100);
    await ctx.tasks.save(taskWithDue('t-pinned'));
    await ctx.attentionEntries.save(pin('a1', 'task', 't-pinned'));

    const view = await ctx.service.getDashboard(t0);

    expect(attentionIds(view.attention)).toEqual([
      'g-failed',
      'g-soon',
      'g-late',
      'p-exhausted',
      't-pinned',
    ]);
  });
});

describe('DashboardService recentActivity', () => {
  it('returns at most 10 records in repository order', async () => {
    const ctx = makeService();
    for (let i = 1; i <= 12; i += 1) {
      await ctx.records.append(
        DomainRecord.create({
          id: `rec${i}`,
          kind: 'somethingHappened',
          detail: i === 5 ? undefined : `detail ${i}`,
          occurredAt: after(i),
        }),
      );
    }

    const view = await ctx.service.getDashboard(t0);

    // The fake returns newest first; the service preserves that order.
    expect(view.recentActivity.map((item) => item.id)).toEqual([
      'rec12',
      'rec11',
      'rec10',
      'rec9',
      'rec8',
      'rec7',
      'rec6',
      'rec5',
      'rec4',
      'rec3',
    ]);
    expect(view.recentActivity[0]).toMatchObject({
      kind: 'somethingHappened',
      detail: 'detail 12',
      occurredAt: after(12),
    });
    expect(view.recentActivity[7].detail).toBeUndefined();
  });

  it('returns fewer than 10 when the repository has fewer', async () => {
    const ctx = makeService();
    await ctx.records.append(
      DomainRecord.create({ id: 'rec1', kind: 'goalCreated', occurredAt: t0 }),
    );

    const view = await ctx.service.getDashboard(t0);

    expect(view.recentActivity).toHaveLength(1);
  });
});

describe('DashboardService stats', () => {
  // All dates are local: 2026-02-10 is "today", noon is `now`.
  const now = new Date(2026, 1, 10, 12, 0, 0);
  const todayMorning = new Date(2026, 1, 10, 8, 0, 0);
  const todayEvening = new Date(2026, 1, 10, 18, 0, 0);
  const yesterday = new Date(2026, 1, 9, 15, 0, 0);

  function completedGoal(id: string, at: Date): Goal {
    const goal = Goal.create({ id, title: `Goal ${id}`, now: yesterday });
    goal.start(at);
    goal.complete(at);
    return goal;
  }

  function completedTask(id: string, at: Date): Task {
    const task = Task.create({ id, title: `Task ${id}`, projectId: 'p1', now: yesterday });
    task.start(at);
    task.complete(at);
    return task;
  }

  it('doingNow counts doing goals, doing tasks, and captured ideas', async () => {
    const ctx = makeService();
    const goal = Goal.create({ id: 'g1', title: 'Goal g1', now: todayMorning });
    goal.start(todayMorning);
    await ctx.goals.save(goal);
    const task = Task.create({ id: 't1', title: 'Task t1', projectId: 'p1', now: todayMorning });
    task.start(todayMorning);
    await ctx.tasks.save(task);
    await ctx.ideas.save(Idea.create({ id: 'i1', content: 'Idea i1', now: todayMorning }));
    // A todo goal and an archived idea are not in the doing list.
    await ctx.goals.save(Goal.create({ id: 'g-todo', title: 'Goal g-todo', now: todayMorning }));
    const archivedIdea = Idea.create({ id: 'i-archived', content: 'archived', now: todayMorning });
    archivedIdea.archive(todayMorning);
    await ctx.ideas.save(archivedIdea);

    const view = await ctx.service.getDashboard(now);

    expect(view.stats.doingNow).toBe(3);
    expect(view.stats.doingNow).toBe(view.doing.length);
  });

  it('doneToday counts goals and tasks completed today, ignoring yesterday', async () => {
    const ctx = makeService();
    await ctx.goals.save(completedGoal('g-today', todayMorning));
    await ctx.tasks.save(completedTask('t-today', todayEvening));
    await ctx.goals.save(completedGoal('g-yesterday', yesterday));
    // An archived goal completed today is excluded.
    const archived = completedGoal('g-archived', todayMorning);
    archived.archive(todayEvening);
    await ctx.goals.save(archived);
    // A goal still doing is not done.
    const doing = Goal.create({ id: 'g-doing', title: 'Goal g-doing', now: todayMorning });
    doing.start(todayMorning);
    await ctx.goals.save(doing);

    const view = await ctx.service.getDashboard(now);

    expect(view.stats.doneToday).toBe(2);
  });

  it('dueToday counts open goals, tasks, and projects due inside today', async () => {
    const ctx = makeService();
    // Counted: a goal, a task (due at the start-of-day boundary), a project.
    await ctx.goals.save(
      Goal.create({ id: 'g-in', title: 'Goal g-in', due: todayEvening, now: todayMorning }),
    );
    await ctx.tasks.save(
      Task.create({
        id: 't-in',
        title: 'Task t-in',
        due: new Date(2026, 1, 10, 0, 0, 0),
        projectId: 'p1',
        now: todayMorning,
      }),
    );
    await ctx.projects.save(
      Project.create({ id: 'p-in', name: 'Project p-in', goalId: 'g0', due: todayEvening, now: todayMorning }),
    );
    // Excluded: done goal, failed task, failed project, archived goal.
    const done = Goal.create({ id: 'g-done', title: 'Goal g-done', due: todayEvening, now: todayMorning });
    done.start(todayMorning);
    done.complete(todayEvening);
    await ctx.goals.save(done);
    const failed = Task.create({ id: 't-failed', title: 'Task t-failed', due: todayEvening, projectId: 'p1', now: todayMorning });
    failed.start(todayMorning);
    failed.fail(todayEvening);
    await ctx.tasks.save(failed);
    const failedProject = Project.create({
      id: 'p-failed',
      name: 'Project p-failed',
      goalId: 'g0',
      due: todayEvening,
      now: todayMorning,
    });
    failedProject.activate(todayMorning);
    failedProject.fail(todayEvening);
    await ctx.projects.save(failedProject);
    const archived = Goal.create({ id: 'g-archived', title: 'Goal g-archived', due: todayEvening, now: todayMorning });
    archived.archive(todayMorning);
    await ctx.goals.save(archived);
    // Excluded: due tomorrow (next-day boundary), due yesterday, no due.
    await ctx.goals.save(
      Goal.create({ id: 'g-tomorrow', title: 'Goal g-tomorrow', due: new Date(2026, 1, 11, 0, 0, 0), now: todayMorning }),
    );
    await ctx.tasks.save(
      Task.create({ id: 't-yesterday', title: 'Task t-yesterday', due: yesterday, projectId: 'p1', now: todayMorning }),
    );
    await ctx.goals.save(Goal.create({ id: 'g-nodue', title: 'Goal g-nodue', now: todayMorning }));

    const view = await ctx.service.getDashboard(now);

    expect(view.stats.dueToday).toBe(3);
  });
});
