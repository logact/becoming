import React, { createContext, useContext, useMemo } from 'react';

import type { AttentionService } from '../../application/attention/AttentionService';
import type { PinCandidatesService } from '../../application/attention/PinCandidatesService';
import type { DashboardService } from '../../application/dashboard/DashboardService';

/**
 * Composed application services exposed to the UI layer. The composition
 * root (composeServices) builds them on top of the SQLite repositories
 * before the app shell renders; screens consume them via useAppServices().
 */
export interface AppServices {
  dashboard: DashboardService;
  attention: AttentionService;
  pinCandidates: PinCandidatesService;
}

const AppServicesContext = createContext<AppServices | null>(null);

export interface AppServicesProviderProps {
  children: React.ReactNode;
  services: AppServices;
}

export function AppServicesProvider({ children, services }: AppServicesProviderProps) {
  const value = useMemo<AppServices>(() => services, [services]);
  return <AppServicesContext.Provider value={value}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error('useAppServices must be used within an AppServicesProvider');
  }
  return services;
}
