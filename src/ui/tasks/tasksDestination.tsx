import React from 'react';

import type { ShellDestination } from '../navigation/NavigationShell';
import { TaskDetailScreen } from './TaskDetailScreen';
import { TaskListScreen } from './TaskListScreen';

/**
 * The real Tasks destination for the M2 shell (#132). Task membership actions
 * are owned by this module — the Task detail wires them directly, and the
 * Project-side "Add an existing Task" action is injected into the Project
 * Overview through `ProjectDetailSlots.renderMembershipActions` in
 * `appDestinations`, mirroring the #134 pursuit slot pattern.
 */
export function tasksDestination(): ShellDestination {
  return {
    id: 'tasks',
    title: 'Tasks',
    icon: '✓',
    renderList: () => <TaskListScreen />,
    renderDetail: (entityId) => <TaskDetailScreen entityId={entityId} />,
  };
}
