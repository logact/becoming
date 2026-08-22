import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { makeFakeRepos } from '../../../application/__tests__/fakes';
import { AttentionService } from '../../../application/attention/AttentionService';
import { DashboardService } from '../../../application/dashboard/DashboardService';
import { GoalDetailService } from '../../../application/goal/GoalDetailService';
import { GoalsOverviewService } from '../../../application/goal/GoalsOverviewService';
import { ScheduleGoalService } from '../../../application/goal/ScheduleGoalService';
import { SelectCurrentPlanService } from '../../../application/goal/SelectCurrentPlanService';
import { LibraryOverviewService } from '../../../application/library/LibraryOverviewService';
import { CreateGoalProjectService } from '../../../application/project/CreateGoalProjectService';
import { ScheduleTaskService } from '../../../application/task/ScheduleTaskService';
import { TaskDetailService } from '../../../application/task/TaskDetailService';
import { TaskLifecycleService } from '../../../application/task/TaskLifecycleService';
import { TasksOverviewService } from '../../../application/task/TasksOverviewService';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { Task } from '../../../domain/task/Task';
import { appDestinations } from '../../appDestinations';
import { NavigationShell } from '../../navigation/NavigationShell';
import { AppServicesProvider, type AppServices } from '../AppServicesProvider';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactForMock = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactForMock.createElement('NativeDateTimePicker', props),
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

function dateEvent() {
  return { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } };
}

async function makeComposition() {
  const repos = await makeFakeRepos();
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
    noteRepo: notes,
    transactionRunner,
  } = repos;
  const services = {
    dashboard: new DashboardService(
      goals, tasks, ideas, projects, resources, relations, records, attentionEntries,
    ),
    attention: new AttentionService(attentionEntries),
    goalsOverview: new GoalsOverviewService(goals, labels),
    goalDetail: new GoalDetailService(goals, projects, records),
    scheduleGoal: new ScheduleGoalService(goals, records, relations, transactionRunner),
    createGoalProject: new CreateGoalProjectService(
      goals, projects, records, relations, transactionRunner,
    ),
    selectCurrentPlan: new SelectCurrentPlanService(
      goals, projects, records, relations, transactionRunner,
    ),
    libraryOverview: new LibraryOverviewService(
      goals, tasks, projects, ideas, notes, resources,
    ),
    tasksOverview: new TasksOverviewService(tasks, projects, labels, records),
    taskDetail: new TaskDetailService(tasks, projects, goals, records),
    taskLifecycle: new TaskLifecycleService(tasks, records, relations),
    scheduleTask: new ScheduleTaskService(tasks, records, relations, transactionRunner),
  } as unknown as AppServices;
  return { services, goals, tasks, projects, records };
}

function renderDestination(services: AppServices, destinationId: 'dashboard' | 'library') {
  const destination = appDestinations().find((item) => item.id === destinationId);
  if (destination === undefined) throw new Error(`Missing ${destinationId} destination`);
  return render(
    <AppServicesProvider services={services}>
      <NavigationShell destinations={[destination]} />
    </AppServicesProvider>,
  );
}

describe('Goal project management composition', () => {
  it('provides working create/select dependencies from both Library and Dashboard Goal routes', async () => {
    const now = new Date('2026-08-22T08:00:00Z');
    const composition = await makeComposition();
    const goal = Goal.create({ id: 'goal-1', title: 'Composed goal', now });
    goal.start(now);
    await composition.goals.save(goal);
    await composition.projects.save(Project.create({
      id: 'project-1', name: 'First plan', goalId: goal.id, now,
    }));

    const libraryRender = renderDestination(composition.services, 'library');
    fireEvent.press(await screen.findByTestId('library-row-goals'));
    fireEvent.press(await screen.findByTestId('goal-row-goal-1'));
    expect(await screen.findByTestId('goal-detail-page')).toBeTruthy();
    fireEvent.press(screen.getByTestId('new-goal-project'));
    fireEvent.changeText(screen.getByTestId('goal-project-name'), 'Second plan');
    fireEvent.press(screen.getByTestId('goal-project-submit'));
    expect(await screen.findByText('Second plan')).toBeTruthy();
    expect((await composition.projects.findById(
      (await composition.projects.list({ goalId: goal.id })).find((item) => item.name === 'Second plan')!.id,
    ))?.status).toBe('planning');
    libraryRender.unmount();

    renderDestination(composition.services, 'dashboard');
    fireEvent.press(await screen.findByTestId('dashboard-doing-goal-goal-1'));
    expect(await screen.findByTestId('goal-detail-page')).toBeTruthy();
    fireEvent.press(screen.getByTestId('choose-current-plan'));
    fireEvent.press(screen.getByTestId('current-plan-option-project-1'));

    expect(await screen.findByTestId('current-plan-project-1')).toBeTruthy();
    await waitFor(async () => {
      expect((await composition.projects.findById('project-1'))?.status).toBe('active');
    });
  });

  it('injects real schedule services into shared Goal and Task detail routes', async () => {
    const now = new Date(2026, 7, 22, 8);
    const composition = await makeComposition();
    const goal = Goal.create({ id: 'goal-schedule', title: 'Schedule goal', now });
    goal.start(now);
    await composition.goals.save(goal);
    await composition.projects.save(Project.create({
      id: 'project-schedule', name: 'Schedule project', goalId: goal.id, now,
    }));
    await composition.tasks.save(Task.create({
      id: 'task-schedule', title: 'Schedule task', projectId: 'project-schedule', now,
    }));

    const dashboardRender = renderDestination(composition.services, 'dashboard');
    fireEvent.press(await screen.findByTestId('dashboard-doing-goal-goal-schedule'));
    fireEvent.press(await screen.findByTestId('goal-schedule-action'));
    fireEvent.press(screen.getByTestId('goal-schedule-editor-start-open'));
    fireEvent(screen.getByTestId('goal-schedule-editor-start-native'), 'change', dateEvent(), new Date(2026, 7, 23, 17));
    fireEvent.press(screen.getByTestId('goal-schedule-editor-start-done'));
    fireEvent.press(screen.getByTestId('goal-schedule-editor-save'));
    await waitFor(async () => {
      expect((await composition.goals.findById('goal-schedule'))?.startAt).toEqual(new Date(2026, 7, 23));
    });
    expect(await screen.findByText('Changed schedule for “Schedule goal”')).toBeTruthy();
    dashboardRender.unmount();

    renderDestination(composition.services, 'library');
    fireEvent.press(await screen.findByTestId('library-row-tasks'));
    fireEvent.press(await screen.findByTestId('task-row-task-schedule'));
    fireEvent.press(await screen.findByTestId('task-schedule-action'));
    fireEvent.press(screen.getByTestId('task-schedule-editor-due-open'));
    fireEvent(screen.getByTestId('task-schedule-editor-due-native'), 'change', dateEvent(), new Date(2026, 7, 25, 17));
    fireEvent.press(screen.getByTestId('task-schedule-editor-due-done'));
    fireEvent.press(screen.getByTestId('task-schedule-editor-save'));
    await waitFor(async () => {
      expect((await composition.tasks.findById('task-schedule'))?.due).toEqual(new Date(2026, 7, 25));
    });
    expect(await screen.findByText('Changed schedule for “Schedule task”')).toBeTruthy();
    expect((await composition.records.listByTarget('goal', 10, 'goal-schedule'))[0]?.kind).toBe('goalScheduleChanged');
    expect((await composition.records.listByTarget('task', 10, 'task-schedule'))[0]?.kind).toBe('taskScheduleChanged');
  });
});
