import React, { createContext, useContext, useMemo } from 'react';

import type { AttentionService } from '../../application/attention/AttentionService';
import type { PinCandidatesService } from '../../application/attention/PinCandidatesService';
import type { DashboardService } from '../../application/dashboard/DashboardService';
import type { GoalDetailService } from '../../application/goal/GoalDetailService';
import type { GoalsOverviewService } from '../../application/goal/GoalsOverviewService';
import type { LibraryOverviewService } from '../../application/library/LibraryOverviewService';
import type { AddMilestoneService } from '../../application/project/AddMilestoneService';
import type { AddSubGoalService } from '../../application/project/AddSubGoalService';
import type { AddTaskService } from '../../application/project/AddTaskService';
import type { ProjectDetailService } from '../../application/project/ProjectDetailService';
import type { ProjectsOverviewService } from '../../application/project/ProjectsOverviewService';
import type { AllocateResourceService } from '../../application/resource/AllocateResourceService';
import type { ResourcePoolsService } from '../../application/resource/ResourcePoolsService';

/**
 * Composed application services exposed to the UI layer. The composition
 * root (composeServices) builds them on top of the SQLite repositories
 * before the app shell renders; screens consume them via useAppServices().
 */
export interface AppServices {
  dashboard: DashboardService;
  attention: AttentionService;
  pinCandidates: PinCandidatesService;
  goalsOverview: GoalsOverviewService;
  goalDetail: GoalDetailService;
  projectsOverview: ProjectsOverviewService;
  projectDetail: ProjectDetailService;
  libraryOverview: LibraryOverviewService;
  /** Command/read services behind the add-plan-item and allocate-resource screens. */
  addSubGoal: AddSubGoalService;
  addTask: AddTaskService;
  addMilestone: AddMilestoneService;
  allocateResource: AllocateResourceService;
  resourcePools: ResourcePoolsService;
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
