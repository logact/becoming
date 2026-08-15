import React from 'react';
import { Text } from 'react-native';

import { goalsDestination } from './goals/goalsDestination';
import type { ShellDestination } from './navigation/NavigationShell';
import { EntityListScaffold } from './shared/EntityListScaffold';

/**
 * The shell destinations for the app: the real Goals destination (#131) plus
 * the remaining temporary placeholders, which render the shared list
 * scaffold in its empty state until the M2 Project (#134) and Task (#132)
 * screens land. Real screens replace placeholders without changing the shell
 * contract.
 */
export function appDestinations(): ShellDestination[] {
  return [
    goalsDestination(),
    placeholder({
      id: 'projects',
      title: 'Projects',
      icon: '▦',
      heroTitle: 'Where intent becomes work',
      heroCopy: 'Projects organize effort without owning the Goal.',
      emptyMessage: 'Project planning screens arrive with the M2 Project task.',
    }),
    placeholder({
      id: 'tasks',
      title: 'Tasks',
      icon: '✓',
      heroTitle: 'The work in front of you',
      heroCopy: 'Tasks can stand alone or belong to a Project.',
      emptyMessage: 'Task planning screens arrive with the M2 Task task.',
    }),
  ];
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
