## Core Models
The project has the following core model:
1. Goal: target state aim to achieve. A goal may have multiple projects (different plans); its active project is the one of its projects whose status is `active`. A goal with a `projectId` is a sub-goal decomposed inside that project; `parentGoalId` carries the goal-tree structure. A top-level goal has neither.
3. Task: the action to implement some goal. A task always belongs to a project (`projectId`, required); within the project it may name the goal it implements (`goalId`, optional — a task without one is treated as hanging under the project's root goal) and link to a milestone (`milestoneId`, optional).
2. Idea: a casually captured thought that may later be developed into another model. Its workflow status is user-controlled: `captured`, `exploring`, `paused`, or `handled`. `handled` means the thought has been processed into useful outcomes; it is not archived and may still derive more Goals, Tasks, or Notes.
4. Project: a container that manage the goal's status and how the goal decompose to subgoals and manage the task to implement thess task. A goal may have mutilp project(that means the goal have different plan)
5. Resource: the resource a project can allocate. Three parts:
   - ResourceType: a user-defined kind of resource; kind is `quantity` or `time`, and it owns the unit (e.g. 'USD', 'minutes').
   - Resource: a global pool of one type with a total amount (minutes for time resources); the total allocated never exceeds the pool.
   - ResourceAllocation: a portion of a pool assigned to a project. Quantity allocations carry an amount; time allocations carry a minute-precision span (part of a day or several days) whose amount equals its duration. Time spans never overlap.
6. Note: an extracted thought or methodology. Its content is non-empty and trimmed. `pinnedAt` records the most recent pin action; pin and unpin do not change `updatedAt`, while pinning an already pinned Note refreshes `pinnedAt`. Archive and pin are independent, so archiving preserves `pinnedAt`.
7. Record: System model's change ,user's record have done for some tasks.
8. AttentionEntry: the user intent for the dashboard attention section. kind 'pin'(user added the item) or 'dismiss'(user hid the item); rule-derived attention items (failed, overdue/due-soon, resource-exhausted, and ready-to-start) are computed, not stored.
9. Milestone: a named date inside a project (`projectId`, required). It has no status of its own — Reached/Upcoming is derived by comparing its date with now. Goals and tasks of the project link to it via their optional `milestoneId`, anchoring the project's roadmap.

## Other models
and some other models:
1. label: the Goal,Task,Idea,Project,Resouce,Note all have the labels for classification.
2. relation: store the relation between the 8 core models.

## States:
Goal: Todo Doing Done Paused Failed
Task: Todo Doing Done Paused Failed

Idea: Captured Exploring Paused Handled
Project: Planning Active Paused Done Failed

Goal and Task each have an optional date-only `startAt` and `due`; Project has an optional `due`. A Goal/Task `startAt` is planning metadata for the local calendar day on which the item becomes actionable. It is separate from the lifecycle `start(now)` operation: reaching `startAt` never changes `todo` to `doing`, and the explicit Start action does not rewrite `startAt`.

`Goal.setSchedule(startAt, due, now)` and `Task.setSchedule(startAt, due, now)` atomically replace both optional values. Passing either value as absent clears it while preserving the other when the resulting range is valid. When both dates exist, their local calendar days must satisfy `startAt <= due`; hours, minutes, and UTC conversion do not participate in this date-only invariant, and the same day is valid.

`Goal.isReadyToStart(now)` / `Task.isReadyToStart(now)` is true only for a non-archived `todo` item whose `startAt` local calendar day has arrived. Ready-to-start is derived attention, not persisted lifecycle state. Each target appears at most once: failed wins first, then overdue/due-soon, resource exhaustion, ready-to-start, and finally a user pin. Ready items with no higher-priority reason sort by oldest `startAt` first. Doing lists remain based on actual lifecycle status.

fail(): Goal/Task doing|paused -> failed, Project active|paused -> failed; Goal/Task reopen(): done|failed -> todo.
Dashboard due-warning windows: goal/project 1 day ahead, task 2 hours ahead (already-overdue counts), implemented via isDueImminent(windowMs, now).

## Archive
Archive is a indepent filed so that when archieve a item we won't cover its status.



## Decisions
1. The Relation between the records and other core models should be represent by the relation
2. Non-time(quantity) resource consumption is recorded as a Record(kind 'resourceConsumed') plus a Relation(kind 'consumes') from the record to the resource; the relation's detail is JSON { projectId, amount }. Relation end types now include 'record'.
3. Hierarchy is Goal → Project → Task, with Milestone as a cross-cutting date anchor inside a project: a task belongs to exactly one project (required `projectId`). Sub-goals are goals with a `projectId` (the project that decomposes them) and a `parentGoalId` (the goal tree). A task again carries an optional `goalId` naming the goal it implements (any level of the tree; absent means the project's root goal), and both goals and tasks carry an optional `milestoneId` pointing to a milestone of the same project.
4. A goal's active project is derived, not stored: it is the goal's project with status `active`. At most one project per goal should be active at a time; application services that activate a project must pause the previously active one.
5. `Goal.activateProject(project, currentActive, now)` enforces decision 4: it pauses the previously active project before activating the new one.
6. Project `complete()`: active → done.
7. Goal-scoped activity: `RecordRepository.listByTarget` matches relations where the record is either the source or the target end.
8. Idea derivation is represented only by a directed Relation: the new model is the source and the preserved Idea is the target (`goal|task|note --derivedFrom--> idea`). The Idea does not store derived IDs, and derived models do not store an Idea ID.
9. Note links use directed Relations: extraction from an Idea is `note --derivedFrom--> idea`, while Goal and Project references are `note --relatesTo--> goal|project`.
10. Goal/Task schedule changes are application commands over the domain's atomic schedule behavior. A successful change writes an immutable `goalScheduleChanged` / `taskScheduleChanged` Record linked to the entity; the entity, Record, and Relation commit or roll back together.
