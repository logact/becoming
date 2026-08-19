import { Goal } from '../../../domain/goal/Goal';
import { Label } from '../../../domain/label/Label';
import { Project } from '../../../domain/project/Project';
import { ProjectsOverviewService } from '../ProjectsOverviewService';
import { GOAL_DUE_WINDOW_MS } from '../../dashboard/DashboardService';
import {
  FakeGoalRepository,
  FakeLabelRepository,
  FakeProjectRepository,
} from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');
const HOUR = 60 * 60 * 1000;
const after = (hours: number): Date => new Date(t0.getTime() + hours * HOUR);

function makeService() {
  const projects = new FakeProjectRepository();
  const goals = new FakeGoalRepository();
  const labels = new FakeLabelRepository();
  const service = new ProjectsOverviewService(projects, goals, labels);
  return { service, projects, goals, labels };
}

function goal(id: string): Goal {
  return Goal.create({ id, title: `Goal ${id}`, now: t0 });
}

function project(id: string, goalId = 'g1', due?: Date): Project {
  return Project.create({ id, name: `Project ${id}`, goalId, due, now: t0 });
}

function activeProject(id: string, goalId = 'g1', due?: Date): Project {
  const p = project(id, goalId, due);
  p.activate(t0);
  return p;
}

function failedProject(id: string, goalId = 'g1', due?: Date): Project {
  const p = activeProject(id, goalId, due);
  p.fail(t0);
  return p;
}

describe('ProjectsOverviewService.getOverview', () => {
  it('counts active and total non-archived projects in stats', async () => {
    const { service, projects } = makeService();
    await projects.save(project('p1'));
    await projects.save(activeProject('p2'));
    const archived = activeProject('p3');
    archived.archive(t0);
    await projects.save(archived);

    const view = await service.getOverview(t0);

    expect(view.stats).toEqual({ activeProjects: 1, totalProjects: 2 });
  });

  it('lists failed projects and due-imminent projects in attention, failed first', async () => {
    const { service, projects } = makeService();
    await projects.save(failedProject('p1'));
    await projects.save(activeProject('p2', 'g1', after(12))); // due within the window
    await projects.save(activeProject('p3', 'g1', after(GOAL_DUE_WINDOW_MS / HOUR + 1))); // outside
    await projects.save(project('p4')); // no due

    const view = await service.getOverview(t0);

    expect(view.attention).toEqual([
      { id: 'p1', name: 'Project p1', reason: 'failed' },
      { id: 'p2', name: 'Project p2', reason: 'overdue', due: after(12) },
    ]);
  });

  it('orders overdue attention items by soonest due', async () => {
    const { service, projects } = makeService();
    await projects.save(activeProject('p1', 'g1', after(20)));
    await projects.save(activeProject('p2', 'g1', after(2)));

    const view = await service.getOverview(t0);

    expect(view.attention.map((item) => item.id)).toEqual(['p2', 'p1']);
  });

  it('excludes archived projects from attention', async () => {
    const { service, projects } = makeService();
    const archived = failedProject('p1');
    archived.archive(t0);
    await projects.save(archived);

    const view = await service.getOverview(t0);

    expect(view.attention).toEqual([]);
  });

  it('lists active projects in focus with labels and due', async () => {
    const { service, projects } = makeService();
    const active = activeProject('p1', 'g1', after(48));
    active.addLabel('l1');
    await projects.save(active);
    await projects.save(project('p2'));

    const view = await service.getOverview(t0);

    expect(view.focus).toEqual([
      {
        id: 'p1',
        name: 'Project p1',
        status: 'active',
        labelIds: ['l1'],
        goalId: 'g1',
        goalTitle: 'g1',
        due: after(48),
      },
    ]);
  });

  it('counts non-archived projects per status', async () => {
    const { service, projects } = makeService();
    await projects.save(project('p1'));
    await projects.save(activeProject('p2'));
    const done = activeProject('p3');
    done.complete(t0);
    await projects.save(done);
    const archived = project('p4');
    archived.archive(t0);
    await projects.save(archived);

    const view = await service.getOverview(t0);

    expect(view.byStatus).toEqual({ planning: 1, active: 1, paused: 0, failed: 0, done: 1 });
  });

  it('counts non-archived projects per label with resolved names, most-used first', async () => {
    const { service, projects, labels } = makeService();
    await labels.save(Label.create({ id: 'l1', name: 'Health' }));
    await labels.save(Label.create({ id: 'l2', name: 'Work' }));
    const p1 = activeProject('p1');
    p1.addLabel('l1');
    p1.addLabel('l2');
    await projects.save(p1);
    const p2 = project('p2');
    p2.addLabel('l1');
    await projects.save(p2);
    const p3 = project('p3');
    p3.addLabel('l-unknown');
    await projects.save(p3);

    const view = await service.getOverview(t0);

    expect(view.byLabel).toEqual([
      { labelId: 'l1', name: 'Health', count: 2 },
      { labelId: 'l-unknown', name: 'l-unknown', count: 1 },
      { labelId: 'l2', name: 'Work', count: 1 },
    ]);
  });

  it('groups all non-archived projects by status with resolved goal titles', async () => {
    const { service, projects, goals } = makeService();
    await goals.save(goal('g1'));
    await projects.save(project('p1'));
    await projects.save(activeProject('p2'));
    const paused = activeProject('p3');
    paused.pause(t0);
    await projects.save(paused);
    const archived = project('p4');
    archived.archive(t0);
    await projects.save(archived);

    const view = await service.getOverview(t0);

    expect(view.allProjects.planning.map((p) => p.id)).toEqual(['p1']);
    expect(view.allProjects.active.map((p) => p.id)).toEqual(['p2']);
    expect(view.allProjects.paused.map((p) => p.id)).toEqual(['p3']);
    expect(view.allProjects.failed).toEqual([]);
    expect(view.allProjects.done).toEqual([]);
    expect(view.allProjects.active[0].goalTitle).toBe('Goal g1');
  });
});
