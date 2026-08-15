import React from 'react';

import type { ShellDestination } from '../navigation/NavigationShell';
import { GoalDetailScreen } from './GoalDetailScreen';
import type { GoalDetailSlots } from './goalDetailSlots';
import { GoalListScreen } from './GoalListScreen';

/**
 * The real Goals destination for the M2 shell (#131). `slots` is the stable
 * extension point handed to Goal detail: #134 wires the Goal pursuit actions
 * (Connect / Remove from a Project) through it without changing this
 * destination or the shell contract.
 */
export function goalsDestination(slots?: GoalDetailSlots): ShellDestination {
  return {
    id: 'goals',
    title: 'Goals',
    icon: '◎',
    renderList: () => <GoalListScreen />,
    renderDetail: (entityId) => <GoalDetailScreen entityId={entityId} slots={slots} />,
  };
}
