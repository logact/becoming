import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { GoalDetailView } from '../../../../application/goal/GoalDetailService';
import type { SelectCurrentPlanCommand } from '../../../../application/goal/SelectCurrentPlanService';
import type { CreateGoalProjectCommand } from '../../../../application/project/CreateGoalProjectService';
import { Goal } from '../../../../domain/goal/Goal';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { GoalDetailPage } from '../GoalDetailPage';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactForMock = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactForMock.createElement('NativeDateTimePicker', props),
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

const HOUR = 60 * 60 * 1000;

function dateEvent() {
  return { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } };
}

function renderDetail(initialView: GoalDetailView, goalId = 'g-run') {
  let view = initialView;
  const detail = { getDetail: jest.fn(async (_id: string) => view) };
  const createProject = { create: jest.fn(async (_command: CreateGoalProjectCommand) => undefined) };
  const selectCurrentPlan = { select: jest.fn(async (_command: SelectCurrentPlanCommand) => undefined) };
  const destinations: ShellDestination[] = [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => (
        <GoalDetailPage
          goalId={goalId}
          detail={detail}
          createProject={createProject}
          selectCurrentPlan={selectCurrentPlan}
        />
      ),
      renderScreen: (id) => <Text testID={`route-${id}`}>{id}</Text>,
    },
  ];
  render(<NavigationShell destinations={destinations} />);
  return {
    detail,
    createProject,
    selectCurrentPlan,
    setView: (next: GoalDetailView) => { view = next; },
  };
}

function detailFixture(now: Date): GoalDetailView {
  return {
    goal: Goal.restore({
      id: 'g-run',
      title: 'Run a half marathon',
      status: 'doing',
      archived: false,
      labelIds: ['l-health'],
      due: new Date(2026, 8, 20),
      createdAt: now,
      updatedAt: now,
    }),
    projects: [
      {
        id: 'p-active', name: 'Spring training plan', status: 'active', subGoalCount: 3,
        canSelectAsCurrentPlan: false,
      },
      {
        id: 'p-alt', name: 'Off-season base building', status: 'planning', subGoalCount: 2,
        canSelectAsCurrentPlan: true,
      },
    ],
    activeProjectId: 'p-active',
    recentActivity: [
      {
        id: 'rec-1', kind: 'taskCompleted', detail: 'Completed "Long run 14 km"',
        occurredAt: new Date(now.getTime() - 2 * HOUR),
      },
    ],
  };
}

describe('GoalDetailPage', () => {
  it('renders detail, current plan, activity, and both management entries', async () => {
    const now = new Date();
    const { detail } = renderDetail(detailFixture(now));

    const header = within(await screen.findByTestId('goal-detail-header'));
    expect(header.getByText('Run a half marathon')).toBeTruthy();
    expect(header.getByText('Doing')).toBeTruthy();
    expect(header.getByText(/^Target /)).toBeTruthy();
    expect(header.getByText('l-health')).toBeTruthy();
    expect(header.getByText('1 / 2')).toBeTruthy();

    const projects = within(screen.getByTestId('projects-section'));
    expect(projects.getByText('Spring training plan')).toBeTruthy();
    expect(projects.getByTestId('current-plan-p-active')).toBeTruthy();
    expect(projects.queryByTestId('current-plan-p-alt')).toBeNull();
    expect(projects.getByTestId('new-goal-project')).toBeTruthy();
    expect(projects.getByTestId('choose-current-plan')).toBeTruthy();

    const activity = within(screen.getByTestId('activity-section'));
    expect(activity.getByText('Completed "Long run 14 km"')).toBeTruthy();
    expect(activity.getByText('2 h')).toBeTruthy();
    expect(detail.getDetail).toHaveBeenCalledWith('g-run');
  });

  it('keeps New project visible in an empty Projects section and hides Choose current plan', async () => {
    const fixture = detailFixture(new Date());
    renderDetail({ ...fixture, projects: [], activeProjectId: null });

    await screen.findByText('No project yet.');
    expect(screen.getByTestId('new-goal-project')).toBeTruthy();
    expect(screen.queryByTestId('choose-current-plan')).toBeNull();
  });

  it('creates through the native bounded due picker, closes, refreshes, and displays the Project', async () => {
    const fixture = detailFixture(new Date());
    const harness = renderDetail(fixture);
    harness.createProject.create.mockImplementation(async (command) => {
      harness.setView({
        ...fixture,
        projects: [
          ...fixture.projects,
          {
            id: command.projectId,
            name: command.name,
            status: 'planning',
            subGoalCount: 0,
            canSelectAsCurrentPlan: true,
          },
        ],
      });
    });

    fireEvent.press(await screen.findByTestId('new-goal-project'));
    fireEvent.changeText(screen.getByTestId('goal-project-name'), 'Summer build');
    fireEvent.press(screen.getByTestId('goal-project-due-open'));
    const picker = screen.getByTestId('goal-project-due-native');
    expect(picker.props.maximumDate).toEqual(new Date(2026, 8, 19));
    fireEvent(picker, 'change', dateEvent(), new Date(2026, 8, 18, 18));
    fireEvent.press(screen.getByTestId('goal-project-due-done'));
    fireEvent.press(screen.getByTestId('goal-project-submit'));

    await waitFor(() => expect(harness.createProject.create).toHaveBeenCalledTimes(1));
    expect(harness.createProject.create).toHaveBeenCalledWith(expect.objectContaining({
      goalId: 'g-run', name: 'Summer build', due: new Date(2026, 8, 18),
      projectId: expect.any(String), recordId: expect.any(String),
      goalRecordRelationId: expect.any(String), projectRecordRelationId: expect.any(String),
      now: expect.any(Date),
    }));
    expect(await screen.findByText('Summer build')).toBeTruthy();
    expect(screen.queryByTestId('create-goal-project-sheet')).toBeNull();
    expect(harness.detail.getDetail).toHaveBeenCalledTimes(2);
  });

  it('validates the required name and strict Goal due boundary before invoking the service', async () => {
    const harness = renderDetail(detailFixture(new Date()));
    fireEvent.press(await screen.findByTestId('new-goal-project'));
    fireEvent.press(screen.getByTestId('goal-project-submit'));
    expect(screen.getByText('Project name is required.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('goal-project-name'), 'Boundary plan');
    fireEvent.press(screen.getByTestId('goal-project-due-open'));
    fireEvent(screen.getByTestId('goal-project-due-native'), 'change', dateEvent(), new Date(2026, 8, 20));
    fireEvent.press(screen.getByTestId('goal-project-due-done'));
    fireEvent.press(screen.getByTestId('goal-project-submit'));

    expect(screen.getByText('Project due date must be earlier than the Goal due date.')).toBeTruthy();
    expect(harness.createProject.create).not.toHaveBeenCalled();
  });

  it('shows service errors without clearing the entered name or due date', async () => {
    const harness = renderDetail(detailFixture(new Date()));
    harness.createProject.create.mockRejectedValueOnce(new Error('Project could not be saved'));
    fireEvent.press(await screen.findByTestId('new-goal-project'));
    fireEvent.changeText(screen.getByTestId('goal-project-name'), 'Keep this value');
    fireEvent.press(screen.getByTestId('goal-project-due-open'));
    fireEvent(screen.getByTestId('goal-project-due-native'), 'change', dateEvent(), new Date(2026, 8, 18));
    fireEvent.press(screen.getByTestId('goal-project-due-done'));
    fireEvent.press(screen.getByTestId('goal-project-submit'));

    expect(await screen.findByText('Project could not be saved')).toBeTruthy();
    expect(screen.getByTestId('goal-project-name').props.value).toBe('Keep this value');
    expect(screen.getByTestId('goal-project-due-value').props.children).not.toBe('Select date');
  });

  it('offers only active, planning, and paused Projects and disables the selected plan', async () => {
    const fixture = detailFixture(new Date());
    fixture.projects.push(
      { id: 'p-paused', name: 'Paused option', status: 'paused', subGoalCount: 0, canSelectAsCurrentPlan: true },
      { id: 'p-done', name: 'Finished option', status: 'done', subGoalCount: 0, canSelectAsCurrentPlan: false },
      { id: 'p-failed', name: 'Failed option', status: 'failed', subGoalCount: 0, canSelectAsCurrentPlan: false },
    );
    const harness = renderDetail(fixture);
    fireEvent.press(await screen.findByTestId('choose-current-plan'));

    expect(screen.getByTestId('current-plan-option-p-active').props.accessibilityState).toEqual({
      selected: true, disabled: true,
    });
    expect(screen.getByTestId('current-plan-option-p-alt')).toBeTruthy();
    expect(screen.getByTestId('current-plan-option-p-paused')).toBeTruthy();
    expect(screen.queryByTestId('current-plan-option-p-done')).toBeNull();
    expect(screen.queryByTestId('current-plan-option-p-failed')).toBeNull();
    fireEvent.press(screen.getByTestId('current-plan-option-p-active'));
    expect(harness.selectCurrentPlan.select).not.toHaveBeenCalled();
  });

  it('immediately selects the first plan, refreshes, and displays its Current plan marker', async () => {
    const fixture = detailFixture(new Date());
    const noActive: GoalDetailView = {
      ...fixture,
      activeProjectId: null,
      projects: fixture.projects.map((project) => ({
        ...project,
        status: project.id === 'p-active' ? 'paused' : project.status,
        canSelectAsCurrentPlan: true,
      })),
    };
    const harness = renderDetail(noActive);
    harness.selectCurrentPlan.select.mockImplementation(async (command) => {
      harness.setView({
        ...noActive,
        activeProjectId: command.selectedProjectId,
        projects: noActive.projects.map((project) => project.id === command.selectedProjectId
          ? { ...project, status: 'active', canSelectAsCurrentPlan: false }
          : project),
      });
    });

    fireEvent.press(await screen.findByTestId('choose-current-plan'));
    fireEvent.press(screen.getByTestId('current-plan-option-p-alt'));

    await waitFor(() => expect(harness.selectCurrentPlan.select).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: 'g-run', selectedProjectId: 'p-alt' }),
    ));
    expect(screen.queryByTestId('replace-current-plan-confirmation')).toBeNull();
    expect(await screen.findByTestId('current-plan-p-alt')).toBeTruthy();
    expect(screen.queryByTestId('current-plan-picker')).toBeNull();
  });

  it('requires confirmation before replacing an active plan and refreshes the marker', async () => {
    const fixture = detailFixture(new Date());
    const harness = renderDetail(fixture);
    harness.selectCurrentPlan.select.mockImplementation(async () => {
      harness.setView({
        ...fixture,
        activeProjectId: 'p-alt',
        projects: fixture.projects.map((project) => project.id === 'p-alt'
          ? { ...project, status: 'active', canSelectAsCurrentPlan: false }
          : { ...project, status: 'paused', canSelectAsCurrentPlan: true }),
      });
    });

    fireEvent.press(await screen.findByTestId('choose-current-plan'));
    fireEvent.press(screen.getByTestId('current-plan-option-p-alt'));
    expect(screen.getByTestId('replace-current-plan-confirmation')).toBeTruthy();
    expect(screen.getByText('Choosing Off-season base building will pause Spring training plan.')).toBeTruthy();
    expect(harness.selectCurrentPlan.select).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('replace-current-plan-confirm'));
    await waitFor(() => expect(harness.selectCurrentPlan.select).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('current-plan-p-alt')).toBeTruthy();
    expect(screen.queryByTestId('current-plan-p-active')).toBeNull();
  });

  it('preserves Project-row navigation', async () => {
    renderDetail(detailFixture(new Date()));
    fireEvent.press(await screen.findByTestId('project-row-p-alt'));
    expect(screen.getByTestId('route-project:p-alt')).toBeTruthy();
  });

  it('renders Unknown goal when the read service returns null', async () => {
    const unknown = detailFixture(new Date());
    renderDetail({ ...unknown, goal: null }, 'g-missing');
    expect(await screen.findByText('Unknown goal.')).toBeTruthy();
    expect(screen.queryByTestId('goal-detail-header')).toBeNull();
  });

  it('surfaces an initial read error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const detail = { getDetail: jest.fn(async () => { throw new Error('offline'); }) };
    const destinations: ShellDestination[] = [{
      id: 'library', title: 'Library', icon: 'folder',
      renderList: () => (
        <GoalDetailPage
          goalId="g-run"
          detail={detail}
          createProject={{ create: jest.fn() }}
          selectCurrentPlan={{ select: jest.fn() }}
        />
      ),
    }];
    render(<NavigationShell destinations={destinations} />);
    expect(await screen.findByText('Could not load the goal: offline')).toBeTruthy();
    consoleError.mockRestore();
  });
});
