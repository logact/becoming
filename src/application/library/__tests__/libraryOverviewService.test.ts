import { Goal } from '../../../domain/goal/Goal';
import { Idea } from '../../../domain/idea/Idea';
import { Note } from '../../../domain/note/Note';
import { Project } from '../../../domain/project/Project';
import { Resource } from '../../../domain/resource/Resource';
import { Task } from '../../../domain/task/Task';
import { makeFakeRepos } from '../../__tests__/fakes';
import { LibraryOverviewService } from '../LibraryOverviewService';

const t0 = new Date('2026-02-01T00:00:00Z');

async function makeService() {
  const {
    goalRepo: goals,
    taskRepo: tasks,
    projectRepo: projects,
    ideaRepo: ideas,
    noteRepo: notes,
    resourceRepo: resources,
  } = await makeFakeRepos();
  const service = new LibraryOverviewService(goals, tasks, projects, ideas, notes, resources);
  return { service, goals, tasks, projects, ideas, notes, resources };
}

describe('LibraryOverviewService.getCounts', () => {
  it('returns zero counts when every collection is empty', async () => {
    const { service } = await makeService();

    expect(await service.getCounts()).toEqual({
      goals: 0,
      tasks: 0,
      projects: 0,
      ideas: 0,
      notes: 0,
      resources: 0,
    });
  });

  it('counts each collection, excluding archived entries', async () => {
    const { service, goals, tasks, projects, ideas, notes, resources } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    const archivedGoal = Goal.create({ id: 'g2', title: 'Goal g2', now: t0 });
    archivedGoal.archive(t0);
    await goals.save(archivedGoal);
    await tasks.save(Task.create({ id: 't1', title: 'Task t1', projectId: 'p1', now: t0 }));
    await projects.save(Project.create({ id: 'p1', name: 'Project p1', goalId: 'g1', now: t0 }));
    await ideas.save(Idea.create({ id: 'i1', content: 'Idea i1', now: t0 }));
    await ideas.save(Idea.create({ id: 'i2', content: 'Idea i2', now: t0 }));
    await notes.save(Note.create({ id: 'n1', content: 'Note n1', now: t0 }));
    const archivedNote = Note.create({ id: 'n2', content: 'Note n2', now: t0 });
    archivedNote.archive(t0);
    await notes.save(archivedNote);
    await resources.save(
      Resource.create({ id: 'r1', typeId: 'rt-time', kind: 'time', name: 'Hours', amount: 10, now: t0 }),
    );

    expect(await service.getCounts()).toEqual({
      goals: 1,
      tasks: 1,
      projects: 1,
      ideas: 2,
      notes: 1,
      resources: 1,
    });
  });
});
