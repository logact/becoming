import { AttentionEntry } from '../../../domain/attention/AttentionEntry';
import { Goal } from '../../../domain/goal/Goal';
import { Idea } from '../../../domain/idea/Idea';
import { Task } from '../../../domain/task/Task';
import { PinCandidatesService } from '../PinCandidatesService';
import { makeFakeRepos } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');
const HOUR = 60 * 60 * 1000;
const after = (hours: number): Date => new Date(t0.getTime() + hours * HOUR);

async function makeService() {
  const {
    goalRepo: goals,
    taskRepo: tasks,
    ideaRepo: ideas,
    attentionEntryRepo: attentionEntries,
  } = await makeFakeRepos();
  const service = new PinCandidatesService(goals, tasks, ideas, attentionEntries);
  return { service, goals, tasks, ideas, attentionEntries };
}

function pin(id: string, targetType: 'goal' | 'task' | 'idea', targetId: string): AttentionEntry {
  return AttentionEntry.create({ id, targetType, targetId, kind: 'pin', now: t0 });
}

describe('PinCandidatesService', () => {
  it('lists goals, tasks, and ideas, mapping idea content to title', async () => {
    const { service, goals, tasks, ideas } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    const task = Task.create({ id: 't1', title: 'Task t1', projectId: 'p1', now: t0 });
    task.start(after(1));
    await tasks.save(task);
    await ideas.save(Idea.create({ id: 'i1', content: 'Idea i1 content', now: after(2) }));

    const candidates = await service.list();

    expect(candidates[0]).toEqual({
      type: 'idea',
      id: 'i1',
      title: 'Idea i1 content',
      status: 'captured',
      pinned: false,
    });
    expect(candidates[1]).toMatchObject({ type: 'task', title: 'Task t1', status: 'doing' });
    expect(candidates[2]).toMatchObject({ type: 'goal', title: 'Goal g1', status: 'todo' });
  });

  it('excludes archived goals, tasks, and ideas', async () => {
    const { service, goals, tasks, ideas } = await makeService();
    // Archived items are updated last, so they would sort first if included.
    const archivedGoal = Goal.create({ id: 'g-archived', title: 'archived', now: t0 });
    archivedGoal.archive(after(9));
    await goals.save(archivedGoal);
    const archivedTask = Task.create({ id: 't-archived', title: 'archived', projectId: 'p1', now: t0 });
    archivedTask.archive(after(9));
    await tasks.save(archivedTask);
    const archivedIdea = Idea.create({ id: 'i-archived', content: 'archived', now: t0 });
    archivedIdea.archive(after(9));
    await ideas.save(archivedIdea);
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));

    const candidates = await service.list();

    expect(candidates.map((candidate) => candidate.id)).toEqual(['g1']);
  });

  it('marks targets with a pin entry as pinned; dismiss does not pin', async () => {
    const { service, goals, tasks, ideas, attentionEntries } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: t0 }));
    await tasks.save(Task.create({ id: 't1', title: 'Task t1', projectId: 'p1', now: t0 }));
    await ideas.save(Idea.create({ id: 'i1', content: 'Idea i1', now: t0 }));
    await attentionEntries.save(pin('a1', 'goal', 'g1'));
    await attentionEntries.save(
      AttentionEntry.create({ id: 'a2', targetType: 'task', targetId: 't1', kind: 'dismiss', now: t0 }),
    );

    const candidates = await service.list();

    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    expect(byId.get('g1')?.pinned).toBe(true);
    expect(byId.get('t1')?.pinned).toBe(false);
    expect(byId.get('i1')?.pinned).toBe(false);
  });

  it('sorts by updatedAt desc across types', async () => {
    const { service, goals, tasks, ideas } = await makeService();
    await goals.save(Goal.create({ id: 'g1', title: 'Goal g1', now: after(1) }));
    await ideas.save(Idea.create({ id: 'i1', content: 'Idea i1', now: after(3) }));
    await tasks.save(Task.create({ id: 't1', title: 'Task t1', projectId: 'p1', now: after(2) }));

    const candidates = await service.list();

    expect(candidates.map((candidate) => candidate.id)).toEqual(['i1', 't1', 'g1']);
  });
});
