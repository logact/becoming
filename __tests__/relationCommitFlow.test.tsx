import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import type { EntityId } from '../src/domain/ids';
import type { AppServices } from '../src/ui/composition/appServices';
import { useAppServices } from '../src/ui/composition/AppServicesProvider';
import { ToastProvider } from '../src/ui/shared/Toast';
import {
  RelationRejectionSheet,
  useRelationCommit,
} from '../src/ui/relations';
import type { RelationErrorFeedback } from '../src/ui/relations';
import {
  closeUiTestHarness,
  createUiTestHarness,
  renderWithServices,
} from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';

/**
 * Miniature Goal-pursuit flow wired exactly the way #134 will consume this
 * module: a selection draft, a committed projection fed only by the query
 * service post-commit, commit through `useRelationCommit`, and commit-time
 * rejection through `RelationRejectionSheet`.
 */
function PursuitFlow({ projectId, goalOneId, goalTwoId }: {
  projectId: EntityId;
  goalOneId: EntityId;
  goalTwoId: EntityId;
}) {
  const services = useAppServices();
  const { commit } = useRelationCommit();
  const [selection, setSelection] = useState(goalOneId);
  const [committed, setCommitted] = useState<string[]>([]);
  const [choicesLoaded, setChoicesLoaded] = useState(0);
  const [feedback, setFeedback] = useState<RelationErrorFeedback | null>(null);

  // Refresh-affected-projections callbacks: re-read the real query services.
  const refreshCommitted = useCallback(async () => {
    const views = await services.goalPursuitQueries.listGoalsPursuedByProject(projectId);
    setCommitted(views.map((view) => view.relationId));
  }, [services, projectId]);
  const refreshChoices = useCallback(() => {
    setChoicesLoaded((count) => count + 1);
  }, []);

  const attempt = useCallback(async () => {
    const outcome = await commit(
      () =>
        services.goalPursuit.startPursuit({
          projectId,
          goalId: selection,
          actor: 'tester',
        }),
      {
        successMessage: 'Pursuit started',
        refresh: [refreshCommitted, refreshChoices],
      },
    );
    setFeedback(outcome.status === 'rejected' ? outcome.feedback : null);
  }, [commit, services, projectId, selection, refreshCommitted, refreshChoices]);

  return (
    <View>
      <Text>selected:{selection === goalOneId ? 'one' : 'two'}</Text>
      <Text>committed:{committed.length}</Text>
      {committed.map((id) => (
        <Text key={id}>pursuit:{id}</Text>
      ))}
      <Text>choices:{choicesLoaded}</Text>
      <Pressable accessibilityLabel="Select Goal One" onPress={() => setSelection(goalOneId)}>
        <Text>Select Goal One</Text>
      </Pressable>
      <Pressable accessibilityLabel="Select Goal Two" onPress={() => setSelection(goalTwoId)}>
        <Text>Select Goal Two</Text>
      </Pressable>
      <Pressable accessibilityLabel="Connect selected Goal" onPress={() => void attempt()}>
        <Text>Connect</Text>
      </Pressable>
      <RelationRejectionSheet
        visible
        feedback={feedback}
        onReviewAnotherChoice={() => setFeedback(null)}
        onRefreshEndpoints={refreshChoices}
        onRetry={() => void attempt()}
        onClose={() => setFeedback(null)}
      />
    </View>
  );
}

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

describe('relation commit flow (integration)', () => {
  let harness: UiTestHarness;
  let services: AppServices;
  let projectId: EntityId;
  let goalOneId: EntityId;
  let goalTwoId: EntityId;

  beforeEach(async () => {
    harness = await createUiTestHarness();
    services = harness.services;
    const project = await services.projects.createProject({
      title: 'Marathon prep',
      actor: 'tester',
    });
    projectId = project.id;
    goalOneId = (
      await services.goals.createGoal({
        title: 'Run a marathon',
        targetState: 'Finish under four hours',
        actor: 'tester',
      })
    ).id;
    goalTwoId = (
      await services.goals.createGoal({
        title: 'Sleep better',
        targetState: 'Eight hours nightly',
        actor: 'tester',
      })
    ).id;

    renderWithServices(
      <ToastProvider>
        <PursuitFlow projectId={projectId} goalOneId={goalOneId} goalTwoId={goalTwoId} />
      </ToastProvider>,
      services,
    );
  });

  afterEach(async () => {
    await closeUiTestHarness(harness);
  });

  it('confirms success only after commit, then refreshes projections', async () => {
    expect(screen.getByText('committed:0')).toBeTruthy();

    await press('Connect selected Goal');

    // Toast confirmation and refreshed projections appear post-commit.
    expect(screen.getByText(/Pursuit started/)).toBeTruthy();
    expect(screen.getByText('committed:1')).toBeTruthy();
    expect(screen.getByText('choices:1')).toBeTruthy();
    const pursuits = await services.goalPursuitQueries.listGoalsPursuedByProject(projectId);
    expect(pursuits).toHaveLength(1);
    expect(screen.getByText(`pursuit:${pursuits[0].relationId}`)).toBeTruthy();
  });

  it('failed → corrected → retried → successful never shows an uncommitted relation', async () => {
    await press('Connect selected Goal');
    expect(screen.getByText('committed:1')).toBeTruthy();

    // Duplicate commit: rejected by the service at commit time.
    await press('Connect selected Goal');
    expect(screen.getByText('Change not allowed')).toBeTruthy();
    expect(screen.getByText('Already connected')).toBeTruthy();
    // Nothing committed optimistically: projection and selection unchanged.
    expect(screen.getByText('committed:1')).toBeTruthy();
    expect(screen.getByText('selected:one')).toBeTruthy();
    expect(
      await services.goalPursuitQueries.listGoalsPursuedByProject(projectId),
    ).toHaveLength(1);

    // Review another choice: sheet closes, draft selection preserved.
    await press('Review another choice');
    expect(screen.queryByText('Change not allowed')).toBeNull();
    expect(screen.getByText('selected:one')).toBeTruthy();

    // Strict 1:1: a different Goal is rejected while the first pursuit is active.
    await press('Select Goal Two');
    await press('Connect selected Goal');
    expect(screen.getByText('Change not allowed')).toBeTruthy();
    expect(screen.getByText('Already placed')).toBeTruthy();
    expect(screen.getByText('committed:1')).toBeTruthy();

    // Ending the active pursuit frees the Project; the preserved selection retries.
    const [pursuit] = await services.goalPursuitQueries.listGoalsPursuedByProject(projectId);
    await services.goalPursuit.endPursuit({ relationId: pursuit.relationId, actor: 'tester' });
    await press('Try again');

    expect(screen.queryByText('Change not allowed')).toBeNull();
    expect(screen.getByText(/Pursuit started/)).toBeTruthy();
    expect(screen.getByText('committed:1')).toBeTruthy();
    const [replacement] = await services.goalPursuitQueries.listGoalsPursuedByProject(projectId);
    expect(replacement.goalId).toBe(goalTwoId);
  });

  it('supports refreshing stale endpoints and retrying the same selection', async () => {
    await press('Connect selected Goal');
    await press('Connect selected Goal');
    expect(screen.getByText('Already connected')).toBeTruthy();

    // Refresh stale endpoint choices without committing anything.
    const choicesBefore = screen.getByText('choices:1');
    expect(choicesBefore).toBeTruthy();
    await press('Refresh choices');
    expect(screen.getByText('choices:2')).toBeTruthy();
    expect(screen.getByText('committed:1')).toBeTruthy();

    // The user corrects the underlying problem outside the sheet (ends the
    // existing pursuit), then retries the preserved selection.
    const [pursuit] = await services.goalPursuitQueries.listGoalsPursuedByProject(projectId);
    await services.goalPursuit.endPursuit({ relationId: pursuit.relationId, actor: 'tester' });
    await press('Try again');

    expect(screen.queryByText('Change not allowed')).toBeNull();
    expect(screen.getByText('committed:1')).toBeTruthy();
    expect(screen.getByText(/Pursuit started/)).toBeTruthy();
    // The committed row is the replacement relation, read post-commit.
    const [replacement] = await services.goalPursuitQueries.listGoalsPursuedByProject(projectId);
    expect(replacement.relationId).not.toBe(pursuit.relationId);
    expect(screen.getByText(`pursuit:${replacement.relationId}`)).toBeTruthy();
  });
});
