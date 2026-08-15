import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { NavigationShell, useShellNavigation } from '../src/ui/navigation/NavigationShell';
import type { ShellDestination } from '../src/ui/navigation/NavigationShell';

function GoalsList() {
  const navigation = useShellNavigation();
  return (
    <View>
      <Text>Goals list</Text>
      <Pressable onPress={() => navigation.openDetail('goal-1')}>
        <Text>Open detail</Text>
      </Pressable>
      <Pressable onPress={() => navigation.presentSheet(<DemoSheet />)}>
        <Text>Open sheet</Text>
      </Pressable>
    </View>
  );
}

function GoalDetail({ entityId }: { entityId: string }) {
  const navigation = useShellNavigation();
  return (
    <View>
      <Text>Goal detail {entityId}</Text>
      <Pressable onPress={navigation.goBack}>
        <Text>Back</Text>
      </Pressable>
    </View>
  );
}

function DemoSheet() {
  const navigation = useShellNavigation();
  return (
    <View>
      <Text>Sheet content</Text>
      <Pressable onPress={navigation.dismissSheet}>
        <Text>Dismiss sheet</Text>
      </Pressable>
    </View>
  );
}

function destinations(): ShellDestination[] {
  return [
    {
      id: 'goals',
      title: 'Goals',
      icon: '◎',
      renderList: () => <GoalsList />,
      renderDetail: (entityId) => <GoalDetail entityId={entityId} />,
    },
    { id: 'projects', title: 'Projects', icon: '▦', renderList: () => <Text>Projects list</Text> },
    { id: 'tasks', title: 'Tasks', icon: '✓', renderList: () => <Text>Tasks list</Text> },
  ];
}

describe('NavigationShell', () => {
  it('renders the three top-level destinations and starts on the Goals list', () => {
    render(<NavigationShell destinations={destinations()} />);
    expect(screen.getByLabelText('Goals tab')).toBeTruthy();
    expect(screen.getByLabelText('Projects tab')).toBeTruthy();
    expect(screen.getByLabelText('Tasks tab')).toBeTruthy();
    expect(screen.getByText('Goals list')).toBeTruthy();
  });

  it('switches destinations from the tab bar and keeps per-destination stacks', () => {
    render(<NavigationShell destinations={destinations()} />);
    fireEvent.press(screen.getByText('Open detail'));
    expect(screen.getByText('Goal detail goal-1')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Tasks tab'));
    expect(screen.getByText('Tasks list')).toBeTruthy();
    expect(screen.queryByText('Goal detail goal-1')).toBeNull();

    fireEvent.press(screen.getByLabelText('Projects tab'));
    expect(screen.getByText('Projects list')).toBeTruthy();

    // Returning to Goals restores its own stack (still on the detail route).
    fireEvent.press(screen.getByLabelText('Goals tab'));
    expect(screen.getByText('Goal detail goal-1')).toBeTruthy();
  });

  it('navigates list -> detail and back within a destination', () => {
    render(<NavigationShell destinations={destinations()} />);
    fireEvent.press(screen.getByText('Open detail'));
    expect(screen.getByText('Goal detail goal-1')).toBeTruthy();
    expect(screen.queryByText('Goals list')).toBeNull();

    fireEvent.press(screen.getByText('Back'));
    expect(screen.getByText('Goals list')).toBeTruthy();
    expect(screen.queryByText('Goal detail goal-1')).toBeNull();
  });

  it('presents and dismisses a sheet above the current screen', () => {
    render(<NavigationShell destinations={destinations()} />);
    fireEvent.press(screen.getByText('Open sheet'));
    expect(screen.getByText('Sheet content')).toBeTruthy();
    expect(screen.getByText('Goals list')).toBeTruthy();

    fireEvent.press(screen.getByText('Dismiss sheet'));
    expect(screen.queryByText('Sheet content')).toBeNull();
  });
});
