import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { Record as DomainRecord } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { GoalDetailService } from '../GoalDetailService';
import {
  PROJECT_ACTIVATED_RECORD_KIND,
  SelectCurrentPlanService,
} from '../SelectCurrentPlanService';
import {
  CreateGoalProjectService,
  PROJECT_CREATED_RECORD_KIND,
} from '../../project/CreateGoalProjectService';
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
    transactionRunner,
  } = await makeFakeRepos();
  const service = new GoalDetailService(goals, projects, records);
  return { service, goals, projects, relations, records, transactionRunner };
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

  it('lists non-archived Goal projects with navigation data, sub-goal counts, and application-level selection eligibility', async () => {
    const { service, goals, projects } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    await projects.save(Project.create({ id: 'p1', name: 'Project p1', goalId: 'g1', now: t0 }));
    const active = Project.create({ id: 'p2', name: 'Project p2', goalId: 'g1', now: t0 });
    active.activate(t0);
    await projects.save(active);
    const paused = Project.create({ id: 'p3', name: 'Project p3', goalId: 'g1', now: t0 });
    paused.activate(t0);
    paused.pause(t0);
    await projects.save(paused);
    const done = Project.create({ id: 'p4', name: 'Project p4', goalId: 'g1', now: t0 });
    done.activate(t0);
    done.complete(t0);
    await projects.save(done);
    const failed = Project.create({ id: 'p5', name: 'Project p5', goalId: 'g1', now: t0 });
    failed.activate(t0);
    failed.fail(t0);
    await projects.save(failed);
    await goals.save(Goal.create({ id: 'g2', title: 'Sub goal', projectId: 'p1', now: t0 }));
    // Belongs to another goal: excluded.
    await projects.save(Project.create({ id: 'p6', name: 'Project p6', goalId: 'other', now: t0 }));

    const view = await service.getDetail('g1');

    expect(view.goal?.id).toBe('g1');
    expect(view.projects).toEqual([
      {
        id: 'p1', name: 'Project p1', status: 'planning', subGoalCount: 1,
        canSelectAsCurrentPlan: true,
      },
      {
        id: 'p2', name: 'Project p2', status: 'active', subGoalCount: 0,
        canSelectAsCurrentPlan: false,
      },
      {
        id: 'p3', name: 'Project p3', status: 'paused', subGoalCount: 0,
        canSelectAsCurrentPlan: true,
      },
      {
        id: 'p4', name: 'Project p4', status: 'done', subGoalCount: 0,
        canSelectAsCurrentPlan: false,
      },
      {
        id: 'p5', name: 'Project p5', status: 'failed', subGoalCount: 0,
        canSelectAsCurrentPlan: false,
      },
    ]);
    expect(view.activeProjectId).toBe('p2');
  });

  it('returns the goal entity with its startAt schedule metadata', async () => {
    const { service, goals } = await makeService();
    const startAt = after(24);
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', startAt, now: t0 }));

    const view = await service.getDetail('g1');

    expect(view.goal?.startAt).toEqual(startAt);
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

  it('returns Project creation and current-plan activation records through Goal recent activity', async () => {
    const {
      service,
      goals,
      projects,
      relations,
      records,
      transactionRunner,
    } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    const createProjects = new CreateGoalProjectService(
      goals,
      projects,
      records,
      relations,
      transactionRunner,
    );
    const selectCurrentPlan = new SelectCurrentPlanService(
      goals,
      projects,
      records,
      relations,
      transactionRunner,
    );

    await createProjects.create({
      projectId: 'p1',
      goalId: 'g1',
      name: 'Project p1',
      recordId: 'r-created',
      goalRecordRelationId: 'rel-created-goal',
      projectRecordRelationId: 'rel-created-project',
      now: after(1),
    });
    await selectCurrentPlan.select({
      goalId: 'g1',
      selectedProjectId: 'p1',
      recordId: 'r-activated',
      goalRecordRelationId: 'rel-activated-goal',
      projectRecordRelationId: 'rel-activated-project',
      now: after(2),
    });

    const view = await service.getDetail('g1');

    expect(view.recentActivity).toEqual([
      {
        id: 'r-activated',
        kind: PROJECT_ACTIVATED_RECORD_KIND,
        detail: 'Selected Project “Project p1” as current plan',
        occurredAt: after(2),
      },
      {
        id: 'r-created',
        kind: PROJECT_CREATED_RECORD_KIND,
        detail: 'Created Project “Project p1”',
        occurredAt: after(1),
      },
    ]);
    expect(view.activeProjectId).toBe('p1');
    expect(view.projects).toEqual([
      {
        id: 'p1',
        name: 'Project p1',
        status: 'active',
        subGoalCount: 0,
        canSelectAsCurrentPlan: false,
      },
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
