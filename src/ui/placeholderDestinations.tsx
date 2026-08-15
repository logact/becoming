import React from 'react';
import { Text } from 'react-native';

import { goalsDestination } from './goals/goalsDestination';
import type { ShellDestination } from './navigation/NavigationShell';
import { CrossDestinationDetailBridge } from './projects/crossDestinationDetail';
import { projectsDestination } from './projects/projectsDestination';
import { GoalPursuitActions } from './projects/pursuit/GoalPursuitActions';
import { EntityListScaffold } from './shared/EntityListScaffold';

/**
 * The shell destinations for the app: the real Goals (#131) and Projects
 * (#134) destinations plus the remaining temporary Task placeholder, which
 * renders the shared list scaffold in its empty state until the M2 Task
 * (#132) screens land. Real screens replace placeholders without changing
 * the shell contract.
 *
 * #134 wires the Goal pursuit actions into the Goal detail slot here, and
 * wraps every destination's list in the cross-destination detail bridge so
 * rows on one destination (e.g. a pursued Goal on the Project Overview) can
 * open the corresponding detail on another destination.
 */
export function appDestinations(): ShellDestination[] {
  return [
    withCrossDetailBridge(
      goalsDestination({
        renderPursuitActions: ({ goal, refresh }) => (
          <GoalPursuitActions goal={goal} refresh={refresh} />
        ),
      }),
    ),
    withCrossDetailBridge(projectsDestination()),
    withCrossDetailBridge(
      placeholder({
        id: 'tasks',
        title: 'Tasks',
        icon: '✓',
        heroTitle: 'The work in front of you',
        heroCopy: 'Tasks can stand alone or belong to a Project.',
        emptyMessage: 'Task planning screens arrive with the M2 Task task.',
      }),
    ),
  ];
}

/**
 * Enables cross-destination detail navigation for a destination: the bridge
 * completes a pending `requestCrossDestinationDetail` push once this
 * destination becomes active.
 */
function withCrossDetailBridge(destination: ShellDestination): ShellDestination {
  return {
    ...destination,
    renderList: () => (
      <CrossDestinationDetailBridge>{destination.renderList()}</CrossDestinationDetailBridge>
    ),
  };
}

interface PlaceholderSpec {
  id: ShellDestination['id'];
  title: string;
  icon: string;
  heroTitle: string;
  heroCopy: string;
  emptyMessage: string;
}

function placeholder(spec: PlaceholderSpec): ShellDestination {
  return {
    id: spec.id,
    title: spec.title,
    icon: spec.icon,
    renderList: () => (
      <EntityListScaffold<never>
        title={spec.title}
        heroTitle={spec.heroTitle}
        heroCopy={spec.heroCopy}
        searchPlaceholder={`Search ${spec.title.toLowerCase()}`}
        status="ready"
        items={[]}
        keyExtractor={() => 'none'}
        renderRow={() => <Text />}
        filter="active"
        onFilterChange={() => undefined}
        searchQuery=""
        onSearchChange={() => undefined}
        emptyTitle={`No ${spec.title.toLowerCase()} yet`}
        emptyMessage={spec.emptyMessage}
      />
    ),
  };
}
