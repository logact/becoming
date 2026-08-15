# Milestone 2 Implementation Plan

Milestone: [V1 Native UI](https://github.com/logact/becoming/milestone/2)

This plan implements the six open `task` + `UI` issues under Features #17–#22. The implementation order is derived from the numbered `Depends on` references in the task bodies: nine dependency edges form an acyclic graph with two roots and five execution waves.

## Milestone outcome

Deliver the native planning loop for Epic #3:

`Goal -> Project -> sub-goals and Tasks -> inspect execution and derived progress`

The milestone is complete when all six UI tasks in this document are closed, their parent Feature acceptance criteria are demonstrated through the native application, and the integrated experience preserves these product rules:

- Goals, Projects, and Tasks remain independent domain entities; UI convenience does not add intrinsic relationship or progress fields.
- Goal pursuit, Task membership, and decomposition use the existing semantic-relation operations and preserve ended relationship history.
- Domain validation and progress policy remain authoritative; presentation code translates results but does not recreate those rules.
- Loading, empty, error, archived, unmanaged, uninitialized, invalid, and traversal-truncated states remain explicit.
- Committed planning changes survive screen refresh and application restart through the existing on-device SQLite persistence.
- Lifecycle state is inspectable in this milestone, while lifecycle-transition mutation UI remains owned by Feature #29.

## How to execute this plan

1. Start [#131](https://github.com/logact/becoming/issues/131) and [#133](https://github.com/logact/becoming/issues/133) in parallel. They establish Goal planning screens and the shared semantic-relation feedback required by later flows.
2. Start #134 when #131 and #133 are closed, then #132 when #133 and #134 are closed. This builds Goal pursuit before Task membership needs Project context.
3. Start #135 only after #131–#134 are closed. Start #136 only after #135 is closed. A task may begin as soon as all of its own dependencies are satisfied; it does not need to wait for unrelated validation work.
4. Implement one task per branch and pull request. Include the issue number in the branch and PR, and use `Closes #<task>` in the PR description.
5. Before coding, refresh the issue's `Dependencies` section and confirm the existing domain/application contracts it consumes are still current. Do not begin while a numbered dependency remains open unless the dependency is deliberately changed in GitHub with an explanation.
6. Keep domain rules in domain/application code. UI code may translate structured errors and compose read models, but it must not independently decide relation validity, hierarchy safety, lifecycle meaning, or progress.
7. Add component tests for presentation states and interaction, integration tests for application-service composition and mutation refresh, and persistence-backed tests for reload behavior.
8. Merge only after `npm run typecheck` and `npm test` pass. Close a parent Feature only after its UI child and Feature-level native acceptance scenarios are complete.

Cross-cutting navigation, application composition, design primitives, and database startup are planned separately. If one is required to host a screen, integrate with its established contract without absorbing that work into these Epic #3 tasks.

### Prototype implementation contract

Use [`m2-codex-prototype.html`](m2-codex-prototype.html) as the interaction and information-architecture baseline for the six tasks below. It defines the intended screen relationships and presentation states, not production architecture or a pixel-perfect web specification.

- The native shell exposes top-level Goals, Projects, and Tasks destinations. Entity lists share a title/hero, search, Active/Archived filter, populated or empty content, and an active-only create action.
- Entity details use a back affordance, type label, title, supporting copy, status badges, compact facts, contextual relationship actions, recent activity, edit, and confirmed archive actions.
- Create/edit forms, endpoint pickers, validation feedback, relation feedback, and destructive confirmations use focused modal or bottom-sheet presentations. Successful mutations provide brief confirmation and refresh every affected screen.
- Project detail owns the Overview, Structure, and Progress segments. #134 delivers the detail shell and Overview; #135 fills Structure; #136 fills Progress.
- Unavailable relation candidates remain visible when useful and explain why they cannot be selected. Presentation hints never replace application-service validation at commit time.
- Status is always communicated with text and an icon or other non-color cue. Native layouts must remain usable with Dynamic Type, VoiceOver, keyboard focus where applicable, and platform touch-target expectations.
- Recent activity is a read-only view of persisted provenance/history contracts. The UI must not manufacture authoritative history from toast messages or local component state.

The browser prototype stores mock data in memory and simplifies a few flows. Production work must retain the issue contracts where they are broader than the sketch: #131 includes Goal success criteria; #134 includes Project creation from Goal context and multi-Goal selection; #132 includes Task description and exit criteria; #135 includes ending a decomposition edge; and all relation state must use semantic-relation services rather than the prototype's embedded IDs or arrays. Traversal guidance is shown only when the production query reports truncation, not as a permanent warning.

## Delivery controls

### Definition of ready

A task is ready when:

- every numbered `Depends on` issue in its body is closed;
- the domain commands, queries, error contracts, and read models it consumes exist on the integration branch;
- any separately planned application shell, navigation, and composition prerequisites needed by the screen are available;
- acceptance criteria and test cases remain current;
- loading, empty, error, archived, and retry behavior are specified for the flow; and
- no unresolved interaction choice would change a domain or application contract.

### Definition of done

A task is done when:

- every task acceptance checkbox is satisfied;
- required component, integration, persistence, and accessibility-focused interaction tests pass;
- `npm run typecheck` and `npm test` pass from the integration branch;
- successful mutations refresh all affected visible projections and persist across reload;
- failed mutations preserve valid user input, present semantic feedback, and never appear committed;
- domain rules are consumed rather than duplicated in presentation code;
- loading, empty, error, archived, integrity, and retry states required by the issue are demonstrated;
- affected documentation is updated;
- the PR is merged and the task issue is closed; and
- the next tasks in the documented DAG are unblocked.

### Integration gates

- **Gate A — Planning foundations:** #131 and #133 are merged; Goal planning and reusable relation feedback pass component and application-integration tests.
- **Gate B — Goal pursuit:** #134 is merged; Projects can be managed from Project or Goal context and active pursuit history remains intact.
- **Gate C — Task membership:** #132 is merged; Task CRUD, Project-context selection, membership changes, archive behavior, and duplicate feedback pass integration tests.
- **Gate D — Decomposition:** #135 is merged; the indented Project hierarchy supports all valid child types and exposes rejected structures and traversal findings.
- **Gate E — Execution insight:** #136 is merged; execution snapshots drive all progress categories, zero-denominator behavior, lifecycle display, and integrity findings.
- **Gate F — Milestone acceptance:** the complete native loop works across Goal, Project, Task, decomposition, and progress screens; all six tasks and Features #17–#22 are ready to close.

## Workstreams

The waves below are authoritative for scheduling. These workstreams clarify ownership and integration boundaries:

- **Entity planning:** #131, #134, and #132.
- **Relation feedback and hierarchy:** #133 and #135.
- **Execution and progress:** #136.

The longest current dependency chains are:

`#131 -> #134 -> #132 -> #135 -> #136`

`#133 -> #134 -> #132 -> #135 -> #136`

Protect these paths from avoidable delay, but do not let them bypass interaction, persistence, accessibility, or integrity-state tests.

## Implementation waves

### Wave 1 — Goal planning and relation feedback

Exit gate: Goal CRUD/archive screens work against persisted application services, and every supported semantic-relation failure has a reusable, retry-safe UI translation.

#### [#131](https://github.com/logact/becoming/issues/131) — Build Goal planning UI (Feature #17)

Prototype-aligned delivery:

- [ ] Build the Goals destination with the prototype's planning hero, title search, Active/Archived filter, populated rows, explicit empty state, loading state, and recoverable error/retry state. Active rows show target state plus pursued/unpursued context; archived rows remain inspectable and expose no create action.
- [ ] Build the New Goal and Edit Goal sheet flows for title, target state, description, and the issue-required success criteria. Preserve entered values and show actionable inline feedback when validation fails.
- [ ] Build Goal detail with intended-outcome heading, description, archive/pursuit status, target-state and active-Project facts, Pursued by list or empty message, and recent persisted activity. Pursuit actions are wired by #134; this task provides the stable detail slots they extend.
- [ ] Add edit and confirmed archive actions. Cancel leaves the Goal unchanged; confirm makes it read-only, removes it from Active, preserves it under Archived/history, and refreshes visible projections.
- [ ] Announce successful create, edit, and archive outcomes without treating the transient confirmation as persisted state.

Task acceptance scenarios:

- [ ] Search and Active/Archived filtering produce correct populated and empty results without changing persisted data.
- [ ] Required fields, optional-field round trips, and non-numeric success criteria behave according to the Goal application contract.
- [ ] Create and edit refresh the list and detail immediately; reload reconstructs the same values from SQLite.
- [ ] Loading, query failure, mutation failure, cancellation, archive, and archived read-only presentations pass component and integration tests.

#### [#133](https://github.com/logact/becoming/issues/133) — Integrate semantic relation feedback into planning UI (Feature #19)

Prototype-aligned delivery:

- [ ] Define one reusable mapping from structured relation errors to a short title, actionable explanation, affected action or candidate, retryability, and safe fallback. Preserve the original structured identity for logs and tests.
- [ ] Use endpoint picker rows that keep useful unavailable choices visible with a Rejected state and a reason such as archived endpoint, duplicate active relationship, invalid direction, already in structure, or cross-Project structure.
- [ ] On commit-time rejection, present the prototype's focused Change not allowed feedback without navigating away, clearing a valid draft/selection, or rendering the relation optimistically. Let the user review another choice, correct the input, refresh stale endpoints, and retry.
- [ ] Use concise success confirmation only after the service commits, then refresh every affected Goal, Project, Task, hierarchy, activity, and progress projection.
- [ ] Integrate this presentation contract into the Goal-pursuit work in #134, Task-membership work in #132, and decomposition work in #135; do not build a generic relation editor.

Task acceptance scenarios:

- [ ] Table-driven tests distinguish missing source, missing target, duplicate active relation, invalid direction, invalid endpoint type, cardinality violation, cycle, archived endpoint, cross-Project structure, and an unknown safe fallback.
- [ ] Picker-time hints and commit-time validation produce consistent language, while the application/domain result remains authoritative.
- [ ] Failed, corrected, retried, and eventually successful mutations preserve state and never show an uncommitted relation.

### Wave 2 — Project planning and Goal pursuit

Exit gate: Projects can be listed, created, edited, inspected, and archived; users can create or end valid Goal pursuits from Goal or Project context with semantic failure feedback.

#### [#134](https://github.com/logact/becoming/issues/134) — Build Project and Goal pursuit UI (Feature #20)

Prototype-aligned delivery:

- [ ] Build the Projects destination using the shared list scaffold: planning hero, title search, Active/Archived filter, task-count context, populated/empty/loading/error states, and active-only New Project action.
- [ ] Build New Project and Edit Project sheets for title, purpose, and description, with inline validation, preserved draft state, successful refresh, and persisted reload behavior.
- [ ] Build Project detail and the sticky Overview/Structure/Progress segment control. #134 owns the header, archive state, segment shell, and Overview; later tasks own the Structure and Progress content.
- [ ] In Overview, show pursued-Goal and member-Task facts, pursued Goal rows or their explicit empty state, member Task rows or their explicit empty state, and recent persisted Project activity. Rows navigate to the corresponding Goal or Task detail.
- [ ] Support Goal pursuit from both directions: Connect/Remove from Goal detail, and Add/Remove from Project Overview. Include creation of a Project from Goal context and selecting multiple active Goals when starting from Project context, even though the prototype demonstrates one-at-a-time connection.
- [ ] Keep unavailable Goals or Projects visible with #133 feedback where that clarifies duplicate or archived-endpoint policy. Ending a pursuit uses an explicit picker when needed and a confirmation explaining that both entities and prior association remain in history.
- [ ] Build Project edit and confirmed archive behavior consistent with Goal planning. Archived Projects become read-only and are rejected or hidden as relation endpoints according to domain policy.

Task acceptance scenarios:

- [ ] Project CRUD, search/filter, empty/loading/error/retry, cancellation, archive, and persisted reload states pass component and integration tests.
- [ ] Pursuit creation works from Goal and Project contexts, including multi-Goal selection, duplicate rejection, archived endpoints, cancellation, ending, and history preservation.
- [ ] Successful pursuit mutations refresh Goal facts/list badges, Project facts/Overview, pickers, and activity; failed mutations preserve current UI state.
- [ ] Overview displays existing Task membership but does not own membership mutation, hierarchy mutation, or progress calculation.

### Wave 3 — Task planning and Project membership

Exit gate: Task CRUD/archive flows, priority validation, Project-context selection, and membership start/end actions pass refresh and persistence tests.

#### [#132](https://github.com/logact/becoming/issues/132) — Build Task and Project membership UI (Feature #18)

Prototype-aligned delivery:

- [ ] Build the Tasks destination using the shared list scaffold: planning hero, title search, Active/Archived filter, target/priority context, lifecycle-status badge, populated/empty/loading/error states, and active-only New Task action.
- [ ] Build New Task and Edit Task sheets for title, target description, description, exit criteria, and optional whole-number priority 1–5. Show required-field and priority errors inline without discarding the draft.
- [ ] Build Task detail with executable-work heading, target, lifecycle-status and priority badges, current Project fact, read-only lifecycle fact, recent persisted activity, edit, and confirmed archive. Keep the prototype's explicit note that lifecycle transition actions belong to Feature #29.
- [ ] Provide Add to a Project from an unassigned Task and Add an existing Task from Project Overview. Candidate rows explain archived, duplicate, or already-belongs-to-another-Project rejection using #133.
- [ ] Provide confirmed Remove from Project for an active membership. Explain that the active membership ends while the Task, Project, and prior association remain; never implement this by persisting a Project field on Task as the prototype mock does.
- [ ] Refresh Task detail/list, Project Overview counts/rows, activity, hierarchy eligibility, and execution snapshot after successful Task or membership mutations.

Task acceptance scenarios:

- [ ] Field round trips include description and exit criteria; priority accepts blank, 1, and 5 and rejects fractions, non-numbers, 0, and 6.
- [ ] Membership start/end, duplicate/cardinality rejection, archived endpoints, cancellation, recoverable retry, and retained history pass integration tests.
- [ ] Archive removes a Task from Active, retains Archived/history access, and prevents forbidden endpoint selection.
- [ ] Task values and semantic memberships survive screen refresh and application reinitialization through SQLite.

### Wave 4 — Project-scoped decomposition

Exit gate: the indented Goal/Task hierarchy renders deterministically, supports every valid child mutation, preserves expansion state, and exposes cycles, invalid structures, and traversal truncation.

#### [#135](https://github.com/logact/becoming/issues/135) — Build Goal and Task decomposition UI (Feature #21)

Prototype-aligned delivery:

- [ ] Fill the Project detail Structure segment with a deterministic, accessible indented tree. Each row exposes expand/collapse, Goal or Task type text, entity title, Task lifecycle status when available, and a contextual add-child action.
- [ ] For a Project with no root structure, show the prototype's explicit No structure yet state and route Pursue a Goal through #134. Do not fabricate a hierarchy root in presentation code.
- [ ] Explain the valid directions in context: Goal -> Goal or Task, and Task -> Task. The add-child sheet combines eligible Goals and Tasks and keeps rejected candidates visible with distinct #133 reasons where useful.
- [ ] Commit Goal->Goal, Goal->Task, and Task->Task additions through decomposition services. Add a contextual, confirmed end-edge action that removes only the active edge and preserves both entities and historical relation; this required action extends the current prototype.
- [ ] Preserve expansion state by stable typed node identity after add/end/refresh operations. A collapsed branch remains collapsed when its node still exists.
- [ ] Render loading, bounded-query error/retry, missing endpoint, cycle/integrity, and traversal-truncated states. Show truncation guidance only when reported by the query, including enough context to prevent a partial tree from looking complete.

Task acceptance scenarios:

- [ ] Empty, root-only, deeply nested, mixed Goal/Task, collapsed, and deterministically ordered structures pass accessible rendering tests.
- [ ] Every supported add-child and end-edge mutation refreshes the tree, affected entity/activity views, and later execution projections without deleting endpoints.
- [ ] Invalid direction/type, duplicate placement, cycle, cardinality, missing endpoint, archived endpoint, cross-Project structure, truncation, retry, and state preservation are covered.
- [ ] The result remains an indented planning structure, not a generic relation editor or graph visualization.

### Wave 5 — Execution and derived progress

Exit gate: the Project execution snapshot is the screen authority; numerator, denominator, percentage or zero-denominator state, lifecycle context, work categories, and integrity findings all render correctly.

#### [#136](https://github.com/logact/becoming/issues/136) — Build Project execution and progress UI (Feature #22)

Prototype-aligned delivery:

- [ ] Fill the Project detail Progress segment from one authoritative Project execution snapshot. Show a skeleton while loading and a Snapshot unavailable state with retry on query failure; never attempt a mutation as part of retry.
- [ ] For measurable work, show the derived percentage prominently together with exact `complete` numerator, `measurable` denominator, and a visual bar. Render values supplied by the snapshot rather than joining Tasks or reproducing progress policy in UI code.
- [ ] For a zero denominator, show Not measurable yet, `0 complete of 0 measurable`, no percentage, and explanatory text. Do not display `0%` or imply failure.
- [ ] Show separate, labeled counts for complete, incomplete, blocked, unmanaged, uninitialized, and invalid work, with text/icon status cues that do not depend on color. Keep unmanaged, uninitialized, and invalid work visibly outside the measurable denominator according to the snapshot.
- [ ] Show integrity findings as actionable rows with affected Task/entity, concise reason, lifecycle state when supplied, and drill-in to its read-only detail. Also surface hierarchy and traversal findings supplied by the snapshot.
- [ ] Keep lifecycle state inspect-only across Project Overview rows, Structure Task rows, Progress findings, and Task detail; provide no transition action.

Task acceptance scenarios:

- [ ] Snapshot fixtures cover empty, zero-denominator, mixed, blocked, unmanaged, uninitialized, invalid, traversal-truncated, and fully complete Projects.
- [ ] Tests assert exact numerator, denominator, optional percentage, all six category counts, deterministic ordering, and affected-work findings.
- [ ] Loading, error, retry success/failure, refresh, stale-result protection, and screen re-entry are defined and tested.
- [ ] Tests fail if presentation code independently derives membership, lifecycle category, integrity state, numerator, denominator, or percentage.

## Milestone closeout

Before closing M2:

- [ ] Confirm all six tasks above are closed and Features #17–#22 have no remaining open UI sub-issues.
- [ ] Run `npm run typecheck` and the full Jest suite from a clean checkout.
- [ ] Demonstrate the native loop from Goal creation through Project pursuit, Task membership, decomposition, and execution/progress inspection.
- [ ] Verify create, edit, archive, relation start/end, retry, refresh, and application-reload behavior against on-device persistence.
- [ ] Verify missing endpoints, duplicates, invalid direction or type, cardinality failures, cycles, cross-Project structures, traversal truncation, and snapshot integrity findings remain visible and actionable.
- [ ] Verify progress displays its numerator, denominator, percentage only when defined, explicit zero-denominator state, and separate complete, incomplete, blocked, unmanaged, uninitialized, and invalid categories.
- [ ] Verify the UI does not introduce numeric Goal-success scoring, a generic relation editor, a graph visualization, progress recomputation, or lifecycle-transition mutation actions.
- [ ] Verify VoiceOver labels, focus order, Dynamic Type behavior, touch targets, destructive confirmations, and color-independent status communication for the milestone flows.
- [ ] Update repository structure and contributor guidance for any UI modules introduced by implementation.
- [ ] Record deferred shell/navigation, design-system, workflow-transition, resource, and broader dashboard work explicitly rather than expanding M2.

## Task execution log

| Task | Started (UTC) | Completed (UTC) | Elapsed | Worker token usage | Commit |
| --- | --- | --- | --- | --- | --- |
| [#131](https://github.com/logact/becoming/issues/131) | — | — | — | — | — |
| [#133](https://github.com/logact/becoming/issues/133) | — | — | — | — | — |
| [#134](https://github.com/logact/becoming/issues/134) | — | — | — | — | — |
| [#132](https://github.com/logact/becoming/issues/132) | — | — | — | — | — |
| [#135](https://github.com/logact/becoming/issues/135) | — | — | — | — | — |
| [#136](https://github.com/logact/becoming/issues/136) | — | — | — | — | — |

## Maintaining the plan

The GitHub sub-issue relationships, milestone membership, labels, and numbered `Dependencies` sections are the source of truth for this roadmap. If a task is split, merged, or gains or removes a dependency:

1. update the GitHub issue and relationships first;
2. recompute the topological waves and confirm the graph remains acyclic;
3. update this file's task checklist, critical path, and gates; and
4. explain dependency changes in the affected issue or PR.

If native GitHub `blocked by` relationships are introduced for M2, migrate the complete dependency graph and treat those native relationships as authoritative. Do not use this document to override an open dependency silently.
