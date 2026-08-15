import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../shared/theme';

export type DestinationId = 'goals' | 'projects' | 'tasks';

export interface ShellRoute {
  name: 'list' | 'detail';
  /** Present on detail routes. */
  entityId?: string;
}

/**
 * One top-level destination. Screens are supplied by callers (M2 tasks
 * provide the real Goal/Project/Task screens); the shell only owns which
 * destination and route is visible.
 */
export interface ShellDestination {
  id: DestinationId;
  /** Tab label, e.g. 'Goals'. */
  title: string;
  /** Short non-color glyph shown above the tab label. */
  icon: string;
  renderList: () => ReactElement;
  /** Omit to make the destination list-only; openDetail is then a no-op. */
  renderDetail?: (entityId: string) => ReactElement;
}

export interface ShellNavigationValue {
  destination: DestinationId;
  /** Top route of the active destination's stack. */
  route: ShellRoute;
  /** Push a detail route onto the active destination. */
  openDetail: (entityId: string) => void;
  /** Pop back to the list route; a no-op on the list route. */
  goBack: () => void;
  /** Switch top-level destination. Each destination keeps its own stack. */
  switchDestination: (id: DestinationId) => void;
  /**
   * Present overlay content (a Sheet, ConfirmDialog, or similar) above the
   * current screen. Only one sheet is presented at a time.
   */
  presentSheet: (content: ReactNode) => void;
  dismissSheet: () => void;
}

const ShellNavigationContext = createContext<ShellNavigationValue | null>(null);

export function useShellNavigation(): ShellNavigationValue {
  const value = useContext(ShellNavigationContext);
  if (value === null) throw new Error('useShellNavigation must be used within a NavigationShell');
  return value;
}

export interface NavigationShellProps {
  destinations: readonly ShellDestination[];
  initialDestination?: DestinationId;
}

/**
 * Lightweight state-driven navigation shell: a bottom tab bar over the
 * Goals, Projects, and Tasks destinations, each with a minimal list ->
 * detail stack plus a single sheet presentation slot. Deliberately not a
 * general navigation library — real navigation is planned separately.
 */
export function NavigationShell({ destinations, initialDestination }: NavigationShellProps) {
  const [active, setActive] = useState<DestinationId>(
    () => initialDestination ?? destinations[0]?.id ?? 'goals',
  );
  const [stacks, setStacks] = useState<Record<DestinationId, ShellRoute[]>>(() =>
    Object.fromEntries(destinations.map((d) => [d.id, [{ name: 'list' as const }]])) as Record<
      DestinationId,
      ShellRoute[]
    >,
  );
  const [sheet, setSheet] = useState<ReactNode>(null);

  const openDetail = useCallback((entityId: string) => {
    setStacks((previous) => ({
      ...previous,
      [active]: [...(previous[active] ?? [{ name: 'list' as const }]), { name: 'detail' as const, entityId }],
    }));
  }, [active]);

  const goBack = useCallback(() => {
    setStacks((previous) => {
      const stack = previous[active] ?? [{ name: 'list' as const }];
      return { ...previous, [active]: stack.length > 1 ? stack.slice(0, -1) : stack };
    });
  }, [active]);

  const switchDestination = useCallback((id: DestinationId) => {
    setSheet(null);
    setActive(id);
  }, []);

  const presentSheet = useCallback((content: ReactNode) => setSheet(() => content), []);
  const dismissSheet = useCallback(() => setSheet(null), []);

  const value = useMemo<ShellNavigationValue>(() => {
    const stack = stacks[active] ?? [{ name: 'list' as const }];
    return {
      destination: active,
      route: stack[stack.length - 1],
      openDetail,
      goBack,
      switchDestination,
      presentSheet,
      dismissSheet,
    };
  }, [active, stacks, openDetail, goBack, switchDestination, presentSheet, dismissSheet]);

  const current = destinations.find((d) => d.id === active) ?? destinations[0];

  return (
    <ShellNavigationContext.Provider value={value}>
      <View style={styles.shell}>
        <View style={styles.screen}>
          {current && renderCurrentRoute(current, value.route)}
        </View>
        {sheet !== null && <View style={styles.sheetSlot}>{sheet}</View>}
        <View style={styles.tabBar} accessibilityRole="tablist" accessibilityLabel="Primary">
          {destinations.map((destination) => {
            const selected = destination.id === active;
            return (
              <Pressable
                key={destination.id}
                onPress={() => switchDestination(destination.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${destination.title} tab`}
                style={styles.tab}
              >
                <Text style={[styles.tabIcon, selected && styles.tabSelected]}>
                  {destination.icon}
                </Text>
                <Text style={[styles.tabLabel, selected && styles.tabSelected]}>
                  {destination.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ShellNavigationContext.Provider>
  );
}

function renderCurrentRoute(destination: ShellDestination, route: ShellRoute): ReactElement {
  if (route.name === 'detail' && route.entityId !== undefined && destination.renderDetail) {
    return destination.renderDetail(route.entityId);
  }
  return destination.renderList();
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  screen: {
    flex: 1,
  },
  sheetSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  tabIcon: {
    fontSize: 18,
    color: colors.muted,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  tabSelected: {
    color: colors.brand,
  },
});
