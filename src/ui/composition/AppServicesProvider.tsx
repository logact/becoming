import React, { createContext, useContext, useMemo } from 'react';

/**
 * Composed application services exposed to the UI layer.
 * Filled in as application services (goalService, taskService, …)
 * are implemented; screens consume them via useAppServices().
 */
export interface AppServices {
  // Placeholder: application services are registered here as they land.
}

const AppServicesContext = createContext<AppServices | null>(null);

export interface AppServicesProviderProps {
  children: React.ReactNode;
  services?: AppServices;
}

export function AppServicesProvider({ children, services }: AppServicesProviderProps) {
  const value = useMemo<AppServices>(() => services ?? {}, [services]);
  return <AppServicesContext.Provider value={value}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error('useAppServices must be used within an AppServicesProvider');
  }
  return services;
}
