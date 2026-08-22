import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  LibraryCounts,
  LibraryOverviewService,
} from '../../../application/library/LibraryOverviewService';
import { Icon, type IconName } from '../../components/Icon';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { colors, serif, spacing } from '../../shared/theme';

interface HubRow {
  key: string;
  icon: IconName;
  title: string;
  subtitle: string;
  count?: number;
  onPress?: () => void;
}

export interface LibraryPageProps {
  /**
   * Read service behind the screen. Passed as a prop (not pulled from
   * AppServices) so the page is testable with fakes.
   */
  overview: Pick<LibraryOverviewService, 'getCounts'>;
}

/**
 * Library hub (prototype `library.html`): the entry point of the Library
 * destination. Rows mirror the prototype's three sections; Goals and
 * Projects are navigable today — they push their screens via
 * `navigation.pushScreen`. The other rows render their counts but stay
 * inert until their pages land.
 */
export function LibraryPage({ overview }: LibraryPageProps) {
  const navigation = useShellNavigation();
  const [counts, setCounts] = useState<LibraryCounts | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      setCounts(await overview.getCounts());
    } catch (cause: unknown) {
      // Surface load failures; a silent rejection would leave a blank screen.
      console.error('Failed to load the library counts', cause);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [overview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Minimal loading state: empty screen background until the first load.
  if (counts === null) {
    return (
      <View testID="library-page" style={styles.screen}>
        {loadError === null ? null : (
          <SectionNote>Could not load the library: {loadError}</SectionNote>
        )}
      </View>
    );
  }

  const planAndDo: HubRow[] = [
    {
      key: 'goals',
      icon: 'target',
      title: 'Goals',
      subtitle: 'Targets you aim to achieve',
      count: counts.goals,
      onPress: () => navigation.pushScreen('goals'),
    },
    {
      key: 'tasks',
      icon: 'checkCircle',
      title: 'Tasks',
      subtitle: 'Actions that implement goals',
      count: counts.tasks,
      onPress: () => navigation.pushScreen('tasks'),
    },
    {
      key: 'projects',
      icon: 'box',
      title: 'Projects',
      subtitle: 'Plans that decompose goals',
      count: counts.projects,
      onPress: () => navigation.pushScreen('projects'),
    },
  ];
  const captureAndThink: HubRow[] = [
    {
      key: 'ideas',
      icon: 'bulb',
      title: 'Ideas',
      subtitle: 'Casual captures, transform later',
      count: counts.ideas,
      onPress: () => navigation.pushScreen('ideas'),
    },
    {
      key: 'notes',
      icon: 'doc',
      title: 'Notes',
      subtitle: 'Extracted thoughts & methods',
    },
  ];
  const manage: HubRow[] = [
    {
      key: 'resources',
      icon: 'banknote',
      title: 'Resources',
      subtitle: 'Time, money, AI tokens',
      count: counts.resources,
    },
    { key: 'records', icon: 'list', title: 'Records', subtitle: 'Everything that happened' },
    { key: 'labels', icon: 'tag', title: 'Labels', subtitle: 'Classification across models' },
    {
      key: 'archive',
      icon: 'archive',
      title: 'Archive',
      subtitle: 'Archived items keep their state',
    },
  ];

  const hubRow = (row: HubRow) => (
    <ListRow
      key={row.key}
      testID={`library-row-${row.key}`}
      icon={row.icon}
      title={row.title}
      subtitle={row.subtitle}
      trailing={
        <>
          {row.count === undefined ? null : <Text style={styles.count}>{row.count}</Text>}
          <Icon name="chevron" size={14} color={colors.chevron} />
        </>
      }
      {...(row.onPress === undefined ? {} : { onPress: row.onPress })}
    />
  );

  return (
    <ScrollView testID="library-page" style={styles.screen}>
      <Text style={styles.title}>Library</Text>
      <View style={styles.search}>
        <Icon name="search" size={15} color={colors.faint} />
        <Text style={styles.searchHint}>Search</Text>
      </View>

      <View testID="plan-do-section">
        <SectionHeader title="Plan & do" />
        <ListSection variant="panel">{planAndDo.map(hubRow)}</ListSection>
      </View>

      <View testID="capture-think-section">
        <SectionHeader title="Capture & think" />
        <ListSection variant="panel">{captureAndThink.map(hubRow)}</ListSection>
      </View>

      <View testID="manage-section">
        <SectionHeader title="Manage" />
        <ListSection variant="panel">{manage.map(hubRow)}</ListSection>
      </View>

      <Text style={styles.slogan}>Record what you do. Shape what you become.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontFamily: serif,
    fontSize: 35,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
    marginHorizontal: spacing.textMargin,
    marginTop: spacing.sectionTop,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginHorizontal: spacing.screenMargin,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  searchHint: { fontSize: 14, color: colors.faint },
  count: { fontSize: 14, fontWeight: '700', color: colors.muted, marginRight: 6 },
  slogan: {
    fontSize: 12,
    color: colors.faint,
    textAlign: 'center',
    marginVertical: spacing.sectionTop,
  },
});
