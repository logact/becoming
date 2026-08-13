# Milestone 1 Implementation Plan

Milestone: [V1 Domain Foundation](https://github.com/logact/becoming/milestone/1)

This plan implements the 76 open `task` issues under Features #5–#30. The implementation order is derived from the native GitHub `blocked by` relationships: 157 dependency edges form an acyclic graph with one root and 13 execution waves.

## Milestone outcome

Deliver a tested domain foundation connecting:

`Goal -> Project -> sub-goals and Tasks -> workflow-governed execution -> resource consumption -> inspectable outcomes and history`

The milestone is complete when all task issues in this document are closed, all Feature acceptance criteria are demonstrated, and the integrated architecture preserves the repository's core rules:

- Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record remain independent core entities.
- There is no shared `entities` table and no database-level foreign keys.
- Logical references and cross-table invariants are enforced in the application/domain layer.
- Important mutations, relation changes, and lifecycle changes produce atomic, append-oriented provenance.
- Planned budgets and allocations remain distinguishable from actual consumption.
- Reusable Workflow templates remain independent from initialized Project machines and historical execution.

## How to execute this plan

1. Start only with [#106](https://github.com/logact/becoming/issues/106). It establishes the shared runtime, repository layout, migrations, transactions, exact decimal handling, and test harness needed by every other workstream.
2. After #106 is merged, start every unblocked Wave 2 task. Work within a wave may proceed in parallel; a later-wave task may start as soon as its own GitHub blockers are closed, without waiting for unrelated tasks in the earlier wave.
3. Implement one task per branch and pull request. Include the issue number in the branch and PR, and use `Closes #<task>` in the PR description.
4. Before coding, refresh the issue's `blocked by` list. Do not begin while any blocker remains open unless the dependency is deliberately changed in GitHub with an explanation.
5. Keep domain rules in domain/application code. Persistence adapters may reinforce concurrency and uniqueness but must not replace logical-reference validation with foreign keys.
6. Add unit tests for domain rules, repository contract tests for persistence, transaction/concurrency tests for atomic invariants, and feature acceptance tests for externally observable behavior.
7. Merge only after required checks pass and dependent contracts remain compatible. Close a Feature only after all its task children and Feature-level acceptance tests are complete.

## Delivery controls

### Definition of ready

A task is ready when:

- every native GitHub `blocked by` issue is closed;
- its input contracts exist on the integration branch;
- acceptance criteria and test cases remain current;
- no unresolved design choice would change the task's public contract; and
- the assignee has identified the application, persistence, and test surfaces affected.

### Definition of done

A task is done when:

- every task acceptance checkbox is satisfied;
- domain, repository, integration, and concurrency tests required by the issue pass;
- migrations work from an empty database and preserve prior history on upgrade;
- no database foreign key or `entities` table has been introduced;
- provenance is atomic with the mutation wherever required;
- documentation and architecture decisions affected by the implementation are updated;
- the PR is merged and the task issue is closed; and
- GitHub automatically unblocks the next DAG nodes.

### Integration gates

- **Gate A — Architecture:** #106 is merged and clean-checkout validation passes.
- **Gate B — Core primitives:** the foundational Workflow, Label, Resource, Record, Relation, and Goal contracts from Waves 2–3 are stable.
- **Gate C — Mutation integrity:** provenance, temporal relations, entity mutations, and transaction rollback tests pass through Waves 4–6.
- **Gate D — Runtime lifecycle:** Project machines, current-state uniqueness, transitions, and lifecycle audit are integrated through Waves 7–9.
- **Gate E — Resource accounting:** budgets, allocations, consumption, balances, and exception queries reconcile through Waves 8–13.
- **Gate F — Milestone acceptance:** entity timelines and Project execution/progress views pass end-to-end acceptance tests, all Features are closed, and the full suite passes from a clean checkout.

## Workstreams

The waves below are authoritative for scheduling. These workstreams clarify ownership and integration boundaries:

- **Architecture and shared infrastructure:** #106.
- **Workflow and lifecycle:** #31–#48 and #50, #52, #55.
- **Provenance and history:** #53, #56–#60, #64–#66, #70–#72, #77, #79, #81, #85–#87.
- **Planning and execution:** #73–#75, #88–#96, #100–#105.
- **Resources and budgets:** #49, #51, #54, #61–#63, #67–#69, #76, #78, #80, #82–#84, #97–#99.

The longest current dependency chain is:

`#106 -> #53 -> #58 -> #64 -> #65 -> #62 -> #63 -> #76 -> #78 -> #80 -> #83 -> #98 -> #99`

Protect this path from avoidable delays, but do not allow it to bypass test and integrity gates.

## Implementation waves

### Wave 1 — Bootstrap

Exit gate: the chosen architecture is documented; local/CI checks, isolated migrations, transaction rollback, exact decimal round-trips, and the no-foreign-key rule are executable.

- [x] [#106](https://github.com/logact/becoming/issues/106) — Bootstrap the V1 domain and persistence test architecture (Feature #6)

### Wave 2 — Independent domain foundations

Exit gate: foundational aggregates/value objects and repository boundaries compile and pass their first contract tests without framework coupling.

- [x] [#31](https://github.com/logact/becoming/issues/31) — Establish the workflow domain model and persistence boundary (Feature #23)
- [x] [#34](https://github.com/logact/becoming/issues/34) — Implement label definitions and archive-safe lookup (Feature #24)
- [x] [#49](https://github.com/logact/becoming/issues/49) — Model resource quantities and catalog invariants (Feature #11)
- [x] [#53](https://github.com/logact/becoming/issues/53) — Establish the Record domain model and persistence (Feature #6)
- [x] [#73](https://github.com/logact/becoming/issues/73) — Define relation domain and logical integrity contracts (Feature #19)
- [x] [#88](https://github.com/logact/becoming/issues/88) — Define Goal domain and persistence boundary (Feature #17)

### Wave 3 — Temporal and reusable primitives

Exit gate: workflow versioning/state storage, label assignment, Project State storage, Resource persistence, mutation provenance contracts, relation mutation, and lifecycle audit payloads have stable interfaces.

- [x] [#32](https://github.com/logact/becoming/issues/32) — Publish immutable workflow versions with explicit lineage (Feature #23)
- [x] [#35](https://github.com/logact/becoming/issues/35) — Manage temporal label assignments for every core entity type (Feature #24)
- [x] [#37](https://github.com/logact/becoming/issues/37) — Persist workflow state templates and machine-scoped queries (Feature #25)
- [x] [#46](https://github.com/logact/becoming/issues/46) — Implement independent Project State management (Feature #28)
- [x] [#51](https://github.com/logact/becoming/issues/51) — Persist and query resource catalog entries (Feature #11)
- [x] [#58](https://github.com/logact/becoming/issues/58) — Define the atomic core-mutation provenance contract (Feature #30)
- [x] [#74](https://github.com/logact/becoming/issues/74) — Implement policy-validated relation create and end operations (Feature #19)
- [x] [#77](https://github.com/logact/becoming/issues/77) — Define the lifecycle-transition audit payload (Feature #9)

### Wave 4 — Core mutation services

Exit gate: core mutation paths have application-level validation, explicit transactions, durable persistence, and required provenance hooks.

- [x] [#33](https://github.com/logact/becoming/issues/33) — Expose workflow discovery and provenance-aware mutation services (Feature #23)
- [x] [#36](https://github.com/logact/becoming/issues/36) — Add label queries, lifecycle boundaries, and provenance (Feature #24) **(done)**
- [ ] [#38](https://github.com/logact/becoming/issues/38) — Enforce workflow state machine integrity and mutation rules (Feature #25) **(processing)**
- [ ] [#40](https://github.com/logact/becoming/issues/40) — Persist workflow transition templates and machine queries (Feature #26)
- [ ] [#47](https://github.com/logact/becoming/issues/47) — Implement Project transition management and independence (Feature #28)
- [ ] [#50](https://github.com/logact/becoming/issues/50) — Persist entity state history and initialize current state safely (Feature #29)
- [ ] [#54](https://github.com/logact/becoming/issues/54) — Implement the resource catalog mutation lifecycle (Feature #11)
- [ ] [#56](https://github.com/logact/becoming/issues/56) — Preserve Record corrections and archival history (Feature #6)
- [ ] [#59](https://github.com/logact/becoming/issues/59) — Capture creation provenance for all core concepts (Feature #30)
- [ ] [#64](https://github.com/logact/becoming/issues/64) — Define the relation-change provenance contract (Feature #5)
- [ ] [#75](https://github.com/logact/becoming/issues/75) — Query current and historical semantic relations (Feature #19)
- [ ] [#89](https://github.com/logact/becoming/issues/89) — Implement Goal mutation commands with provenance (Feature #17)
- [ ] [#91](https://github.com/logact/becoming/issues/91) — Implement Project domain, persistence, and mutations (Feature #20)
- [ ] [#94](https://github.com/logact/becoming/issues/94) — Implement Task domain, persistence, and mutations (Feature #18)

### Wave 5 — Integrity and history

Exit gate: topology, transition validation, Record queries, mutation history, initial budget contracts, relation audit, lineage policies, and Goal querying pass integration tests.

- [ ] [#39](https://github.com/logact/becoming/issues/39) — Complete workflow state history and provenance coverage (Feature #25)
- [ ] [#41](https://github.com/logact/becoming/issues/41) — Enforce workflow transition topology and duplicate policies (Feature #26)
- [ ] [#52](https://github.com/logact/becoming/issues/52) — Build the Project transition validation engine (Feature #29)
- [ ] [#57](https://github.com/logact/becoming/issues/57) — Query, classify, and link occurrence Records (Feature #6)
- [ ] [#60](https://github.com/logact/becoming/issues/60) — Capture update, archive, and restoration provenance (Feature #30)
- [ ] [#61](https://github.com/logact/becoming/issues/61) — Define project budget relation contracts (Feature #12)
- [ ] [#65](https://github.com/logact/becoming/issues/65) — Audit relation creation and ending atomically (Feature #5)
- [ ] [#70](https://github.com/logact/becoming/issues/70) — Define origin and transformation relation policies (Feature #8)
- [ ] [#90](https://github.com/logact/becoming/issues/90) — Query active and archived Goals (Feature #17)

### Wave 6 — Atomic lifecycle and semantic joins

Exit gate: lifecycle transitions and relation changes are atomic with audit data; budget mutation and Goal/Project/Task relations preserve temporal history.

- [ ] [#42](https://github.com/logact/becoming/issues/42) — Add transition lifecycle services and provenance coverage (Feature #26)
- [ ] [#55](https://github.com/logact/becoming/issues/55) — Commit lifecycle transitions atomically with concurrency controls (Feature #29)
- [ ] [#62](https://github.com/logact/becoming/issues/62) — Create and supersede project resource budgets (Feature #12)
- [ ] [#66](https://github.com/logact/becoming/issues/66) — Query endpoint relationship history and replacements (Feature #5)
- [ ] [#71](https://github.com/logact/becoming/issues/71) — Create and end lineage links with provenance (Feature #8)
- [ ] [#85](https://github.com/logact/becoming/issues/85) — Define the unified entity timeline event contract (Feature #10)
- [ ] [#92](https://github.com/logact/becoming/issues/92) — Implement Project-to-Goal pursuit relations (Feature #20)
- [ ] [#95](https://github.com/logact/becoming/issues/95) — Implement Task-to-Project membership relations (Feature #18)

### Wave 7 — Resolution, safeguards, and historical queries

Exit gate: workflow resolution is deterministic; occupied states, capacity policies, lineage, transition audit, pursuit, and membership histories behave safely.

- [ ] [#43](https://github.com/logact/becoming/issues/43) — Model workflow applicability and deterministic resolution (Feature #27)
- [ ] [#48](https://github.com/logact/becoming/issues/48) — Protect occupied Project States during archival and migration (Feature #28)
- [ ] [#63](https://github.com/logact/becoming/issues/63) — Query budget history and enforce capacity policy (Feature #12)
- [ ] [#72](https://github.com/logact/becoming/issues/72) — Query immediate sources and derivatives safely (Feature #8)
- [ ] [#79](https://github.com/logact/becoming/issues/79) — Commit state history and transition audit atomically (Feature #9)
- [ ] [#93](https://github.com/logact/becoming/issues/93) — Query current and historical Goal pursuit (Feature #20)
- [ ] [#96](https://github.com/logact/becoming/issues/96) — Query Task membership and Project contexts (Feature #18)

### Wave 8 — Project machine and resource planning

Exit gate: Project machines initialize atomically; resource allocation/usage contracts and lifecycle history queries are stable; decomposition policies are explicit.

- [ ] [#44](https://github.com/logact/becoming/issues/44) — Atomically initialize independent Project machines from templates (Feature #27)
- [ ] [#67](https://github.com/logact/becoming/issues/67) — Define project-funded task allocation contracts (Feature #13)
- [ ] [#76](https://github.com/logact/becoming/issues/76) — Define append-oriented resource usage records (Feature #14)
- [ ] [#81](https://github.com/logact/becoming/issues/81) — Query durable lifecycle audit history (Feature #9)
- [ ] [#100](https://github.com/logact/becoming/issues/100) — Define project-scoped decomposition policies (Feature #21)

### Wave 9 — Applied workflows, allocations, consumption, and timelines

Exit gate: applied Workflow behavior, temporal allocation/consumption, unified timelines, and cycle-safe decomposition pass acceptance and rollback tests.

- [ ] [#45](https://github.com/logact/becoming/issues/45) — Complete workflow application errors, provenance, and acceptance tests (Feature #27)
- [ ] [#68](https://github.com/logact/becoming/issues/68) — Create and supersede task resource allocations (Feature #13)
- [ ] [#78](https://github.com/logact/becoming/issues/78) — Record and correct actual resource consumption (Feature #14)
- [ ] [#82](https://github.com/logact/becoming/issues/82) — Specify unit-safe resource balance semantics (Feature #15)
- [ ] [#86](https://github.com/logact/becoming/issues/86) — Compose complete entity timeline queries (Feature #10)
- [ ] [#101](https://github.com/logact/becoming/issues/101) — Implement cycle-safe decomposition mutations (Feature #21)

### Wave 10 — Historical planning and exception contracts

Exit gate: allocation/usage histories reconcile, timeline pagination is stable, planned-versus-actual policy is explicit, and hierarchy traversal is bounded and deterministic.

- [ ] [#69](https://github.com/logact/becoming/issues/69) — Query allocation totals, history, and policy status (Feature #13)
- [ ] [#80](https://github.com/logact/becoming/issues/80) — Query and reconcile resource usage history (Feature #14)
- [ ] [#87](https://github.com/logact/becoming/issues/87) — Add stable cursor pagination to entity timelines (Feature #10)
- [ ] [#97](https://github.com/logact/becoming/issues/97) — Define planned-versus-actual exception semantics (Feature #16)
- [ ] [#102](https://github.com/logact/becoming/issues/102) — Query bounded Goal and Task hierarchies (Feature #21)

### Wave 11 — Integrated balances and execution snapshots

Exit gate: current Project/Task balances and current/historical execution snapshots reconcile with their underlying histories.

- [ ] [#83](https://github.com/logact/becoming/issues/83) — Calculate project and task resource balances (Feature #15)
- [ ] [#103](https://github.com/logact/becoming/issues/103) — Compose current and historical Project execution snapshots (Feature #22)

### Wave 12 — Historical reconciliation and derived views

Exit gate: as-of balances, resource exceptions, and lifecycle-enriched Project snapshots expose anomalies instead of hiding them.

- [ ] [#84](https://github.com/logact/becoming/issues/84) — Implement historical balance queries and reconciliation (Feature #15)
- [ ] [#98](https://github.com/logact/becoming/issues/98) — Derive project and task resource exceptions (Feature #16)
- [ ] [#104](https://github.com/logact/becoming/issues/104) — Enrich execution snapshots with current lifecycle state (Feature #22)

### Wave 13 — Milestone-facing outcomes

Exit gate: users can query active/resolved resource exceptions and inspect explainable Project progress; all milestone acceptance scenarios pass.

- [ ] [#99](https://github.com/logact/becoming/issues/99) — Query active and resolved resource exceptions (Feature #16)
- [ ] [#105](https://github.com/logact/becoming/issues/105) — Derive and explain Project progress (Feature #22)

## Milestone closeout

Before closing M1:

- [ ] Confirm every task above is closed and every Feature has no remaining open sub-issues.
- [ ] Run the full clean-checkout validation suite, including migrations, unit tests, repository contracts, integration tests, concurrency tests, and acceptance tests.
- [ ] Demonstrate the core flow from Goal through Project/work decomposition, workflow execution, resource consumption, and history inspection.
- [ ] Verify current-state tables reconcile with append-oriented histories and that anomaly queries expose inconsistent data.
- [ ] Verify archived Workflows, Project machines, relations, assignments, Records, and core entities remain historically resolvable.
- [ ] Verify no database foreign keys and no shared `entities` table exist.
- [ ] Update repository structure and contributor guidance to match the implemented architecture.
- [ ] Record deferred work explicitly rather than expanding M1 into billing, general accounting, scheduling, automated budget remediation, or a full audit UI.

## Task execution log

| Task | Started (UTC) | Completed (UTC) | Elapsed | Worker token usage | Commit |
| --- | --- | --- | --- | --- | --- |
| [#33](https://github.com/logact/becoming/issues/33) | 2026-08-13T03:30:03Z | 2026-08-13T03:32:17Z | 2m 14s | Unavailable (worker runtime did not expose it) | [`23a8e72`](https://github.com/logact/becoming/commit/23a8e7289112146394d1ee303ab7bad7b6b0ba27) |
| [#36](https://github.com/logact/becoming/issues/36) | 2026-08-13T03:33:38Z | 2026-08-13T03:45:50Z | 12m 12s | Unavailable (worker runtime did not expose it) | [`417b266`](https://github.com/logact/becoming/commit/417b2669364ce8421ace7ac5df3de33ba94c6ee9) |

## Maintaining the plan

GitHub's native sub-issue and dependency relationships are the source of truth. If a task is split, merged, or gains/removes a blocker:

1. update the GitHub relationships first;
2. recompute the topological waves and confirm the graph remains acyclic;
3. update this file's task checklist and gates; and
4. explain dependency changes in the affected issue or PR.

Do not use this document to override an open GitHub blocker silently.
