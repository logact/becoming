import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { ProjectDetailView } from '../../../../application/project/ProjectDetailService';
import type { AddMilestoneService } from '../../../../application/project/AddMilestoneService';
import type { AddSubGoalService } from '../../../../application/project/AddSubGoalService';
import type { AddTaskService } from '../../../../application/project/AddTaskService';
import { Project } from '../../../../domain/project/Project';
import { DomainError } from '../../../../domain/shared/errors';
import { NavigationShell, useShellNavigation, type ShellDestination } from '../../../navigation/NavigationShell';
import { AddPlanItemPage, type AddPlanItemPageProps } from '../AddPlanItemPage';

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

function selectPicker(testID: string, value: Date): void {
  fireEvent.press(screen.getByTestId(testID + '-open'));
  fireEvent(screen.getByTestId(testID + '-native'), 'change', dateEvent(), value);
  fireEvent.press(screen.getByTestId(testID + '-done'));
}

type SubGoalParams = Parameters<AddSubGoalService['add']>[0];
type TaskParams = Parameters<AddTaskService['add']>[0];
type MilestoneParams = Parameters<AddMilestoneService['add']>[0];

function detailView(): ProjectDetailView {
  const now = new Date();
  const project = Project.create({ id: 'p1', name: 'Spring training plan', goalId: 'g1', now });
  return {
    project,
    plan: {
      id: 'g1',
      title: 'Run a half marathon',
      status: 'doing',
      tasks: [],
      children: [
        { id: 'g2', title: '10 km under 50:00', status: 'doing', tasks: [], children: [] },
      ],
    },
    progress: null,
    weeks: null,
    milestones: [
      { id: 'm1', title: 'Race week', date: new Date(2026, 9, 18), reached: false, items: [] },
    ],
    tasks: [],
    resources: [],
    recentActivity: [],
  };
}

function renderPage(pageProps: Pick<AddPlanItemPageProps, 'initialParentGoalId' | 'initialTab'> = {}) {
  const detail = { getDetail: jest.fn(async (_id: string) => detailView()) };
  const subGoalCalls: SubGoalParams[] = [];
  const taskCalls: TaskParams[] = [];
  const milestoneCalls: MilestoneParams[] = [];
  const addSubGoal = {
    add: jest.fn(async (params: SubGoalParams) => {
      subGoalCalls.push(params);
    }),
  };
  const addTask = {
    add: jest.fn(async (params: TaskParams) => {
      taskCalls.push(params);
    }),
  };
  const addMilestone = {
    add: jest.fn(async (params: MilestoneParams) => {
      milestoneCalls.push(params);
    }),
  };

  /** Tappable list root that pushes the page, so submit's goBack pops back. */
  function Launcher() {
    const navigation = useShellNavigation();
    return <Text testID="list" onPress={() => navigation.pushScreen('add-plan-item')} />;
  }

  const destinations: ShellDestination[] = [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <Launcher />,
      renderScreen: (screenId) =>
        screenId === 'add-plan-item' ? (
          <AddPlanItemPage
            projectId="p1"
            detail={detail}
            addSubGoal={addSubGoal}
            addTask={addTask}
            addMilestone={addMilestone}
            {...pageProps}
          />
        ) : null,
    },
  ];
  render(<NavigationShell destinations={destinations} />);
  fireEvent.press(screen.getByTestId('list'));
  return { detail, addSubGoal, addTask, addMilestone, subGoalCalls, taskCalls, milestoneCalls };
}

describe('AddPlanItemPage', () => {
  it('submits a sub-goal with the root goal as default parent and pops back', async () => {
    const { subGoalCalls } = renderPage();

    fireEvent.changeText(await screen.findByTestId('plan-item-title'), '15 km under 75:00');
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    // goBack popped the page.
    expect(await screen.findByTestId('list')).toBeTruthy();
    expect(subGoalCalls).toHaveLength(1);
    const params = subGoalCalls[0];
    expect(params.projectId).toBe('p1');
    expect(params.parentGoalId).toBe('g1');
    expect(params.title).toBe('15 km under 75:00');
    expect(params.due).toBeUndefined();
    expect(params.milestoneId).toBeUndefined();
    expect(typeof params.id).toBe('string');
    expect(params.now).toBeInstanceOf(Date);
  });

  it('preselects the Under picker from the initialParentGoalId prop', async () => {
    const { subGoalCalls } = renderPage({ initialParentGoalId: 'g2' });

    // The picker shows the preselected node instead of the plan root.
    expect(await screen.findByText('10 km under 50:00')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('plan-item-title'), '15 km under 75:00');
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    expect(subGoalCalls[0].parentGoalId).toBe('g2');
  });

  it('preselects the Milestone tab from the initialTab prop', async () => {
    const { milestoneCalls } = renderPage({ initialTab: 'milestone' });

    // The milestone form renders without touching the segmented control.
    fireEvent.changeText(await screen.findByTestId('milestone-name'), 'Race week');
    selectPicker('milestone-date', new Date(2026, 9, 18));
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    expect(milestoneCalls).toHaveLength(1);
  });

  it('picks a parent goal and milestone and passes semantic Start and Due values', async () => {
    const { subGoalCalls } = renderPage();

    fireEvent.changeText(await screen.findByTestId('plan-item-title'), '15 km under 75:00');
    selectPicker('plan-item-start', new Date(2026, 9, 1, 13));
    selectPicker('plan-item-due', new Date(2026, 9, 12, 17));

    fireEvent.press(screen.getByTestId('plan-item-goal'));
    fireEvent.press(await screen.findByTestId('option-g2'));
    // The sheet is dismissed and the picker shows the selection.
    expect(screen.queryByTestId('option-sheet')).toBeNull();
    expect(screen.getByText('10 km under 50:00')).toBeTruthy();

    fireEvent.press(screen.getByTestId('plan-item-milestone'));
    fireEvent.press(await screen.findByTestId('option-m1'));
    expect(screen.getByText('Race week')).toBeTruthy();

    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    const params = subGoalCalls[0];
    expect(params.parentGoalId).toBe('g2');
    expect(params.milestoneId).toBe('m1');
    expect(params.startAt?.getTime()).toBe(new Date(2026, 9, 1).getTime());
    expect(params.due?.getTime()).toBe(new Date(2026, 9, 12).getTime());
  });

  it('lets an optional Due be cleared while preserving Start', async () => {
    const { subGoalCalls } = renderPage();

    fireEvent.changeText(await screen.findByTestId('plan-item-title'), '15 km under 75:00');
    selectPicker('plan-item-start', new Date(2026, 9, 1));
    selectPicker('plan-item-due', new Date(2026, 9, 12));
    fireEvent.press(screen.getByTestId('plan-item-due-clear'));
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    expect(subGoalCalls[0].startAt).toEqual(new Date(2026, 9, 1));
    expect(subGoalCalls[0].due).toBeUndefined();
  });

  it('submits a task on the Task tab with the picked goal', async () => {
    const { taskCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('add-plan-item-segmented-task'));
    fireEvent.changeText(screen.getByTestId('plan-item-title'), 'Cruise intervals 4 × 1600 m');
    fireEvent.press(screen.getByTestId('plan-item-goal'));
    fireEvent.press(await screen.findByTestId('option-g2'));
    selectPicker('plan-item-start', new Date(2026, 8, 5, 12));
    selectPicker('plan-item-due', new Date(2026, 8, 8, 20));
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    const params = taskCalls[0];
    expect(params.goalId).toBe('g2');
    expect(params.title).toBe('Cruise intervals 4 × 1600 m');
    expect(params.startAt).toEqual(new Date(2026, 8, 5));
    expect(params.due).toEqual(new Date(2026, 8, 8));
  });

  it('submits a milestone on the Milestone tab', async () => {
    const { milestoneCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('add-plan-item-segmented-milestone'));
    fireEvent.changeText(screen.getByTestId('milestone-name'), 'Race week');
    expect(screen.queryByTestId('milestone-date-clear')).toBeNull();
    selectPicker('milestone-date', new Date(2026, 9, 18, 15));
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    const params = milestoneCalls[0];
    expect(params.title).toBe('Race week');
    expect(params.date.getTime()).toBe(new Date(2026, 9, 18).getTime());
  });

  it('requires a date on the Milestone tab', async () => {
    const { milestoneCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('add-plan-item-segmented-milestone'));
    fireEvent.changeText(screen.getByTestId('milestone-name'), 'Race week');
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('add-plan-item-error')).toHaveTextContent(
      'Choose a milestone date.',
    );
    expect(milestoneCalls).toHaveLength(0);
  });

  it('shows the service error inline when the command fails', async () => {
    const { addSubGoal } = renderPage();
    addSubGoal.add.mockRejectedValue(new DomainError('Goal title must not be empty'));

    fireEvent.press(await screen.findByTestId('plan-item-title'));
    fireEvent.press(screen.getByTestId('add-plan-item-submit'));

    expect(await screen.findByTestId('add-plan-item-error')).toHaveTextContent(
      'Goal title must not be empty',
    );
    // The page stays on top: no goBack happened.
    expect(screen.queryByTestId('list')).toBeNull();
  });

  it('renders "Unknown project" when the project or plan is missing', async () => {
    const detail = {
      getDetail: jest.fn(async () => ({ ...detailView(), project: null })),
    };
    render(
      <NavigationShell
        destinations={[
          {
            id: 'library',
            title: 'Library',
            icon: 'folder',
            renderList: () => (
              <AddPlanItemPage
                projectId="p-missing"
                detail={detail}
                addSubGoal={{ add: jest.fn() }}
                addTask={{ add: jest.fn() }}
                addMilestone={{ add: jest.fn() }}
              />
            ),
          },
        ]}
      />,
    );

    expect(await screen.findByText('Unknown project.')).toBeTruthy();
  });
});
