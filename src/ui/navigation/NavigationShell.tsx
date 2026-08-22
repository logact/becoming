import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureFloatingButton } from '../components/CaptureFloatingButton';
import { useOptionalAppServices } from '../composition/AppServicesProvider';
import { Icon, type IconName } from '../components/Icon';
import { useOptionalToast } from '../shared/Toast';
import { colors } from '../shared/theme';
import { CaptureRevisionContext } from './CaptureRevision';
import { GlobalCapture } from './GlobalCapture';

/** A top-level tab destination of the app shell. */
export interface ShellDestination {
  id: string;
  title: string;
  icon: IconName;
  renderList: () => React.ReactElement;
  /** Null renders nothing (unknown entity / screen id). */
  renderDetail?: (entityId: string) => React.ReactElement | null;
  renderScreen?: (screenId: string) => React.ReactElement | null;
}

/** One pushed entry on a destination's navigation stack. */
export type ShellStackEntry =
  | { kind: 'detail'; entityId: string }
  | { kind: 'screen'; screenId: string };

/** Navigation actions available to screens inside the shell. */
export interface ShellNavigation {
  /** Push a detail view for an entity onto the active destination's stack. */
  openDetail: (entityId: string) => void;
  /** Push a named screen onto the active destination's stack. */
  pushScreen: (screenId: string) => void;
  /** Pop the top entry off the active destination's stack. */
  goBack: () => void;
  /** Present a bottom sheet above the shell. */
  presentSheet: (content: React.ReactElement) => void;
  /** Dismiss the currently presented sheet. */
  dismissSheet: () => void;
}

const ShellNavigationContext = createContext<ShellNavigation | null>(null);

export function useShellNavigation(): ShellNavigation {
  const navigation = useContext(ShellNavigationContext);
  if (!navigation) {
    throw new Error('useShellNavigation must be used within a NavigationShell');
  }
  return navigation;
}

interface NavigationShellProps {
  destinations: ShellDestination[];
}

/**
 * App shell: a bottom tab bar over per-destination navigation stacks.
 * Only the top of the active destination's stack renders; inactive
 * destinations unmount entirely, so remounting refetches their data.
 * Pushed screens hide the tab bar (per docs/design/design-style.md).
 */
export function NavigationShell({ destinations }: NavigationShellProps) {
  const insets = useSafeAreaInsets();
  const services = useOptionalAppServices();
  const toast = useOptionalToast();
  const [activeId, setActiveId] = useState(destinations[0]?.id);
  const [stacks, setStacks] = useState<Record<string, ShellStackEntry[]>>({});
  const [sheet, setSheet] = useState<React.ReactElement | null>(null);
  const [captureVisible, setCaptureVisible] = useState(false);
  const [captureRevision, setCaptureRevision] = useState(0);

  const active = destinations.find((d) => d.id === activeId) ?? destinations[0];
  const activeStack = active ? stacks[active.id] ?? [] : [];
  const top = activeStack[activeStack.length - 1];
  const captureAvailable = services?.quickCapture !== undefined
    && services.captureOptions !== undefined
    && toast !== null;
  const incrementCaptureRevision = useCallback(() => {
    setCaptureRevision((revision) => revision + 1);
  }, []);
  const captureRevisionValue = useMemo(
    () => ({ revision: captureRevision, increment: incrementCaptureRevision }),
    [captureRevision, incrementCaptureRevision],
  );

  const navigation = useMemo<ShellNavigation>(
    () => ({
      openDetail: (entityId) => {
        if (active) {
          setStacks((prev) => ({
            ...prev,
            [active.id]: [...(prev[active.id] ?? []), { kind: 'detail', entityId }],
          }));
        }
      },
      pushScreen: (screenId) => {
        if (active) {
          setStacks((prev) => ({
            ...prev,
            [active.id]: [...(prev[active.id] ?? []), { kind: 'screen', screenId }],
          }));
        }
      },
      goBack: () => {
        if (active) {
          setStacks((prev) => ({
            ...prev,
            [active.id]: (prev[active.id] ?? []).slice(0, -1),
          }));
        }
      },
      presentSheet: setSheet,
      dismissSheet: () => setSheet(null),
    }),
    [active],
  );

  const renderContent = () => {
    if (!active) return null;
    if (top?.kind === 'detail' && active.renderDetail) {
      return active.renderDetail(top.entityId);
    }
    if (top?.kind === 'screen' && active.renderScreen) {
      return active.renderScreen(top.screenId);
    }
    return active.renderList();
  };

  return (
    <CaptureRevisionContext.Provider value={captureRevisionValue}>
      <ShellNavigationContext.Provider value={navigation}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.content}>{renderContent()}</View>
          {activeStack.length === 0 ? (
            <View testID="tab-bar" style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
              {destinations.map((destination) => {
                const isActive = destination.id === active?.id;
                return (
                  <Pressable
                    key={destination.id}
                    accessibilityLabel={`${destination.title} tab`}
                    accessibilityRole="button"
                    onPress={() => setActiveId(destination.id)}
                    style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
                  >
                    <View style={[styles.tabIconChip, isActive && styles.tabIconChipActive]}>
                      <Icon
                        name={destination.icon}
                        size={20}
                        color={isActive ? colors.green : colors.faint}
                      />
                    </View>
                    <Text style={[styles.tabTitle, isActive && styles.tabTitleActive]}>
                      {destination.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {captureAvailable && sheet === null && !captureVisible ? (
            <CaptureFloatingButton
              bottomOffset={insets.bottom + (activeStack.length === 0 ? 76 : 16)}
              onPress={() => setCaptureVisible(true)}
            />
          ) : null}
          {captureAvailable ? (
            <GlobalCapture visible={captureVisible} onDismiss={() => setCaptureVisible(false)} />
          ) : null}
          {sheet ? (
            <View testID="shell-sheet-overlay" style={styles.sheetOverlay}>
              <View style={styles.sheet}>{sheet}</View>
            </View>
          ) : null}
        </View>
      </ShellNavigationContext.Provider>
    </CaptureRevisionContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  pressed: { opacity: 0.5 },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,30,24,0.25)',
    zIndex: 60,
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.tabBarBg,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabIconChip: {
    width: 46,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconChipActive: { backgroundColor: colors.mint },
  tabTitle: { fontSize: 10.5, fontWeight: '600', color: colors.faint, marginTop: 2 },
  tabTitleActive: { color: colors.green },
});
