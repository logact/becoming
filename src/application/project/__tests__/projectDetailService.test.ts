import { Goal } from '../../../domain/goal/Goal';
import { Milestone } from '../../../domain/milestone/Milestone';
import { Project } from '../../../domain/project/Project';
import { Record as DomainRecord } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { Resource } from '../../../domain/resource/Resource';
import { Task } from '../../../domain/task/Task';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import { RECENT_ACTIVITY_LIMIT } from '../../dashboard/DashboardService';
import { ProjectDetailService } from '../ProjectDetailService';

const t0 = new Date('2026-02-01T00:00:00Z');
const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * HOUR;
const after = (hours: number): Date => new Date(t0.getTime() + hours * HOUR);

async function makeService() {
  const {
    projectRepo: projects,
    goalRepo: goals,
    taskRepo: tasks,
    resourceRepo: resources,
    relationRepo: relations,
    recordRepo: records,
    milestoneRepo: milestones,
  } = await makeFakeRepos();
  const service = new ProjectDetailService(projects, goals, tasks, resources, records, milestones);
  return { service, projects, goals, tasks, resources, relations, records, milestones };
}

function seedProject(
  projects: TestRepositories['projectRepo'],
  goals: TestRepositories['goalRepo'],
) {
  const goal = Goal.create({ id: 'g1', title: 'Run a half marathon', now: t0 });
  goal.start(t0);
  const project = Project.create({ id: 'p1', name: 'Spring training plan', goalId: 'g1', now: t0 });
  return Promise.all([goals.save(goal), projects.save(project)]);
}

describe('ProjectDetailService.getDetail', () => {
  it('returns an empty view with null project for an unknown project', async () => {
    const { service } = await makeService();

    expect(await service.getDetail('nope')).toEqual({
      project: null,
      plan: null,
      progress: null,
      weeks: null,
      milestones: [],
      tasks: [],
      resources: [],
      recentActivity: [],
    });
  });

  it('builds the plan tree rooted at the serving goal with nested sub-goals and tasks attached to their goal', async () => {
    const { service, projects, goals, tasks } = await makeService();
    await seedProject(projects, goals);
    // Direct sub-goal (parent is the serving goal).
    await goals.save(
      Goal.create({
        id: 'g2',
        title: '10 km under 50:00',
        projectId: 'p1',
        parentGoalId: 'g1',
        startAt: after(24),
        due: after(48),
        milestoneId: 'm1',
        now: t0,
      }),
    );
    // Nested sub-goal under g2.
    await goals.save(
      Goal.create({ id: 'g3', title: 'Threshold endurance', projectId: 'p1', parentGoalId: 'g2', now: t0 }),
    );
    // Sub-goal without an explicit parent attaches under the root.
    await goals.save(Goal.create({ id: 'g4', title: 'Race day', projectId: 'p1', now: t0 }));
    // A goal of another project is excluded.
    await goals.save(Goal.create({ id: 'g5', title: 'Other', projectId: 'p2', now: t0 }));
    // A task targeting a sub-goal attaches to that node.
    await tasks.save(
      Task.create({
        id: 't1', title: 'Intervals 6 × 800 m', projectId: 'p1', goalId: 'g2',
        startAt: after(12), now: t0,
      }),
    );
    // Tasks without a goal (or with an unknown goal) attach to the root.
    await tasks.save(Task.create({ id: 't2', title: 'Long run 16 km', projectId: 'p1', now: t0 }));
    await tasks.save(Task.create({ id: 't3', title: 'Orphan', projectId: 'p1', goalId: 'gone', now: t0 }));

    const view = await service.getDetail('p1');

    expect(view.plan).toEqual({
      id: 'g1',
      title: 'Run a half marathon',
      status: 'doing',
      tasks: [
        { id: 't2', title: 'Long run 16 km', status: 'todo' },
        { id: 't3', title: 'Orphan', status: 'todo' },
      ],
      children: [
        { id: 'g4', title: 'Race day', status: 'todo', tasks: [], children: [] },
        {
          id: 'g2',
          title: '10 km under 50:00',
          status: 'todo',
          startAt: after(24),
          due: after(48),
          milestoneId: 'm1',
          tasks: [
            {
              id: 't1', title: 'Intervals 6 × 800 m', status: 'todo',
              startAt: after(12), goalTitle: '10 km under 50:00',
            },
          ],
          children: [{ id: 'g3', title: 'Threshold endurance', status: 'todo', tasks: [], children: [] }],
        },
      ],
    });
    // The flat task list carries the goal context for the List view.
    expect(view.tasks).toEqual([
      {
        id: 't1', title: 'Intervals 6 × 800 m', status: 'todo',
        startAt: after(12), goalTitle: '10 km under 50:00',
      },
      { id: 't2', title: 'Long run 16 km', status: 'todo' },
      { id: 't3', title: 'Orphan', status: 'todo' },
    ]);
  });

  it('lists non-archived tasks and the resources allocated to the project', async () => {
    const { service, projects, goals, tasks, resources } = await makeService();
    await seedProject(projects, goals);
    await tasks.save(Task.create({ id: 't1', title: 'Intervals 6 × 800 m', projectId: 'p1', now: t0 }));
    const done = Task.create({ id: 't2', title: 'Base run 8 km', projectId: 'p1', due: after(24), now: t0 });
    done.start(t0);
    done.complete(t0);
    await tasks.save(done);
    const archived = Task.create({ id: 't3', title: 'Old run', projectId: 'p1', now: t0 });
    archived.archive(t0);
    await tasks.save(archived);

    const time = Resource.create({ id: 'r1', typeId: 'rt-time', kind: 'time', name: 'Time budget', amount: 600, now: t0 });
    time.allocate({ id: 'a1', projectId: 'p1', span: { startAt: t0, endAt: after(8) } }, t0);
    await resources.save(time);
    const gear = Resource.create({ id: 'r2', typeId: 'rt-money', kind: 'quantity', name: 'Gear budget', amount: 3000, now: t0 });
    gear.allocate({ id: 'a2', projectId: 'p2', amount: 100 }, t0);
    await resources.save(gear);

    const view = await service.getDetail('p1');

    expect(view.tasks).toEqual([
      { id: 't1', title: 'Intervals 6 × 800 m', status: 'todo' },
      { id: 't2', title: 'Base run 8 km', status: 'done', due: after(24) },
    ]);
    // Time resources expose the allocated span; the amount is its duration in minutes.
    expect(view.resources).toEqual([
      { id: 'r1', name: 'Time budget', kind: 'time', amount: 480, span: { startAt: t0, endAt: after(8) } },
    ]);
  });

  it('computes progress across sub-goals and tasks', async () => {
    const { service, projects, goals, tasks } = await makeService();
    await seedProject(projects, goals);
    const doneGoal = Goal.create({ id: 'g2', title: '10 km under 50:00', projectId: 'p1', now: t0 });
    doneGoal.start(t0);
    doneGoal.complete(t0);
    await goals.save(doneGoal);
    await goals.save(Goal.create({ id: 'g3', title: 'Race day', projectId: 'p1', now: t0 }));
    await tasks.save(Task.create({ id: 't1', title: 'Long run 16 km', projectId: 'p1', now: t0 }));
    const doneTask = Task.create({ id: 't2', title: 'Base run 8 km', projectId: 'p1', now: t0 });
    doneTask.start(t0);
    doneTask.complete(t0);
    await tasks.save(doneTask);

    const view = await service.getDetail('p1', t0);

    expect(view.progress).toEqual({
      doneSubGoals: 1,
      totalSubGoals: 2,
      doneTasks: 1,
      totalTasks: 2,
      percent: 50,
    });
  });

  it('returns null progress when the serving goal is unknown', async () => {
    const { service, projects } = await makeService();
    await projects.save(Project.create({ id: 'p1', name: 'Spring training plan', goalId: 'gone', now: t0 }));

    const view = await service.getDetail('p1', t0);

    expect(view.plan).toBeNull();
    expect(view.progress).toBeNull();
  });

  it('derives the 1-based current week from project createdAt to due', async () => {
    const { service, projects, goals } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Run a half marathon', now: t0 }));
    await projects.save(
      Project.create({
        id: 'p1',
        name: 'Spring training plan',
        goalId: 'g1',
        due: new Date(t0.getTime() + 16 * WEEK),
        now: t0,
      }),
    );

    const view = await service.getDetail('p1', new Date(t0.getTime() + 5 * WEEK + 12 * HOUR));

    expect(view.weeks).toEqual({ current: 6, total: 16 });
  });

  it('returns null weeks when the project has no due', async () => {
    const { service, projects, goals } = await makeService();
    await seedProject(projects, goals);

    const view = await service.getDetail('p1', t0);

    expect(view.weeks).toBeNull();
  });

  it('lists milestones sorted by date with the reached flag and linked items', async () => {
    const { service, projects, goals, tasks, milestones } = await makeService();
    await seedProject(projects, goals);
    await goals.save(
      Goal.create({
        id: 'g2',
        title: '10 km under 50:00',
        projectId: 'p1',
        parentGoalId: 'g1',
        milestoneId: 'm2',
        now: t0,
      }),
    );
    await goals.save(
      Goal.create({
        id: 'g3',
        title: 'Threshold endurance',
        projectId: 'p1',
        parentGoalId: 'g2',
        milestoneId: 'm1',
        now: t0,
      }),
    );
    await tasks.save(
      Task.create({
        id: 't1',
        title: 'Intervals 6 × 800 m',
        projectId: 'p1',
        goalId: 'g2',
        milestoneId: 'm1',
        now: t0,
      }),
    );
    // Saved newest first to prove the view sorts by date.
    await milestones.save(
      Milestone.create({ id: 'm3', title: 'Race week', date: after(14 * 24), projectId: 'p1', now: t0 }),
    );
    await milestones.save(
      Milestone.create({ id: 'm2', title: 'Mid-plan test', date: after(7 * 24), projectId: 'p1', now: t0 }),
    );
    await milestones.save(
      Milestone.create({ id: 'm1', title: 'Base phase', date: after(-7 * 24), projectId: 'p1', now: t0 }),
    );
    // A milestone of another project is excluded.
    await milestones.save(
      Milestone.create({ id: 'm9', title: 'Other', date: after(-30 * 24), projectId: 'p2', now: t0 }),
    );

    const view = await service.getDetail('p1', t0);

    expect(view.milestones).toEqual([
      {
        id: 'm1',
        title: 'Base phase',
        date: after(-7 * 24),
        reached: true,
        items: [
          { kind: 'goal', id: 'g3', title: 'Threshold endurance', status: 'todo', context: '10 km under 50:00' },
          { kind: 'task', id: 't1', title: 'Intervals 6 × 800 m', status: 'todo', context: '10 km under 50:00' },
        ],
      },
      {
        id: 'm2',
        title: 'Mid-plan test',
        date: after(7 * 24),
        reached: false,
        items: [
          { kind: 'goal', id: 'g2', title: '10 km under 50:00', status: 'todo', context: 'Run a half marathon' },
        ],
      },
      { id: 'm3', title: 'Race week', date: after(14 * 24), reached: false, items: [] },
    ]);
  });

  it('returns project-linked activity in either relation direction, capped', async () => {
    const { service, projects, goals, relations, records } = await makeService();
    await seedProject(projects, goals);
    for (let i = 1; i <= RECENT_ACTIVITY_LIMIT + 2; i += 1) {
      await records.append(
        DomainRecord.create({ id: `rec-${i}`, kind: 'taskCompleted', detail: `Record ${i}`, occurredAt: after(i) }),
      );
      await relations.save(
        Relation.create({
          id: `rel-${i}`,
          sourceType: 'project',
          sourceId: 'p1',
          targetType: 'record',
          targetId: `rec-${i}`,
          kind: 'logged',
          now: t0,
        }),
      );
    }
    // A record linked from the record end (record → project) also matches.
    await records.append(
      DomainRecord.create({ id: 'rec-rev', kind: 'noteCreated', detail: 'Reverse link', occurredAt: after(100) }),
    );
    await relations.save(
      Relation.create({
        id: 'rel-rev',
        sourceType: 'record',
        sourceId: 'rec-rev',
        targetType: 'project',
        targetId: 'p1',
        kind: 'about',
        now: t0,
      }),
    );

    const view = await service.getDetail('p1');

    expect(view.recentActivity).toHaveLength(RECENT_ACTIVITY_LIMIT);
    // Newest first: the reverse-linked record is the most recent.
    expect(view.recentActivity[0]).toMatchObject({ id: 'rec-rev', kind: 'noteCreated' });
  });
});
