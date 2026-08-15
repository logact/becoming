import React from 'react';

import { goalsDestination } from './goals/goalsDestination';
import type { ShellDestination } from './navigation/NavigationShell';
import { CrossDestinationDetailBridge } from './projects/crossDestinationDetail';
import { projectsDestination } from './projects/projectsDestination';
import { GoalPursuitActions } from './projects/pursuit/GoalPursuitActions';
import { ProjectStructureSegment } from './projects/structure/ProjectStructureSegment';
import { ProjectMembershipActions } from './tasks/membership/ProjectMembershipActions';
import { tasksDestination } from './tasks/tasksDestination';

/**
 * The shell destinations for the app: the real Goals (#131), Projects (#134),
 * and Tasks (#132) destinations. Real screens replace placeholders without
 * changing the shell contract.
 *
 * #134 wires the Goal pursuit actions into the Goal detail slot here; #132
 * wires the Project-Overview membership actions (Add an existing Task) into
 * the Project detail slot; #135 wires the Project-Structure decomposition
 * tree into the Project detail slot. Every destination's list is wrapped in
 * the cross-destination detail bridge so rows on one destination (e.g. a
 * member Task on the Project Overview) can open the corresponding detail on
 * another destination.
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
    withCrossDetailBridge(
      projectsDestination({
        renderStructure: ({ project, refresh }) => (
          <ProjectStructureSegment project={project} refresh={refresh} />
        ),
        renderMembershipActions: ({ project, memberTasks, refresh }) => (
          <ProjectMembershipActions
            project={project}
            memberTasks={memberTasks}
            onChanged={refresh}
          />
        ),
      }),
    ),
    withCrossDetailBridge(tasksDestination()),
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
