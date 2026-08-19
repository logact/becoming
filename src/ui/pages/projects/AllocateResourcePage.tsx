import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ProjectDetailService } from '../../../application/project/ProjectDetailService';
import type { AllocateResourceService } from '../../../application/resource/AllocateResourceService';
import type {
  ResourcePoolItem,
  ResourcePoolsService,
} from '../../../application/resource/ResourcePoolsService';
import type { Project } from '../../../domain/project/Project';
import type { ProjectId, ResourceId } from '../../../domain/shared/ids';
import { Icon } from '../../components/Icon';
import { InlineNavBar } from '../../components/InlineNavBar';
import { ListRow } from '../../components/ListRow';
import { ListSection } from '../../components/ListSection';
import { PrimaryChipButton } from '../../components/PrimaryChipButton';
import { SectionHeader } from '../../components/SectionHeader';
import { SectionNote } from '../../components/SectionNote';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { parseDateTimeText } from '../../shared/dateText';
import { createId } from '../../shared/id';
import { colors, spacing } from '../../shared/theme';
import { FormTextRow } from './formRows';

/** Time pools hold minutes; display them as hours. */
function hours(minutes: number): number {
  return Number((minutes / 60).toFixed(1));
}

/** `Quantity · 2,000 of 5,000 available in pool` / `Time · 4 h of 12 h available in pool`. */
function poolSubtitle(pool: ResourcePoolItem): string {
  const amounts =
    pool.kind === 'time'
      ? `${hours(pool.available)} h of ${hours(pool.amount)} h available in pool`
      : `${pool.available} of ${pool.amount} available in pool`;
  return `${pool.kind === 'time' ? 'Time' : 'Quantity'} · ${amounts}`;
}

export interface AllocateResourcePageProps {
  projectId: ProjectId;
  /**
   * Read service behind the target-project row. Passed as a prop (not pulled
   * from AppServices) so the page is testable with fakes.
   */
  detail: Pick<ProjectDetailService, 'getDetail'>;
  /** Read service listing the global resource pools with available amounts. */
  resourcePools: Pick<ResourcePoolsService, 'list'>;
  allocateResource: Pick<AllocateResourceService, 'allocate'>;
}

/**
 * "Allocate resource" pushed screen (`project:<id>:allocate-resource`): the
 * target project row, the global resource pools (tap to select), then an
 * Amount input for quantity pools or Start/End `YYYY-MM-DD HH:mm` inputs for
 * time pools. Submit calls AllocateResourceService and pops back on success;
 * validation failures show inline.
 */
export function AllocateResourcePage({
  projectId,
  detail,
  resourcePools,
  allocateResource,
}: AllocateResourcePageProps) {
  const navigation = useShellNavigation();
  const [loaded, setLoaded] = useState<{ project: Project | null; pools: ResourcePoolItem[] } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<ResourceId | null>(null);
  const [amountText, setAmountText] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([detail.getDetail(projectId, new Date()), resourcePools.list()]).then(
      ([view, pools]) => {
        if (!cancelled) {
          setLoaded({ project: view.project, pools });
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [detail, resourcePools, projectId]);

  // Minimal loading state: navbar plus an optional load-error note.
  if (loaded === null) {
    return (
      <View testID="allocate-resource-page" style={styles.screen}>
        <InlineNavBar title="Allocate resource" onBack={navigation.goBack} />
        {loadError === null ? null : (
          <SectionNote>Could not load: {loadError}</SectionNote>
        )}
      </View>
    );
  }

  const { project, pools } = loaded;
  if (project === null) {
    return (
      <View testID="allocate-resource-page" style={styles.screen}>
        <InlineNavBar title="Allocate resource" onBack={navigation.goBack} />
        <SectionNote>Unknown project.</SectionNote>
      </View>
    );
  }

  const selected = pools.find((pool) => pool.id === selectedId);
  const select = (id: ResourceId): void => {
    setSelectedId(id);
    setError(null);
  };

  const submit = async (): Promise<void> => {
    setError(null);
    if (selected === undefined) {
      setError('Choose a resource first.');
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date();
      if (selected.kind === 'quantity') {
        const amount = Number(amountText.trim());
        if (!Number.isFinite(amount) || amount <= 0) {
          setError('Amount must be a positive number.');
          return;
        }
        if (amount > selected.available) {
          setError(`Amount must be ≤ ${selected.available}.`);
          return;
        }
        await allocateResource.allocate({
          allocationId: createId(),
          resourceId: selected.id,
          projectId,
          amount,
          now,
        });
      } else {
        const startAt = parseDateTimeText(startText);
        const endAt = parseDateTimeText(endText);
        if (startAt === null || endAt === null) {
          setError('Start and end must match YYYY-MM-DD HH:mm.');
          return;
        }
        if (startAt.getTime() >= endAt.getTime()) {
          setError('Start must be earlier than end.');
          return;
        }
        await allocateResource.allocate({
          allocationId: createId(),
          resourceId: selected.id,
          projectId,
          span: { startAt, endAt },
          now,
        });
      }
      navigation.goBack();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View testID="allocate-resource-page" style={styles.screen}>
      <InlineNavBar title="Allocate resource" onBack={navigation.goBack} />
      <ScrollView>
        <ListSection variant="panel">
          <ListRow
            testID="allocate-target"
            icon="box"
            title={project.name}
            subtitle="Allocating to this project"
          />
        </ListSection>

        <SectionHeader title="Choose a resource — global pools" />
        <ListSection variant="panel">
          {pools.map((pool) => (
            <ListRow
              key={pool.id}
              testID={`pool-${pool.id}`}
              icon={pool.kind === 'time' ? 'clock' : 'banknote'}
              title={pool.name}
              subtitle={poolSubtitle(pool)}
              trailing={
                pool.id === selectedId ? (
                  <Icon name="check" size={15} color={colors.sage} />
                ) : undefined
              }
              onPress={() => select(pool.id)}
            />
          ))}
        </ListSection>
        {pools.length === 0 ? <SectionNote>No resource pools yet.</SectionNote> : null}

        {selected === undefined ? null : selected.kind === 'quantity' ? (
          <View testID="allocate-amount-section">
            <SectionHeader title={`Amount — ${selected.name}`} />
            <ListSection variant="panel">
              <FormTextRow
                testID="allocate-amount"
                label="Amount"
                value={amountText}
                onChangeText={setAmountText}
                placeholder="0"
                hint={`≤ ${selected.available}`}
                keyboardType="numeric"
              />
            </ListSection>
            <SectionNote>
              The new allocation adds to what this project already holds; the pool’s total
              allocated never exceeds its amount.
            </SectionNote>
          </View>
        ) : (
          <View testID="allocate-span-section">
            <SectionHeader title={`Span — ${selected.name}`} />
            <ListSection variant="panel">
              <FormTextRow
                testID="allocate-start"
                label="Start"
                value={startText}
                onChangeText={setStartText}
                placeholder="YYYY-MM-DD HH:mm"
              />
              <FormTextRow
                testID="allocate-end"
                label="End"
                value={endText}
                onChangeText={setEndText}
                placeholder="YYYY-MM-DD HH:mm"
              />
            </ListSection>
            <SectionNote>
              Time is allocated as concrete spans (minute precision, may cross days); the amount
              equals the duration and spans never overlap.
            </SectionNote>
          </View>
        )}

        {error === null ? null : (
          <Text testID="allocate-error" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={styles.submit}>
          <PrimaryChipButton
            testID="allocate-submit"
            label="Allocate to project"
            disabled={submitting}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  error: {
    marginTop: 12,
    marginHorizontal: spacing.textMargin,
    fontSize: 13,
    fontWeight: '500',
    color: colors.conflictRed,
  },
  submit: {
    marginTop: 18,
    marginHorizontal: spacing.screenMargin,
    paddingBottom: 30,
    alignItems: 'center',
  },
});
