import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EntityListScaffold } from '../src/ui/shared/EntityListScaffold';
import type { EntityListScaffoldProps } from '../src/ui/shared/EntityListScaffold';

interface Row {
  id: string;
  title: string;
}

function props(overrides: Partial<EntityListScaffoldProps<Row>> = {}): EntityListScaffoldProps<Row> {
  return {
    title: 'Goals',
    heroTitle: 'What do you want to become?',
    heroCopy: 'Define outcomes before choosing the work.',
    searchPlaceholder: 'Search goals',
    status: 'ready',
    items: [],
    keyExtractor: (row) => row.id,
    renderRow: (row) => <Text>{row.title}</Text>,
    filter: 'active',
    onFilterChange: jest.fn(),
    searchQuery: '',
    onSearchChange: jest.fn(),
    emptyTitle: 'No goals yet',
    emptyMessage: 'Define an outcome to get started.',
    createLabel: 'New goal',
    onCreate: jest.fn(),
    ...overrides,
  };
}

describe('EntityListScaffold', () => {
  it('renders populated rows with hero, search, and the active-only create action', () => {
    const onCreate = jest.fn();
    render(
      <EntityListScaffold {...props({ items: [{ id: 'g1', title: 'Run a marathon' }], onCreate })} />,
    );
    expect(screen.getByText('What do you want to become?')).toBeTruthy();
    expect(screen.getByText('Run a marathon')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('New goal'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders the explicit empty state when a ready list has no rows', () => {
    render(<EntityListScaffold {...props()} />);
    expect(screen.getByText('No goals yet')).toBeTruthy();
    expect(screen.getByText('Define an outcome to get started.')).toBeTruthy();
  });

  it('renders the loading state', () => {
    render(<EntityListScaffold {...props({ status: 'loading' })} />);
    expect(screen.getByLabelText('Loading goals')).toBeTruthy();
    expect(screen.queryByLabelText('New goal')).toBeNull();
  });

  it('renders the recoverable error state and retries', () => {
    const onRetry = jest.fn();
    render(
      <EntityListScaffold {...props({ status: 'error', errorMessage: 'The query failed.', onRetry })} />,
    );
    expect(screen.getByText('Goals unavailable')).toBeTruthy();
    expect(screen.getByText('The query failed.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading goals'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the create action on the archived filter', () => {
    render(<EntityListScaffold {...props({ filter: 'archived' })} />);
    expect(screen.queryByLabelText('New goal')).toBeNull();
  });

  it('forwards search input and filter toggle changes', () => {
    const onSearchChange = jest.fn();
    const onFilterChange = jest.fn();
    render(<EntityListScaffold {...props({ onSearchChange, onFilterChange })} />);

    fireEvent.changeText(screen.getByLabelText('Search goals'), 'marathon');
    expect(onSearchChange).toHaveBeenCalledWith('marathon');

    fireEvent.press(screen.getByLabelText('Show archived goals'));
    expect(onFilterChange).toHaveBeenCalledWith('archived');
  });
});
