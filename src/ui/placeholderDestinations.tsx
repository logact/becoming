import React from 'react';
import { Text } from 'react-native';

import type { ShellDestination } from './navigation/NavigationShell';
import { EntityListScaffold } from './shared/EntityListScaffold';

/**
 * Temporary destinations so the shell and composition root are exercisable
 * before the M2 screen tasks (#131, #132, #134) land. Each renders the
 * shared list scaffold in its empty state; the real screens replace these
 * without changing the shell contract.
 */
export function placeholderDestinations(): ShellDestination[] {
  return [
    placeholder({
      id: 'goals',
      title: 'Goals',
      icon: '◎',
      heroTitle: 'What do you want to become?',
      heroCopy: 'Define outcomes before choosing the work.',
      emptyMessage: 'Goal planning screens arrive with the M2 Goal task.',
    }),
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
