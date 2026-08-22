import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { makeFakeRepos } from '../../../application/__tests__/fakes';
import { AttentionService } from '../../../application/attention/AttentionService';
import { DashboardService } from '../../../application/dashboard/DashboardService';
import { GoalDetailService } from '../../../application/goal/GoalDetailService';
import { GoalsOverviewService } from '../../../application/goal/GoalsOverviewService';
import { SelectCurrentPlanService } from '../../../application/goal/SelectCurrentPlanService';
import { LibraryOverviewService } from '../../../application/library/LibraryOverviewService';
import { CreateGoalProjectService } from '../../../application/project/CreateGoalProjectService';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import { appDestinations } from '../../appDestinations';
import { NavigationShell } from '../../navigation/NavigationShell';
import { AppServicesProvider, type AppServices } from '../AppServicesProvider';

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
    createGoalProject: new CreateGoalProjectService(
      goals, projects, records, relations, transactionRunner,
    ),
    selectCurrentPlan: new SelectCurrentPlanService(
      goals, projects, records, relations, transactionRunner,
    ),
    libraryOverview: new LibraryOverviewService(
      goals, tasks, projects, ideas, notes, resources,
    ),
  } as unknown as AppServices;
  return { services, goals, projects };
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
});
