import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { Icon } from '../Icon';
import { IconChip } from '../IconChip';
import { InlineNavBar } from '../InlineNavBar';
import { ListRow } from '../ListRow';
import { ListSection } from '../ListSection';
import { PrimaryChipButton } from '../PrimaryChipButton';
import { ProgressBar } from '../ProgressBar';
import { SectionHeader } from '../SectionHeader';
import { SegmentedControl } from '../SegmentedControl';
import { SectionNote } from '../SectionNote';
import { StatTile } from '../StatTile';
import { StatusPill } from '../StatusPill';

describe('Icon', () => {
  it.each(['grid', 'gear', 'checkCircle', 'alert', 'list'] as const)(
    'renders the %s glyph',
    (name) => {
      expect(() => render(<Icon name={name} />)).not.toThrow();
      expect(screen.toJSON()).toBeTruthy();
    },
  );
});

describe('StatusPill', () => {
  it('shows its label', () => {
    render(<StatusPill state="doing" label="Doing" />);
    expect(screen.getByText('Doing')).toBeTruthy();
  });
});

describe('ListSection', () => {
  it('renders rows with separators between them', () => {
    render(
      <ListSection variant="borderless">
        <ListRow title="First" />
        <ListRow title="Second" />
        <ListRow title="Third" />
      </ListSection>,
    );
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getByText('Third')).toBeTruthy();
    // Hairlines sit between rows only — never above the first row.
    expect(screen.getAllByTestId('list-section-separator')).toHaveLength(2);
  });

  it('renders a single row without separators (panel variant)', () => {
    render(
      <ListSection variant="panel">
        <ListRow title="Only" subtitle="dense row" icon="folder" />
      </ListSection>,
    );
    expect(screen.getByText('Only')).toBeTruthy();
    expect(screen.queryAllByTestId('list-section-separator')).toHaveLength(0);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { key: 'tree', label: 'Tree' },
    { key: 'list', label: 'List' },
    { key: 'roadmap', label: 'Roadmap' },
  ] as const;

  it('renders every option and marks the selected one', () => {
    render(
      <SegmentedControl
        testID="seg"
        options={[...options]}
        selected="list"
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('Tree')).toBeTruthy();
    expect(screen.getByText('List')).toBeTruthy();
    expect(screen.getByText('Roadmap')).toBeTruthy();
    expect(screen.getByTestId('seg-list').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('seg-tree').props.accessibilityState).toEqual({ selected: false });
  });

  it('calls onSelect with the pressed option key', () => {
    const onSelect = jest.fn();
    render(
      <SegmentedControl testID="seg" options={[...options]} selected="tree" onSelect={onSelect} />,
    );
    fireEvent.press(screen.getByTestId('seg-roadmap'));
    expect(onSelect).toHaveBeenCalledWith('roadmap');
  });
});

describe('PrimaryChipButton', () => {
  it('fires onPress', () => {
    const onPress = jest.fn();
    render(<PrimaryChipButton label="Plan" onPress={onPress} />);
    fireEvent.press(screen.getByText('Plan'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<PrimaryChipButton label="Plan" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Plan'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders ghost and danger action variants', () => {
    render(
      <>
        <PrimaryChipButton label="Pause" variant="ghost" />
        <PrimaryChipButton label="Fail" variant="danger" />
      </>,
    );
    expect(screen.getByText('Pause')).toBeTruthy();
    expect(screen.getByText('Fail')).toBeTruthy();
  });
});

describe('remaining components smoke', () => {
  it('renders without crashing', () => {
    render(
      <>
        <SectionHeader title="Doing now" />
        <SectionNote>Rows are ordered by priority.</SectionNote>
        <StatTile value={3} label="Tasks done" />
        <ProgressBar progress={0.5} />
        <IconChip name="target" size="lg" />
        <InlineNavBar title="Goal detail" onBack={jest.fn()} />
      </>,
    );
    expect(screen.getByText('Goal detail')).toBeTruthy();
    expect(screen.getByText('Doing now')).toBeTruthy();
  });
});
