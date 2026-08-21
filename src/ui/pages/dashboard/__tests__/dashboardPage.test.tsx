import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import { makeFakeRepos } from '../../../../application/__tests__/fakes';
import { AttentionService } from '../../../../application/attention/AttentionService';
import { PinCandidatesService } from '../../../../application/attention/PinCandidatesService';
import { DashboardService } from '../../../../application/dashboard/DashboardService';
import { GoalDetailService } from '../../../../application/goal/GoalDetailService';
import { GoalsOverviewService } from '../../../../application/goal/GoalsOverviewService';
import { LibraryOverviewService } from '../../../../application/library/LibraryOverviewService';
import { AddMilestoneService } from '../../../../application/project/AddMilestoneService';
import { AddSubGoalService } from '../../../../application/project/AddSubGoalService';
import { AddTaskService } from '../../../../application/project/AddTaskService';
import { ProjectDetailService } from '../../../../application/project/ProjectDetailService';
import { ProjectsOverviewService } from '../../../../application/project/ProjectsOverviewService';
import { AllocateResourceService } from '../../../../application/resource/AllocateResourceService';
import { ResourcePoolsService } from '../../../../application/resource/ResourcePoolsService';
import { Goal } from '../../../../domain/goal/Goal';
import { Idea } from '../../../../domain/idea/Idea';
import { Record as DomainRecord } from '../../../../domain/record/Record';
import { Task } from '../../../../domain/task/Task';
import { appDestinations } from '../../../appDestinations';
import { AppServicesProvider, type AppServices } from '../../../composition/AppServicesProvider';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { DashboardPage } from '../DashboardPage';

const MINUTE = 60 * 1000;

/**
 * Real application services over isolated in-memory SQLite repositories, so the
 * pages under test exercise the same read models the app composes.
 */
async function makeServices() {
  const {
    goalRepo: goals,
    taskRepo: tasks,
    ideaRepo: ideas,
    projectRepo: projects,
    resourceRepo: resources,
    relationRepo: relations,
    recordRepo: records,
    attentionEntryRepo: attentionEntries,
    labelRepo: labels,
    milestoneRepo: milestones,
  } = await makeFakeRepos();
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
    goalsOverview: new GoalsOverviewService(goals, labels),
    goalDetail: new GoalDetailService(goals, projects, records),
    projectsOverview: new ProjectsOverviewService(projects, goals, labels),
    projectDetail: new ProjectDetailService(projects, goals, tasks, resources, records),
    libraryOverview: new LibraryOverviewService(goals, tasks, projects, ideas, resources),
    addSubGoal: new AddSubGoalService(projects, goals),
    addTask: new AddTaskService(projects, goals, tasks, records, relations),
    addMilestone: new AddMilestoneService(projects, milestones),
    allocateResource: new AllocateResourceService(resources),
    resourcePools: new ResourcePoolsService(resources),
  };
  return { services, goals, tasks, ideas, records, attentionEntries };
}

function dashboardDestinations(): ShellDestination[] {
  return [
    { id: 'dashboard', title: 'Dashboard', icon: 'grid', renderList: () => <DashboardPage /> },
  ];
}

function renderShell(services: AppServices, destinations: ShellDestination[]) {
  return render(
    <AppServicesProvider services={services}>
      <NavigationShell destinations={destinations} />
    </AppServicesProvider>,
  );
}

function doingGoal(id: string, title: string, now: Date): Goal {
  const goal = Goal.create({ id, title, now });
  goal.start(now);
  return goal;
}

function doingTask(id: string, title: string, now: Date): Task {
  const task = Task.create({ id, title, projectId: 'p1', now });
  task.start(now);
  return task;
}

function failedGoal(id: string, title: string, now: Date): Goal {
  const goal = doingGoal(id, title, now);
  goal.fail(now);
  return goal;
}

describe('DashboardPage', () => {
  it('renders stats, section headers, doing rows, an attention row, and recent activity', async () => {
    const now = new Date();
    // One minute after local midnight: always inside "today", never crossing
    // a calendar-day boundary regardless of when the test runs.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1);
    const ctx = await makeServices();

    await ctx.goals.save(doingGoal('g-doing', 'Write the report', now));
    await ctx.tasks.save(doingTask('t-doing', 'Buy groceries', now));
    await ctx.ideas.save(Idea.create({ id: 'i-idea', content: 'A wild idea', now }));
    const done = doingTask('t-done', 'Morning run', now);
    done.complete(now);
    await ctx.tasks.save(done);
    await ctx.goals.save(failedGoal('g-failed', 'Ship v2', now));
    // Due earlier today: counts for Due today and also surfaces as overdue.
    await ctx.goals.save(Goal.create({ id: 'g-due', title: 'File taxes', due: startOfToday, now }));
    await ctx.records.append(
      DomainRecord.create({
        id: 'rec-1',
        kind: 'taskCompleted',
        detail: 'Finished chapter 3',
        occurredAt: new Date(now.getTime() - 30 * MINUTE),
      }),
    );

    renderShell(ctx.services, dashboardDestinations());

    // Stats row: 3 doing, 1 done today, 1 due today.
    const stats = within(await screen.findByTestId('stats-row'));
    expect(stats.getByText('3')).toBeTruthy();
    expect(stats.getAllByText('1')).toHaveLength(2);
    expect(stats.getByText('Doing now')).toBeTruthy();
    expect(stats.getByText('Done today')).toBeTruthy();
    expect(stats.getByText('Due today')).toBeTruthy();

    const doing = within(screen.getByTestId('doing-section'));
    expect(doing.getByText('Doing now')).toBeTruthy();
    expect(doing.getByText('Write the report')).toBeTruthy();
    expect(doing.getByText('Buy groceries')).toBeTruthy();
    expect(doing.getByText('A wild idea')).toBeTruthy();

    const attention = within(screen.getByTestId('attention-section'));
    expect(attention.getByText('Needs attention')).toBeTruthy();
    expect(attention.getByText('Ship v2')).toBeTruthy();
    expect(attention.getByText('Goal · Failed')).toBeTruthy();
    expect(attention.getByText('File taxes')).toBeTruthy();

    const activity = within(screen.getByTestId('activity-section'));
    expect(activity.getByText('Recent activity')).toBeTruthy();
    expect(activity.getByText('Finished chapter 3')).toBeTruthy();
    expect(activity.getByText('30 min')).toBeTruthy();
  });

  it('removes an attention item and persists the dismissal', async () => {
    const now = new Date();
    const ctx = await makeServices();
    await ctx.goals.save(failedGoal('g-failed', 'Ship v2', now));

    renderShell(ctx.services, dashboardDestinations());

    expect(await screen.findByText('Ship v2')).toBeTruthy();

    fireEvent.press(screen.getByTestId('attention-remove-goal-g-failed'));

    // The page dismisses via the real AttentionService, then refetches.
    await waitFor(() => expect(screen.queryByText('Ship v2')).toBeNull());
    expect(
      (await ctx.attentionEntries.list()).some(
        (entry) =>
          entry.kind === 'dismiss' && entry.targetType === 'goal' && entry.targetId === 'g-failed',
      ),
    ).toBe(true);
  });

  it('pins a goal through the pushed attention-pin screen and shows it after going back', async () => {
    const now = new Date();
    const ctx = await makeServices();
    await ctx.goals.save(Goal.create({ id: 'g1', title: 'Learn piano', now }));

    renderShell(ctx.services, appDestinations());

    // A plain todo goal is not in Needs attention yet.
    await screen.findByTestId('attention-section');
    expect(screen.queryByText('Learn piano')).toBeNull();

    fireEvent.press(screen.getByTestId('pin-an-item'));

    // The pushed screen replaces the tab content and hides the tab bar.
    await screen.findByTestId('attention-pin-page');
    expect(screen.queryByTestId('tab-bar')).toBeNull();

    fireEvent.press(await screen.findByTestId('pin-goal-g1'));
    await waitFor(() => expect(screen.getByTestId('pin-goal-g1')).toBeDisabled());

    fireEvent.press(screen.getByLabelText('Back'));

    // The dashboard remounts, refetches, and shows the pinned goal.
    expect(await screen.findByText('Goal · Pinned')).toBeTruthy();
    const attention = within(screen.getByTestId('attention-section'));
    expect(attention.getByText('Learn piano')).toBeTruthy();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });
});
