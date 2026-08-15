import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DuplicateActiveGoalPursuitError } from '../src/application/projectGoalPursuitService';
import { DecompositionGraphIntegrityError } from '../src/application/decompositionService';
import type { Relation } from '../src/domain/relation';
import { RelationRejectionSheet, mapRelationError } from '../src/ui/relations';
import type { RelationErrorFeedback } from '../src/ui/relations';

const RELATION: Relation = {
  id: 'rel-1',
  sourceType: 'project',
  sourceId: 'p-1',
  relationType: 'contributes_to',
  targetType: 'goal',
  targetId: 'g-1',
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  endedAt: null,
};

const DUPLICATE_FEEDBACK = mapRelationError(new DuplicateActiveGoalPursuitError(RELATION));

function renderSheet(
  feedback: RelationErrorFeedback | null,
  handlers: {
    onReviewAnotherChoice?: () => void;
    onRefreshEndpoints?: () => void;
    onRetry?: () => void;
    onClose?: () => void;
  } = {},
) {
  return render(
    <RelationRejectionSheet
      visible
      feedback={feedback}
      onReviewAnotherChoice={handlers.onReviewAnotherChoice ?? jest.fn()}
      onRefreshEndpoints={handlers.onRefreshEndpoints}
      onRetry={handlers.onRetry}
      onClose={handlers.onClose ?? jest.fn()}
    />,
  );
}

describe('RelationRejectionSheet', () => {
  it('presents the mapped feedback under the focused "Change not allowed" title', () => {
    renderSheet(DUPLICATE_FEEDBACK);
    expect(screen.getByText('Change not allowed')).toBeTruthy();
    expect(screen.getByText('Already connected')).toBeTruthy();
    expect(
      screen.getByText(
        'This active relationship already exists. Pick another choice, or end the existing relationship first.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Nothing was saved — your current screen and draft remain unchanged.'),
    ).toBeTruthy();
  });

  it('lets the user review another choice, refresh stale endpoints, and retry', () => {
    const onReviewAnotherChoice = jest.fn();
    const onRefreshEndpoints = jest.fn();
    const onRetry = jest.fn();
    renderSheet(DUPLICATE_FEEDBACK, { onReviewAnotherChoice, onRefreshEndpoints, onRetry });

    fireEvent.press(screen.getByLabelText('Review another choice'));
    fireEvent.press(screen.getByLabelText('Refresh choices'));
    fireEvent.press(screen.getByLabelText('Try again'));

    expect(onReviewAnotherChoice).toHaveBeenCalledTimes(1);
    expect(onRefreshEndpoints).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides retry for non-retryable failures', () => {
    const feedback = mapRelationError(
      new DecompositionGraphIntegrityError('existing active cycle detected'),
    );
    renderSheet(feedback, { onRetry: jest.fn() });
    expect(screen.getByText('Structure needs inspection')).toBeTruthy();
    expect(screen.queryByLabelText('Try again')).toBeNull();
    // Reviewing another choice is always available.
    expect(screen.getByLabelText('Review another choice')).toBeTruthy();
  });

  it('renders nothing without feedback', () => {
    renderSheet(null);
    expect(screen.queryByText('Change not allowed')).toBeNull();
  });

  it('never clears the caller’s draft or selection when dismissed', () => {
    function DraftHost() {
      const [draft, setDraft] = useState('My draft title');
      const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(DUPLICATE_FEEDBACK);
      return (
        <>
          <TextInput
            accessibilityLabel="Goal title"
            value={draft}
            onChangeText={setDraft}
          />
          <Text>selected:goal-7</Text>
          <RelationRejectionSheet
            visible
            feedback={feedback}
            onReviewAnotherChoice={() => setFeedback(null)}
            onClose={() => setFeedback(null)}
          />
        </>
      );
    }
    render(<DraftHost />);

    fireEvent.press(screen.getByLabelText('Review another choice'));

    // The sheet closed; the draft and selection are exactly as before.
    expect(screen.queryByText('Change not allowed')).toBeNull();
    expect(screen.getByLabelText('Goal title').props.value).toBe('My draft title');
    expect(screen.getByText('selected:goal-7')).toBeTruthy();
  });
});
