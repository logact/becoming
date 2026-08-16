# Repository Guidelines

## Product Background

Becoming is a goal-planning and execution system built around the idea: **“Record what you do. Shape what you become.”** It helps users turn an intended outcome into structured, executable work while making the rules, resource constraints, and history behind that work explicit and inspectable.

The product is centered on four connected capabilities:

1. **Goal and task planning and execution** — A Goal represents an outcome a user wants to achieve. A Project organizes the effort toward that Goal — pursuit is strict 1:1: a Project exists to achieve exactly one Goal, and a Goal is pursued by at most one Project. Within a Project, Goals can be refined into sub-goals and Tasks, and large Tasks can be decomposed into smaller Tasks. The resulting hierarchy and relationships make progress inspectable while domain rules prevent invalid structures or state changes. See [Epic #3](https://github.com/logact/becoming/issues/3).
2. **Workflow and lifecycle management** — Reusable, versionable Workflows define how Projects, Goals, and Tasks are decomposed and how they move through explicit lifecycle states such as Backlog, Ready, In Progress, Review, and Done. Workflows define the permitted transitions; execution entities consume those rules rather than embedding their own ad hoc state machines. See [Epic #4](https://github.com/logact/becoming/issues/4).
3. **Resource and budget management** — Projects operate under finite resources such as time, money, AI tokens, compute, or energy. Resource pools fund Project budgets, budgets can be allocated to Tasks, and actual consumption is recorded against the relevant Project, Task, time, and amount. This allows users to compare plans with reality and see over-allocation or exhaustion clearly. See [Epic #2](https://github.com/logact/becoming/issues/2).
4. **Data provenance and history** — Important mutations across all core entities produce structured, append-oriented history. Records identify what changed, who or what caused it, when it happened, relevant before-and-after data, and an entity's origin or transformation links. This explains how the system reached its current state without replacing the current-state domain model. See [Epic #1](https://github.com/logact/becoming/issues/1).

The core product flow is:

`Goal -> Project -> sub-goals and Tasks -> workflow-governed execution -> resource consumption -> inspectable outcomes and history`

The major domain relationships are:

- A Project exists to achieve exactly one Goal, and a Goal is pursued by at most one Project (strict 1:1 pursuit).
- A Project contains related Goals and Tasks and exposes progress derived from that work.
- Projects, Goals, and Tasks use applicable Workflows for decomposition and lifecycle rules.
- Projects receive resource budgets; Tasks may receive explicit allocations; consumption contributes to actual usage.
- Provenance records changes to Goals, Projects, Tasks, Workflows, Resources, relationships, and lifecycle state.

Product design and implementation should preserve these principles:

- **Explicit structure:** Goal, Project, Task, Workflow, Resource, and history concepts are first-class domain entities with clear responsibilities.
- **Valid transitions:** Lifecycle changes follow the associated Workflow; invalid hierarchy and state updates are rejected.
- **Traceability:** Meaningful mutations and relationship changes can be traced through structured history.
- **Historical integrity:** Workflow changes and other current-state edits do not silently rewrite past execution records.
- **Resource awareness:** Planned allocations and actual consumption remain distinguishable and queryable.
- **Extensibility:** The model should accommodate workflow versioning, new resource types, and future provenance-aware entities such as Decisions and Ideas.

The initial scope is not intended to become a general accounting, billing, or resource-scheduling product. It also does not require automated remediation for exhausted budgets or every possible audit-history view. The first priority is a reliable domain foundation that connects intent, execution, constraints, and evidence.

## Project Structure &amp; Module Organization

Becoming is a native iOS app built with TypeScript, React Native, and Expo, persisting on-device in SQLite via `expo-sqlite` (see `docs/architecture.md`).

- `index.ts` + `App.tsx` — Expo app entry and root component (`"main": "index.ts"` in `package.json`); `app.json` holds the Expo config (bundle ID `com.logact.becoming`), `eas.json` the EAS Build/Submit profiles.
- `src/domain/` — framework-independent domain layer: core entities, relations/labels, workflow and Project state machines, exact `Decimal`/`Quantity`, resource planning/usage/balances/exceptions, and provenance/timeline contracts; no Expo/React Native/Node imports.
- `src/application/` — framework-independent command/query services for core entities, relations, workflow applicability and machine initialization, lifecycle execution/audit, decomposition/lineage (including atomic Project Structure child creation and lazy built-in decomposition guidance), and resource planning/usage projections; services compose through `Clock`, `IdGenerator`, repositories, and `UnitOfWork` ports.
- `src/persistence/` — framework-independent persistence port (`SqliteDatabase`), `withTransaction` unit-of-work helper, append-only migrations, and repositories for implemented entities, relations, and state-machine tables.
- `src/persistence/sqlite/` — port adapters: `appDatabase.ts` (production, expo-sqlite) and `nodeSqliteDatabase.ts` (tests/CI, `node:sqlite`).
- `src/ui/` — React Native UI layer: `composition/` (database startup, service-graph composition, `AppServicesProvider` context), `navigation/` (lightweight state-driven shell with Goals/Projects/Tasks tabs; no navigation library), `shared/` (design primitives: entity list scaffold, status badge, sheet, confirm dialog, toast), `goals/` (Goal planning screens: list, detail with pursuit-action slots for #134, New/Edit sheet), `projects/` (Project planning screens: list, detail with Overview/Structure/Roadmap segment slots, Overview, New/Edit sheet, Goal-pursuit flows for both Goal and Project contexts, and `structure/` — the #135 Structure segment: Project-scoped decomposition tree, add-child and end-edge flows wired through the `renderStructure` slot; `roadmap/` — the Roadmap segment: the Project's ordered Milestones grouping the pursued Goal's descendant Goals, rendered only from the `ProjectRoadmapQueryService` result (reached flags, per-Goal completion, summary counts, unassigned-Goal warnings, integrity findings) via the `renderRoadmap` slot, plus the Milestone add/edit form sheet, Goal picker (conflicting Goals visible but disabled), and edit/remove/reorder flows; and `progress/` — the retained #136 Progress segment: derived execution progress rendered from the single authoritative Project execution snapshot — prominent percentage with exact numerator/denominator and bar, explicit zero-denominator state, six labeled work-category counts, affected-work findings with drill-in, and snapshot integrity/hierarchy/traversal findings; presentation never derives progress itself; the Roadmap segment replaced it as the visible Project detail segment, but the progress code remains for other consumers of the execution snapshot), `tasks/` (Task planning screens: list, detail with lifecycle-inspect and membership actions, New/Edit sheet, and Task↔Project membership flows for both Task and Project Overview contexts). UI owns no domain logic; it consumes application services only.
- `__tests__/` — Jest (jest-expo preset, Node environment) suites plus the shared harnesses `__tests__/helpers/testDatabase.ts` (fresh migrated in-memory database per test) and `__tests__/helpers/uiTestHarness.tsx` (renders screens with the real service graph composed over that database, via `@testing-library/react-native`).
- `docs/` — architecture and CI/CD documentation, plus interactive UI prototypes (`m2-prototype.html`, single-file HTML mock of the M2 native planning loop).
- `.github/workflows/` — `publish.yml` (manual EAS Build/Submit to TestFlight or App Store; setup in `docs/ci-cd.md`).

Checks: `npm run typecheck` and `npm test`. Hard rules: no database foreign keys, no shared `entities` table, exact decimals as TEXT, logical references validated in the domain layer. Update this guide when the layout changes.

## Table definetions

refer to Table-definetion.txt

## Workflow Github integration

The project develop mange with the github 

1. The Epics store in the github issue with Epic label.
2. The Feature should be a sub-issue of a Epic issue. the feature issue is the sub-issue of Epic
3. The Task issue is to implement the Feature with label task. And the task issue is the sub issue of the feature issue.
4. Use the milestone to trace the process of project.



## Development workflow

We name the group of some tasks including features-impl or bug-fix as the step , it means it is a very short term span verifiable work-unit. which follow the quick-advance-small-step.

In this dev system all milestone are mini milestone which can be verified in serval 2 hours so there won’t be too much item under it  (max to 4).

#### structure of the dev directory
- .Dev
	-Step-x
		-feat-x1
		-feat-x2
		-bug-x
		-bug-x
		-doc
			-prototype snapshot for feat-x1
		       -model plan
  			-The whole traceable implementation plan.		
		

#### When the user ask for implementation of mile-x ,perform acording the following workflow:
Implement the plan of mile-x , implement the task one by one according to the implementation plan ,update the tasks status ,and record the time( accurate to the seconds) and token consumption in the docs .

Each time your finish a task,you should create a dependent commit for it. 



## Not Do
Don't load the Dev directory when you don't execute the related tasks
.