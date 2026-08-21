import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { Record as DomainRecord } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { GoalDetailService } from '../GoalDetailService';
import { RECENT_ACTIVITY_LIMIT } from '../../dashboard/DashboardService';
import { makeFakeRepos } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');
const HOUR = 60 * 60 * 1000;
const after = (hours: number): Date => new Date(t0.getTime() + hours * HOUR);

async function makeService() {
  const {
    goalRepo: goals,
    projectRepo: projects,
    relationRepo: relations,
    recordRepo: records,
  } = await makeFakeRepos();
  const service = new GoalDetailService(goals, projects, records);
  return { service, goals, projects, relations, records };
}

describe('GoalDetailService.getDetail', () => {
  it('returns a null goal when the goal is unknown', async () => {
    const { service } = await makeService();

    const view = await service.getDetail('missing');

    expect(view.goal).toBeNull();
    expect(view.projects).toEqual([]);
    expect(view.activeProjectId).toBeNull();
    expect(view.recentActivity).toEqual([]);
  });

  it('lists the goal projects with status and sub-goal count', async () => {
    const { service, goals, projects } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    await projects.save(Project.create({ id: 'p1', name: 'Project p1', goalId: 'g1', now: t0 }));
    const active = Project.create({ id: 'p2', name: 'Project p2', goalId: 'g1', now: t0 });
    active.activate(t0);
    await projects.save(active);
    await goals.save(Goal.create({ id: 'g2', title: 'Sub goal', projectId: 'p1', now: t0 }));
    // Belongs to another goal: excluded.
    await projects.save(Project.create({ id: 'p3', name: 'Project p3', goalId: 'other', now: t0 }));

    const view = await service.getDetail('g1');

    expect(view.goal?.id).toBe('g1');
    expect(view.projects).toEqual([
      { id: 'p1', name: 'Project p1', status: 'planning', subGoalCount: 1 },
      { id: 'p2', name: 'Project p2', status: 'active', subGoalCount: 0 },
    ]);
    expect(view.activeProjectId).toBe('p2');
  });

  it('excludes archived projects and reports no active project when none is active', async () => {
    const { service, goals, projects } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    const archived = Project.create({ id: 'p1', name: 'Project p1', goalId: 'g1', now: t0 });
    archived.archive(t0);
    await projects.save(archived);

    const view = await service.getDetail('g1');

    expect(view.projects).toEqual([]);
    expect(view.activeProjectId).toBeNull();
  });

  it('lists records linked to the goal in either relation direction, newest first', async () => {
    const { service, goals, relations, records } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    await records.append(
      DomainRecord.create({ id: 'r1', kind: 'goalCreated', occurredAt: after(1) }),
    );
    await records.append(
      DomainRecord.create({ id: 'r2', kind: 'noteAdded', detail: 'note', occurredAt: after(2) }),
    );
    // record as the relation source end
    await relations.save(
      Relation.create({
        id: 'rel1',
        sourceType: 'record',
        sourceId: 'r1',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'relatesTo',
        now: t0,
      }),
    );
    // record as the relation target end
    await relations.save(
      Relation.create({
        id: 'rel2',
        sourceType: 'goal',
        sourceId: 'g1',
        targetType: 'record',
        targetId: 'r2',
        kind: 'relatesTo',
        now: t0,
      }),
    );
    // linked to another goal: excluded
    await records.append(
      DomainRecord.create({ id: 'r3', kind: 'goalCreated', occurredAt: after(3) }),
    );
    await relations.save(
      Relation.create({
        id: 'rel3',
        sourceType: 'record',
        sourceId: 'r3',
        targetType: 'goal',
        targetId: 'other',
        kind: 'relatesTo',
        now: t0,
      }),
    );

    const view = await service.getDetail('g1');

    expect(view.recentActivity).toEqual([
      { id: 'r2', kind: 'noteAdded', detail: 'note', occurredAt: after(2) },
      { id: 'r1', kind: 'goalCreated', occurredAt: after(1) },
    ]);
  });

  it('lists a record linked in both directions only once', async () => {
    const { service, goals, relations, records } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    await records.append(
      DomainRecord.create({ id: 'r1', kind: 'goalCreated', occurredAt: after(1) }),
    );
    await relations.save(
      Relation.create({
        id: 'rel1',
        sourceType: 'record',
        sourceId: 'r1',
        targetType: 'goal',
        targetId: 'g1',
        kind: 'relatesTo',
        now: t0,
      }),
    );
    await relations.save(
      Relation.create({
        id: 'rel2',
        sourceType: 'goal',
        sourceId: 'g1',
        targetType: 'record',
        targetId: 'r1',
        kind: 'relatesTo',
        now: t0,
      }),
    );

    const view = await service.getDetail('g1');

    expect(view.recentActivity.map((item) => item.id)).toEqual(['r1']);
  });

  it('caps recent activity at the recent activity limit', async () => {
    const { service, goals, relations, records } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    for (let i = 0; i < RECENT_ACTIVITY_LIMIT + 3; i += 1) {
      const id = `r${String(i).padStart(2, '0')}`;
      await records.append(DomainRecord.create({ id, kind: 'noteAdded', occurredAt: after(i) }));
      await relations.save(
        Relation.create({
          id: `rel${i}`,
          sourceType: 'record',
          sourceId: id,
          targetType: 'goal',
          targetId: 'g1',
          kind: 'relatesTo',
          now: t0,
        }),
      );
    }

    const view = await service.getDetail('g1');

    expect(view.recentActivity).toHaveLength(RECENT_ACTIVITY_LIMIT);
    expect(view.recentActivity[0].id).toBe(`r${String(RECENT_ACTIVITY_LIMIT + 2).padStart(2, '0')}`);
  });
});
