import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** A top-level tab destination of the app shell. */
export interface ShellDestination {
  id: string;
  title: string;
  icon: string;
  renderList: () => React.ReactElement;
  renderDetail?: (entityId: string) => React.ReactElement;
}

/** Navigation actions available to screens inside the shell. */
export interface ShellNavigation {
  openDetail: (entityId: string) => void;
  goBack: () => void;
  presentSheet: (content: React.ReactElement) => void;
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
 * Minimal app shell: a bottom tab bar over per-destination content.
 * Detail navigation and sheets are stubbed with a single detail slot
 * per destination; routing grows from here.
 */
export function NavigationShell({ destinations }: NavigationShellProps) {
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState(destinations[0]?.id);
  const [detailIds, setDetailIds] = useState<Record<string, string | null>>({});
  const [sheet, setSheet] = useState<React.ReactElement | null>(null);

  const active = destinations.find((d) => d.id === activeId) ?? destinations[0];
  const activeDetailId = active ? detailIds[active.id] : null;

  const navigation = useMemo<ShellNavigation>(
    () => ({
      openDetail: (entityId) => {
        if (active) setDetailIds((prev) => ({ ...prev, [active.id]: entityId }));
      },
      goBack: () => {
        if (active) setDetailIds((prev) => ({ ...prev, [active.id]: null }));
      },
      presentSheet: setSheet,
      dismissSheet: () => setSheet(null),
    }),
    [active],
  );

  const renderContent = useCallback(() => {
    if (!active) return null;
    if (activeDetailId != null && active.renderDetail) {
      return active.renderDetail(activeDetailId);
    }
    return active.renderList();
  }, [active, activeDetailId]);

  return (
    <ShellNavigationContext.Provider value={navigation}>
      <View style={styles.container}>
        <View style={styles.content}>{renderContent()}</View>
        {sheet ? <View style={styles.sheet}>{sheet}</View> : null}
        <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
          {destinations.map((destination) => (
            <Pressable
              key={destination.id}
              accessibilityLabel={`${destination.title} tab`}
              accessibilityRole="button"
              onPress={() => setActiveId(destination.id)}
              style={styles.tab}
            >
              <Text style={styles.tabIcon}>{destination.icon}</Text>
              <Text
                style={[
                  styles.tabTitle,
                  destination.id === active?.id && styles.tabTitleActive,
                ]}
              >
                {destination.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ShellNavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    backgroundColor: '#fff',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabIcon: { fontSize: 18 },
  tabTitle: { fontSize: 12, color: '#666' },
  tabTitleActive: { color: '#000', fontWeight: '600' },
});
