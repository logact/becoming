import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { PinCandidate } from '../../../application/attention/PinCandidatesService';
import { Icon, type IconName } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { createId } from '../../shared/id';
import { colors, radii } from '../../shared/theme';

const GROUPS: { type: PinCandidate['type']; title: string; icon: IconName }[] = [
  { type: 'goal', title: 'Goals', icon: 'target' },
  { type: 'task', title: 'Tasks', icon: 'checkCircle' },
  { type: 'idea', title: 'Ideas', icon: 'bulb' },
];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * "Pin to attention" pushed screen: searchable pin candidates grouped by
 * type, each with a Pin action. Pinning updates the row locally; the
 * dashboard refreshes itself on return (pushed stacks remount).
 */
export function AttentionPinPage() {
  const { attention, pinCandidates } = useAppServices();
  if (!attention) {
    throw new Error('AppServices.attention is not provided');
  }
  if (!pinCandidates) {
    throw new Error('AppServices.pinCandidates is not provided');
  }

  const navigation = useShellNavigation();
  const [candidates, setCandidates] = useState<PinCandidate[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void pinCandidates.list().then((list) => {
      if (!cancelled) {
        setCandidates(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pinCandidates]);

  const pin = async (candidate: PinCandidate): Promise<void> => {
    await attention.pin({
      id: createId(),
      targetType: candidate.type,
      targetId: candidate.id,
      now: new Date(),
    });
    // Mark just this row pinned; no full refetch needed.
    setCandidates((prev) =>
      (prev ?? []).map((entry) =>
        entry.type === candidate.type && entry.id === candidate.id
          ? { ...entry, pinned: true }
          : entry,
      ),
    );
  };

  const needle = query.trim().toLowerCase();
  const visible = (candidates ?? []).filter(
    (candidate) => needle === '' || candidate.title.toLowerCase().includes(needle),
  );

  return (
    <View testID="attention-pin-page" style={styles.screen}>
      <InlineNavBar title="Pin to attention" onBack={navigation.goBack} />
      <View style={styles.search}>
        <Icon name="search" size={15} color={colors.muted} />
        <TextInput
          testID="pin-search"
          style={styles.searchInput}
          placeholder="Search goals, tasks, ideas"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <ScrollView>
        {GROUPS.map((group) => {
          const rows = visible.filter((candidate) => candidate.type === group.type);
          if (rows.length === 0) {
            return null;
          }
          return (
            <View key={group.type}>
              <SectionHeader title={group.title} />
              <ListSection variant="panel">
                {rows.map((candidate) => (
                  <ListRow
                    key={`${candidate.type}-${candidate.id}`}
                    icon={group.icon}
                    title={candidate.title}
                    subtitle={capitalize(candidate.status)}
                    trailing={
                      <PrimaryChipButton
                        testID={`pin-${candidate.type}-${candidate.id}`}
                        label={candidate.pinned ? 'Pinned' : 'Pin'}
                        disabled={candidate.pinned}
                        onPress={() => void pin(candidate)}
                      />
                    }
                  />
                ))}
              </ListSection>
            </View>
          );
        })}
        <SectionNote>Pinned items stay in Needs attention until you remove them.</SectionNote>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.track,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 2,
    marginBottom: 8,
    marginHorizontal: 18,
  },
  searchInput: { flex: 1, padding: 0, fontSize: 15, color: colors.ink },
});
