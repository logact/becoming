import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ShellDestination } from './navigation/NavigationShell';

function PlaceholderList({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>Nothing here yet.</Text>
    </View>
  );
}

/**
 * Top-level destinations shown until the real pages under src/ui/pages
 * are implemented.
 */
export function appDestinations(): ShellDestination[] {
  return [
    {
      id: 'goals',
      title: 'Goals',
      icon: '◎',
      renderList: () => <PlaceholderList title="Goals" />,
    },
    {
      id: 'projects',
      title: 'Projects',
      icon: '▦',
      renderList: () => <PlaceholderList title="Projects" />,
    },
    {
      id: 'tasks',
      title: 'Tasks',
      icon: '✓',
      renderList: () => <PlaceholderList title="Tasks" />,
    },
  ];
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  hint: { fontSize: 14, color: '#888' },
});
