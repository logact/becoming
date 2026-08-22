import React, { createContext, useContext, useMemo } from 'react';

import type { AttentionService } from '../../application/attention/AttentionService';
import type { PinCandidatesService } from '../../application/attention/PinCandidatesService';
import type { DashboardService } from '../../application/dashboard/DashboardService';
import type { GoalDetailService } from '../../application/goal/GoalDetailService';
import type { GoalsOverviewService } from '../../application/goal/GoalsOverviewService';
import type { CaptureIdeaService } from '../../application/idea/CaptureIdeaService';
import type { ChangeIdeaStatusService } from '../../application/idea/ChangeIdeaStatusService';
import type { CreateGoalFromIdeaService } from '../../application/idea/CreateGoalFromIdeaService';
import type { CreateTaskFromIdeaService } from '../../application/idea/CreateTaskFromIdeaService';
import type { EditIdeaService } from '../../application/idea/EditIdeaService';
import type { IdeaDerivationOptionsService } from '../../application/idea/IdeaDerivationOptionsService';
import type { IdeaDetailService } from '../../application/idea/IdeaDetailService';
import type { IdeasOverviewService } from '../../application/idea/IdeasOverviewService';
import type { LibraryOverviewService } from '../../application/library/LibraryOverviewService';
import type { ArchiveNoteService } from '../../application/note/ArchiveNoteService';
import type { CaptureNoteService } from '../../application/note/CaptureNoteService';
import type { DeleteNoteService } from '../../application/note/DeleteNoteService';
import type { EditNoteService } from '../../application/note/EditNoteService';
import type { ExtractNoteFromIdeaService } from '../../application/note/ExtractNoteFromIdeaService';
import type { LinkNoteService } from '../../application/note/LinkNoteService';
import type { NoteDetailService } from '../../application/note/NoteDetailService';
import type { NoteLinkOptionsService } from '../../application/note/NoteLinkOptionsService';
import type { NotesOverviewService } from '../../application/note/NotesOverviewService';
import type { SetNotePinService } from '../../application/note/SetNotePinService';
import type { AddMilestoneService } from '../../application/project/AddMilestoneService';
import type { AddSubGoalService } from '../../application/project/AddSubGoalService';
import type { AddTaskService } from '../../application/project/AddTaskService';
import type { ProjectDetailService } from '../../application/project/ProjectDetailService';
import type { ProjectsOverviewService } from '../../application/project/ProjectsOverviewService';
import type { AllocateResourceService } from '../../application/resource/AllocateResourceService';
import type { ResourcePoolsService } from '../../application/resource/ResourcePoolsService';
import type { TaskDetailService } from '../../application/task/TaskDetailService';
import type { TaskLifecycleService } from '../../application/task/TaskLifecycleService';
import type { TasksOverviewService } from '../../application/task/TasksOverviewService';

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
  tasksOverview: TasksOverviewService;
  taskDetail: TaskDetailService;
  taskLifecycle: TaskLifecycleService;
  ideasOverview: IdeasOverviewService;
  ideaDetail: IdeaDetailService;
  ideaDerivationOptions: IdeaDerivationOptionsService;
  captureIdea: CaptureIdeaService;
  editIdea: EditIdeaService;
  changeIdeaStatus: ChangeIdeaStatusService;
  createGoalFromIdea: CreateGoalFromIdeaService;
  createTaskFromIdea: CreateTaskFromIdeaService;
  extractNoteFromIdea: ExtractNoteFromIdeaService;
  notesOverview: NotesOverviewService;
  noteDetail: NoteDetailService;
  noteLinkOptions: NoteLinkOptionsService;
  captureNote: CaptureNoteService;
  editNote: EditNoteService;
  setNotePin: SetNotePinService;
  archiveNote: ArchiveNoteService;
  linkNote: LinkNoteService;
  deleteNote: DeleteNoteService;
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
