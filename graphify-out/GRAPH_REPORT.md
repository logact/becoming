# Graph Report - /Users/logact/projects/becoming  (2026-08-13)

## Corpus Check
- 188 files · ~159,434 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2316 nodes · 8516 edges · 106 communities (83 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Label Assignment Commands
- Decomposition Hierarchy Queries
- Workflow State Transitions
- Entity Timeline Queries
- Workflow State Definitions
- Project Service & Lifecycle
- Resource Usage Recording
- Decomposition Policy
- Label Definitions
- Active Relation Uniqueness
- Service Ports & Wiring
- Lineage Queries
- Label Assignment Service
- Project Budget Commands
- Record Entity CRUD
- Project State Transition Machine
- Project Budget Mutations
- Project Entity State Service
- Decimal Arithmetic
- Goal Mutations & Provenance
- Product Docs & Concepts
- Task Allocation Queries
- Query Service Ports
- Workflow CRUD
- Label Assignment Lifecycle
- Lifecycle State Errors
- Project Machine Initialization
- Task Allocation Mutations
- Project Entity State Repository
- Mutation Provenance Service
- Decomposition Service
- Project Transition Execution
- Resource Service
- Lifecycle Audit Service
- Lifecycle Audit Queries
- Project State CRUD
- Transition Condition Evaluation
- Relation Policy & Tests
- Package & Dependencies
- Goal Service
- Label Resolution
- Resource Balance Calculation
- Node SQLite Adapter
- Project Budget Queries
- Resource Exception Evaluation
- Resource Usage Queries
- Task Project Membership
- Task Service
- Workflow Service
- Project State Repository
- Project Service
- Resource Balance Queries
- Resource Exception Queries
- Expo App Config
- Resource Entity CRUD
- SQLite Database Port
- Entity Label Assignments
- Resource Exception Entity
- State Transition Audit
- Project State Transition Service
- Membership Query Service
- Relation Query Service
- Project State Factory
- Lineage Query Service
- Transition Machine Errors
- Workflow Applicability
- Relation Entity
- DB Migrations & Invariants
- Transition Audit Service
- Lineage Commands
- Lineage Service
- Goal Pursuit Queries
- Goal Pursuit Service
- Audit Payload Building
- Entity Lookup Resolution
- Goal Pursuit Query Types
- Active Reference Validation
- M1 Plan DAG Docs
- Wave Reader Script
- Entity Label List Queries
- Entity State Query Service
- CI Publish Workflow
- Doc Concepts: Time & Service
- TypeScript Config
- App Entry Component
- Tagging Categories
- Rules & Keys
- Goal Pursuit Errors
- Goal Pursuit Endpoint Errors
- Project Not Found Error
- Project Archived Error
- Record History Errors
- Record Not Found Error
- Relation Ended Error
- Membership Not Found Error
- Applicability Label Error
- Workflow Archived Error
- Duplicate Transition Edge Error
- Transition Endpoint Errors
- Transition Machine Mismatch Error
- Transition Not Found Error
- Label Config
- Ideas Concept
- Philosophies Concept

## God Nodes (most connected - your core abstractions)
1. `EntityId` - 587 edges
2. `IsoTimestamp` - 266 edges
3. `Relation` - 131 edges
4. `CoreEntityType` - 120 edges
5. `Clock` - 104 edges
6. `SqliteDatabase` - 97 edges
7. `IdGenerator` - 81 edges
8. `createTestDatabase()` - 60 edges
9. `RelationRepository` - 52 edges
10. `JsonValue` - 50 edges

## Surprising Connections (you probably didn't know these)
- `Workflow and lifecycle management capability` --semantically_similar_to--> `Workflow versioning (publishWorkflow / supersedes_id)`  [INFERRED] [semantically similar]
  AGENTS.md → docs/architecture.md
- `Resource and budget management capability` --semantically_similar_to--> `Temporal relations and versioned planning metadata`  [INFERRED] [semantically similar]
  AGENTS.md → docs/architecture.md
- `Data provenance and history capability` --semantically_similar_to--> `Append-oriented provenance Records`  [INFERRED] [semantically similar]
  AGENTS.md → docs/architecture.md
- `Implementation waves 1-13 (from #106 bootstrap to #105)` --semantically_similar_to--> `M1 task dependency DAG (13 waves)`  [INFERRED] [semantically similar]
  m1-plan.md → AGENTS.md
- `Project-owned state machine independence` --semantically_similar_to--> `project_state_transitions table`  [INFERRED] [semantically similar]
  docs/architecture.md → Table-definetion.txt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Eight core concepts connected through the relations semantic graph** — table_definetion_tasks, table_definetion_goals, table_definetion_projects, table_definetion_ideas, table_definetion_philosophies, table_definetion_workflows, table_definetion_resources, table_definetion_records, table_definetion_relations [EXTRACTED 1.00]
- **Workflow state machine templates initialize Project machines that drive runtime entity state history** — table_definetion_workflow_states, table_definetion_workflow_state_transitions, table_definetion_project_states, table_definetion_project_state_transitions, table_definetion_project_entity_states, table_definetion_state_machine_identity [EXTRACTED 1.00]
- **M1 delivery framework: milestone planned as waves, gates, and workstreams over the GitHub issue DAG** — m1_plan_milestone_v1_domain_foundation, m1_plan_execution_waves, m1_plan_integration_gates, m1_plan_workstreams, m1_plan_ready_done_definitions, agents_task_wave_dag [INFERRED 0.85]

## Communities (106 total, 23 thin omitted)

### Community 0 - "Label Assignment Commands"
Cohesion: 0.03
Nodes (56): DecompositionHierarchyEdge, GoalNotFoundError, AssignLabelCommand, AssignLabelWithProvenanceCommand, CreateLabelCommand, LifecycleAuditEntityLookup, CurrentEntityState, InitializeProjectEntityStateCommand (+48 more)

### Community 1 - "Decomposition Hierarchy Queries"
Cohesion: 0.05
Nodes (53): assertBounds(), assertNode(), assertProjectId(), assertReadOptions(), compareEdge(), DecompositionHierarchyIntegrityFinding, DecompositionHierarchyQueryResult, DecompositionHierarchyQueryService (+45 more)

### Community 2 - "Workflow State Transitions"
Cohesion: 0.07
Nodes (25): machineOf(), sameMachine(), snapshot(), WorkflowStateTransitionService, archiveWorkflowStateTransition(), createWorkflowStateTransition(), NewWorkflowStateTransition, reactivateWorkflowStateTransition() (+17 more)

### Community 3 - "Entity Timeline Queries"
Cohesion: 0.06
Nodes (59): assertPageQuery(), assertQuery(), assertRange(), assertString(), assertStringSet(), assertTimestamp(), base64UrlDecode(), base64UrlEncode() (+51 more)

### Community 4 - "Workflow State Definitions"
Cohesion: 0.07
Nodes (30): filterStates(), snapshot(), WorkflowStateService, archiveWorkflowState(), createWorkflowState(), NewWorkflowState, normalizeWorkflowStateTitle(), requireCoreEntityType() (+22 more)

### Community 5 - "Project Service & Lifecycle"
Cohesion: 0.11
Nodes (35): projectGoalPursuitProvenancePort(), ResourceUsageIdempotencyConflictError, archiveProject(), createProject(), requireNonBlank(), updateProject(), validateProject(), TASK_PROJECT_MEMBERSHIP_RELATION_TYPE (+27 more)

### Community 6 - "Resource Usage Recording"
Cohesion: 0.08
Nodes (32): canonical(), requiredRelation(), requireKey(), ResourceUsageService, result(), sameUsageCommand(), assertJsonValue(), RecordFactoryDeps (+24 more)

### Community 7 - "Decomposition Policy"
Cohesion: 0.05
Nodes (34): allowsDecompositionDirection(), DECOMPOSITION_ENDPOINT_MATRIX, DECOMPOSITION_ENDPOINT_TYPES, DECOMPOSITION_RELATION_POLICY, DECOMPOSITION_RELATION_TYPE, DecompositionDirectionError, DecompositionEndpointArchivedError, DecompositionEndpointNotFoundError (+26 more)

### Community 8 - "Label Definitions"
Cohesion: 0.09
Nodes (29): CORE_ENTITY_TYPES, archiveLabel(), createLabel(), NewLabel, updateLabel(), validateLabel(), RELATION_TYPES, LabelRow (+21 more)

### Community 9 - "Active Relation Uniqueness"
Cohesion: 0.06
Nodes (18): RelationIsNotLineageError, DuplicateActiveProjectBudgetError, DuplicateActiveGoalPursuitError, DuplicateActiveRelationError, RelationService, RelationTargetCardinalityError, requireActor(), DuplicateActiveTaskAllocationError (+10 more)

### Community 10 - "Service Ports & Wiring"
Cohesion: 0.13
Nodes (37): DecompositionHierarchyQueryServicePorts, RecordDecompositionProvenancePort, DecompositionProvenancePort, DecompositionServicePorts, GoalServicePorts, ProjectBudgetQueryServicePorts, ProjectBudgetServicePorts, ProjectEntityStateServicePorts (+29 more)

### Community 11 - "Lineage Queries"
Cohesion: 0.08
Nodes (37): assertEndpoint(), endpointKey(), ImmediateLineageNeighbor, ImmediateLineageQuery, LineageEndpoint, LineageEndpointNotFoundError, LineageNeighborDirection, LineageQueryValidationError (+29 more)

### Community 12 - "Label Assignment Service"
Cohesion: 0.15
Nodes (28): RFC-4122, LabelArchivedError, LabelAssignmentEntityNotFoundError, LabelAssignmentNotFoundError, LabelNotFoundError, ASSIGNMENT_POLICY, LABEL_POLICY, LifecycleAuditPersistenceError (+20 more)

### Community 13 - "Project Budget Commands"
Cohesion: 0.07
Nodes (34): ActiveProjectBudgetNotFoundError, ChangeProjectBudgetCommand, CreateProjectBudgetCommand, EndProjectBudgetCommand, ProjectBudgetMutationResult, ProjectBudgetNotActiveError, ProjectBudgetRelationNotFoundError, ProjectBudgetSupersessionResult (+26 more)

### Community 14 - "Record Entity CRUD"
Cohesion: 0.09
Nodes (29): archiveRecord(), createRecord(), NewRecord, RECORD_TYPES, RecordType, requireNonBlank(), requireSupportedRecordType(), requireTimestamp() (+21 more)

### Community 15 - "Project State Transition Machine"
Cohesion: 0.11
Nodes (17): createProjectStateTransition(), NewProjectStateTransition, ProjectStateTransition, ProjectStateTransitionChanges, ProjectStateTransitionFactoryDeps, ProjectStateTransitionMachine, requireCoreEntityType(), requireNonBlankId() (+9 more)

### Community 16 - "Project Budget Mutations"
Cohesion: 0.14
Nodes (21): ProjectBudgetService, requireActor(), ActiveProjectBudgetReferenceLookup, assessProjectBudgetCapacity(), canonicalQuantity(), createProjectBudgetRelation(), interval(), projectBudgetActiveIdentity() (+13 more)

### Community 17 - "Project Entity State Service"
Cohesion: 0.07
Nodes (14): ProjectTransitionRef, ProjectEntityStateEntityArchivedError, ProjectEntityStateEntityNotFoundError, ProjectEntityStateInitialStateAmbiguousError, ProjectEntityStateInitialStateMissingError, ProjectEntityStateLabelArchivedError, ProjectEntityStateLabelAssignmentRequiredError, ProjectEntityStateLabelNotFoundError (+6 more)

### Community 18 - "Decimal Arithmetic"
Cohesion: 0.09
Nodes (10): TaskAllocationTotal, Decimal, ProjectBudgetCapacityExceededError, Quantity, NewResourceUsageCorrection, NewResourceUsageRecord, TaskAllocationOverBudgetError, insertResource() (+2 more)

### Community 19 - "Goal Mutations & Provenance"
Cohesion: 0.11
Nodes (17): MutationPersistenceError, ProvenancePersistenceError, ProvenanceValidationError, archiveGoal(), createGoal(), requireNonBlank(), updateGoal(), validateGoal() (+9 more)

### Community 20 - "Product Docs & Concepts"
Cohesion: 0.07
Nodes (33): markdownlint-cli2 configuration, Becoming product (goal-planning and execution system), Goal and task planning and execution capability, Data provenance and history capability, Resource and budget management capability, Workflow and lifecycle management capability, Append-oriented provenance Records, src/application command/query services (+25 more)

### Community 21 - "Task Allocation Queries"
Cohesion: 0.13
Nodes (18): AmbiguousActiveTaskAllocationBudgetError, compareAllocationViews(), compareBudgetViews(), earliestEnd(), isEffectiveAt(), ProjectBudgetView, ProjectResourceAllocationQuery, sumAllocations() (+10 more)

### Community 22 - "Query Service Ports"
Cohesion: 0.10
Nodes (17): CoreEntityLookup, EntityTimelineQueryServicePorts, LabelServicePorts, AuditedTransition, LineageQueryPorts, AuditedProjectTransition, RECORD_CORRECTION_RELATION_METADATA, RecordCorrectionPersistenceError (+9 more)

### Community 23 - "Workflow CRUD"
Cohesion: 0.13
Nodes (21): newId(), nowIso(), archiveWorkflow(), createWorkflow(), createWorkflowVersion(), NewWorkflow, publishWorkflow(), requireNonBlank() (+13 more)

### Community 24 - "Label Assignment Lifecycle"
Cohesion: 0.14
Nodes (7): LabelAssignmentService, EntityLabelAssignment, EntityLabelRepository, pagination(), SqliteEntityLabelRepository, toDomain(), toRow()

### Community 25 - "Lifecycle State Errors"
Cohesion: 0.09
Nodes (21): CurrentStateMismatchError, CurrentStateNotFoundError, LifecycleMachineMismatchError, LifecycleStateNotFoundError, LifecycleTransitionMismatchError, LifecycleTransitionNotFoundError, applyTransition(), fixedClock (+13 more)

### Community 26 - "Project Machine Initialization"
Cohesion: 0.10
Nodes (19): assertTopology(), createInitializationRecord(), groupByMachine(), InitializedProjectMachine, InitializeProjectMachinesCommand, InitializeProjectMachinesResult, ProjectMachineInitializationConflictError, ProjectMachineInitializationProjectArchivedError (+11 more)

### Community 27 - "Task Allocation Mutations"
Cohesion: 0.17
Nodes (15): requireActor(), TaskAllocationService, canonicalQuantity(), createTaskAllocationRelation(), interval(), requireNonBlank(), requirePolicy(), requireTimestamp() (+7 more)

### Community 28 - "Project Entity State Repository"
Cohesion: 0.15
Nodes (10): ProjectEntityState, ProjectEntityStateContext, contextOf(), ProjectEntityStateCurrentConflictError, ProjectEntityStateMultipleCurrentError, ProjectEntityStateRepository, ProjectEntityStateRow, SqliteProjectEntityStateRepository (+2 more)

### Community 29 - "Mutation Provenance Service"
Cohesion: 0.13
Nodes (20): CreateGoalCommand, MutationProvenanceService, MutationProvenanceServicePorts, CreateTaskCommand, TaskNotFoundError, NewGoal, applyFieldPolicy(), buildProvenancePayload() (+12 more)

### Community 30 - "Decomposition Service"
Cohesion: 0.11
Nodes (17): CreateDecompositionCommand, DecompositionCycleError, DecompositionGraphIntegrityError, DecompositionMutationNotice, DecompositionMutationResult, DecompositionNotFoundError, DecompositionService, DuplicateActiveDecompositionError (+9 more)

### Community 31 - "Project Transition Execution"
Cohesion: 0.13
Nodes (20): ExecuteAuditedProjectTransitionCommand, ExecutedProjectTransition, ExecuteProjectTransitionCommand, ProjectEntityStateIdentityAnomalyError, ProjectEntityStateQueryServicePorts, ProjectTransitionRejectedError, ProjectTransitionAccepted, ProjectTransitionValidationResult (+12 more)

### Community 32 - "Resource Service"
Cohesion: 0.14
Nodes (12): CreateResourceCommand, hasSemanticChange(), ResourceQuantityReferenceGuard, ResourceService, ResourceServicePorts, snapshot(), resolveFieldPolicy(), NewResource (+4 more)

### Community 33 - "Lifecycle Audit Service"
Cohesion: 0.12
Nodes (21): LabelAssignmentServicePorts, LabelService, LifecycleAuditQueryServicePorts, LifecycleAuditService, LifecycleAuditServicePorts, ProjectMachineInitializationServicePorts, ProjectLookup, ProjectStateServicePorts (+13 more)

### Community 34 - "Lifecycle Audit Queries"
Cohesion: 0.13
Nodes (17): assertQuery(), assertRange(), compareEntries(), inRange(), isTimestamp(), LifecycleAuditLiveReference, LifecycleAuditPayloadError, LifecycleAuditProjectLookup (+9 more)

### Community 35 - "Project State CRUD"
Cohesion: 0.18
Nodes (7): ProjectStateOccupantMigration, ProjectStateService, snapshot(), archiveProjectState(), ProjectState, ProjectStateChanges, current()

### Community 36 - "Transition Condition Evaluation"
Cohesion: 0.11
Nodes (19): ProjectTransitionExecutionServicePorts, machineOf(), ProjectTransitionConditionEvaluationInput, ProjectTransitionConditionEvaluator, ProjectTransitionEvaluationResult, ProjectTransitionEvidence, ProjectTransitionExitCriteriaEvaluationInput, ProjectTransitionExitCriteriaEvaluator (+11 more)

### Community 37 - "Relation Policy & Tests"
Cohesion: 0.09
Nodes (14): RelationCycleError, RelationEndpointNotFoundError, RelationProvenancePersistenceError, DEFAULT_RELATION_POLICIES, lineageMetadata, service(), metadata, service() (+6 more)

### Community 38 - "Package & Dependencies"
Cohesion: 0.08
Nodes (23): dependencies, expo, expo-sqlite, react, react-native, description, devDependencies, @babel/core (+15 more)

### Community 39 - "Goal Service"
Cohesion: 0.15
Nodes (7): GoalService, snapshot(), Goal, GoalChanges, assertPagination(), GoalListOptions, toDomain()

### Community 40 - "Label Resolution"
Cohesion: 0.12
Nodes (8): ResolvedLabelAssignment, snapshot(), LifecycleAuditLiveReferences, Label, LabelChanges, assertPagination(), LabelListOptions, toDomain()

### Community 41 - "Resource Balance Calculation"
Cohesion: 0.19
Nodes (20): assertTimestamp(), BalanceRelationContributor, BalanceTemporalRelation, calculateProjectResourceBalances(), calculateTaskResourceBalances(), isBalanceRelationEffectiveAt(), isBalanceUsageIncludedAt(), ProjectBudgetBalanceContributor (+12 more)

### Community 42 - "Node SQLite Adapter"
Cohesion: 0.15
Nodes (8): SqliteRunResult, SqliteValue, migrate(), NodeSqliteDatabase, withTransaction(), ResourceRow, listTables(), CORE_TABLES

### Community 43 - "Project Budget Queries"
Cohesion: 0.16
Nodes (12): ActiveProjectBudgetQuery, AmbiguousActiveProjectBudgetError, compareBudgetViews(), isEffectiveAt(), ProjectBudgetCapacityDiagnostics, ProjectBudgetHistoryQuery, ProjectBudgetQueryService, ProjectBudgetReadOptions (+4 more)

### Community 44 - "Resource Exception Evaluation"
Cohesion: 0.18
Nodes (18): assertId(), assertProjectBalanceUnits(), assertQuantitiesUseUnit(), assertTaskBalanceUnits(), assertTimestamp(), assertUnit(), compareExceptions(), deduplicate() (+10 more)

### Community 45 - "Resource Usage Queries"
Cohesion: 0.14
Nodes (14): LifecycleAuditHistoryQuery, ResourceBalanceReadOptions, ResourceExceptionQueryServicePorts, assertQuery(), compareOccurrences(), inRange(), noRelation(), oneRelation() (+6 more)

### Community 46 - "Task Project Membership"
Cohesion: 0.11
Nodes (13): isTaskProjectMembership(), requireActor(), LINEAGE_ENDPOINT_MATRIX, LineageMetadataV1, lineageRelationPolicy(), LineageSourceFragment, openRelationPolicy(), RelationMetadataPolicyError (+5 more)

### Community 47 - "Task Service"
Cohesion: 0.15
Nodes (7): snapshot(), TaskService, Task, TaskChanges, assertPagination(), TaskListOptions, toDomain()

### Community 48 - "Workflow Service"
Cohesion: 0.20
Nodes (4): snapshot(), WorkflowService, Workflow, WorkflowDraftChanges

### Community 49 - "Project State Repository"
Cohesion: 0.19
Nodes (8): normalizeProjectStateTitle(), ProjectStateTitleConflictError, assertProjectStateUpdateAllowed(), machineOf(), ProjectStateRow, SqliteProjectStateRepository, toDomain(), toRow()

### Community 50 - "Project Service"
Cohesion: 0.16
Nodes (5): ProjectService, snapshot(), Project, ProjectFilter, toDomain()

### Community 51 - "Resource Balance Queries"
Cohesion: 0.22
Nodes (11): assertId(), assertTimestamp(), isIncluded(), ResourceBalanceQueryService, ResourceBalanceQueryServicePorts, toUsageContributors(), ResourceExceptionTrace, ProjectResourceBalance (+3 more)

### Community 52 - "Resource Exception Queries"
Cohesion: 0.18
Nodes (14): assertQuery(), compareResults(), contextKey(), deriveAll(), ExceptionEvaluation, parseContext(), ResourceExceptionQuery, ResourceExceptionQueryResult (+6 more)

### Community 53 - "Expo App Config"
Cohesion: 0.11
Nodes (17): usesNonExemptEncryption, projectId, expo, extra, ios, name, newArchEnabled, orientation (+9 more)

### Community 54 - "Resource Entity CRUD"
Cohesion: 0.22
Nodes (10): archiveResource(), createResource(), normalizeCapacity(), requireNonBlank(), updateResource(), validateResource(), toRow(), toRow() (+2 more)

### Community 55 - "SQLite Database Port"
Cohesion: 0.12
Nodes (4): SqliteDatabase, SqliteCoreEntityLookup, TABLE_BY_TYPE, SqliteProjectLookup

### Community 56 - "Entity Label Assignments"
Cohesion: 0.21
Nodes (14): createEntityLabelAssignment(), endEntityLabelAssignment(), EntityLabelAssignmentFactoryDeps, NewEntityLabelAssignment, requireCoreEntityType(), requireNonBlankId(), requireTimestamp(), validateEntityLabelAssignment() (+6 more)

### Community 57 - "Resource Exception Entity"
Cohesion: 0.21
Nodes (14): createResourceException(), isResourceExceptionActive(), NewResourceException, normalizedIds(), requireId(), requireSameUnit(), requireTimestamp(), ResourceExceptionContributorIds (+6 more)

### Community 58 - "State Transition Audit"
Cohesion: 0.18
Nodes (16): AuditSnapshots, buildEvaluationReport(), buildEvaluationResult(), buildStateTransitionAuditPayload(), EVALUATION_OUTCOMES, EvaluationOutcome, EvaluationReport, EvaluationResult (+8 more)

### Community 59 - "Project State Transition Service"
Cohesion: 0.21
Nodes (3): machineOf(), ProjectStateTransitionService, sameMachine()

### Community 60 - "Membership Query Service"
Cohesion: 0.19
Nodes (8): assertOptions(), bothEndpointsActive(), MemberTaskSummary, TaskProjectContextSummary, TaskProjectMembershipHistoryOptions, TaskProjectMembershipIntegrityAnomaly, TaskProjectMembershipQueryService, TaskProjectMembershipReadOptions

### Community 61 - "Relation Query Service"
Cohesion: 0.20
Nodes (4): RelationEndpointResolver, RelationQueryService, RelationListQuery, RelationQuery

### Community 62 - "Project State Factory"
Cohesion: 0.26
Nodes (12): createProjectState(), NewProjectState, ProjectStateFactoryDeps, ProjectStateInitialConflictError, requireCoreEntityType(), requireNonBlankId(), requireNonBlankTitle(), requireNotBothInitialAndTerminal() (+4 more)

### Community 63 - "Lineage Query Service"
Cohesion: 0.24
Nodes (5): assertQuery(), assertTimestamp(), isLineageRelation(), LineageQueryService, LINEAGE_RELATION_TYPES

### Community 64 - "Transition Machine Errors"
Cohesion: 0.15
Nodes (7): ProjectStateTransitionEndpointArchivedError, ProjectStateTransitionEndpointNotFoundError, ProjectStateTransitionMachineMismatchError, ProjectStateTransitionNotFoundError, MACHINE, setup(), state()

### Community 65 - "Workflow Applicability"
Cohesion: 0.27
Nodes (4): readMetadata(), validateContext(), WORKFLOW_CONSUMER_TYPES, WorkflowApplicabilityService

### Community 66 - "Relation Entity"
Cohesion: 0.27
Nodes (11): createRelation(), endRelation(), NewRelation, RelationFactoryDeps, RelationType, requireCoreEntityType(), requireNonBlankId(), requireSupportedRelationType() (+3 more)

### Community 67 - "DB Migrations & Invariants"
Cohesion: 0.32
Nodes (6): initialSchema, workflowVersionLineage, projectEntityStateCurrentInvariant, workflowTransitionActiveEdgeInvariant, MIGRATIONS, Migration

### Community 68 - "Transition Audit Service"
Cohesion: 0.21
Nodes (6): evaluationFrom(), isAuditableEntityType(), ProjectTransitionAuditEntityLookup, ProjectTransitionAuditService, ProjectTransitionAuditServicePorts, ProjectTransitionExecutionService

### Community 69 - "Lineage Commands"
Cohesion: 0.20
Nodes (9): CreateOriginLinkCommand, CreateTransformationLinkCommand, EndLineageLinkCommand, LineageServicePorts, ReplaceLineageLinkCommand, UnsupportedLineageRelationTypeError, CreateRelationCommand, EndRelationCommand (+1 more)

### Community 70 - "Lineage Service"
Cohesion: 0.33
Nodes (3): isLineageRelationType(), LineageService, requireLineageRelationType()

### Community 71 - "Goal Pursuit Queries"
Cohesion: 0.31
Nodes (3): assertOptions(), bothEndpointsActive(), ProjectGoalPursuitQueryService

### Community 72 - "Goal Pursuit Service"
Cohesion: 0.33
Nodes (4): isGoalPursuit(), ProjectGoalPursuitService, requireActor(), PROJECT_GOAL_PURSUIT_POLICY

### Community 73 - "Audit Payload Building"
Cohesion: 0.38
Nodes (4): LifecycleAuditHistoryEntry, StateTransitionAuditPayload, stateTransitionAuditPayloadToJson(), audit()

### Community 74 - "Entity Lookup Resolution"
Cohesion: 0.29
Nodes (3): LifecycleEntityLookup, ProjectEntityStateLookup, ProjectTransitionLookup

### Community 75 - "Goal Pursuit Query Types"
Cohesion: 0.33
Nodes (6): GoalPursuitHistoryOptions, GoalPursuitIntegrityAnomaly, GoalPursuitReadOptions, PursuedGoalSummary, PursuingProjectSummary, PROJECT_GOAL_PURSUIT_RELATION_TYPE

### Community 77 - "M1 Plan DAG Docs"
Cohesion: 0.33
Nodes (6): GitHub Epic/Feature/Task issue hierarchy, M1 task dependency DAG (13 waves), Implementation waves 1-13 (from #106 bootstrap to #105), Integration gates A-F, Definition of ready / definition of done, Workstreams (infrastructure, workflow/lifecycle, provenance, planning, resources)

### Community 78 - "Wave Reader Script"
Cohesion: 0.47
Nodes (5): Any, Namespace, main(), parse_args(), parse_plan()

### Community 81 - "CI Publish Workflow"
Cohesion: 0.60
Nodes (5): Dependabot GitHub Actions update config, appstore-review job (fastlane deliver), build-and-submit job (EAS Build/Submit), Publish iOS workflow, iOS publishing procedure (TestFlight / App Store)

### Community 82 - "Doc Concepts: Time & Service"
Cohesion: 0.60
Nodes (3): hour(), project(), task()

### Community 83 - "TypeScript Config"
Cohesion: 0.40
Nodes (4): compilerOptions, types, extends, include

## Knowledge Gaps
- **162 isolated node(s):** `styles`, `ResourceRow`, `machine`, `metadata`, `lineageMetadata` (+157 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `EntityId` connect `Label Assignment Commands` to `Decomposition Hierarchy Queries`, `Workflow State Transitions`, `Entity Timeline Queries`, `Workflow State Definitions`, `Project Service & Lifecycle`, `Resource Usage Recording`, `Decomposition Policy`, `Label Definitions`, `Active Relation Uniqueness`, `Service Ports & Wiring`, `Lineage Queries`, `Label Assignment Service`, `Project Budget Commands`, `Record Entity CRUD`, `Project State Transition Machine`, `Project Budget Mutations`, `Project Entity State Service`, `Decimal Arithmetic`, `Goal Mutations & Provenance`, `Task Allocation Queries`, `Query Service Ports`, `Workflow CRUD`, `Label Assignment Lifecycle`, `Lifecycle State Errors`, `Project Machine Initialization`, `Task Allocation Mutations`, `Project Entity State Repository`, `Mutation Provenance Service`, `Decomposition Service`, `Project Transition Execution`, `Resource Service`, `Lifecycle Audit Service`, `Lifecycle Audit Queries`, `Project State CRUD`, `Transition Condition Evaluation`, `Goal Service`, `Label Resolution`, `Resource Balance Calculation`, `Project Budget Queries`, `Resource Exception Evaluation`, `Resource Usage Queries`, `Task Project Membership`, `Task Service`, `Workflow Service`, `Project State Repository`, `Project Service`, `Resource Balance Queries`, `Resource Exception Queries`, `Resource Entity CRUD`, `SQLite Database Port`, `Entity Label Assignments`, `Resource Exception Entity`, `State Transition Audit`, `Project State Transition Service`, `Membership Query Service`, `Relation Query Service`, `Project State Factory`, `Lineage Query Service`, `Transition Machine Errors`, `Workflow Applicability`, `Relation Entity`, `Transition Audit Service`, `Lineage Commands`, `Lineage Service`, `Goal Pursuit Queries`, `Goal Pursuit Service`, `Audit Payload Building`, `Entity Lookup Resolution`, `Goal Pursuit Query Types`, `Active Reference Validation`, `Entity Label List Queries`, `Entity State Query Service`, `Goal Pursuit Errors`, `Goal Pursuit Endpoint Errors`, `Project Not Found Error`, `Project Archived Error`, `Record History Errors`, `Record Not Found Error`, `Relation Ended Error`, `Membership Not Found Error`, `Applicability Label Error`, `Workflow Archived Error`, `Duplicate Transition Edge Error`, `Transition Endpoint Errors`, `Transition Machine Mismatch Error`, `Transition Not Found Error`?**
  _High betweenness centrality (0.371) - this node is a cross-community bridge._
- **Why does `IsoTimestamp` connect `Label Assignment Commands` to `Decomposition Hierarchy Queries`, `Workflow State Transitions`, `Entity Timeline Queries`, `Workflow State Definitions`, `Project Service & Lifecycle`, `Resource Usage Recording`, `Label Definitions`, `Active Relation Uniqueness`, `Service Ports & Wiring`, `Lineage Queries`, `Label Assignment Service`, `Project Budget Commands`, `Record Entity CRUD`, `Project State Transition Machine`, `Project Budget Mutations`, `Project Entity State Service`, `Decimal Arithmetic`, `Goal Mutations & Provenance`, `Task Allocation Queries`, `Query Service Ports`, `Workflow CRUD`, `Label Assignment Lifecycle`, `Project Machine Initialization`, `Task Allocation Mutations`, `Project Entity State Repository`, `Mutation Provenance Service`, `Decomposition Service`, `Project Transition Execution`, `Resource Service`, `Lifecycle Audit Service`, `Lifecycle Audit Queries`, `Project State CRUD`, `Goal Service`, `Label Resolution`, `Resource Balance Calculation`, `Project Budget Queries`, `Resource Exception Evaluation`, `Resource Usage Queries`, `Task Service`, `Workflow Service`, `Project Service`, `Resource Balance Queries`, `Resource Exception Queries`, `Resource Entity CRUD`, `Entity Label Assignments`, `Resource Exception Entity`, `State Transition Audit`, `Project State Transition Service`, `Membership Query Service`, `Relation Query Service`, `Project State Factory`, `Lineage Query Service`, `Workflow Applicability`, `Relation Entity`, `Lineage Commands`, `Audit Payload Building`, `Goal Pursuit Query Types`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `Relation` connect `Active Relation Uniqueness` to `Label Assignment Commands`, `Decomposition Hierarchy Queries`, `Project Service & Lifecycle`, `Resource Usage Recording`, `Label Definitions`, `Service Ports & Wiring`, `Lineage Queries`, `Project Budget Commands`, `Project Budget Mutations`, `Project Entity State Service`, `Decimal Arithmetic`, `Task Allocation Queries`, `Query Service Ports`, `Project Machine Initialization`, `Task Allocation Mutations`, `Decomposition Service`, `Lifecycle Audit Service`, `Relation Policy & Tests`, `Project Budget Queries`, `Resource Usage Queries`, `Task Project Membership`, `Resource Entity CRUD`, `Membership Query Service`, `Relation Query Service`, `Lineage Query Service`, `Workflow Applicability`, `Relation Entity`, `Lineage Commands`, `Lineage Service`, `Goal Pursuit Queries`, `Goal Pursuit Service`, `Goal Pursuit Query Types`, `Active Reference Validation`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `styles`, `ResourceRow`, `machine` to the rest of the system?**
  _165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Label Assignment Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.03327596098680436 - nodes in this community are weakly interconnected._
- **Should `Decomposition Hierarchy Queries` be split into smaller, more focused modules?**
  _Cohesion score 0.05228070175438596 - nodes in this community are weakly interconnected._
- **Should `Workflow State Transitions` be split into smaller, more focused modules?**
  _Cohesion score 0.07207207207207207 - nodes in this community are weakly interconnected._