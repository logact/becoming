import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import {
  FakeAttentionEntryRepository,
  FakeGoalRepository,
  FakeIdeaRepository,
  FakeProjectRepository,
  FakeRecordRepository,
  FakeRelationRepository,
  FakeResourceRepository,
  FakeTaskRepository,
} from '../../../../application/__tests__/fakes';
import { AttentionService } from '../../../../application/attention/AttentionService';
import { PinCandidatesService } from '../../../../application/attention/PinCandidatesService';
import { DashboardService } from '../../../../application/dashboard/DashboardService';
import { AttentionEntry } from '../../../../domain/attention/AttentionEntry';
import { Goal } from '../../../../domain/goal/Goal';
import { Idea } from '../../../../domain/idea/Idea';
import { Task } from '../../../../domain/task/Task';
import { AppServicesProvider, type AppServices } from '../../../composition/AppServicesProvider';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { AttentionPinPage } from '../AttentionPinPage';

/** Real application services over the in-memory fake repositories. */
function makeServices() {
  const goals = new FakeGoalRepository();
  const tasks = new FakeTaskRepository();
  const ideas = new FakeIdeaRepository();
  const projects = new FakeProjectRepository();
  const resources = new FakeResourceRepository();
  const relations = new FakeRelationRepository();
  const records = new FakeRecordRepository();
  const attentionEntries = new FakeAttentionEntryRepository();
  const services: AppServices = {
    dashboard: new DashboardService(
      goals,
      tasks,
      ideas,
      projects,
      resources,
      relations,
      records,
      attentionEntries,
    ),
    attention: new AttentionService(attentionEntries),
    pinCandidates: new PinCandidatesService(goals, tasks, ideas, attentionEntries),
  };
  return { services, goals, tasks, ideas, attentionEntries };
}

type Ctx = ReturnType<typeof makeServices>;

/** 'Alpha goal' (todo), 'Beta task' (doing), 'Gamma idea' (captured). */
async function seedCandidates(ctx: Ctx, now: Date): Promise<void> {
  await ctx.goals.save(Goal.create({ id: 'g1', title: 'Alpha goal', now }));
  const task = Task.create({ id: 't1', title: 'Beta task', projectId: 'p1', now });
  task.start(now);
  await ctx.tasks.save(task);
  await ctx.ideas.save(Idea.create({ id: 'i1', content: 'Gamma idea', now }));
}

/** The page needs the shell's navigation context; render it as the tab list. */
function renderPinPage(services: AppServices) {
  const destinations: ShellDestination[] = [
    { id: 'dashboard', title: 'Dashboard', icon: 'grid', renderList: () => <AttentionPinPage /> },
  ];
  return render(
    <AppServicesProvider services={services}>
      <NavigationShell destinations={destinations} />
    </AppServicesProvider>,
  );
}

describe('AttentionPinPage', () => {
  it('groups candidates under Goals/Tasks/Ideas with status subtitles and disables pinned rows', async () => {
    const now = new Date();
    const ctx = makeServices();
    await seedCandidates(ctx, now);
    await ctx.goals.save(Goal.create({ id: 'g2', title: 'Delta goal', now }));
    await ctx.attentionEntries.save(
      AttentionEntry.create({ id: 'a1', targetType: 'goal', targetId: 'g2', kind: 'pin', now }),
    );

    renderPinPage(ctx.services);

    await screen.findByText('Alpha goal');
    expect(screen.getByText('Goals')).toBeTruthy();
    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getByText('Ideas')).toBeTruthy();
    // Status subtitles: both goals are todo, the task is doing, the idea captured.
    expect(screen.getAllByText('Todo')).toHaveLength(2);
    expect(screen.getByText('Doing')).toBeTruthy();
    expect(screen.getByText('Captured')).toBeTruthy();

    const pinnedButton = screen.getByTestId('pin-goal-g2');
    expect(pinnedButton).toBeDisabled();
    expect(within(pinnedButton).getByText('Pinned')).toBeTruthy();
    expect(within(screen.getByTestId('pin-goal-g1')).getByText('Pin')).toBeTruthy();
  });

  it('filters candidates case-insensitively by title', async () => {
    const now = new Date();
    const ctx = makeServices();
    await seedCandidates(ctx, now);

    renderPinPage(ctx.services);

    await screen.findByText('Alpha goal');
    fireEvent.changeText(screen.getByTestId('pin-search'), 'ALPHA');

    expect(screen.getByText('Alpha goal')).toBeTruthy();
    expect(screen.queryByText('Beta task')).toBeNull();
    expect(screen.queryByText('Gamma idea')).toBeNull();
    // Groups with no visible rows disappear entirely.
    expect(screen.getByText('Goals')).toBeTruthy();
    expect(screen.queryByText('Tasks')).toBeNull();
    expect(screen.queryByText('Ideas')).toBeNull();
  });

  it('pin persists the pin and flips the row to a disabled Pinned without refetching', async () => {
    const now = new Date();
    const ctx = makeServices();
    await seedCandidates(ctx, now);
    const listSpy = jest.spyOn(ctx.services.pinCandidates, 'list');

    renderPinPage(ctx.services);

    await screen.findByTestId('pin-task-t1');
    expect(listSpy).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('pin-task-t1'));

    await waitFor(() => expect(screen.getByTestId('pin-task-t1')).toBeDisabled());
    expect(within(screen.getByTestId('pin-task-t1')).getByText('Pinned')).toBeTruthy();
    // The pin went through the real AttentionService into the fake repository…
    expect(
      ctx.attentionEntries.items.some(
        (entry) => entry.kind === 'pin' && entry.targetType === 'task' && entry.targetId === 't1',
      ),
    ).toBe(true);
    // …and the row flipped from local state: no second list() call.
    expect(listSpy).toHaveBeenCalledTimes(1);
  });
});
