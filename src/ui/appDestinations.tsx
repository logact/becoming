import React from 'react';

import type { ShellDestination } from './navigation/NavigationShell';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { AttentionPinPage } from './pages/dashboard/AttentionPinPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';

/**
 * Top-level destinations of the app shell. The dashboard renders its real
 * page and the "Pin to attention" pushed screen; Library and Setting still
 * render PlaceholderPage until their tasks land.
 */
export function appDestinations(): ShellDestination[] {
  return [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'grid',
      renderList: () => <DashboardPage />,
      renderScreen: (screenId) => (screenId === 'attention-pin' ? <AttentionPinPage /> : null),
    },
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <PlaceholderPage title="Library" />,
    },
    {
      id: 'setting',
      title: 'Setting',
      icon: 'gear',
      renderList: () => <PlaceholderPage title="Setting" />,
    },
  ];
}
