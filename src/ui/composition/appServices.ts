import type { SqliteDatabase } from '../../persistence/database';
import { sqliteUnitOfWork } from '../../persistence/transactions';
import { SqliteGoalRepository } from '../../persistence/goalRepository';
import { SqliteProjectRepository } from '../../persistence/projectRepository';
import { SqliteTaskRepository } from '../../persistence/taskRepository';
import { SqliteRecordRepository } from '../../persistence/recordRepository';
import { SqliteRelationRepository } from '../../persistence/relationRepository';
import { SqliteLabelRepository } from '../../persistence/labelRepository';
import { SqliteEntityLabelRepository } from '../../persistence/entityLabelRepository';
import { SqliteWorkflowRepository } from '../../persistence/workflowRepository';
import { SqliteWorkflowStateRepository } from '../../persistence/workflowStateRepository';
import { SqliteProjectStateRepository } from '../../persistence/projectStateRepository';
import { SqliteProjectStateTransitionRepository } from '../../persistence/projectStateTransitionRepository';
import { SqliteProjectEntityStateRepository } from '../../persistence/projectEntityStateRepository';
import { SqliteMilestoneRepository } from '../../persistence/milestoneRepository';
import { SqliteMilestoneGoalAssignmentRepository } from '../../persistence/milestoneGoalAssignmentRepository';
import { SqliteCoreEntityLookup } from '../../persistence/sqlite/coreEntityLookup';
import { GoalService } from '../../application/goalService';
import { ProjectService } from '../../application/projectService';
import { TaskService } from '../../application/taskService';
import { RelationService } from '../../application/relationService';
import { RecordRelationProvenancePort } from '../../application/relationProvenanceService';
import { RecordDecompositionProvenancePort } from '../../application/decompositionProvenanceService';
import { WorkflowApplicabilityService } from '../../application/workflowApplicabilityService';
import {
  ProjectGoalPursuitService,
  projectGoalPursuitProvenancePort,
} from '../../application/projectGoalPursuitService';
import { ProjectGoalPursuitQueryService } from '../../application/projectGoalPursuitQueryService';
import { TaskProjectMembershipService } from '../../application/taskProjectMembershipService';
import { TaskProjectMembershipQueryService } from '../../application/taskProjectMembershipQueryService';
import { DecompositionService } from '../../application/decompositionService';
import { DecompositionHierarchyQueryService } from '../../application/decompositionHierarchyQueryService';
import { ProjectExecutionSnapshotService } from '../../application/projectExecutionSnapshotService';
import { MilestoneService } from '../../application/milestoneService';
import { RecordMilestoneProvenancePort } from '../../application/milestoneProvenanceService';
import { ProjectRoadmapQueryService } from '../../application/projectRoadmapQueryService';
import { ProjectStructureCreationService } from '../../application/projectStructureCreationService';
import { DefaultDecompositionGuidanceService } from '../../application/defaultDecompositionGuidanceService';
import { EntityTimelineQueryService } from '../../application/entityTimelineQueryService';
import { LifecycleAuditQueryService } from '../../application/lifecycleAuditQueryService';
import { workflowApplicabilityGuidanceResolver } from './decompositionGuidanceResolver';

/**
 * The application services the M2 screens consume. Command services write
 * through the shared SQLite unit of work; query services read through
 * repositories bound to the same database handle. Screens never construct
 * repositories themselves — they use this graph via `useAppServices()`.
 */
export interface AppServices {
  goals: GoalService<SqliteDatabase>;
  projects: ProjectService<SqliteDatabase>;
  tasks: TaskService<SqliteDatabase>;
  /** Project -> Goal pursuit commands (start/end). */
  goalPursuit: ProjectGoalPursuitService<SqliteDatabase>;
  goalPursuitQueries: ProjectGoalPursuitQueryService;
  /** Task -> Project membership commands (start/end). */
  taskMembership: TaskProjectMembershipService<SqliteDatabase>;
  taskMembershipQueries: TaskProjectMembershipQueryService;
  /** Project-scoped decomposition commands (create/end edge). */
  decomposition: DecompositionService<SqliteDatabase>;
  /** Atomic create-and-attach commands used by the Project Structure UI. */
  structureCreation: ProjectStructureCreationService<SqliteDatabase>;
  decompositionQueries: DecompositionHierarchyQueryService;
  /** Read model for the Project execution/progress view. */
  executionSnapshots: ProjectExecutionSnapshotService;
  /** Project Roadmap Milestone commands (create/update/reorder/archive, membership). */
  milestones: MilestoneService<SqliteDatabase>;
  /** Read model for the Project Roadmap view. */
  roadmaps: ProjectRoadmapQueryService;
  /** Per-entity persisted activity (provenance) timeline. */
  timelines: EntityTimelineQueryService;
  /** Lifecycle transition audit history. */
  lifecycleAudit: LifecycleAuditQueryService;
}

/**
 * Compose the full application-service graph over an already migrated
 * database. Used by the app composition root with the production adapter
 * and by UI tests with the in-memory Node adapter — the graph is identical.
 */
export function composeAppServices(db: SqliteDatabase): AppServices {
  const unitOfWork = sqliteUnitOfWork(db);
  const records = (context: SqliteDatabase) => new SqliteRecordRepository(context);

  const goalRepository = new SqliteGoalRepository(db);
  const projectRepository = new SqliteProjectRepository(db);
  const taskRepository = new SqliteTaskRepository(db);
  const relationRepository = new SqliteRelationRepository(db);
  const labelRepository = new SqliteLabelRepository(db);
  const projectStateRepository = new SqliteProjectStateRepository(db);

  const relationService = new RelationService<SqliteDatabase>({
    unitOfWork,
    relations: (context) => new SqliteRelationRepository(context),
    endpoints: (context) => new SqliteCoreEntityLookup(context),
    provenance: new RecordRelationProvenancePort({ records }),
  });
  const workflowApplicability = new WorkflowApplicabilityService<SqliteDatabase>({
    relationService,
    relations: relationRepository,
    workflows: new SqliteWorkflowRepository(db),
    labels: labelRepository,
    workflowStates: new SqliteWorkflowStateRepository(db),
    entities: new SqliteCoreEntityLookup(db),
  });

  const goalPursuitQueries = new ProjectGoalPursuitQueryService({
    projects: projectRepository,
    goals: goalRepository,
    relations: relationRepository,
  });
  const taskMembershipQueries = new TaskProjectMembershipQueryService({
    tasks: taskRepository,
    projects: projectRepository,
    relations: relationRepository,
  });
  const decompositionQueries = new DecompositionHierarchyQueryService({
    projects: projectRepository,
    goals: goalRepository,
    tasks: taskRepository,
    relations: relationRepository,
  });
  const executionSnapshots = new ProjectExecutionSnapshotService({
    projects: projectRepository,
    goals: goalRepository,
    tasks: taskRepository,
    pursuits: goalPursuitQueries,
    memberships: taskMembershipQueries,
    hierarchy: decompositionQueries,
    entityLabels: new SqliteEntityLabelRepository(db),
    labels: labelRepository,
    projectStates: projectStateRepository,
    entityStates: new SqliteProjectEntityStateRepository(db),
  });

  // Compound Structure creation owns the outer transaction. These scoped
  // services reuse that context without trying to open nested transactions.
  const scopedUnitOfWork = (context: SqliteDatabase) => ({
    run: <T>(work: (inner: SqliteDatabase) => Promise<T>) => work(context),
  });
  const scopedGoals = (context: SqliteDatabase) => new GoalService<SqliteDatabase>({
    unitOfWork: scopedUnitOfWork(context),
    goals: () => new SqliteGoalRepository(context),
    records: () => new SqliteRecordRepository(context),
    readGoals: new SqliteGoalRepository(context),
  });
  const scopedTasks = (context: SqliteDatabase) => new TaskService<SqliteDatabase>({
    unitOfWork: scopedUnitOfWork(context),
    tasks: () => new SqliteTaskRepository(context),
    records: () => new SqliteRecordRepository(context),
    readTasks: new SqliteTaskRepository(context),
  });
  const scopedMemberships = (context: SqliteDatabase) =>
    new TaskProjectMembershipService<SqliteDatabase>({
      unitOfWork: scopedUnitOfWork(context),
      tasks: () => new SqliteTaskRepository(context),
      projects: () => new SqliteProjectRepository(context),
      relations: () => new SqliteRelationRepository(context),
      provenance: new RecordRelationProvenancePort({
        records: () => new SqliteRecordRepository(context),
      }),
    });
  const scopedDecompositions = (context: SqliteDatabase) =>
    new DecompositionService<SqliteDatabase>({
      unitOfWork: scopedUnitOfWork(context),
      projects: () => new SqliteProjectRepository(context),
      goals: () => new SqliteGoalRepository(context),
      tasks: () => new SqliteTaskRepository(context),
      relations: () => new SqliteRelationRepository(context),
      workflowGuidance: workflowApplicabilityGuidanceResolver(workflowApplicability),
      provenance: new RecordDecompositionProvenancePort({
        records: () => new SqliteRecordRepository(context),
      }),
      milestoneAssignments: () => new SqliteMilestoneGoalAssignmentRepository(context),
    });
  const defaultDecompositionGuidance = new DefaultDecompositionGuidanceService<SqliteDatabase>({
    labels: (context) => new SqliteLabelRepository(context),
    workflows: (context) => new SqliteWorkflowRepository(context),
    states: (context) => new SqliteWorkflowStateRepository(context),
    relations: (context) => new SqliteRelationRepository(context),
    records,
    provenance: new RecordRelationProvenancePort({ records }),
  });

  return {
    goals: new GoalService<SqliteDatabase>({
      unitOfWork,
      goals: (context) => new SqliteGoalRepository(context),
      records,
      readGoals: goalRepository,
    }),
    projects: new ProjectService<SqliteDatabase>({
      unitOfWork,
      projects: (context) => new SqliteProjectRepository(context),
      records,
      readProjects: projectRepository,
    }),
    tasks: new TaskService<SqliteDatabase>({
      unitOfWork,
      tasks: (context) => new SqliteTaskRepository(context),
      records,
      readTasks: taskRepository,
    }),
    goalPursuit: new ProjectGoalPursuitService<SqliteDatabase>({
      unitOfWork,
      projects: (context) => new SqliteProjectRepository(context),
      goals: (context) => new SqliteGoalRepository(context),
      relations: (context) => new SqliteRelationRepository(context),
      provenance: projectGoalPursuitProvenancePort<SqliteDatabase>({ records }),
    }),
    goalPursuitQueries,
    taskMembership: new TaskProjectMembershipService<SqliteDatabase>({
      unitOfWork,
      tasks: (context) => new SqliteTaskRepository(context),
      projects: (context) => new SqliteProjectRepository(context),
      relations: (context) => new SqliteRelationRepository(context),
      provenance: new RecordRelationProvenancePort<SqliteDatabase>({ records }),
    }),
    taskMembershipQueries,
    decomposition: new DecompositionService<SqliteDatabase>({
      unitOfWork,
      projects: (context) => new SqliteProjectRepository(context),
      goals: (context) => new SqliteGoalRepository(context),
      tasks: (context) => new SqliteTaskRepository(context),
      relations: (context) => new SqliteRelationRepository(context),
      workflowGuidance: workflowApplicabilityGuidanceResolver(workflowApplicability),
      provenance: new RecordDecompositionProvenancePort<SqliteDatabase>({ records }),
      milestoneAssignments: (context) => new SqliteMilestoneGoalAssignmentRepository(context),
    }),
    structureCreation: new ProjectStructureCreationService<SqliteDatabase>({
      unitOfWork,
      goals: scopedGoals,
      tasks: scopedTasks,
      memberships: scopedMemberships,
      decompositions: scopedDecompositions,
      guidance: defaultDecompositionGuidance,
    }),
    decompositionQueries,
    executionSnapshots,
    milestones: new MilestoneService<SqliteDatabase>({
      unitOfWork,
      projects: (context) => new SqliteProjectRepository(context),
      goals: (context) => new SqliteGoalRepository(context),
      relations: (context) => new SqliteRelationRepository(context),
      milestones: (context) => new SqliteMilestoneRepository(context),
      assignments: (context) => new SqliteMilestoneGoalAssignmentRepository(context),
      hierarchy: (context) =>
        new DecompositionHierarchyQueryService({
          projects: new SqliteProjectRepository(context),
          goals: new SqliteGoalRepository(context),
          tasks: new SqliteTaskRepository(context),
          relations: new SqliteRelationRepository(context),
        }),
      provenance: new RecordMilestoneProvenancePort<SqliteDatabase>({ records }),
    }),
    roadmaps: new ProjectRoadmapQueryService({
      goals: goalRepository,
      pursuits: goalPursuitQueries,
      milestones: new SqliteMilestoneRepository(db),
      assignments: new SqliteMilestoneGoalAssignmentRepository(db),
      snapshots: executionSnapshots,
    }),
    timelines: new EntityTimelineQueryService({
      entities: new SqliteCoreEntityLookup(db),
      records: new SqliteRecordRepository(db),
    }),
    lifecycleAudit: new LifecycleAuditQueryService({
      records: new SqliteRecordRepository(db),
      projects: projectRepository,
      labels: labelRepository,
      states: projectStateRepository,
      transitions: new SqliteProjectStateTransitionRepository(db),
    }),
  };
}
