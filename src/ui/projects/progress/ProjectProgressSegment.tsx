import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProjectExecutionSnapshot } from '../../../application/projectExecutionSnapshotService';
import type { ProjectProgressFinding } from '../../../application/projectProgress';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { StatusBadge } from '../../shared/StatusBadge';
import { colors, fonts, radius, spacing } from '../../shared/theme';
import { requestCrossDestinationDetail } from '../crossDestinationDetail';
import type { ProjectDetailSegmentContext } from '../projectDetailSlots';
import {
  actionableWorkFindings,
  describeFindingReason,
  describeIntegrityFinding,
  findSnapshotNode,
  findingStatusPresentation,
  formatPercentage,
  MEASURABLE_CATEGORIES,
  nodeCurrentStateTitle,
  nodeTitle,
  NON_MEASURABLE_CATEGORIES,
} from './progressPresentation';
import type { WorkCategoryPresentation } from './progressPresentation';

type ProgressState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: ProjectExecutionSnapshot };

/**
 * The Project detail Progress segment (#136): derived execution progress
 * rendered from ONE authoritative Project execution snapshot per render.
 *
 * The snapshot is the screen authority: numerator, denominator, optional
 * percentage, the six work-category counts, affected-work findings, and
 * integrity/hierarchy/traversal findings all render exactly as supplied.
 * Presentation never joins Tasks, reproduces progress policy, or derives
 * lifecycle categories itself. Lifecycle stays inspect-only — this segment
 * owns no mutation at all; retry only re-queries the read model.
 */
export function ProjectProgressSegment({ project }: ProjectDetailSegmentContext) {
  const services = useAppServices();
  const navigation = useShellNavigation();

  const [state, setState] = useState<ProgressState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  /** Retry re-queries the snapshot read model only — never a mutation. */
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      try {
        const snapshot = await services.executionSnapshots.getSnapshot(project.id);
        if (!cancelled) setState({ status: 'ready', snapshot });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The composed read model failed.',
          });
        }
      }
    }
    void load();
    // A late response from a superseded load is dropped, never rendered.
    return () => {
      cancelled = true;
    };
  }, [project.id, reloadToken, services]);

  function openFinding(finding: ProjectProgressFinding) {
    const destination = finding.node.type === 'goal' ? 'goals' : 'tasks';
    requestCrossDestinationDetail({ destination, entityId: finding.node.id });
    navigation.switchDestination(destination);
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.skeleton} accessibilityLabel="Loading progress">
        <View style={[styles.skeletonBlock, styles.skeletonHero]} />
        <View style={styles.skeletonBlock} />
        <View style={[styles.skeletonBlock, styles.skeletonShort]} />
        <Text style={styles.skeletonText} maxFontSizeMultiplier={2}>
          Loading progress…
        </Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.stateBlock}>
        <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
          !
        </Text>
        <Text style={styles.stateTitle} maxFontSizeMultiplier={2}>
          Snapshot unavailable
        </Text>
        <Text style={styles.stateText} maxFontSizeMultiplier={2}>
          {state.message}
        </Text>
        <Text style={styles.stateText} maxFontSizeMultiplier={2}>
          The snapshot is a read model — no mutation was attempted.
        </Text>
        <Pressable
          onPress={reload}
          accessibilityRole="button"
          accessibilityLabel="Retry snapshot"
          style={styles.retryButton}
        >
          <Text style={styles.retryText} maxFontSizeMultiplier={2}>
            Retry snapshot
          </Text>
        </Pressable>
      </View>
    );
  }

  const { snapshot } = state;
  const progress = snapshot.progress;
  const measurable = progress.percentage !== null;
  const percentageText = measurable ? formatPercentage(progress.percentage) : null;
  const measurableCopy = `${progress.numerator} complete of ${progress.denominator} measurable`;
  const heroLabel = measurable
    ? `Derived progress: ${percentageText} percent, ${measurableCopy}`
    : `Derived progress: not measurable yet, ${measurableCopy}`;
  const workFindings = actionableWorkFindings(snapshot);

  return (
    <View>
      <View style={styles.hero} accessible accessibilityLabel={heroLabel}>
        <View style={styles.heroTop}>
          <View style={styles.heroLead}>
            <Text style={styles.heroKicker} maxFontSizeMultiplier={2}>
              Derived progress
            </Text>
            {percentageText !== null ? (
              <Text style={styles.heroNumber} maxFontSizeMultiplier={1.5}>
                {percentageText}%
              </Text>
            ) : (
              <Text style={styles.heroZeroTitle} maxFontSizeMultiplier={2}>
                Not measurable yet
              </Text>
            )}
          </View>
          <Text style={styles.heroCopy} maxFontSizeMultiplier={2}>
            {measurableCopy}
          </Text>
        </View>
        {percentageText !== null ? (
          <View
            style={styles.barTrack}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, Math.max(0, progress.percentage ?? 0))}%` },
              ]}
            />
          </View>
        ) : (
          <Text style={styles.heroNote} maxFontSizeMultiplier={2}>
            No percentage is shown for a zero denominator. Measurable work appears when lifecycle
            machines report current states.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
          Work categories
        </Text>
        <Text style={styles.groupLabel} maxFontSizeMultiplier={2}>
          Measurable work
        </Text>
        {MEASURABLE_CATEGORIES.map((category) => (
          <CategoryRow
            key={category.status}
            category={category}
            count={progress.counts[category.status]}
          />
        ))}
        <Text style={styles.groupLabel} maxFontSizeMultiplier={2}>
          Outside the measurable denominator
        </Text>
        {NON_MEASURABLE_CATEGORIES.map((category) => (
          <CategoryRow
            key={category.status}
            category={category}
            count={progress.counts[category.status]}
          />
        ))}
        <View style={styles.noteRow}>
          <Text style={styles.noteIcon} accessibilityElementsHidden importantForAccessibility="no">
            i
          </Text>
          <Text style={styles.noteText} maxFontSizeMultiplier={2}>
            Unmanaged, no-machine, uninitialized, and invalid work stays separate and never enters
            the measurable denominator.
          </Text>
        </View>
      </View>

      {workFindings.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
            {`Work findings · ${workFindings.length}`}
          </Text>
          {workFindings.map((finding) => (
            <WorkFindingRow
              key={`${finding.node.type}:${finding.node.id}`}
              finding={finding}
              snapshot={snapshot}
              onOpen={openFinding}
            />
          ))}
        </View>
      )}

      {snapshot.findings.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={2}>
            {`Integrity findings · ${snapshot.findings.length}`}
          </Text>
          {snapshot.findings.map((finding, index) => {
            const item = describeIntegrityFinding(finding);
            return (
              <View key={`${finding.kind}-${index}`} style={styles.findingRow}>
                <Text
                  style={styles.findingIcon}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {item.icon}
                </Text>
                <Text style={styles.findingText} maxFontSizeMultiplier={2}>
                  {item.text}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function CategoryRow({
  category,
  count,
}: {
  category: WorkCategoryPresentation;
  count: number;
}) {
  return (
    <View style={styles.categoryRow} accessible accessibilityLabel={`${category.label}: ${count}`}>
      <StatusBadge label={category.label} icon={category.icon} tone={category.tone} />
      <Text style={styles.categoryCount} maxFontSizeMultiplier={2}>
        {count}
      </Text>
    </View>
  );
}

function WorkFindingRow({
  finding,
  snapshot,
  onOpen,
}: {
  finding: ProjectProgressFinding;
  snapshot: ProjectExecutionSnapshot;
  onOpen: (finding: ProjectProgressFinding) => void;
}) {
  const node = findSnapshotNode(snapshot, finding.node);
  const title = nodeTitle(node);
  const missing = title === null;
  const displayTitle = title ?? 'Missing endpoint';
  const stateTitle = nodeCurrentStateTitle(node);
  const status = findingStatusPresentation(finding.status);
  const reasonText = finding.reasons.map(describeFindingReason).join('; ');
  const typeText = finding.node.type === 'goal' ? 'GOAL' : 'TASK';

  return (
    <Pressable
      onPress={() => onOpen(finding)}
      disabled={missing}
      accessibilityRole="button"
      accessibilityLabel={
        missing
          ? `${displayTitle}, unavailable`
          : `Open ${finding.node.type} ${displayTitle}`
      }
      accessibilityState={{ disabled: missing }}
      style={({ pressed }) => [styles.workRow, pressed && !missing && styles.workRowPressed]}
    >
      <Text style={styles.workIcon} accessibilityElementsHidden importantForAccessibility="no">
        {status.icon}
      </Text>
      <View style={styles.workBody}>
        <View style={styles.workTitleRow}>
          <Text
            style={[styles.typeDot, finding.node.type === 'goal' ? styles.typeGoal : styles.typeTask]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {typeText}
          </Text>
          <Text
            style={[styles.workTitle, missing && styles.workTitleMissing]}
            maxFontSizeMultiplier={2}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
        </View>
        <Text style={styles.workReason} maxFontSizeMultiplier={2}>
          {reasonText}
        </Text>
        <View style={styles.workBadges}>
          <StatusBadge label={status.label} icon={status.icon} tone={status.tone} />
          {stateTitle !== null && (
            <StatusBadge label={stateTitle} icon="●" tone="info" />
          )}
        </View>
      </View>
      {!missing && (
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  skeletonBlock: {
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.canvas,
  },
  skeletonHero: {
    height: 64,
    borderRadius: radius.card,
  },
  skeletonShort: {
    width: '55%',
  },
  skeletonText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  stateBlock: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.red,
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroLead: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.brandSoft,
  },
  heroNumber: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '500',
    color: colors.white,
  },
  heroZeroTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
    color: colors.white,
  },
  heroCopy: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.brandSoft,
    textAlign: 'right',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3d5650',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.lime,
  },
  heroNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.brandSoft,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  groupLabel: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  categoryCount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  noteRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  noteIcon: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.blue,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
  },
  workRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 54,
  },
  workRowPressed: {
    opacity: 0.7,
  },
  workIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.amber,
  },
  workBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  workTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeDot: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    overflow: 'hidden',
  },
  typeGoal: {
    backgroundColor: colors.blueSoft,
    color: colors.blue,
  },
  typeTask: {
    backgroundColor: colors.brandSoft,
    color: colors.brand,
  },
  workTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  workTitleMissing: {
    color: colors.muted,
    fontStyle: 'italic',
  },
  workReason: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  workBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chevron: {
    fontSize: 18,
    color: colors.muted,
  },
  findingRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  findingIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.amber,
  },
  findingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
});
