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
