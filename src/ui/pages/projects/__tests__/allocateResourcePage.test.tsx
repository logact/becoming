import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import type { ProjectDetailView } from '../../../../application/project/ProjectDetailService';
import type { AllocateResourceService } from '../../../../application/resource/AllocateResourceService';
import type { ResourcePoolItem } from '../../../../application/resource/ResourcePoolsService';
import { Project } from '../../../../domain/project/Project';
import { NavigationShell, useShellNavigation, type ShellDestination } from '../../../navigation/NavigationShell';
import { AllocateResourcePage } from '../AllocateResourcePage';

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

type AllocateParams = Parameters<AllocateResourceService['allocate']>[0];

const POOLS: ResourcePoolItem[] = [
  { id: 'r1', name: 'Time budget', kind: 'time', amount: 720, available: 240 },
  { id: 'r2', name: 'Gear budget', kind: 'quantity', amount: 5000, available: 2000 },
];

function detailView(): ProjectDetailView {
  const now = new Date();
  return {
    project: Project.create({ id: 'p1', name: 'Spring training plan', goalId: 'g1', now }),
    plan: null,
    progress: null,
    weeks: null,
    milestones: [],
    tasks: [],
    resources: [],
    recentActivity: [],
  };
}

function renderPage() {
  const detail = { getDetail: jest.fn(async (_id: string) => detailView()) };
  const resourcePools = { list: jest.fn(async () => POOLS) };
  const allocateCalls: AllocateParams[] = [];
  const allocateResource = {
    allocate: jest.fn(async (params: AllocateParams) => {
      allocateCalls.push(params);
    }),
  };

  /** Tappable list root that pushes the page, so submit's goBack pops back. */
  function Launcher() {
    const navigation = useShellNavigation();
    return <Text testID="list" onPress={() => navigation.pushScreen('allocate-resource')} />;
  }

  const destinations: ShellDestination[] = [
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <Launcher />,
      renderScreen: (screenId) =>
        screenId === 'allocate-resource' ? (
          <AllocateResourcePage
            projectId="p1"
            detail={detail}
            resourcePools={resourcePools}
            allocateResource={allocateResource}
          />
        ) : null,
    },
  ];
  render(<NavigationShell destinations={destinations} />);
  fireEvent.press(screen.getByTestId('list'));
  return { detail, resourcePools, allocateResource, allocateCalls };
}

describe('AllocateResourcePage', () => {
  it('shows the target project row and the pools with available amounts', async () => {
    renderPage();

    const target = within(await screen.findByTestId('allocate-target'));
    expect(target.getByText('Spring training plan')).toBeTruthy();
    expect(target.getByText('Allocating to this project')).toBeTruthy();
    expect(screen.getByText('Time · 4 h of 12 h available in pool')).toBeTruthy();
    expect(screen.getByText('Quantity · 2000 of 5000 available in pool')).toBeTruthy();
  });

  it('allocates an amount of a quantity pool and pops back', async () => {
    const { allocateCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('pool-r2'));
    // The amount editor shows the ≤ available hint.
    expect(screen.getByTestId('allocate-amount-section')).toBeTruthy();
    expect(screen.getByText('≤ 2000')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('allocate-amount'), '500');
    fireEvent.press(screen.getByTestId('allocate-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    expect(allocateCalls).toHaveLength(1);
    const params = allocateCalls[0];
    expect(params.resourceId).toBe('r2');
    expect(params.projectId).toBe('p1');
    expect(params.amount).toBe(500);
    expect(params.span).toBeUndefined();
    expect(typeof params.allocationId).toBe('string');
    expect(params.now).toBeInstanceOf(Date);
  });

  it('allocates a span of a time pool', async () => {
    const { allocateCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('pool-r1'));
    expect(screen.getByTestId('allocate-span-section')).toBeTruthy();
    selectPicker('allocate-start', new Date(2026, 8, 6, 7, 0, 42));
    selectPicker('allocate-end', new Date(2026, 8, 6, 9, 0, 57));
    fireEvent.press(screen.getByTestId('allocate-submit'));

    expect(await screen.findByTestId('list')).toBeTruthy();
    const params = allocateCalls[0];
    expect(params.resourceId).toBe('r1');
    expect(params.amount).toBeUndefined();
    expect(params.span?.startAt.getTime()).toBe(new Date(2026, 8, 6, 7, 0).getTime());
    expect(params.span?.endAt.getTime()).toBe(new Date(2026, 8, 6, 9, 0).getTime());
  });

  it('rejects an amount beyond the available pool inline', async () => {
    const { allocateCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('pool-r2'));
    fireEvent.changeText(screen.getByTestId('allocate-amount'), '3000');
    fireEvent.press(screen.getByTestId('allocate-submit'));

    expect(await screen.findByTestId('allocate-error')).toHaveTextContent(
      'Amount must be ≤ 2000.',
    );
    expect(allocateCalls).toHaveLength(0);
  });

  it('keeps Cancel lossless and requires both optional span endpoints', async () => {
    const { allocateCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('pool-r1'));
    selectPicker('allocate-start', new Date(2026, 8, 6, 7));
    fireEvent.press(screen.getByTestId('allocate-end-open'));
    fireEvent(
      screen.getByTestId('allocate-end-native'),
      'change',
      dateEvent(),
      new Date(2026, 8, 6, 9),
    );
    fireEvent.press(screen.getByTestId('allocate-end-cancel'));
    fireEvent.press(screen.getByTestId('allocate-submit'));

    expect(await screen.findByTestId('allocate-error')).toHaveTextContent(
      'Choose both a start and end.',
    );
    expect(allocateCalls).toHaveLength(0);
  });

  it('allows explicit endpoint clearing and preserves strict start-before-end validation', async () => {
    const { allocateCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('pool-r1'));
    selectPicker('allocate-start', new Date(2026, 8, 6, 9));
    selectPicker('allocate-end', new Date(2026, 8, 6, 7));
    fireEvent.press(screen.getByTestId('allocate-submit'));

    expect(await screen.findByTestId('allocate-error')).toHaveTextContent(
      'Start must be earlier than end.',
    );
    expect(allocateCalls).toHaveLength(0);

    fireEvent.press(screen.getByTestId('allocate-end-clear'));
    fireEvent.press(screen.getByTestId('allocate-submit'));
    expect(await screen.findByTestId('allocate-error')).toHaveTextContent(
      'Choose both a start and end.',
    );
  });

  it('requires a selected resource before submitting', async () => {
    const { allocateCalls } = renderPage();

    fireEvent.press(await screen.findByTestId('allocate-submit'));

    expect(await screen.findByTestId('allocate-error')).toHaveTextContent(
      'Choose a resource first.',
    );
    expect(allocateCalls).toHaveLength(0);
  });
});
