import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProjectGoalPursuitView } from '../../../application/projectGoalPursuitQueryService';
import { useAppServices } from '../../composition/AppServicesProvider';
import { useShellNavigation } from '../../navigation/NavigationShell';
import { RelationRejectionSheet, useRelationCommit } from '../../relations';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { StatusBadge } from '../../shared/StatusBadge';
import { colors, radius, spacing } from '../../shared/theme';
import { taskLifecycleFromSnapshot } from '../../tasks/taskLifecycle';
import type { TaskLifecyclePresentation } from '../../tasks/taskLifecycle';
import { requestCrossDestinationDetail } from '../crossDestinationDetail';
import type { ProjectDetailSegmentContext } from '../projectDetailSlots';
import { ProjectPursuitActions } from '../pursuit/ProjectPursuitActions';
import { AddChildFlow } from './AddChildFlow';
import {
  buildStructureRows,
  collectStructureEdges,
  collectStructureFindings,
  describeStructureFinding,
  describeTruncation,
  structureNodeKey,
  summarizeTruncation,
} from './structureTree';
import type {
  StructureNodeRef,
  StructureRootTraversal,
  StructureRow,
} from './structureTree';

/** Local single-user actor recorded in mutation provenance. */
const ACTOR = 'local-user';

const NO_COLLAPSED: ReadonlySet<string> = new Set();

/**
 * Session-level expansion state keyed by Project id and stable typed node
 * identity. The Project detail shell briefly unmounts this segment whenever
 * its own queries reload (which every committed mutation requests), so
 * component state alone cannot honor "a collapsed branch stays collapsed
 * while its node exists" — this store survives those remounts. A branch whose
 * node disappears simply never renders; its stale key is harmless.
 */
const collapsedByProject = new Map<string, Set<string>>();

interface StructureData {
  pursuits: ProjectGoalPursuitView[];
  roots: StructureRootTraversal[];
  /** Node key -> entity title; nodes without an entry are missing endpoints. */
  titles: Record<string, string>;
  /** Node key -> Task lifecycle badge; absent when unavailable. */
  lifecycles: Record<string, TaskLifecyclePresentation | null>;
}

type StructureState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StructureData };

/**
 * The Project detail Structure segment (#135): a deterministic, accessible
 * indented tree of the Project-scoped Goal/Task decomposition, built from the
 * bounded hierarchy query with the Project's pursued Goals as roots (never a
 * fabricated root). Rows expose expand/collapse, type text, title, an
 * inspect-only Task lifecycle badge from the execution snapshot, a contextual
 * add-child action, and a confirmed end-edge action. Loading, error/retry,
 * missing-endpoint, integrity-finding, and traversal-truncation states are
 * explicit; truncation guidance renders only when the query reports it.
 *
 * Presentation only: the decomposition services decide validity, hierarchy
 * safety, and lifecycle meaning; this segment translates their read models.
 */
export function ProjectStructureSegment({ project, refresh }: ProjectDetailSegmentContext) {
  const services = useAppServices();
  const navigation = useShellNavigation();
  const { commit } = useRelationCommit();

  const [state, setState] = useState<StructureState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  /** Bumped when expansion state changes; the state itself lives in `collapsedByProject`. */
  const [, setExpansionVersion] = useState(0);
  const collapsed = collapsedByProject.get(project.id) ?? NO_COLLAPSED;

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      try {
        const pursuits = await services.goalPursuitQueries.listGoalsPursuedByProject(project.id);
        const rootGoals = pursuits.filter((pursuit) => pursuit.goal !== null);
        const traversals = await Promise.all(
          rootGoals.map((pursuit) =>
            services.decompositionQueries.findDescendants(project.id, {
              type: 'goal',
              id: pursuit.goalId,
            }),
          ),
        );
        const traversed: StructureRootTraversal[] = rootGoals.map((pursuit, index) => ({
          root: { type: 'goal', id: pursuit.goalId },
          traversal: traversals[index],
        }));
        // A pursued Goal that is already reachable as another root's child is
        // shown in that branch, not duplicated as a root (the prototype's
        // no-parent rule). The fallback keeps a pure stored cycle visible.
        const childKeys = new Set(
          traversed.flatMap(({ traversal }) =>
            traversal.edges.map((edge) => structureNodeKey(edge.child)),
          ),
        );
        const withoutParents = traversed.filter(
          ({ root }) => !childKeys.has(structureNodeKey(root)),
        );
        const roots = withoutParents.length > 0 ? withoutParents : traversed;
        const nodes = new Map<string, StructureNodeRef>();
        const collect = (node: StructureNodeRef) => nodes.set(structureNodeKey(node), node);
        for (const { root, traversal } of roots) {
          collect(root);
          for (const { node } of traversal.nodes) collect(node);
          for (const edge of traversal.edges) {
            collect(edge.parent);
            collect(edge.child);
          }
        }
        const titles: Record<string, string> = {};
        await Promise.all(
          [...nodes.values()].map(async (node) => {
            const entity =
              node.type === 'goal'
                ? await services.goals.getGoal(node.id)
                : await services.tasks.getTask(node.id);
            if (entity !== null) titles[structureNodeKey(node)] = entity.title;
          }),
        );
        // Lifecycle badges are auxiliary ("when available"): the tree stays
        // authoritative if the snapshot read fails.
        const lifecycles: Record<string, TaskLifecyclePresentation | null> = {};
        try {
          const snapshot = await services.executionSnapshots.getSnapshot(project.id);
          for (const node of nodes.values()) {
            if (node.type !== 'task') continue;
            const key = structureNodeKey(node);
            if (titles[key] === undefined) continue;
            lifecycles[key] = taskLifecycleFromSnapshot(snapshot, node.id);
          }
        } catch {
          // No badges this render; the tree is unaffected.
        }
        if (!cancelled) setState({ status: 'ready', data: { pursuits, roots, titles, lifecycles } });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The structure could not be loaded. No changes were made.',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id, reloadToken, services]);

  /** After a committed mutation: re-run the tree and the detail's projections. */
  const afterMutation = useCallback(() => {
    reload();
    refresh();
  }, [reload, refresh]);

  function toggleNode(node: StructureNodeRef) {
    const key = structureNodeKey(node);
    const next = new Set(collapsedByProject.get(project.id) ?? []);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    collapsedByProject.set(project.id, next);
    setExpansionVersion((version) => version + 1);
  }

  function openNode(node: StructureNodeRef) {
    const destination = node.type === 'goal' ? 'goals' : 'tasks';
    requestCrossDestinationDetail({ destination, entityId: node.id });
    navigation.switchDestination(destination);
  }

  function openAddChild(node: StructureNodeRef, title: string, edges: ReturnType<typeof collectStructureEdges>) {
    navigation.presentSheet(
      <AddChildFlow
        project={project}
        parent={{ node, title }}
        edges={edges}
        onCommitted={afterMutation}
        onClose={navigation.dismissSheet}
      />,
    );
  }

  function openEndEdge(row: StructureRow, data: StructureData) {
    const edge = row.via!;
    const childTitle = data.titles[structureNodeKey(row.node)] ?? 'Missing endpoint';
    const parentTitle = data.titles[structureNodeKey(edge.parent)] ?? 'Missing endpoint';
    async function confirmEnd() {
      const outcome = await commit(
        () => services.decomposition.end({ relationId: edge.relationId, actor: ACTOR }),
        { successMessage: 'Decomposition ended', refresh: [afterMutation] },
      );
      navigation.dismissSheet();
      if (outcome.status === 'rejected') {
        navigation.presentSheet(
          <RelationRejectionSheet
            visible
            feedback={outcome.feedback}
            onReviewAnotherChoice={navigation.dismissSheet}
            onRetry={
              outcome.feedback.retryable
                ? () => {
                    void confirmEnd();
                  }
                : undefined
            }
            onClose={navigation.dismissSheet}
          />,
        );
      }
    }
    navigation.presentSheet(
      <ConfirmDialog
        visible
        title="End this decomposition?"
        message={
          `"${parentTitle}" will no longer contain "${childTitle}" in this Project. ` +
          'Only the active connection ends — both items and their past relationship remain in history.'
        }
        confirmLabel="End decomposition"
        destructive
        onCancel={navigation.dismissSheet}
        onConfirm={() => {
          void confirmEnd();
        }}
      />,
    );
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.stateBlock} accessibilityLabel="Loading structure">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.stateText}>Loading structure…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.stateBlock}>
        <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
          !
        </Text>
        <Text style={styles.stateTitle}>Structure unavailable</Text>
        <Text style={styles.stateText}>{state.message}</Text>
        <Pressable
          onPress={reload}
          accessibilityRole="button"
          accessibilityLabel="Retry loading structure"
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { data } = state;
  const archived = project.archivedAt !== null;

  if (data.roots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon} accessibilityElementsHidden importantForAccessibility="no">
          ⌁
        </Text>
        <Text style={styles.emptyTitle} maxFontSizeMultiplier={2}>
          No structure yet
        </Text>
        <Text style={styles.emptyMessage} maxFontSizeMultiplier={2}>
          A pursued Goal becomes the root of this Project hierarchy.
        </Text>
        {!archived && (
          <View style={styles.emptyActions}>
            <ProjectPursuitActions project={project} pursuits={data.pursuits} onChanged={afterMutation} />
          </View>
        )}
      </View>
    );
  }

  const rows = buildStructureRows(data.roots, collapsed);
  const findings = collectStructureFindings(data.roots);
  const truncation = summarizeTruncation(data.roots);
  const edges = collectStructureEdges(data.roots);

  return (
    <View>
      <View style={styles.note}>
        <Text style={styles.noteIcon} accessibilityElementsHidden importantForAccessibility="no">
          ↳
        </Text>
        <View style={styles.noteBody}>
          <Text style={styles.noteTitle} maxFontSizeMultiplier={2}>
            Project-scoped decomposition
          </Text>
          <Text style={styles.noteText} maxFontSizeMultiplier={2}>
            Expand branches or add a child. Goal → Goal or Task and Task → Task are the valid
            directions.
          </Text>
        </View>
      </View>

      {truncation !== null && (
        <View
          style={[styles.note, styles.noteWarning]}
          accessibilityLabel="Partial structure warning"
        >
          <Text style={styles.noteIcon} accessibilityElementsHidden importantForAccessibility="no">
            ✂
          </Text>
          <View style={styles.noteBody}>
            <Text style={styles.noteTitle} maxFontSizeMultiplier={2}>
              Partial structure
            </Text>
            <Text style={styles.noteText} maxFontSizeMultiplier={2}>
              {describeTruncation(truncation)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.tree} accessibilityLabel="Project structure">
        {rows.map((row) => (
          <StructureRowView
            key={structureNodeKey(row.node)}
            row={row}
            data={data}
            archived={archived}
            collapsed={collapsed}
            onToggle={toggleNode}
            onOpen={openNode}
            onAddChild={(node, title) => openAddChild(node, title, edges)}
            onEndEdge={(target) => openEndEdge(target, data)}
          />
        ))}
      </View>

      {findings.length > 0 && (
        <View style={styles.findings}>
          <Text style={styles.findingsTitle} maxFontSizeMultiplier={2}>
            Structure findings
          </Text>
          {findings.map((finding, index) => {
            const item = describeStructureFinding(finding);
            return (
              <View key={`${finding.kind}-${index}`} style={styles.findingRow}>
                <Text style={styles.findingIcon} accessibilityElementsHidden
                  importantForAccessibility="no">
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

interface StructureRowViewProps {
  row: StructureRow;
  data: StructureData;
  archived: boolean;
  collapsed: ReadonlySet<string>;
  onToggle: (node: StructureNodeRef) => void;
  onOpen: (node: StructureNodeRef) => void;
  onAddChild: (node: StructureNodeRef, title: string) => void;
  onEndEdge: (row: StructureRow) => void;
}

function StructureRowView({
  row,
  data,
  archived,
  collapsed,
  onToggle,
  onOpen,
  onAddChild,
  onEndEdge,
}: StructureRowViewProps) {
  const key = structureNodeKey(row.node);
  const title = data.titles[key];
  const missing = title === undefined;
  const displayTitle = title ?? 'Missing endpoint';
  const expanded = !collapsed.has(key);
  const lifecycle = row.node.type === 'task' ? (data.lifecycles[key] ?? null) : null;
  const typeText = row.node.type === 'goal' ? 'GOAL' : 'TASK';

  return (
    <View style={[styles.row, { paddingLeft: spacing.md + row.depth * 18 }]}>
      {row.hasChildren ? (
        <Pressable
          onPress={() => onToggle(row.node)}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${displayTitle}`}
          accessibilityState={{ expanded }}
          hitSlop={8}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>{expanded ? '▾' : '▸'}</Text>
        </Pressable>
      ) : (
        <View style={styles.toggle} />
      )}
      <Pressable
        onPress={() => onOpen(row.node)}
        disabled={missing}
        accessibilityRole="button"
        accessibilityLabel={
          missing ? 'Missing endpoint, unavailable' : `Open ${row.node.type} ${displayTitle}`
        }
        accessibilityState={{ disabled: missing }}
        style={({ pressed }) => [styles.rowMain, pressed && !missing && styles.rowPressed]}
      >
        <Text
          style={[styles.typeDot, row.node.type === 'goal' ? styles.typeGoal : styles.typeTask]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {typeText}
        </Text>
        <Text
          style={[styles.rowTitle, missing && styles.rowTitleMissing]}
          maxFontSizeMultiplier={2}
          numberOfLines={2}
        >
          {displayTitle}
        </Text>
        {lifecycle !== null && (
          <StatusBadge
            label={lifecycle.badgeLabel}
            icon={lifecycle.badgeIcon}
            tone={lifecycle.badgeTone}
          />
        )}
      </Pressable>
      {!archived && !missing && (
        <Pressable
          onPress={() => onAddChild(row.node, displayTitle)}
          accessibilityRole="button"
          accessibilityLabel={`Add a child to ${displayTitle}`}
          hitSlop={8}
          style={styles.rowAction}
        >
          <Text style={styles.rowActionText}>＋</Text>
        </Pressable>
      )}
      {!archived && row.via !== null && (
        <Pressable
          onPress={() => onEndEdge(row)}
          accessibilityRole="button"
          accessibilityLabel={`End decomposition of ${displayTitle}`}
          hitSlop={8}
          style={styles.rowAction}
        >
          <Text style={styles.endActionText}>✂</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  empty: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 26,
    color: colors.brand,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: spacing.sm,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  noteWarning: {
    backgroundColor: colors.amberSoft,
  },
  noteIcon: {
    fontSize: 14,
    color: colors.ink,
  },
  noteBody: {
    flex: 1,
    gap: spacing.xs,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  tree: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 54,
  },
  toggle: {
    width: 28,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleText: {
    fontSize: 13,
    color: colors.brand,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    opacity: 0.7,
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
  rowTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  rowTitleMissing: {
    color: colors.muted,
    fontStyle: 'italic',
  },
  rowAction: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  rowActionText: {
    fontSize: 18,
    color: colors.brand,
  },
  endActionText: {
    fontSize: 14,
    color: colors.red,
  },
  findings: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  findingsTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
