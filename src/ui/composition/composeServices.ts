import { AttentionService } from '../../application/attention/AttentionService';
import { PinCandidatesService } from '../../application/attention/PinCandidatesService';
import { CaptureOptionsService } from '../../application/capture/CaptureOptionsService';
import { QuickCaptureService } from '../../application/capture/QuickCaptureService';
import { DashboardService } from '../../application/dashboard/DashboardService';
import { GoalDetailService } from '../../application/goal/GoalDetailService';
import { SelectCurrentPlanService } from '../../application/goal/SelectCurrentPlanService';
import { GoalsOverviewService } from '../../application/goal/GoalsOverviewService';
import { CaptureIdeaService } from '../../application/idea/CaptureIdeaService';
import { ChangeIdeaStatusService } from '../../application/idea/ChangeIdeaStatusService';
import { CreateGoalFromIdeaService } from '../../application/idea/CreateGoalFromIdeaService';
import { CreateTaskFromIdeaService } from '../../application/idea/CreateTaskFromIdeaService';
import { EditIdeaService } from '../../application/idea/EditIdeaService';
import { IdeaDerivationOptionsService } from '../../application/idea/IdeaDerivationOptionsService';
import { IdeaDetailService } from '../../application/idea/IdeaDetailService';
import { IdeasOverviewService } from '../../application/idea/IdeasOverviewService';
import { LibraryOverviewService } from '../../application/library/LibraryOverviewService';
import { ArchiveNoteService } from '../../application/note/ArchiveNoteService';
import { CaptureNoteService } from '../../application/note/CaptureNoteService';
import { DeleteNoteService } from '../../application/note/DeleteNoteService';
import { EditNoteService } from '../../application/note/EditNoteService';
import { ExtractNoteFromIdeaService } from '../../application/note/ExtractNoteFromIdeaService';
import { LinkNoteService } from '../../application/note/LinkNoteService';
import { NoteDetailService } from '../../application/note/NoteDetailService';
import { NoteLinkOptionsService } from '../../application/note/NoteLinkOptionsService';
import { NotesOverviewService } from '../../application/note/NotesOverviewService';
import { SetNotePinService } from '../../application/note/SetNotePinService';
import { AddMilestoneService } from '../../application/project/AddMilestoneService';
import { AddSubGoalService } from '../../application/project/AddSubGoalService';
import { AddTaskService } from '../../application/project/AddTaskService';
import { CreateGoalProjectService } from '../../application/project/CreateGoalProjectService';
import { ProjectDetailService } from '../../application/project/ProjectDetailService';
import { ProjectsOverviewService } from '../../application/project/ProjectsOverviewService';
import { AllocateResourceService } from '../../application/resource/AllocateResourceService';
import { ConsumeResourceService } from '../../application/resource/ConsumeResourceService';
import { ResourcePoolsService } from '../../application/resource/ResourcePoolsService';
import { TaskDetailService } from '../../application/task/TaskDetailService';
import { TaskLifecycleService } from '../../application/task/TaskLifecycleService';
import { TasksOverviewService } from '../../application/task/TasksOverviewService';
import { openExpoDatabase } from '../../infrastructure/sqliteRepository/ExpoSqliteDatabase';
import { migrate } from '../../infrastructure/sqliteRepository/schema';
import { SqliteAttentionEntryRepository } from '../../infrastructure/sqliteRepository/SqliteAttentionEntryRepository';
import { SqliteGoalRepository } from '../../infrastructure/sqliteRepository/SqliteGoalRepository';
import { SqliteIdeaRepository } from '../../infrastructure/sqliteRepository/SqliteIdeaRepository';
import { SqliteLabelRepository } from '../../infrastructure/sqliteRepository/SqliteLabelRepository';
import { SqliteMilestoneRepository } from '../../infrastructure/sqliteRepository/SqliteMilestoneRepository';
import { SqliteNoteRepository } from '../../infrastructure/sqliteRepository/SqliteNoteRepository';
import { SqliteProjectRepository } from '../../infrastructure/sqliteRepository/SqliteProjectRepository';
import { SqliteRecordRepository } from '../../infrastructure/sqliteRepository/SqliteRecordRepository';
import { SqliteRelationRepository } from '../../infrastructure/sqliteRepository/SqliteRelationRepository';
import { SqliteResourceRepository } from '../../infrastructure/sqliteRepository/SqliteResourceRepository';
import { SqliteTaskRepository } from '../../infrastructure/sqliteRepository/SqliteTaskRepository';
import { SqliteTransactionRunner } from '../../infrastructure/sqliteRepository/SqliteTransactionRunner';
import type { AppServices } from './AppServicesProvider';
import { seedDevData } from './devSeed';

export interface ComposeServicesOptions {
  /**
   * DEV ONLY: when true and the database holds no goals yet, a
   * prototype-like dataset is seeded so the dashboard is visibly alive on
   * first launch.
   */
  seed?: boolean;
}

/**
 * Composition root: opens (and migrates) the on-device SQLite database,
 * builds the repositories and application services on top of it, and returns
 * the services the UI consumes. Rejects when the database cannot be opened
 * or migrated; the caller renders the error state.
 */
export async function composeServices(options: ComposeServicesOptions = {}): Promise<AppServices> {
  const db = await openExpoDatabase('becoming.db');
  await migrate(db);

  const goals = new SqliteGoalRepository(db);
  const tasks = new SqliteTaskRepository(db);
  const ideas = new SqliteIdeaRepository(db);
  const projects = new SqliteProjectRepository(db);
  const resources = new SqliteResourceRepository(db);
  const relations = new SqliteRelationRepository(db);
  const records = new SqliteRecordRepository(db);
  const attentionEntries = new SqliteAttentionEntryRepository(db);
  const labels = new SqliteLabelRepository(db);
  const milestones = new SqliteMilestoneRepository(db);
  const notes = new SqliteNoteRepository(db);
  const transactionRunner = new SqliteTransactionRunner(db);

  if (options.seed === true && (await goals.list()).length === 0) {
    await seedDevData({
      goals,
      tasks,
      ideas,
      projects,
      resources,
      records,
      relations,
      milestones,
      notes,
      consumeResource: new ConsumeResourceService(resources, relations, records),
    });
  }

  return {
    quickCapture: new QuickCaptureService(
      ideas, goals, tasks, notes, projects, records, relations, transactionRunner,
    ),
    captureOptions: new CaptureOptionsService(projects),
    dashboard: new DashboardService(
      goals,
      tasks,
      ideas,
      projects,
      resources,
      relations,
      records,
      attentionEntries,
    ),
    attention: new AttentionService(attentionEntries),
    pinCandidates: new PinCandidatesService(goals, tasks, ideas, attentionEntries),
    goalsOverview: new GoalsOverviewService(goals, labels),
    goalDetail: new GoalDetailService(goals, projects, records),
    createGoalProject: new CreateGoalProjectService(
      goals, projects, records, relations, transactionRunner,
    ),
    selectCurrentPlan: new SelectCurrentPlanService(
      goals, projects, records, relations, transactionRunner,
    ),
    projectsOverview: new ProjectsOverviewService(projects, goals, labels),
    projectDetail: new ProjectDetailService(projects, goals, tasks, resources, records, milestones),
    libraryOverview: new LibraryOverviewService(goals, tasks, projects, ideas, notes, resources),
    addSubGoal: new AddSubGoalService(projects, goals),
    addTask: new AddTaskService(projects, goals, tasks, records, relations),
    addMilestone: new AddMilestoneService(projects, milestones),
    allocateResource: new AllocateResourceService(resources),
    resourcePools: new ResourcePoolsService(resources),
    tasksOverview: new TasksOverviewService(tasks, projects, labels, records),
    taskDetail: new TaskDetailService(tasks, projects, goals, records),
    taskLifecycle: new TaskLifecycleService(tasks, records, relations),
    ideasOverview: new IdeasOverviewService(ideas, records),
    ideaDetail: new IdeaDetailService(
      ideas, goals, tasks, notes, projects, labels, relations, records,
    ),
    ideaDerivationOptions: new IdeaDerivationOptionsService(projects, goals),
    captureIdea: new CaptureIdeaService(ideas, records, relations, transactionRunner),
    editIdea: new EditIdeaService(ideas, records, relations, transactionRunner),
    changeIdeaStatus: new ChangeIdeaStatusService(ideas, records, relations, transactionRunner),
    createGoalFromIdea: new CreateGoalFromIdeaService(
      ideas, goals, records, relations, transactionRunner,
    ),
    createTaskFromIdea: new CreateTaskFromIdeaService(
      ideas, projects, goals, tasks, records, relations, transactionRunner,
    ),
    extractNoteFromIdea: new ExtractNoteFromIdeaService(
      ideas, notes, records, relations, transactionRunner,
    ),
    notesOverview: new NotesOverviewService(notes, labels, records),
    noteDetail: new NoteDetailService(notes, labels, relations, ideas, goals, projects, records),
    noteLinkOptions: new NoteLinkOptionsService(goals, projects),
    captureNote: new CaptureNoteService(notes, records, relations, transactionRunner),
    editNote: new EditNoteService(notes, records, relations, transactionRunner),
    setNotePin: new SetNotePinService(notes, records, relations, transactionRunner),
    archiveNote: new ArchiveNoteService(notes, records, relations, transactionRunner),
    linkNote: new LinkNoteService(notes, goals, projects, records, relations, transactionRunner),
    deleteNote: new DeleteNoteService(notes, transactionRunner),
  };
}
