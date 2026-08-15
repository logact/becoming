---
session_id: session_5e095849-0d46-4a3f-8a75-d97ff54d7868
exported_at: 2026-08-15T14:28:12.229Z
work_dir: /Users/logact/projects/becoming
message_count: 22
token_count: 40049
---

# Kimi Session Export

## Overview

- **Topic**: implement the @dev/mile3/roadmap-milestones-implementation-plan.md
- **Conversation**: 1 turns | 10 tool calls

---

## Turn 1

### User

implement the @dev/mile3/roadmap-milestones-implementation-plan.md

### Assistant

<details><summary>Thinking</summary>

Let me read the plan file first.

</details>

I'll read the implementation plan first.

#### Tool Call: Read (`dev/mile3/roadmap-milestones-implementation-plan.md`)
<!-- call_id: tool_vZtU9VjRX4YRbJMj8oB5ntjI -->
```json
{
  "path": "dev/mile3/roadmap-milestones-implementation-plan.md"
}
```

<details><summary>Tool Result: Read (`dev/mile3/roadmap-milestones-implementation-plan.md`)</summary>

<!-- call_id: tool_vZtU9VjRX4YRbJMj8oB5ntjI -->
1	# Roadmap Milestones — Implementation Plan
2	
3	Status: design ready for implementation
4	
5	Prototype: [roadmap-milestones-prototype.html](./roadmap-milestones-prototype.html)
6	
7	## 1. Feature definition
8	
9	A Project Roadmap belongs to the Project's exact active Goal pursuit.
10	
11	```text
12	Project
13	  -> active contributes_to relation
14	  -> pursued root Goal
15	  -> Project-scoped decomposes hierarchy
16	  -> descendant Goals
17	
18	Pursuit
19	  -> ordered Milestones
20	  -> each Milestone groups one or more descendant Goals
21	```
22	
23	A Milestone is a checkpoint for a set of Goals. It is not a Goal, Task, lifecycle State, or percentage.
24	
25	A Milestone is reached when every currently assigned Goal is complete according to the authoritative Project execution snapshot. Completion is derived and is never manually toggled or persisted on the Milestone.
26	
27	## 2. Product rules
28	
29	1. A Milestone belongs to one exact Project pursuit relation, not merely to a Project ID.
30	2. Every assigned Goal must be an active descendant of that pursuit's root Goal in the same Project-scoped decomposition hierarchy.
31	3. A Milestone must contain at least one active Goal assignment.
32	4. The same Goal may belong to at most one active Milestone within one pursuit.
33	5. Milestones and Goals have deterministic, user-controlled ordering.
34	6. Reaching a Milestone is derived from assigned Goal lifecycle state.
35	7. Missing, unmanaged, uninitialized, blocked, or invalid Goals do not satisfy a Milestone.
36	8. Removing a Milestone does not remove or archive its Goals.
37	9. Removing a Goal assignment ends the assignment; it does not delete history.
38	10. Ending a decomposition edge that would move an assigned Goal outside the pursued hierarchy must fail until the Goal is removed from its Milestone.
39	11. An ended pursuit retains its Roadmap for history. A later pursuit receives a new Roadmap because it has a different relation ID.
40	
41	## 3. Persistence design
42	
43	Add the next append-only migration after the repository's current final migration. At the time of this plan, that would be `src/persistence/migrations/0005_milestones.ts`.
44	
45	```sql
46	CREATE TABLE milestones (
47	  id                  TEXT PRIMARY KEY,
48	  pursuit_relation_id TEXT NOT NULL,
49	  title               TEXT NOT NULL,
50	  description         TEXT,
51	  target_at           TEXT,
52	  sort_order          INTEGER NOT NULL CHECK (sort_order > 0),
53	  created_at          TEXT NOT NULL,
54	  updated_at          TEXT NOT NULL,
55	  archived_at         TEXT
56	);
57	
58	CREATE TABLE milestone_goal_assignments (
59	  id                  TEXT PRIMARY KEY,
60	  pursuit_relation_id TEXT NOT NULL,
61	  milestone_id        TEXT NOT NULL,
62	  goal_id             TEXT NOT NULL,
63	  sort_order          INTEGER NOT NULL CHECK (sort_order > 0),
64	  created_at          TEXT NOT NULL,
65	  ended_at            TEXT
66	);
67	
68	CREATE INDEX milestones_pursuit_order_idx
69	  ON milestones (pursuit_relation_id, archived_at, sort_order, created_at, id);
70	
71	CREATE INDEX milestone_goal_assignments_milestone_idx
72	  ON milestone_goal_assignments (milestone_id, ended_at, sort_order, created_at, id);
73	
74	CREATE UNIQUE INDEX milestone_active_order_unique_idx
75	  ON milestones (pursuit_relation_id, sort_order)
76	  WHERE archived_at IS NULL;
77	
78	CREATE UNIQUE INDEX milestone_goal_active_pursuit_unique_idx
79	  ON milestone_goal_assignments (pursuit_relation_id, goal_id)
80	  WHERE ended_at IS NULL;
81	```
82	
83	There are deliberately no database foreign keys. The application service validates `pursuit_relation_id`, `milestone_id`, and `goal_id` inside the same write unit of work.
84	
85	`pursuit_relation_id` is repeated on assignments intentionally. It supports efficient pursuit-wide uniqueness and corruption detection. The service must verify that it matches the owning Milestone.
86	
87	Do not add `is_complete`, `status`, or `completed_at` columns. Those values would become stale when a Goal transitions or reopens.
88	
89	Do not store `goal_ids` as JSON on `milestones`. A JSON array would make membership history, logical-reference validation, ordering, and efficient querying unnecessarily fragile.
90	
91	Do not use the general `relations` table for Milestone assignments in this version. That table connects registered core concepts, and Milestone is currently a supporting Project-planning aggregate rather than a ninth core concept.
92	
93	## 4. Domain model
94	
95	Create `src/domain/milestone.ts`:
96	
97	```ts
98	export interface Milestone {
99	  id: EntityId;
100	  pursuitRelationId: EntityId;
101	  title: string;
102	  description: string | null;
103	  targetAt: IsoTimestamp | null;
104	  sortOrder: number;
105	  createdAt: IsoTimestamp;
106	  updatedAt: IsoTimestamp;
107	  archivedAt: IsoTimestamp | null;
108	}
109	
110	export interface MilestoneGoalAssignment {
111	  id: EntityId;
112	  pursuitRelationId: EntityId;
113	  milestoneId: EntityId;
114	  goalId: EntityId;
115	  sortOrder: number;
116	  createdAt: IsoTimestamp;
117	  endedAt: IsoTimestamp | null;
118	}
119	```
120	
121	Domain constructors and mutation functions must enforce:
122	
123	- non-blank title and IDs;
124	- positive integer ordering;
125	- valid ISO timestamps;
126	- archive/end timestamps not earlier than creation;
127	- archived Milestones cannot be edited or receive assignments;
128	- ended assignments are immutable.
129	
130	Endpoint existence, active pursuit validity, hierarchy membership, assignment uniqueness, and lifecycle completion belong in the application layer because they require repositories and composed read models.
131	
132	## 5. Repository boundaries
133	
134	Create:
135	
136	- `src/persistence/milestoneRepository.ts`
137	- `src/persistence/milestoneGoalAssignmentRepository.ts`
138	
139	Required Milestone operations:
140	
141	```ts
142	add(milestone)
143	getById(id)
144	save(milestone)
145	listForPursuit(pursuitRelationId, options)
146	reorderActiveForPursuit(pursuitRelationId, orderedMilestoneIds, updatedAt)
147	```
148	
149	Required assignment operations:
150	
151	```ts
152	add(assignment)
153	getById(id)
154	save(assignment) // ended_at only
155	listCurrentForMilestone(milestoneId)
156	listHistoryForMilestone(milestoneId)
157	listCurrentForPursuit(pursuitRelationId)
158	findCurrentForGoal(pursuitRelationId, goalId)
159	reorderCurrentForMilestone(milestoneId, orderedAssignmentIds)
160	```
161	
162	Repository reads must use total deterministic ordering: `sort_order`, then `created_at`, then `id`.
163	
164	Repositories validate their own stored aggregates. They do not decide whether a Goal is beneath a pursued root.
165	
166	## 6. Mutation service
167	
168	Create `src/application/milestoneService.ts` with these commands:
169	
170	- `createMilestone`
171	- `updateMilestone`
172	- `reorderMilestones`
173	- `archiveMilestone`
174	- `assignGoal`
175	- `removeGoalAssignment`
176	- `reorderMilestoneGoals`
177	
178	Each mutation must run through `UnitOfWork` and repeat all eligibility checks inside the transaction.
179	
180	### Creating a Milestone
181	
182	1. Resolve `pursuitRelationId` through `RelationRepository`.
183	2. Require the canonical active `project -> contributes_to -> goal` direction.
184	3. Require the Project, pursued Goal, and selected Goals to exist and be active.
185	4. Use `DecompositionHierarchyQueryService.findDescendants` for the pursuit's Project and root Goal.
186	5. Reject traversal truncation or hierarchy integrity findings; mutations fail closed.
187	6. Require every selected Goal to appear among the valid descendant Goal nodes.
188	7. Reject an empty or duplicate Goal list.
189	8. Reject Goals already assigned to another active Milestone in this pursuit.
190	9. Allocate the next contiguous Milestone and assignment sort orders.
191	10. Write the Milestone, assignments, and provenance Records atomically.
192	
193	### Editing membership
194	
195	Treat assignment replacement as a diff:
196	
197	- retained Goal IDs keep their assignment identity;
198	- removed Goal IDs receive `ended_at`;
199	- added Goal IDs receive new assignment rows;
200	- retained assignments may be reordered;
201	- no historical row is deleted or repointed.
202	
203	### Archiving
204	
205	Archiving a Milestone sets `archived_at` and ends all active assignments in the same unit of work. Repeated archival is idempotent.
206	
207	### Decomposition interaction
208	
209	Before `DecompositionService.end` commits an edge removal, check whether any active Milestone assignment would cease to be a descendant of its pursuit root. Reject with a structured error instructing the user to remove or move the affected Goal assignment first.
210	
211	This keeps Roadmap membership explicit and prevents a Structure mutation from silently changing a Milestone's meaning.
212	
213	## 7. Roadmap query service
214	
215	Create `src/application/projectRoadmapQueryService.ts`.
216	
217	The service should compose:
218	
219	- `ProjectGoalPursuitQueryService`;
220	- `MilestoneRepository`;
221	- `MilestoneGoalAssignmentRepository`;
222	- `ProjectExecutionSnapshotService`;
223	- Goal lookup and decomposition hierarchy results.
224	
225	Suggested read model:
226	
227	```ts
228	export interface ProjectRoadmap {
229	  projectId: EntityId;
230	  pursuit: ProjectGoalPursuitView | null;
231	  milestones: MilestoneRoadmapItem[];
232	  unassignedGoals: ProjectExecutionNode[];
233	  findings: ProjectRoadmapFinding[];
234	  summary: {
235	    reachedMilestones: number;
236	    totalMilestones: number;
237	    achievedGoals: number;
238	    totalGoals: number;
239	  };
240	}
241	
242	export interface MilestoneRoadmapItem {
243	  milestone: Milestone;
244	  goals: MilestoneGoalView[];
245	  reached: boolean;
246	}
247	```
248	
249	For each assigned Goal, reuse the execution snapshot's authoritative classification. A Goal satisfies its Milestone only when its status is `complete`. The Roadmap UI must not interpret raw State titles or derive lifecycle categories itself.
250	
251	Return explicit findings for:
252	
253	- missing or malformed pursuit relation;
254	- missing or archived Milestone/Goal references;
255	- assignment pursuit mismatch;
256	- duplicate active Goal assignment;
257	- empty Milestone;
258	- Goal outside the active pursued hierarchy;
259	- hierarchy traversal truncation or corruption;
260	- lifecycle state that is unmanaged, uninitialized, blocked, or invalid;
261	- active descendant Goal not assigned to any Milestone.
262	
263	Current Roadmap reads exclude ended assignments and archived Milestones. Historical reads select the pursuit, Milestones, assignments, decomposition edges, and lifecycle periods valid at the requested instant.
264	
265	## 8. Provenance
266	
267	Append structured `records` for:
268	
269	- `milestone_created`
270	- `milestone_updated`
271	- `milestone_reordered`
272	- `milestone_archived`
273	- `milestone_goal_assigned`
274	- `milestone_goal_removed`
275	- `milestone_goals_reordered`
276	
277	Records should identify the Milestone, pursuit relation, Project, pursued root Goal, affected Goal IDs, actor, occurrence time, and before/after values where applicable.
278	
279	Optionally append `milestone_reached` and `milestone_reopened` observations when a Goal transition causes the derived Milestone result to cross that boundary. These Records are historical evidence only; current completion remains derived.
280	
281	## 9. Service composition
282	
283	Update `src/ui/composition/appServices.ts` to expose:
284	
285	```ts
286	milestones: MilestoneService
287	roadmaps: ProjectRoadmapQueryService
288	```
289	
290	Construct both repositories over the same `SqliteDatabase` port used by production and test adapters. Provenance writes must share the mutation transaction.
291	
292	## 10. Native UI implementation
293	
294	Create:
295	
296	- `src/ui/projects/roadmap/ProjectRoadmapSegment.tsx`
297	- `src/ui/projects/roadmap/roadmapPresentation.ts`
298	- `src/ui/projects/roadmap/MilestoneFormSheet.tsx`
299	- `src/ui/projects/roadmap/MilestoneGoalPicker.tsx`
300	- `src/ui/projects/roadmap/MilestoneActions.tsx`
301	
302	Change the Project detail segment contract:
303	
304	```ts
305	ProjectDetailSegmentId = 'overview' | 'structure' | 'roadmap'
306	ProjectDetailSlots.renderRoadmap
307	```
308	
309	Replace the visible Progress segment with Roadmap in `ProjectDetailScreen`. Retain the existing execution snapshot and progress-domain code because Roadmap completion consumes the same authoritative execution classification and other consumers may still need Project progress.
310	
311	The Roadmap segment must render only the `ProjectRoadmapQueryService` result. Presentation code may format dates and findings but must not recalculate completion.
312	
313	UI states from the prototype:
314	
315	1. no pursued Goal;
316	2. pursued Goal with no descendant Goals;
317	3. descendant Goals with no Milestones;
318	4. ordered Milestones with nested Goal sets;
319	5. unscheduled Goal warning;
320	6. next Milestone emphasis;
321	7. reached Milestone;
322	8. complete Roadmap;
323	9. loading, retry, and integrity findings;
324	10. add/edit/remove/reorder Milestone flows.
325	
326	The Goal picker shows only valid descendant Goals. Goals assigned elsewhere remain visible but disabled with an explanation.
327	
328	## 11. Tests
329	
330	### Domain tests
331	
332	- Milestone and assignment construction validation.
333	- Archive/end idempotency and timestamp ordering.
334	- Reordering validation.
335	
336	### Migration and repository tests
337	
338	- Fresh database includes both tables and indexes.
339	- Migration upgrade preserves existing data.
340	- No `FOREIGN KEY` or `REFERENCES` clauses.
341	- Current/history visibility and stable ordering.
342	- Active order and Goal-assignment uniqueness under competing writes.
343	
344	### Service tests
345	
346	- Create a Milestone for valid descendant Goals.
347	- Reject root Goal, Task, unrelated Goal, archived Goal, and cross-Project Goal.
348	- Reject empty, duplicate, or already assigned Goal sets.
349	- Reject malformed, ended, or mismatched pursuit relations.
350	- Membership edits retain, end, and add the correct rows.
351	- Archive ends assignments atomically.
352	- Provenance failure rolls back all writes.
353	- Decomposition removal cannot orphan an assigned Goal.
354	
355	### Query tests
356	
357	- One-Goal and multi-Goal Milestones.
358	- Completion is true only when all assigned Goals are complete.
359	- Reopening one Goal reopens its Milestone.
360	- Blocked/unmanaged/uninitialized/invalid Goal handling.
361	- Unassigned descendant detection.
362	- Missing endpoints and hierarchy integrity findings.
363	- Current and historical Roadmaps.
364	
365	### UI tests
366	
367	Use the real service graph and migrated in-memory SQLite harness.
368	
369	- Roadmap replaces the Project Progress tab.
370	- Loading, empty, error, populated, reached, and complete states.
371	- Multi-Goal Milestone rows and derived counts.
372	- Add/edit/remove flows and validation feedback.
373	- Disabled picker candidates explain assignment conflicts.
374	- Mutation success refreshes the Roadmap and shows a toast.
375	- Mutation failure preserves the current screen and draft.
376	- Accessibility labels expose Milestone position, assigned Goal status, and derived completion.
377	
378	## 12. Delivery sequence
379	
380	### Wave 1 — domain and persistence
381	
382	1. Migration and migration tests.
383	2. Milestone domain aggregate.
384	3. Milestone and assignment repositories.
385	
386	### Wave 2 — application behavior
387	
388	4. Mutation service and provenance.
389	5. Decomposition orphan protection.
390	6. Roadmap query service and derived completion.
391	
392	### Wave 3 — native UI
393	
394	7. Service graph composition.
395	8. Project Roadmap segment and presentation model.
396	9. Milestone form, Goal picker, removal, and reorder flows.
397	10. Project detail segment replacement.
398	
399	### Wave 4 — verification and documentation
400	
401	11. Full UI integration tests.
402	12. Typecheck and complete Jest suite.
403	13. Update `Table-definetion.txt`, `docs/architecture.md`, and repository layout guidance.
404	
405	## 13. Acceptance criteria
406	
407	- A user can create an ordered Milestone under the Project's active pursued Goal.
408	- A Milestone can group multiple valid descendant Goals.
409	- A Goal is not actively scheduled in two Milestones for the same pursuit.
410	- A Milestone reaches completion only when every assigned Goal is authoritatively complete.
411	- Goal transitions immediately change the derived Milestone state.
412	- Unassigned sub-goals and integrity problems remain visible.
413	- Structure changes cannot silently invalidate active Milestone membership.
414	- Ending or replacing a pursuit does not rewrite the previous Roadmap.
415	- Every mutation is atomic, provenance-backed, and history preserving.
416	- The UI contains no domain completion logic.
417	

</details>

<details><summary>Thinking</summary>

This is a large implementation plan. Let me look at the dev/mile3 directory for more context, and understand the codebase structure. This is a big task — good candidate for careful planning. Let me first explore what's in dev/mile3, check the prototype, and understand existing code structure (migrations, domain, application services, UI patterns).

Given the scale, I should probably enter plan mode? Actually the user said "implement the plan" — the plan already exists and is detailed. The instruction is to execute it. Plan mode is for planning before implementation; here a plan exists. I could just implement. But it's a big multi-wave task. Let me set up a todo list and work through it, delegating heavy parts to subagents where sensible.

First, gather context. Let me look at dev/mile3 contents, the migrations directory, existing domain files, and related services. I'll delegate exploration to an explore agent to keep my context lean, but I need to understand enough to write good prompts. Let me do some quick direct reads in parallel.

</details>

I'll start by surveying the existing code this plan builds on.

#### Tool Call: Bash (`ls dev/mile3/ src/persistence/migrations/ src/domain/ src/ap…`)
<!-- call_id: tool_mxbyrArSgTPPPk3bEYntpAuF -->
```json
{
  "command": "ls dev/mile3/ src/persistence/migrations/ src/domain/ src/application/ src/ui/projects/ __tests__/"
}
```

<details><summary>Tool Result: Bash (`ls dev/mile3/ src/persistence/migrations/ src/domain/ src/ap…`)</summary>

<!-- call_id: tool_mxbyrArSgTPPPk3bEYntpAuF -->
__tests__/:
appServicesProvider.test.tsx
decimal.test.ts
decimalRoundTrip.test.ts
decompositionHierarchyQueryService.test.ts
decompositionPolicy.test.ts
decompositionService.test.ts
entityLabel.test.ts
entityListScaffold.test.tsx
entityTimelineQueryService.test.ts
goal.test.ts
goalDetailScreen.test.tsx
goalFormSheet.test.tsx
goalListScreen.test.tsx
goalPlanningIntegration.test.tsx
helpers
isolation.test.ts
label.test.ts
labelService.test.ts
lifecycleAuditQueryService.test.ts
lineageQueryService.test.ts
lineageRelationPolicy.test.ts
lineageService.test.ts
migrations.test.ts
mutationProvenance.test.ts
navigationShell.test.tsx
project.test.ts
projectBudget.test.ts
projectBudgetQueryService.test.ts
projectBudgetService.test.ts
projectDetailScreen.test.tsx
projectEntityState.test.ts
projectExecutionSnapshotService.test.ts
projectGoalPursuitQueryService.test.ts
projectGoalPursuitService.test.ts
projectListScreen.test.tsx
projectMachineInitializationService.test.ts
projectPlanningIntegration.test.tsx
projectProgressSegment.test.tsx
projectPursuitFlow.test.tsx
projectState.test.ts
projectStateTransition.test.ts
projectStructureSegment.test.tsx
projectTransitionAuditService.test.ts
projectTransitionExecutionService.test.ts
projectTransitionValidationService.test.ts
quantity.test.ts
record.test.ts
recordQueryClassifyLink.test.ts
relation.test.ts
relationCommitFlow.test.tsx
relationEndpointPicker.test.tsx
relationErrorMapping.test.ts
relationOperations.test.ts
relationProvenance.test.ts
relationRejectionSheet.test.tsx
resource.test.ts
resourceBalance.test.ts
resourceBalanceQueryService.test.ts
resourceException.test.ts
resourceExceptionEvaluator.test.ts
resourceExceptionQueryService.test.ts
resourceService.test.ts
resourceUsage.test.ts
resourceUsageQueryService.test.ts
resourceUsageService.test.ts
schemaIntegrity.test.ts
stateTransitionAudit.test.ts
structureTree.test.ts
task.test.ts
taskAllocation.test.ts
taskAllocationQueryService.test.ts
taskAllocationService.test.ts
taskDetailScreen.test.tsx
taskFormSheet.test.tsx
taskListScreen.test.tsx
taskMembershipFlow.test.tsx
taskProjectMembershipQueryService.test.ts
taskProjectMembershipService.test.ts
timelineEvent.test.ts
transactions.test.ts
workflow.test.ts
workflowApplicabilityService.test.ts
workflowService.test.ts
workflowState.test.ts
workflowStateTransition.test.ts

dev/mile3/:
README.md
roadmap-milestones-implementation-plan.md
roadmap-milestones-prototype.html

src/application/:
coreEntityLookup.ts
decompositionHierarchyQueryService.ts
decompositionProvenanceService.ts
decompositionService.ts
entityTimelineQueryService.ts
goalService.ts
labelAssignmentService.ts
labelService.ts
lifecycleAuditQueryService.ts
lifecycleAuditService.ts
lineageQueryService.ts
lineageService.ts
mutationProvenanceService.ts
projectBudgetQueryService.ts
projectBudgetService.ts
projectEntityStateService.ts
projectExecutionSnapshotService.ts
projectGoalPursuitQueryService.ts
projectGoalPursuitService.ts
projectMachineInitializationService.ts
projectProgress.ts
projectService.ts
projectStateService.ts
projectStateTransitionService.ts
projectTransitionAuditService.ts
projectTransitionExecutionService.ts
projectTransitionValidationService.ts
recordHistoryService.ts
recordService.ts
relationProvenanceService.ts
relationQueryService.ts
relationService.ts
resourceBalanceQueryService.ts
resourceExceptionQueryService.ts
resourceService.ts
resourceUsageQueryService.ts
resourceUsageService.ts
taskAllocationQueryService.ts
taskAllocationService.ts
taskProjectMembershipQueryService.ts
taskProjectMembershipService.ts
taskService.ts
timelineEntityResolver.ts
unitOfWork.ts
workflowApplicabilityService.ts
workflowService.ts
workflowStateService.ts
workflowStateTransitionService.ts

src/domain/:
decimal.ts
decompositionPolicy.ts
entityLabel.ts
entityTypes.ts
goal.ts
ids.ts
json.ts
label.ts
mutationProvenance.ts
project.ts
projectBudget.ts
projectEntityState.ts
projectState.ts
projectStateTransition.ts
quantity.ts
record.ts
recordCorrection.ts
relation.ts
relationPolicy.ts
relationProvenance.ts
resource.ts
resourceBalance.ts
resourceException.ts
resourceExceptionEvaluator.ts
resourceUsage.ts
stateTransitionAudit.ts
task.ts
taskAllocation.ts
timelineEvent.ts
workflow.ts
workflowState.ts
workflowStateTransition.ts

src/persistence/migrations/:
0001_initialSchema.ts
0002_workflowVersionLineage.ts
0003_projectEntityStateCurrentInvariant.ts
0004_workflowTransitionActiveEdgeInvariant.ts
index.ts
migration.ts

src/ui/projects/:
crossDestinationDetail.tsx
progress
projectActivity.ts
ProjectDetailScreen.tsx
projectDetailSlots.ts
ProjectFormSheet.tsx
ProjectListScreen.tsx
ProjectOverview.tsx
projectsDestination.tsx
pursuit
structure


</details>

<details><summary>Thinking</summary>

This is a big multi-wave task. The codebase has established patterns. I should delegate implementation in waves to coder subagents, but subagents need good briefings. Let me first gather key context myself: migration pattern (0004, index.ts), a domain aggregate example (e.g. projectBudget.ts or label.ts), repository example, service example (projectGoalPursuitService), query service (projectGoalPursuitQueryService, projectExecutionSnapshotService), composition (appServices.ts), UI patterns (structure/ and progress/ segments, projectDetailSlots.ts), and the prototype HTML.

That's a lot of context. A good approach: delegate Wave 1 to a coder subagent with a detailed prompt including the plan file path (subagent can read the plan file itself), and pointers to exemplar files. The subagent can read the plan and the exemplars. Then Wave 2, Wave 3, Wave 4 similarly, sequentially since they depend on each other.

But delegation quality depends on briefing. The plan file is quite detailed and the codebase has consistent patterns — a coder subagent reading the plan + exemplar files should manage. I'll do waves sequentially with one subagent per wave, and run typecheck/tests between waves myself (or let subagents do it).

Actually, let me first enter plan mode? No — the user asked to implement an existing detailed plan. Approval of approach already given by pointing at the plan. I'll set up a todo list and proceed.

Let me check a few key files quickly to give subagents accurate pointers. Actually subagents can find these themselves; I'll point them at the plan file and let them explore. But per Agent guidance: "Lookups: put the exact path or command in the prompt." I know enough paths already from the ls output. I'll include them.

One consideration: doing the whole thing myself would eat enormous context. Delegating waves to coder subagents is right. Each wave is substantial. Let me create the todo list and launch Wave 1.

Wave 1: migration 0005_milestones.ts + migration tests, src/domain/milestone.ts, src/persistence/milestoneRepository.ts + milestoneGoalAssignmentRepository.ts + tests.

Wave 2: milestoneService.ts + provenance, decomposition orphan protection (modify decompositionService.end), projectRoadmapQueryService.ts + tests.

Wave 3: composition + UI (roadmap segment, presentation, form sheet, goal picker, actions, segment contract change in projectDetailSlots.ts and ProjectDetailScreen) + UI tests.

Wave 4: full test suite, typecheck, docs updates.

Important: Wave 3 changes ProjectDetailSegmentId — 'progress' is replaced by 'roadmap' visibly but retain progress code. Existing tests (projectProgressSegment.test.tsx, projectDetailScreen.test.tsx) may reference the progress segment; Wave 3 subagent must handle that (plan says replace visible Progress segment with Roadmap; retain code). Tests referencing progress tab will need updating — that's a judgment call; plan says "Roadmap replaces the Project Progress tab" in UI tests. So update existing tests accordingly.

Let me launch Wave 1 now. I'll write a thorough prompt.

</details>

#### Tool Call: TodoList
<!-- call_id: tool_8gMxHe2WnRFlWEE4z38vZYsM -->
```json
{
  "todos": [
    {
      "title": "Wave 1: migration 0005 + domain + repositories + tests",
      "status": "in_progress"
    },
    {
      "title": "Wave 2: milestoneService + decomposition guard + roadmap query service + tests",
      "status": "pending"
    },
    {
      "title": "Wave 3: service composition + Roadmap UI segment + tests",
      "status": "pending"
    },
    {
      "title": "Wave 4: full verification + docs updates",
      "status": "pending"
    }
  ]
}
```

<details><summary>Tool Result: TodoList</summary>

<!-- call_id: tool_8gMxHe2WnRFlWEE4z38vZYsM -->
Todo list updated.
Current todo list:
  [in_progress] Wave 1: migration 0005 + domain + repositories + tests
  [pending] Wave 2: milestoneService + decomposition guard + roadmap query service + tests
  [pending] Wave 3: service composition + Roadmap UI segment + tests
  [pending] Wave 4: full verification + docs updates

Ensure that you continue to use the todo list to track progress. Mark tasks done immediately after finishing them, and keep exactly one task in_progress when work is underway.

</details>

#### Tool Call: Agent (`coder`)
<!-- call_id: tool_KJSsGaVWmS51KX0oazs2cfQp -->
```json
{
  "subagent_type": "coder",
  "description": "Wave 1: milestone persistence layer",
  "prompt": "You are implementing Wave 1 of the Roadmap Milestones feature in the repo at /Users/logact/projects/becoming (TypeScript, React Native/Expo, SQLite, Jest).\n\nFIRST read the authoritative plan: dev/mile3/roadmap-milestones-implementation-plan.md — implement ONLY its Wave 1 scope:\n1. Migration `src/persistence/migrations/0005_milestones.ts` creating the `milestones` and `milestone_goal_assignments` tables exactly as specified in plan section 3 (no foreign keys, the four indexes, CHECK constraints on sort_order), registered in `src/persistence/migrations/index.ts`.\n2. Domain aggregate `src/domain/milestone.ts` with `Milestone` and `MilestoneGoalAssignment` interfaces and constructor/mutation functions per plan section 4 (non-blank title/IDs, positive integer ordering, valid ISO timestamps, archive/end timestamps not earlier than creation, archived Milestones cannot be edited or receive assignments, ended assignments are immutable).\n3. Repositories `src/persistence/milestoneRepository.ts` and `src/persistence/milestoneGoalAssignmentRepository.ts` with exactly the operations listed in plan section 5, total deterministic ordering (sort_order, created_at, id).\n4. Tests per plan section 11 \"Domain tests\" and \"Migration and repository tests\".\n\nMatch existing codebase conventions exactly. Study these exemplars before writing anything:\n- Migration pattern: src/persistence/migrations/0004_workflowTransitionActiveEdgeInvariant.ts, src/persistence/migrations/index.ts, src/persistence/migrations/migration.ts, and __tests__/migrations.test.ts + __tests__/schemaIntegrity.test.ts (note: schemaIntegrity may enumerate expected tables/indexes — update it if that's the established pattern).\n- Domain aggregate pattern: src/domain/label.ts or src/domain/projectBudget.ts (constructors, validation error style, EntityId/IsoTimestamp from src/domain/ids.ts).\n- Repository pattern: an existing repository in src/persistence/ (e.g. one for relations or labels — find how repositories take the SqliteDatabase port, map rows, and are tested via __tests__/helpers/testDatabase.ts).\n- Test harness: __tests__/helpers/testDatabase.ts (fresh migrated in-memory DB per test).\n\nHard rules from AGENTS.md: no database foreign keys, no shared entities table, exact decimals as TEXT, logical references validated in domain/application layer. Append-only migrations (never edit 0001-0004).\n\nWhen done: run `npm run typecheck` and the relevant Jest suites (`npx jest migrations schemaIntegrity milestone` and any repository/domain tests you added) and make them green. Do not touch application services or UI — that's later waves.\n\nReport back: files created/modified, test results, and any deviations from the plan."
}
```

<details><summary>Tool Result: Agent (`coder`)</summary>

<!-- call_id: tool_KJSsGaVWmS51KX0oazs2cfQp -->
agent_id: agent-2
actual_subagent_type: coder
status: completed

[summary]
Wave 1 of the Roadmap Milestones plan is complete and fully green.

## Files created

- `src/persistence/migrations/0005_milestones.ts` — migration version 5, `milestones` and `milestone_goal_assignments` tables exactly per plan §3 SQL (no FKs, `CHECK (sort_order > 0)` on both), the two plain indexes and two partial unique indexes verbatim.
- `src/domain/milestone.ts` — `Milestone` and `MilestoneGoalAssignment` interfaces per plan §4, plus `validateMilestone`, `validateMilestoneGoalAssignment`, `createMilestone`, `updateMilestone`, `archiveMilestone`, `createMilestoneGoalAssignment`, `endMilestoneGoalAssignment`, and `NewMilestone`/`MilestoneChanges`/`NewMilestoneGoalAssignment`/`MilestoneFactoryDeps` input types. Style mirrors `src/domain/label.ts` and `src/domain/entityLabel.ts` (immutability, `deps.id`/`deps.now` for deterministic tests, same error-message idiom).
- `src/persistence/milestoneRepository.ts` — `MilestoneRepository` interface + `SqliteMilestoneRepository` with exactly the plan §5 operations: `add`, `getById`, `save`, `listForPursuit(pursuitRelationId, options)` (`includeArchived` option), `reorderActiveForPursuit(pursuitRelationId, orderedMilestoneIds, updatedAt)`. All reads order by `sort_order, created_at, id`.
- `src/persistence/milestoneGoalAssignmentRepository.ts` — `MilestoneGoalAssignmentRepository` + `SqliteMilestoneGoalAssignmentRepository` with `add`, `getById`, `save` (persists `ended_at` only, per plan), `listCurrentForMilestone`, `listHistoryForMilestone`, `listCurrentForPursuit`, `findCurrentForGoal`, `reorderCurrentForMilestone`. Same total deterministic ordering.
- `__tests__/milestone.test.ts` — 33 tests covering plan §11 "Domain tests" (construction validation, archive/end rules and timestamp ordering, reorder validation) and "Migration and repository tests" (table/column/index shape, no FK/REFERENCES, CHECK enforcement, current-vs-history visibility, stable ordering, active sort-order and per-pursuit Goal-assignment uniqueness, reorder happy path and rejection of empty/duplicate/partial/unknown lists, archived rows untouched).

## Files modified

- `src/persistence/migrations/index.ts` — appended `milestones` to `MIGRATIONS` (0001–0004 untouched).
- `__tests__/migrations.test.ts` — updated expected applied versions to `[1,2,3,4,5]`, table list now includes the two new tables, `schema_migrations` expectation includes `{5, 'milestones'}`; added a new test "upgrading from V4 preserves existing data and adds the milestone tables" (applies migrations <5 manually, seeds a project, runs `migrate()`, asserts data intact and new tables present). `schemaIntegrity.test.ts` needed no changes — it asserts rules (no FKs, no `entities` table), not a table enumeration.

## Verification

- `npm run typecheck` — clean.
- `npx jest migrations schemaIntegrity milestone` — 3 suites, 45 tests, all pass.
- Full `npx jest` — 85 suites, 974 tests, all pass.

## Deviations / decisions worth knowing

1. **Archive/end idempotency lives at the domain boundary as rejection, not silent no-op.** Plan §11 lists "Archive/end idempotency" under domain tests, but the codebase convention (`archiveLabel`, `endEntityLabelAssignment`) throws on repeated archive/end. I followed the codebase: `archiveMilestone`/`endMilestoneGoalAssignment` throw on an already archived/ended aggregate. Plan §6's "repeated archival is idempotent" is therefore a Wave-2 service concern (the service checks `archivedAt` before calling the domain function). Flagging in case the Wave 2 author expected domain-level no-ops.
2. **`createMilestoneGoalAssignment` takes the owning `Milestone` aggregate** (not raw ids) and derives `pursuitRelationId` from it. This is how the domain enforces "archived Milestones cannot receive assignments" (plan §4) and guarantees the denormalized `pursuit_relation_id` can never diverge from the Milestone at creation time.
3. **Milestone reorder uses two UPDATEs** (shift by a 1,000,000 offset, then a single `CASE` rewrite to contiguous 1-based positions). A single `CASE` UPDATE alone fails because SQLite checks the partial unique index row-by-row mid-statement — my first implementation hit exactly that in tests. Assignment reorder has no unique index on sort order, so it uses the single `CASE` UPDATE.
4. **Uniqueness enforcement relies on the DB partial unique indexes** (not app-level pre-checks like `LabelRepository.assertActiveNameFree`), since the plan deliberately specifies those indexes; competing-write tests assert the constraint rejects duplicates. Wave 2 services can catch and re-wrap these into structured errors.
5. **Reorder validation** (exact active-set matching: non-empty, no duplicates, no unknown/inactive ids, no omissions) is implemented in the repositories via a private `assertExactActiveSet` helper duplicated in each repo file, matching the codebase's per-file private-helper convention (e.g. `assertPagination` in `labelRepository.ts`).

No application services, UI, composition, or docs were touched — those remain for Waves 2–4.

</details>

<details><summary>Thinking</summary>

Wave 1 done, full suite green. Now Wave 2: application services. This includes milestoneService.ts with provenance, decomposition orphan protection (modify decompositionService), and projectRoadmapQueryService. This is the heaviest wave. Brief the subagent with pointers: exemplar services — projectGoalPursuitService.ts, decompositionService.ts, projectGoalPursuitQueryService.ts, projectExecutionSnapshotService.ts, mutationProvenanceService.ts, unitOfWork.ts, recordService.ts / record domain. Also mention Wave 1 deviation: archive idempotency at service level.

</details>

#### Tool Call: TodoList
<!-- call_id: tool_Zsazu8IZqHh89tZTfkFJL4pD -->
```json
{
  "todos": [
    {
      "status": "done",
      "title": "Wave 1: migration 0005 + domain + repositories + tests"
    },
    {
      "status": "in_progress",
      "title": "Wave 2: milestoneService + decomposition guard + roadmap query service + tests"
    },
    {
      "status": "pending",
      "title": "Wave 3: service composition + Roadmap UI segment + tests"
    },
    {
      "status": "pending",
      "title": "Wave 4: full verification + docs updates"
    }
  ]
}
```

<details><summary>Tool Result: TodoList</summary>

<!-- call_id: tool_Zsazu8IZqHh89tZTfkFJL4pD -->
Todo list updated.
Current todo list:
  [done] Wave 1: migration 0005 + domain + repositories + tests
  [in_progress] Wave 2: milestoneService + decomposition guard + roadmap query service + tests
  [pending] Wave 3: service composition + Roadmap UI segment + tests
  [pending] Wave 4: full verification + docs updates

Ensure that you continue to use the todo list to track progress. Mark tasks done immediately after finishing them, and keep exactly one task in_progress when work is underway.

</details>

#### Tool Call: Agent (`Wave 2: milestone application services`)
<!-- call_id: tool_aKmhWAGdT6f1zSVMSl0sZ23S -->
```json
{
  "description": "Wave 2: milestone application services",
  "prompt": "You are implementing Wave 2 of the Roadmap Milestones feature in the repo at /Users/logact/projects/becoming (TypeScript, Expo, SQLite, Jest). Wave 1 is done: migration 0005 (tables `milestones`, `milestone_goal_assignments`), `src/domain/milestone.ts` (createMilestone/updateMilestone/archiveMilestone/createMilestoneGoalAssignment/endMilestoneGoalAssignment — note archiveMilestone and endMilestoneGoalAssignment THROW on repeated archive/end; idempotent archival is YOUR service-level concern), and repositories `src/persistence/milestoneRepository.ts` + `src/persistence/milestoneGoalAssignmentRepository.ts` with the exact operations from the plan. Read those files first.\n\nFIRST read the authoritative plan dev/mile3/roadmap-milestones-implementation-plan.md sections 6 (mutation service), 7 (roadmap query service), 8 (provenance), and 11 (Service tests, Query tests). Implement ONLY Wave 2 scope:\n\n1. `src/application/milestoneService.ts` — commands createMilestone, updateMilestone, reorderMilestones, archiveMilestone, assignGoal, removeGoalAssignment, reorderMilestoneGoals, exactly per plan §6. Every mutation runs through UnitOfWork and repeats eligibility checks inside the transaction. Key rules: resolve pursuitRelationId via RelationRepository requiring canonical active `project -> contributes_to -> goal` direction; Project/pursued Goal/selected Goals must exist and be active; use `DecompositionHierarchyQueryService.findDescendants` for the pursuit's Project + root Goal and fail closed on traversal truncation or hierarchy integrity findings; every selected Goal must be a valid descendant Goal node (reject root Goal, Tasks, unrelated/archived/cross-Project Goals); reject empty/duplicate Goal lists and Goals already actively assigned in this pursuit; next contiguous sort orders; write Milestone + assignments + provenance Records atomically. Membership edits are diffs: retained keep identity, removed get ended_at, added get new rows, retained may be reordered, no historical row deleted/repointed. Archiving sets archived_at and ends all active assignments in the same unit of work; repeated archival is idempotent at the service level (domain throws, so check first).\n2. Decomposition orphan protection (plan §6 \"Decomposition interaction\"): in `src/application/decompositionService.ts` `end` flow, before committing an edge removal, reject (structured error telling the user to remove/move the Goal assignment first) if any active Milestone assignment would cease to be a descendant of its pursuit root. Wire the milestone assignment repository into the decomposition service composition minimally; keep it optional or compose it wherever DecompositionService is constructed (check src/ui/composition/appServices.ts and test harnesses) so existing tests keep passing.\n3. `src/application/projectRoadmapQueryService.ts` per plan §7: compose ProjectGoalPursuitQueryService, both milestone repositories, ProjectExecutionSnapshotService, Goal lookup, and decomposition hierarchy results. Read model `ProjectRoadmap` / `MilestoneRoadmapItem` as sketched in the plan (you may refine field shapes to match codebase conventions). Completion: a Goal satisfies its Milestone only when the execution snapshot classifies it `complete`; never interpret raw State titles in this service. Emit explicit findings for everything listed in plan §7 (missing/malformed pursuit relation, missing/archived refs, pursuit mismatch, duplicate active assignment, empty Milestone, Goal outside active hierarchy, hierarchy truncation/corruption, unmanaged/uninitialized/blocked/invalid lifecycle state, unassigned active descendant Goals in `unassignedGoals`). Current reads exclude ended assignments and archived Milestones; also support a historical read (at a requested instant) per plan §7 last paragraph IF the codebase already has an established as-of/historical query pattern (check entityTimelineQueryService / lifecycleAuditQueryService); if no such pattern exists, implement current reads well and keep historical support minimal but tested.\n4. Provenance (plan §8): append structured records for milestone_created, milestone_updated, milestone_reordered, milestone_archived, milestone_goal_assigned, milestone_goal_removed, milestone_goals_reordered — identifying Milestone, pursuit relation, Project, root Goal, affected Goal IDs, actor, occurrence time, before/after values where applicable. The optional milestone_reached/milestone_reopened observations are OPTIONAL — skip them. Provenance failure must roll back all writes (same transaction).\n5. Tests per plan §11 \"Service tests\" and \"Query tests\" (new files __tests__/milestoneService.test.ts and __tests__/projectRoadmapQueryService.test.ts, plus decomposition orphan-protection cases in __tests__/decompositionService.test.ts or a new file).\n\nMatch codebase conventions exactly. Study these exemplars before writing:\n- Service + UnitOfWork + provenance pattern: src/application/projectGoalPursuitService.ts, src/application/unitOfWork.ts, src/application/mutationProvenanceService.ts, src/application/recordService.ts, src/domain/record.ts, src/domain/mutationProvenance.ts, and __tests__/mutationProvenance.test.ts (how provenance rollback is tested).\n- Pursuit relation resolution: src/application/projectGoalPursuitQueryService.ts and src/application/relationService.ts / src/domain/relationPolicy.ts (canonical contributes_to direction constants).\n- Hierarchy: src/application/decompositionHierarchyQueryService.ts (findDescendants result shape, findings for truncation/integrity) and __tests__/decompositionHierarchyQueryService.test.ts.\n- Execution classification: src/application/projectExecutionSnapshotService.ts and src/application/projectProgress.ts (authoritative `complete` classification).\n- Decomposition end flow: src/application/decompositionService.ts and __tests__/decompositionService.test.ts.\n- Test harness: __tests__/helpers/testDatabase.ts.\n\nDo NOT touch src/ui/** or appServices composition of the NEW services (Wave 3 wires the UI), except the minimal DecompositionService constructor change needed for orphan protection — if that forces a composition/test-harness edit, keep it minimal and note it.\n\nWhen done: `npm run typecheck` clean, full `npx jest` green (85+ suites existed before; your new suites add to that). Report files created/modified, test counts, and any deviations.",
  "subagent_type": "coder"
}
```

<details><summary>Tool Result: Agent (`Wave 2: milestone application services`)</summary>

<!-- call_id: tool_aKmhWAGdT6f1zSVMSl0sZ23S -->
agent_id: agent-3
actual_subagent_type: coder
status: completed

[summary]
Wave 2 is complete and verified: `npm run typecheck` clean, full `npx jest` green — **88 suites / 1005 tests passed** (85 suites / 974 tests before; +3 suites / +31 tests).

## Files created

- `src/domain/milestoneProvenance.ts` — provenance payload contract mirroring `relationProvenance.ts`: the 7 actions from plan §8 (`milestone_created/updated/reordered/archived`, `milestone_goal_assigned/removed`, `milestone_goals_reordered`), payload identifies Milestone, pursuit relation, Project, root Goal, affected `goalIds`, actor, `occurredAt`, with per-action before/after validation. Optional `milestone_reached/reopened` deliberately skipped per scope.
- `src/application/milestoneProvenanceService.ts` — `MilestoneProvenancePort<TContext>` seam + `RecordMilestoneProvenancePort` (Record-backed, appends inside the caller's open unit of work, so provenance failure rolls back all writes — verified by test).
- `src/application/milestoneService.ts` — all 7 commands per plan §6, each through `UnitOfWork` with eligibility checks repeated inside the transaction: canonical active `project -> contributes_to -> goal` resolution, active Project/root-Goal/selected-Goal checks, `findDescendants` with fail-closed truncation/integrity handling, rejection of root/Task/unrelated/archived/cross-Project/unknown Goals, empty/duplicate lists, already-assigned Goals; contiguous next sort orders; atomic Milestone + assignments + provenance writes. `assignGoal` is the membership-edit command implementing the diff semantics (retained keep identity, removed get `ended_at`, added get new rows, retained reordered, history never deleted). `archiveMilestone` ends all active assignments atomically and is idempotent on repeat (checks `archivedAt` first, since the domain throws); `removeGoalAssignment` is also idempotent and rejects removing the last active Goal (`MilestoneWithoutGoalsError`). Typed errors follow codebase conventions (`MilestoneNotFoundError`, `ActivePursuitNotFoundError`, `MilestoneGoalOutsidePursuitError`, etc.).
- `src/application/projectRoadmapQueryService.ts` — per plan §7: composes `ProjectGoalPursuitQueryService`, both milestone repositories, and `ProjectExecutionSnapshotService` (whose `progress.findings` supply the authoritative `complete` classification — raw State titles are never read). Read model `ProjectRoadmap` / `MilestoneRoadmapItem` / `MilestoneGoalView` with `reached` derived only from snapshot classification, plus `summary` and deterministic findings for every case in §7 (missing/duplicate/malformed pursuit, missing/archived Milestone/Goal refs, assignment pursuit mismatch, duplicate active assignment, empty Milestone, Goal outside hierarchy, hierarchy truncation/corruption passthrough, unsatisfied lifecycle states, `unassignedGoals`). Current reads exclude ended assignments and archived Milestones; `asOf` selects pursuit/Milestones/assignments/edges valid at the instant using half-open-interval filtering (matching the codebase's existing as-of pattern in the snapshot service).
- `__tests__/milestoneService.test.ts` (17 tests), `__tests__/projectRoadmapQueryService.test.ts` (9), `__tests__/decompositionMilestoneOrphanProtection.test.ts` (5) — covering plan §11 Service and Query test lists, including provenance-rollback and ended-pursuit-history cases.

## Files modified

- `src/application/decompositionService.ts` — optional `milestoneAssignments` port; `end` now calls `assertNoMilestoneOrphans`, which BFS-checks reachability from each active pursuit root with/without the ending edge (bounded, fail-closed via `DecompositionGraphIntegrityError`) and rejects with `DecompositionEndOrphansMilestoneGoalError` (carries structured `orphans`, message tells the user to remove/move the assignment first). Without the port, prior behavior is unchanged.
- `src/ui/composition/appServices.ts` — the one permitted composition edit: import + one-line wiring of `SqliteMilestoneGoalAssignmentRepository` into the existing `DecompositionService` construction. New services (`milestones`, `roadmaps`) are intentionally NOT composed — that's Wave 3.

## Deviations

1. `assignGoal` takes the Milestone's complete desired `goalIds` set (atomic diff per §6 "Editing membership") rather than a single Goal — the plan's command list has no separate replace command, and per-call atomicity requires it.
2. `MilestoneService` fails closed on hierarchy findings *except* `cross_project_edge`: the hierarchy read lists the global decomposition table, so any second Project's valid edges would otherwise permanently block all Milestone mutations.
3. Orphan-protection cases went into a new test file rather than editing `decompositionService.test.ts`, keeping the existing suite untouched.
4. No `AGENTS.md` update needed — no layout/convention changes (new files fit the documented structure).

</details>

<details><summary>Thinking</summary>

Wave 2 done. Wave 3: UI. This is large: composition of milestones + roadmaps services, segment contract change ('progress' → 'roadmap'), ProjectRoadmapSegment, roadmapPresentation, MilestoneFormSheet, MilestoneGoalPicker, MilestoneActions, update ProjectDetailScreen, update existing tests that reference the progress tab, new UI tests.

Brief subagent with exemplars: src/ui/projects/structure/, src/ui/projects/progress/, projectDetailSlots.ts, ProjectDetailScreen.tsx, uiTestHarness.tsx, projectProgressSegment.test.tsx, projectStructureSegment.test.tsx, and the prototype HTML dev/mile3/roadmap-milestones-prototype.html.

</details>

#### Tool Call: TodoList
<!-- call_id: tool_J3LMbRJx3GgHSJxhjAg1yl6b -->
```json
{
  "todos": [
    {
      "status": "done",
      "title": "Wave 1: migration 0005 + domain + repositories + tests"
    },
    {
      "status": "done",
      "title": "Wave 2: milestoneService + decomposition guard + roadmap query service + tests"
    },
    {
      "status": "in_progress",
      "title": "Wave 3: service composition + Roadmap UI segment + tests"
    },
    {
      "status": "pending",
      "title": "Wave 4: full verification + docs updates"
    }
  ]
}
```

<details><summary>Tool Result: TodoList</summary>

<!-- call_id: tool_J3LMbRJx3GgHSJxhjAg1yl6b -->
Todo list updated.
Current todo list:
  [done] Wave 1: migration 0005 + domain + repositories + tests
  [done] Wave 2: milestoneService + decomposition guard + roadmap query service + tests
  [in_progress] Wave 3: service composition + Roadmap UI segment + tests
  [pending] Wave 4: full verification + docs updates

Ensure that you continue to use the todo list to track progress. Mark tasks done immediately after finishing them, and keep exactly one task in_progress when work is underway.

</details>

#### Tool Call: Agent (`Wave 3: Roadmap UI segment`)
<!-- call_id: tool_8bKWJWbsPB17m742J4LVCkTY -->
```json
{
  "description": "Wave 3: Roadmap UI segment",
  "prompt": "You are implementing Wave 3 of the Roadmap Milestones feature in the repo at /Users/logact/projects/becoming (TypeScript, React Native/Expo, SQLite, Jest + @testing-library/react-native).\n\nWaves 1–2 are done and the full suite is green (88 suites / 1005 tests). Available now: domain `src/domain/milestone.ts`, repositories `src/persistence/milestoneRepository.ts` + `milestoneGoalAssignmentRepository.ts`, services `src/application/milestoneService.ts` (createMilestone/updateMilestone/reorderMilestones/archiveMilestone/assignGoal/removeGoalAssignment/reorderMilestoneGoals — note assignGoal takes the Milestone's full desired goalIds set as an atomic diff), `src/application/projectRoadmapQueryService.ts` (ProjectRoadmap read model with MilestoneRoadmapItem{ milestone, goals, reached }, unassignedGoals, findings, summary), and `src/domain/milestoneProvenance.ts`. `src/ui/composition/appServices.ts` already wires the assignment repository into DecompositionService. Read these files first to learn exact APIs.\n\nFIRST read the authoritative plan dev/mile3/roadmap-milestones-implementation-plan.md — sections 9 (service composition), 10 (native UI), and 11 (UI tests). Also study the visual/interaction spec: dev/mile3/roadmap-milestones-prototype.html (single-file HTML mock — mine it for states, copy, layout, and flows).\n\nImplement Wave 3 scope:\n\n1. Composition: update `src/ui/composition/appServices.ts` to expose `milestones: MilestoneService` and `roadmaps: ProjectRoadmapQueryService`, constructing repositories over the same SqliteDatabase port and sharing the mutation transaction for provenance (follow how existing services + record/provenance ports are composed there; check how the Wave-2 services' constructors want their deps).\n\n2. Segment contract change in `src/ui/projects/projectDetailSlots.ts` and `src/ui/projects/ProjectDetailScreen.tsx`: `ProjectDetailSegmentId = 'overview' | 'structure' | 'roadmap'` and add `ProjectDetailSlots.renderRoadmap`. Replace the VISIBLE Progress segment with Roadmap in ProjectDetailScreen. RETAIN all existing progress code (`src/ui/projects/progress/`, projectExecutionSnapshotService, projectProgress) — Roadmap consumes the same snapshot via the query service and other consumers may still need progress; only the visible segment changes. Existing tests that assert the Progress tab is visible (likely __tests__/projectProgressSegment.test.tsx and __tests__/projectDetailScreen.test.tsx) must be updated to the new contract — keep testing the progress code paths that still exist (e.g. renderProgress slot may remain in the slots contract if other consumers use it; judge from how slots are consumed), but the default Project detail screen now shows Roadmap.\n\n3. New UI under `src/ui/projects/roadmap/`:\n   - `ProjectRoadmapSegment.tsx` — renders ONLY the ProjectRoadmapQueryService result; presentation may format dates/findings but must never recalculate completion.\n   - `roadmapPresentation.ts` — pure presentation mapping (labels, finding text, derived display strings) consuming the query result.\n   - `MilestoneFormSheet.tsx` — add/edit Milestone (title, description, target date), following the existing sheet patterns.\n   - `MilestoneGoalPicker.tsx` — shows only valid descendant Goals of the pursuit; Goals already assigned to another active Milestone remain visible but disabled with an explanation.\n   - `MilestoneActions.tsx` — edit/remove/reorder/archive flows with confirm dialog + toast per existing conventions.\n   Wire the segment into ProjectDetailScreen through the `renderRoadmap` slot exactly like structure/progress are wired (see how `src/ui/projects/structure/` and `src/ui/projects/progress/` plug into slots and screens).\n\n4. UI states from the prototype (plan §10 list): no pursued Goal; pursued Goal with no descendants; descendants with no Milestones; ordered Milestones with nested Goal sets; unscheduled Goal warning (unassignedGoals); next-Milestone emphasis; reached Milestone; complete Roadmap; loading/retry/integrity findings; add/edit/remove/reorder flows.\n\n5. UI tests (new file(s), e.g. __tests__/projectRoadmapSegment.test.tsx) using the REAL service graph over the migrated in-memory SQLite harness `__tests__/helpers/uiTestHarness.tsx` — cover plan §11 \"UI tests\": Roadmap replaces the Progress tab; loading/empty/error/populated/reached/complete states; multi-Goal Milestone rows and derived counts; add/edit/remove flows with validation feedback; disabled picker candidates explain conflicts; mutation success refreshes + toast; mutation failure preserves screen and draft; accessibility labels expose Milestone position, assigned Goal status, derived completion. Update any existing tests broken by the segment change.\n\nMatch codebase UI conventions exactly. Study: `src/ui/projects/structure/` (segment + flows wired through renderStructure slot — the closest analog), `src/ui/projects/progress/`, `src/ui/shared/` (entity list scaffold, status badge, sheet, confirm dialog, toast), `src/ui/goals/` form sheet patterns, and __tests__/projectStructureSegment.test.tsx for test style.\n\nHard rule: UI owns no domain logic — all completion/reachability comes from the query service result.\n\nWhen done: `npm run typecheck` clean and full `npx jest` green. Report files created/modified, test counts, how you handled the progress→roadmap test migration, and deviations.",
  "subagent_type": "coder"
}
```

<details><summary>Tool Result: Agent (`Wave 3: Roadmap UI segment`)</summary>

<!-- call_id: tool_8bKWJWbsPB17m742J4LVCkTY -->
agent_id: agent-4
actual_subagent_type: coder
status: completed

[summary]
Wave 3 is complete. `npm run typecheck` is clean and the full `npx jest` run is green: **89 suites / 1025 tests passed** (baseline was 88/1005; +1 suite, +20 tests).

## Files created (Wave 3)

- `src/ui/projects/roadmap/ProjectRoadmapSegment.tsx` — the Roadmap segment. Renders only `ProjectRoadmapQueryService.getProjectRoadmap` output; reached flags, per-Goal completion, summary counts, unassigned Goals, and findings all come from the read model. Covers every prototype state: no pursued Goal (with pursuit actions), no sub-goals, no Milestones, ordered Milestone cards with nested Goal rows + status badges, unscheduled-Goal warning, next-Milestone emphasis ("Next · Milestone 01" + brand border), reached Milestones, complete-Roadmap banner, loading/error/retry, and a findings card that filters out `goal_lifecycle_unsatisfied`/`unassigned_goal` (already explained by badges/warning).
- `src/ui/projects/roadmap/roadmapPresentation.ts` — pure mapping: status badge presentation, `formatTargetDate` ("Sep 30, 2026" / "No target date"), position labels, progress text, next-Milestone selection, summary text, per-Milestone VoiceOver labels, finding descriptions.
- `src/ui/projects/roadmap/MilestoneFormSheet.tsx` — New/Edit sheet (title, description, `YYYY-MM-DD` target date, Goal selection). Follows `GoalFormSheet` conventions: service stays authoritative, structured errors translate to inline feedback, drafts survive failures. Edit commits `updateMilestone` + an `assignGoal` diff when membership changed.
- `src/ui/projects/roadmap/MilestoneGoalPicker.tsx` — checkbox candidates; Goals assigned to another active Milestone render disabled with `Already assigned to "<title>"`.
- `src/ui/projects/roadmap/MilestoneActions.tsx` — per-Milestone move up/down (`reorderMilestones`), Edit, and confirmed Remove (`archiveMilestone`) via `useRelationCommit` + `ConfirmDialog` + toast + `RelationRejectionSheet`, mirroring the structure segment's end-edge flow.
- `__tests__/projectRoadmapSegment.test.tsx` — 20 tests over the real service graph + in-memory SQLite harness.

## Files modified

- `src/ui/composition/appServices.ts` — exposes `milestones: MilestoneService` (context-bound repos + hierarchy read inside the unit of work, `RecordMilestoneProvenancePort` sharing the mutation transaction) and `roadmaps: ProjectRoadmapQueryService` (shares the hoisted `executionSnapshots` instance).
- `src/ui/projects/projectDetailSlots.ts` — `ProjectDetailSegmentId = 'overview' | 'structure' | 'roadmap'`; `renderRoadmap` slot added; `renderProgress` removed (no visible segment consumes it anymore; the progress code itself is fully retained).
- `src/ui/projects/ProjectDetailScreen.tsx` — visible Progress segment replaced by Roadmap (tab "Roadmap", placeholder pane when slot absent).
- `src/ui/placeholderDestinations.tsx` — production wiring now injects `ProjectRoadmapSegment` via `renderRoadmap`.
- `AGENTS.md` — layout description updated for `roadmap/` and the segment change.

## Progress→Roadmap test migration

- `__tests__/projectDetailScreen.test.tsx` — placeholder/slot tests updated to `Show roadmap` / `renderRoadmap`.
- `__tests__/projectProgressSegment.test.tsx` — all progress code-path coverage kept. Since the Progress tab no longer exists, the segment is now mounted directly as the Projects destination's list route inside the real shell (`appDestinations()` with the projects entry swapped, Goals/Tasks untouched so drill-in still works). The stale-response test was adapted: first load gated (real 100% snapshot), tab round-trip triggers a fresh zero-denominator load, late stale resolution must not clobber it.

## Test coverage of plan §11

Tab replacement; loading/error/retry (incl. persistent failure); no-pursuit/no-sub-goals/no-milestones empties; populated multi-Goal rows with derived counts, dates, next emphasis; reached + complete states; findings card (injected finding; lifecycle findings stay filtered); a query-authority guard test (stubbed `reached: true` renders as supplied — UI never recalculates); add flow with inline validation (empty Goals, blank title, malformed date), conflicted picker candidates disabled with explanation; mutation failure preserves sheet/draft/selection then same draft commits; edit details + membership swap; remove confirm/cancel/failure (rejection sheet, roadmap unchanged); reorder up/down. Accessibility labels asserted for milestone position/completion/emphasis, per-Goal status, and summary.

## Deviations

- "Remove" in the UI is the service's `archiveMilestone` (the domain has no delete) — copy follows the prototype ("Remove this milestone? … Goals remain in the Project Structure").
- Goal-level reordering within a Milestone (`reorderMilestoneGoals`) is not exposed as a separate UI gesture; membership order follows candidate order through the `assignGoal` diff. Plan §10 lists only Milestone-level reorder, so this matches scope.
- Wave 4 items (Table-definetion.txt, docs/architecture.md updates) intentionally left for Wave 4 per the plan's delivery sequence; only AGENTS.md was updated since it mandates staying current on layout changes.

</details>

<details><summary>Thinking</summary>

Wave 3 done, suite green. Wave 4: docs updates (Table-definetion.txt, docs/architecture.md — AGENTS.md already updated) + final verification. This is smaller; I could do it myself or delegate. Docs updates need knowledge of the new tables and architecture conventions. It's moderate; delegate to a subagent (could resume agent-4 which has context). Resuming agent-4 keeps context — good.

</details>

Wave 3 done — 89 suites / 1025 tests green. Wave 4 is docs plus final verification; I'll resume the same agent since it has the context.

#### Tool Call: TodoList
<!-- call_id: tool_XE9UwtG1ZqMluvlUyevbkCo8 -->
```json
{
  "todos": [
    {
      "status": "done",
      "title": "Wave 1: migration 0005 + domain + repositories + tests"
    },
    {
      "status": "done",
      "title": "Wave 2: milestoneService + decomposition guard + roadmap query service + tests"
    },
    {
      "status": "done",
      "title": "Wave 3: service composition + Roadmap UI segment + tests"
    },
    {
      "status": "in_progress",
      "title": "Wave 4: full verification + docs updates"
    }
  ]
}
```

<details><summary>Tool Result: TodoList</summary>

<!-- call_id: tool_XE9UwtG1ZqMluvlUyevbkCo8 -->
Todo list updated.
Current todo list:
  [done] Wave 1: migration 0005 + domain + repositories + tests
  [done] Wave 2: milestoneService + decomposition guard + roadmap query service + tests
  [done] Wave 3: service composition + Roadmap UI segment + tests
  [in_progress] Wave 4: full verification + docs updates

Ensure that you continue to use the todo list to track progress. Mark tasks done immediately after finishing them, and keep exactly one task in_progress when work is underway.

</details>

#### Tool Call: Agent (`Wave 4: docs and final verification`)
<!-- call_id: tool_iif8RS1oy6BhFsCwzBBH8BKW -->
```json
{
  "description": "Wave 4: docs and final verification",
  "prompt": "Continue with Wave 4 (final wave) of the Roadmap Milestones plan (dev/mile3/roadmap-milestones-implementation-plan.md §12 Wave 4):\n\n1. Update `Table-definetion.txt` — add the `milestones` and `milestone_goal_assignments` table definitions, matching the file's existing format for other tables, reflecting the exact 0005 migration schema.\n2. Update `docs/architecture.md` — document the Milestone/Roadmap concepts where the doc describes domain entities, persistence migrations, application services, and the Projects UI (Roadmap segment replacing the visible Progress tab; progress code retained). Follow the doc's existing structure and tone; keep it accurate to what was actually implemented across Waves 1–3 (milestoneService, projectRoadmapQueryService, decomposition orphan protection, provenance actions, ui/projects/roadmap/).\n3. Check `AGENTS.md` Wave-4 accuracy — you already updated the layout line; verify nothing else it states is now stale (e.g. segment contract description).\n4. Final verification: run `npm run typecheck` and the full `npx jest` suite; both must be green. Also sanity-check acceptance criteria in plan §13 against what was built and report any gaps honestly.\n\nReport: doc changes made, final test/typecheck results, and any acceptance-criteria gaps.",
  "resume": "agent-4"
}
```

<details><summary>Tool Result: Agent (`Wave 4: docs and final verification`)</summary>

<!-- call_id: tool_iif8RS1oy6BhFsCwzBBH8BKW -->
agent_id: agent-4
actual_subagent_type: coder
status: failed

subagent error: The subagent was stopped before it finished. Reason: 403 You've reached your usage limit for this billing cycle. Your quota will be refreshed in the next cycle. To continue now, purchase extra usage or upgrade your plan: https://www.kimi.com/code/#pricing

</details>
