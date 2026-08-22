import { Goal } from '../../../domain/goal/Goal';
import { Idea } from '../../../domain/idea/Idea';
import { Label } from '../../../domain/label/Label';
import { Project } from '../../../domain/project/Project';
import { Record } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { Task } from '../../../domain/task/Task';
import { makeFakeRepos } from '../../__tests__/fakes';
import { IdeaDetailService } from '../IdeaDetailService';

const t0 = new Date('2026-08-01T00:00:00Z');

describe('IdeaDetailService', () => {
  it('returns an explicit empty detail for an unknown Idea', async () => {
    const repos = await makeFakeRepos();
    const detail = await new IdeaDetailService(
      repos.ideaRepo, repos.goalRepo, repos.taskRepo, repos.projectRepo,
      repos.labelRepo, repos.relationRepo, repos.recordRepo,
    ).getDetail('missing');

    expect(detail).toEqual({ idea: null, labels: [], derivedItems: [], recentActivity: [] });
  });

  it('resolves labels, Goal and Task derivations, task project names, and scoped activity', async () => {
    const repos = await makeFakeRepos();
    await repos.labelRepo.save(Label.create({ id: 'label-a', name: 'Adventure', color: '#00ff00' }));
    await repos.labelRepo.save(Label.create({ id: 'label-b', name: 'Someday' }));
    const idea = Idea.create({ id: 'idea-1', content: 'Run somewhere new', now: t0 });
    idea.addLabel('label-a');
    idea.addLabel('label-b');
    await repos.ideaRepo.save(idea);

    const goal = Goal.create({ id: 'goal-1', title: 'Run a trail race', now: t0 });
    await repos.goalRepo.save(goal);
    await repos.projectRepo.save(Project.create({
      id: 'project-1', name: 'Autumn training', goalId: goal.id, now: t0,
    }));
    const task = Task.create({
      id: 'task-1', title: 'Choose a race', projectId: 'project-1', now: t0,
    });
    task.start(new Date('2026-08-02T00:00:00Z'));
    await repos.taskRepo.save(task);

    await Promise.all([
      repos.relationRepo.save(Relation.derivedFromIdea({
        id: 'derived-goal', sourceType: 'goal', sourceId: goal.id,
        ideaId: idea.id, now: new Date('2026-08-03T00:00:00Z'),
      })),
      repos.relationRepo.save(Relation.derivedFromIdea({
        id: 'derived-task', sourceType: 'task', sourceId: task.id,
        ideaId: idea.id, now: new Date('2026-08-04T00:00:00Z'),
      })),
      repos.relationRepo.save(Relation.derivedFromIdea({
        id: 'dangling-goal', sourceType: 'goal', sourceId: 'missing-goal',
        ideaId: idea.id, now: new Date('2026-08-05T00:00:00Z'),
      })),
      repos.relationRepo.save(Relation.derivedFromIdea({
        id: 'dangling-task', sourceType: 'task', sourceId: 'missing-task',
        ideaId: idea.id, now: new Date('2026-08-06T00:00:00Z'),
      })),
      repos.relationRepo.save(Relation.derivedFromIdea({
        id: 'unrelated', sourceType: 'goal', sourceId: goal.id,
        ideaId: 'other-idea', now: new Date('2026-08-07T00:00:00Z'),
      })),
    ]);

    await repos.recordRepo.append(Record.create({
      id: 'record-old', kind: 'ideaCaptured', detail: 'old',
      occurredAt: new Date('2026-08-08T00:00:00Z'),
    }));
    await repos.recordRepo.append(Record.create({
      id: 'record-new', kind: 'ideaEdited', detail: 'new',
      occurredAt: new Date('2026-08-09T00:00:00Z'),
    }));
    await repos.recordRepo.append(Record.create({
      id: 'record-other', kind: 'ideaCaptured', occurredAt: new Date('2026-08-10T00:00:00Z'),
    }));
    await Promise.all([
      repos.relationRepo.save(Relation.create({
        id: 'log-old', sourceType: 'record', sourceId: 'record-old', targetType: 'idea',
        targetId: idea.id, kind: 'logs', now: t0,
      })),
      repos.relationRepo.save(Relation.create({
        id: 'log-new', sourceType: 'record', sourceId: 'record-new', targetType: 'idea',
        targetId: idea.id, kind: 'logs', now: t0,
      })),
      repos.relationRepo.save(Relation.create({
        id: 'log-other', sourceType: 'record', sourceId: 'record-other', targetType: 'idea',
        targetId: 'other-idea', kind: 'logs', now: t0,
      })),
    ]);

    const detail = await new IdeaDetailService(
      repos.ideaRepo, repos.goalRepo, repos.taskRepo, repos.projectRepo,
      repos.labelRepo, repos.relationRepo, repos.recordRepo,
    ).getDetail(idea.id);

    expect(detail.idea?.id).toBe(idea.id);
    expect(detail.labels).toEqual([
      { id: 'label-a', name: 'Adventure', color: '#00ff00' },
      { id: 'label-b', name: 'Someday' },
    ]);
    expect(detail.derivedItems).toEqual([
      {
        type: 'task', id: 'task-1', title: 'Choose a race', status: 'doing',
        projectId: 'project-1', projectName: 'Autumn training', context: 'Autumn training',
      },
      { type: 'goal', id: 'goal-1', title: 'Run a trail race', status: 'todo' },
    ]);
    expect(detail.recentActivity).toEqual([
      { id: 'record-new', kind: 'ideaEdited', detail: 'new', occurredAt: new Date('2026-08-09T00:00:00Z') },
      { id: 'record-old', kind: 'ideaCaptured', detail: 'old', occurredAt: new Date('2026-08-08T00:00:00Z') },
    ]);
  });

  it('falls back to a dangling project id for a resolvable derived Task', async () => {
    const repos = await makeFakeRepos();
    const idea = Idea.create({ id: 'idea-1', content: 'An idea', now: t0 });
    await repos.ideaRepo.save(idea);
    await repos.taskRepo.save(Task.create({
      id: 'task-1', title: 'Task', projectId: 'missing-project', now: t0,
    }));
    await repos.relationRepo.save(Relation.derivedFromIdea({
      id: 'derived-task', sourceType: 'task', sourceId: 'task-1', ideaId: idea.id, now: t0,
    }));

    const detail = await new IdeaDetailService(
      repos.ideaRepo, repos.goalRepo, repos.taskRepo, repos.projectRepo,
      repos.labelRepo, repos.relationRepo, repos.recordRepo,
    ).getDetail(idea.id);

    expect(detail.derivedItems[0]).toMatchObject({
      type: 'task', projectName: 'missing-project', context: 'missing-project',
    });
  });
});
