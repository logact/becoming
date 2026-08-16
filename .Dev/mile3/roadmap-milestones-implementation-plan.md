# Roadmap Milestones — Implementation Plan

Status: design ready for implementation

Prototype: [roadmap-milestones-prototype.html](./roadmap-milestones-prototype.html)

## 1. Feature definition

A Project Roadmap belongs to the Project's exact active Goal pursuit.

```text
Project
  -> active contributes_to relation
  -> pursued root Goal
  -> Project-scoped decomposes hierarchy
  -> descendant Goals

Pursuit
  -> ordered Milestones
  -> each Milestone groups one or more descendant Goals
```

A Milestone is a checkpoint for a set of Goals. It is not a Goal, Task, lifecycle State, or percentage.

A Milestone is reached when every currently assigned Goal is complete according to the authoritative Project execution snapshot. Completion is derived and is never manually toggled or persisted on the Milestone.

## 2. Product rules

1. A Milestone belongs to one exact Project pursuit relation, not merely to a Project ID.
2. Every assigned Goal must be an active descendant of that pursuit's root Goal in the same Project-scoped decomposition hierarchy.
3. A Milestone must contain at least one active Goal assignment.
4. The same Goal may belong to at most one active Milestone within one pursuit.
5. Milestones and Goals have deterministic, user-controlled ordering.
6. Reaching a Milestone is derived from assigned Goal lifecycle state.
7. Missing, unmanaged, uninitialized, blocked, or invalid Goals do not satisfy a Milestone.
8. Removing a Milestone does not remove or archive its Goals.
9. Removing a Goal assignment ends the assignment; it does not delete history.
10. Ending a decomposition edge that would move an assigned Goal outside the pursued hierarchy must fail until the Goal is removed from its Milestone.
11. An ended pursuit retains its Roadmap for history. A later pursuit receives a new Roadmap because it has a different relation ID.

## 3. Persistence design

Add the next append-only migration after the repository's current final migration. At the time of this plan, that would be `src/persistence/migrations/0005_milestones.ts`.

```sql
CREATE TABLE milestones (
  id                  TEXT PRIMARY KEY,
  pursuit_relation_id TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  target_at           TEXT,
  sort_order          INTEGER NOT NULL CHECK (sort_order > 0),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT
);

CREATE TABLE milestone_goal_assignments (
  id                  TEXT PRIMARY KEY,
  pursuit_relation_id TEXT NOT NULL,
  milestone_id        TEXT NOT NULL,
  goal_id             TEXT NOT NULL,
  sort_order          INTEGER NOT NULL CHECK (sort_order > 0),
  created_at          TEXT NOT NULL,
  ended_at            TEXT
);

CREATE INDEX milestones_pursuit_order_idx
  ON milestones (pursuit_relation_id, archived_at, sort_order, created_at, id);

CREATE INDEX milestone_goal_assignments_milestone_idx
  ON milestone_goal_assignments (milestone_id, ended_at, sort_order, created_at, id);

CREATE UNIQUE INDEX milestone_active_order_unique_idx
  ON milestones (pursuit_relation_id, sort_order)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX milestone_goal_active_pursuit_unique_idx
  ON milestone_goal_assignments (pursuit_relation_id, goal_id)
  WHERE ended_at IS NULL;
```

There are deliberately no database foreign keys. The application service validates `pursuit_relation_id`, `milestone_id`, and `goal_id` inside the same write unit of work.

`pursuit_relation_id` is repeated on assignments intentionally. It supports efficient pursuit-wide uniqueness and corruption detection. The service must verify that it matches the owning Milestone.

Do not add `is_complete`, `status`, or `completed_at` columns. Those values would become stale when a Goal transitions or reopens.

Do not store `goal_ids` as JSON on `milestones`. A JSON array would make membership history, logical-reference validation, ordering, and efficient querying unnecessarily fragile.

Do not use the general `relations` table for Milestone assignments in this version. That table connects registered core concepts, and Milestone is currently a supporting Project-planning aggregate rather than a ninth core concept.

## 4. Domain model

Create `src/domain/milestone.ts`:

```ts
export interface Milestone {
  id: EntityId;
  pursuitRelationId: EntityId;
  title: string;
  description: string | null;
  targetAt: IsoTimestamp | null;
  sortOrder: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

export interface MilestoneGoalAssignment {
  id: EntityId;
  pursuitRelationId: EntityId;
  milestoneId: EntityId;
  goalId: EntityId;
  sortOrder: number;
  createdAt: IsoTimestamp;
  endedAt: IsoTimestamp | null;
}
```

Domain constructors and mutation functions must enforce:

- non-blank title and IDs;
- positive integer ordering;
- valid ISO timestamps;
- archive/end timestamps not earlier than creation;
- archived Milestones cannot be edited or receive assignments;
- ended assignments are immutable.

Endpoint existence, active pursuit validity, hierarchy membership, assignment uniqueness, and lifecycle completion belong in the application layer because they require repositories and composed read models.

## 5. Repository boundaries

Create:

- `src/persistence/milestoneRepository.ts`
- `src/persistence/milestoneGoalAssignmentRepository.ts`

Required Milestone operations:

```ts
add(milestone)
getById(id)
save(milestone)
listForPursuit(pursuitRelationId, options)
reorderActiveForPursuit(pursuitRelationId, orderedMilestoneIds, updatedAt)
```

Required assignment operations:

```ts
add(assignment)
getById(id)
save(assignment) // ended_at only
listCurrentForMilestone(milestoneId)
listHistoryForMilestone(milestoneId)
listCurrentForPursuit(pursuitRelationId)
findCurrentForGoal(pursuitRelationId, goalId)
reorderCurrentForMilestone(milestoneId, orderedAssignmentIds)
```

Repository reads must use total deterministic ordering: `sort_order`, then `created_at`, then `id`.

Repositories validate their own stored aggregates. They do not decide whether a Goal is beneath a pursued root.

## 6. Mutation service

Create `src/application/milestoneService.ts` with these commands:

- `createMilestone`
- `updateMilestone`
- `reorderMilestones`
- `archiveMilestone`
- `assignGoal`
- `removeGoalAssignment`
- `reorderMilestoneGoals`

Each mutation must run through `UnitOfWork` and repeat all eligibility checks inside the transaction.

### Creating a Milestone

1. Resolve `pursuitRelationId` through `RelationRepository`.
2. Require the canonical active `project -> contributes_to -> goal` direction.
3. Require the Project, pursued Goal, and selected Goals to exist and be active.
4. Use `DecompositionHierarchyQueryService.findDescendants` for the pursuit's Project and root Goal.
5. Reject traversal truncation or hierarchy integrity findings; mutations fail closed.
6. Require every selected Goal to appear among the valid descendant Goal nodes.
7. Reject an empty or duplicate Goal list.
8. Reject Goals already assigned to another active Milestone in this pursuit.
9. Allocate the next contiguous Milestone and assignment sort orders.
10. Write the Milestone, assignments, and provenance Records atomically.

### Editing membership

Treat assignment replacement as a diff:

- retained Goal IDs keep their assignment identity;
- removed Goal IDs receive `ended_at`;
- added Goal IDs receive new assignment rows;
- retained assignments may be reordered;
- no historical row is deleted or repointed.

### Archiving

Archiving a Milestone sets `archived_at` and ends all active assignments in the same unit of work. Repeated archival is idempotent.

### Decomposition interaction

Before `DecompositionService.end` commits an edge removal, check whether any active Milestone assignment would cease to be a descendant of its pursuit root. Reject with a structured error instructing the user to remove or move the affected Goal assignment first.

This keeps Roadmap membership explicit and prevents a Structure mutation from silently changing a Milestone's meaning.

## 7. Roadmap query service

Create `src/application/projectRoadmapQueryService.ts`.

The service should compose:

- `ProjectGoalPursuitQueryService`;
- `MilestoneRepository`;
- `MilestoneGoalAssignmentRepository`;
- `ProjectExecutionSnapshotService`;
- Goal lookup and decomposition hierarchy results.

Suggested read model:

```ts
export interface ProjectRoadmap {
  projectId: EntityId;
  pursuit: ProjectGoalPursuitView | null;
  milestones: MilestoneRoadmapItem[];
  unassignedGoals: ProjectExecutionNode[];
  findings: ProjectRoadmapFinding[];
  summary: {
    reachedMilestones: number;
    totalMilestones: number;
    achievedGoals: number;
    totalGoals: number;
  };
}

export interface MilestoneRoadmapItem {
  milestone: Milestone;
  goals: MilestoneGoalView[];
  reached: boolean;
}
```

For each assigned Goal, reuse the execution snapshot's authoritative classification. A Goal satisfies its Milestone only when its status is `complete`. The Roadmap UI must not interpret raw State titles or derive lifecycle categories itself.

Return explicit findings for:

- missing or malformed pursuit relation;
- missing or archived Milestone/Goal references;
- assignment pursuit mismatch;
- duplicate active Goal assignment;
- empty Milestone;
- Goal outside the active pursued hierarchy;
- hierarchy traversal truncation or corruption;
- lifecycle state that is unmanaged, uninitialized, blocked, or invalid;
- active descendant Goal not assigned to any Milestone.

Current Roadmap reads exclude ended assignments and archived Milestones. Historical reads select the pursuit, Milestones, assignments, decomposition edges, and lifecycle periods valid at the requested instant.

## 8. Provenance

Append structured `records` for:

- `milestone_created`
- `milestone_updated`
- `milestone_reordered`
- `milestone_archived`
- `milestone_goal_assigned`
- `milestone_goal_removed`
- `milestone_goals_reordered`

Records should identify the Milestone, pursuit relation, Project, pursued root Goal, affected Goal IDs, actor, occurrence time, and before/after values where applicable.

Optionally append `milestone_reached` and `milestone_reopened` observations when a Goal transition causes the derived Milestone result to cross that boundary. These Records are historical evidence only; current completion remains derived.

## 9. Service composition

Update `src/ui/composition/appServices.ts` to expose:

```ts
milestones: MilestoneService
roadmaps: ProjectRoadmapQueryService
```

Construct both repositories over the same `SqliteDatabase` port used by production and test adapters. Provenance writes must share the mutation transaction.

## 10. Native UI implementation

Create:

- `src/ui/projects/roadmap/ProjectRoadmapSegment.tsx`
- `src/ui/projects/roadmap/roadmapPresentation.ts`
- `src/ui/projects/roadmap/MilestoneFormSheet.tsx`
- `src/ui/projects/roadmap/MilestoneGoalPicker.tsx`
- `src/ui/projects/roadmap/MilestoneActions.tsx`

Change the Project detail segment contract:

```ts
ProjectDetailSegmentId = 'overview' | 'structure' | 'roadmap'
ProjectDetailSlots.renderRoadmap
```

Replace the visible Progress segment with Roadmap in `ProjectDetailScreen`. Retain the existing execution snapshot and progress-domain code because Roadmap completion consumes the same authoritative execution classification and other consumers may still need Project progress.

The Roadmap segment must render only the `ProjectRoadmapQueryService` result. Presentation code may format dates and findings but must not recalculate completion.

UI states from the prototype:

1. no pursued Goal;
2. pursued Goal with no descendant Goals;
3. descendant Goals with no Milestones;
4. ordered Milestones with nested Goal sets;
5. unscheduled Goal warning;
6. next Milestone emphasis;
7. reached Milestone;
8. complete Roadmap;
9. loading, retry, and integrity findings;
10. add/edit/remove/reorder Milestone flows.

The Goal picker shows only valid descendant Goals. Goals assigned elsewhere remain visible but disabled with an explanation.

## 11. Tests

### Domain tests

- Milestone and assignment construction validation.
- Archive/end idempotency and timestamp ordering.
- Reordering validation.

### Migration and repository tests

- Fresh database includes both tables and indexes.
- Migration upgrade preserves existing data.
- No `FOREIGN KEY` or `REFERENCES` clauses.
- Current/history visibility and stable ordering.
- Active order and Goal-assignment uniqueness under competing writes.

### Service tests

- Create a Milestone for valid descendant Goals.
- Reject root Goal, Task, unrelated Goal, archived Goal, and cross-Project Goal.
- Reject empty, duplicate, or already assigned Goal sets.
- Reject malformed, ended, or mismatched pursuit relations.
- Membership edits retain, end, and add the correct rows.
- Archive ends assignments atomically.
- Provenance failure rolls back all writes.
- Decomposition removal cannot orphan an assigned Goal.

### Query tests

- One-Goal and multi-Goal Milestones.
- Completion is true only when all assigned Goals are complete.
- Reopening one Goal reopens its Milestone.
- Blocked/unmanaged/uninitialized/invalid Goal handling.
- Unassigned descendant detection.
- Missing endpoints and hierarchy integrity findings.
- Current and historical Roadmaps.

### UI tests

Use the real service graph and migrated in-memory SQLite harness.

- Roadmap replaces the Project Progress tab.
- Loading, empty, error, populated, reached, and complete states.
- Multi-Goal Milestone rows and derived counts.
- Add/edit/remove flows and validation feedback.
- Disabled picker candidates explain assignment conflicts.
- Mutation success refreshes the Roadmap and shows a toast.
- Mutation failure preserves the current screen and draft.
- Accessibility labels expose Milestone position, assigned Goal status, and derived completion.

## 12. Delivery sequence

### Wave 1 — domain and persistence

1. Migration and migration tests.
2. Milestone domain aggregate.
3. Milestone and assignment repositories.

### Wave 2 — application behavior

4. Mutation service and provenance.
5. Decomposition orphan protection.
6. Roadmap query service and derived completion.

### Wave 3 — native UI

7. Service graph composition.
8. Project Roadmap segment and presentation model.
9. Milestone form, Goal picker, removal, and reorder flows.
10. Project detail segment replacement.

### Wave 4 — verification and documentation

11. Full UI integration tests.
12. Typecheck and complete Jest suite.
13. Update `Table-definetion.txt`, `docs/architecture.md`, and repository layout guidance.

## 13. Acceptance criteria

- A user can create an ordered Milestone under the Project's active pursued Goal.
- A Milestone can group multiple valid descendant Goals.
- A Goal is not actively scheduled in two Milestones for the same pursuit.
- A Milestone reaches completion only when every assigned Goal is authoritatively complete.
- Goal transitions immediately change the derived Milestone state.
- Unassigned sub-goals and integrity problems remain visible.
- Structure changes cannot silently invalidate active Milestone membership.
- Ending or replacing a pursuit does not rewrite the previous Roadmap.
- Every mutation is atomic, provenance-backed, and history preserving.
- The UI contains no domain completion logic.

