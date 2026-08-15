import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  EndpointPickerSheet,
  candidateRejectionReason,
  pickerHintForKind,
} from '../src/ui/relations';
import type { EndpointCandidate } from '../src/ui/relations';

const CANDIDATES: EndpointCandidate[] = [
  { id: 'g-1', title: 'Run a marathon', detail: 'Finish under four hours' },
  { id: 'g-2', title: 'Old ambition', rejection: { kind: 'archived-endpoint' } },
  { id: 'g-3', title: 'Already pursued', rejection: { kind: 'duplicate-active-relation' } },
];

function renderPicker(overrides: Partial<Parameters<typeof EndpointPickerSheet>[0]> = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  render(
    <EndpointPickerSheet
      visible
      title="Choose a Goal"
      candidates={CANDIDATES}
      onSelect={onSelect}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSelect, onClose };
}

describe('EndpointPickerSheet', () => {
  it('keeps unavailable candidates visible with a Rejected state and a reason', () => {
    renderPicker();
    expect(screen.getByText('Old ambition')).toBeTruthy();
    expect(screen.getByText('Archived endpoint')).toBeTruthy();
    expect(screen.getByText('Already pursued')).toBeTruthy();
    expect(screen.getByText('Duplicate active relationship')).toBeTruthy();
    // Distinct Rejected badges, one per unavailable row.
    expect(screen.getAllByText('! Rejected')).toHaveLength(2);
  });

  it('selects only available candidates', () => {
    const { onSelect } = renderPicker();

    fireEvent.press(screen.getByLabelText('Choose Run a marathon'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(CANDIDATES[0]);

    fireEvent.press(screen.getByLabelText('Old ambition, unavailable: Archived endpoint'));
    fireEvent.press(
      screen.getByLabelText('Already pursued, unavailable: Duplicate active relationship'),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marks rejected rows disabled for assistive technology', () => {
    renderPicker();
    const rejected = screen.getByLabelText('Old ambition, unavailable: Archived endpoint');
    expect(rejected.props.accessibilityState).toEqual({ disabled: true });
    const available = screen.getByLabelText('Choose Run a marathon');
    expect(available.props.accessibilityState).toEqual({ disabled: false });
  });

  it('supports a specific reason override without changing the kind', () => {
    renderPicker({
      candidates: [
        {
          id: 't-1',
          title: 'Member elsewhere',
          rejection: {
            kind: 'duplicate-active-relation',
            reason: 'Belongs to another Project',
          },
        },
      ],
    });
    expect(screen.getByText('Belongs to another Project')).toBeTruthy();
  });

  it('renders the explicit empty state when there is nothing to choose', () => {
    renderPicker({ candidates: [], emptyMessage: 'No active Goals yet.' });
    expect(screen.getByText('No active Goals yet.')).toBeTruthy();
  });
});

describe('candidateRejectionReason', () => {
  it('derives reasons from the same mapping that drives commit-time feedback', () => {
    for (const kind of [
      'archived-endpoint',
      'duplicate-active-relation',
      'invalid-direction',
      'cardinality-violation',
      'cross-project-structure',
      'cycle',
    ] as const) {
      expect(candidateRejectionReason({ kind })).toBe(pickerHintForKind(kind));
    }
  });
});
