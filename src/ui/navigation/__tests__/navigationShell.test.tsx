import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { NavigationShell, useShellNavigation, type ShellDestination } from '../NavigationShell';

function FakeList({ id }: { id: string }) {
  const navigation = useShellNavigation();
  return (
    <View>
      <Text testID={`${id}-list`}>{`${id} list`}</Text>
      <Pressable testID={`${id}-push`} onPress={() => navigation.pushScreen('x')} />
    </View>
  );
}

function FakeScreen({ id }: { id: string }) {
  const navigation = useShellNavigation();
  return (
    <View>
      <Text testID={`${id}-screen-x`}>{`${id} screen x`}</Text>
      <Pressable testID={`${id}-back`} onPress={() => navigation.goBack()} />
    </View>
  );
}

function fakeDestinations(): ShellDestination[] {
  return (['dash', 'lib', 'set'] as const).map((id) => ({
    id,
    title: { dash: 'Dashboard', lib: 'Library', set: 'Setting' }[id],
    icon: ({ dash: 'grid', lib: 'folder', set: 'gear' } as const)[id],
    renderList: () => <FakeList id={id} />,
    renderScreen: () => <FakeScreen id={id} />,
  }));
}

describe('NavigationShell', () => {
  it('renders all three tab labels and switches screens on tap', () => {
    render(<NavigationShell destinations={fakeDestinations()} />);

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Library')).toBeTruthy();
    expect(screen.getByText('Setting')).toBeTruthy();

    expect(screen.getByTestId('dash-list')).toBeTruthy();

    fireEvent.press(screen.getByText('Library'));
    expect(screen.getByTestId('lib-list')).toBeTruthy();
    // Inactive destinations unmount entirely.
    expect(screen.queryByTestId('dash-list')).toBeNull();

    fireEvent.press(screen.getByText('Setting'));
    expect(screen.getByTestId('set-list')).toBeTruthy();
    expect(screen.queryByTestId('lib-list')).toBeNull();
  });

  it('pushScreen renders the pushed screen and hides the tab bar', () => {
    render(<NavigationShell destinations={fakeDestinations()} />);

    expect(screen.getByTestId('tab-bar')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dash-push'));
    expect(screen.getByTestId('dash-screen-x')).toBeTruthy();
    expect(screen.queryByTestId('dash-list')).toBeNull();
    // Pushed screens hide the tab bar.
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('goBack pops back to the list and the tab bar returns', () => {
    render(<NavigationShell destinations={fakeDestinations()} />);

    fireEvent.press(screen.getByTestId('dash-push'));
    expect(screen.getByTestId('dash-screen-x')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dash-back'));
    expect(screen.getByTestId('dash-list')).toBeTruthy();
    expect(screen.queryByTestId('dash-screen-x')).toBeNull();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });
});
