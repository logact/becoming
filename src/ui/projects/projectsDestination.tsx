import React from 'react';

import type { ShellDestination } from '../navigation/NavigationShell';
import { ProjectDetailScreen } from './ProjectDetailScreen';
import { ProjectListScreen } from './ProjectListScreen';
import type { ProjectDetailSlots } from './projectDetailSlots';

/**
 * The real Projects destination for the M2 shell (#134). `slots` is the
 * stable extension point handed to Project detail: #135 and #136 inject the
 * Structure and Progress segment content through it without changing this
 * destination or the shell contract.
 */
export function projectsDestination(slots?: ProjectDetailSlots): ShellDestination {
  return {
    id: 'projects',
    title: 'Projects',
    icon: '▦',
    renderList: () => <ProjectListScreen />,
    renderDetail: (entityId) => <ProjectDetailScreen entityId={entityId} slots={slots} />,
  };
}
