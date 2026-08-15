# Repository Guidelines

## Product Background

Becoming is a goal-planning and execution system built around the idea: **“Record what you do. Shape what you become.”** It helps users turn an intended outcome into structured, executable work while making the rules, resource constraints, and history behind that work explicit and inspectable.

The product is centered on four connected capabilities:

1. **Goal and task planning and execution** — A Goal represents an outcome a user wants to achieve. One or more Projects organize the effort toward that Goal. Within a Project, Goals can be refined into sub-goals and Tasks, and large Tasks can be decomposed into smaller Tasks. The resulting hierarchy and relationships make progress inspectable while domain rules prevent invalid structures or state changes. See [Epic #3](https://github.com/logact/becoming/issues/3).
2. **Workflow and lifecycle management** — Reusable, versionable Workflows define how Projects, Goals, and Tasks are decomposed and how they move through explicit lifecycle states such as Backlog, Ready, In Progress, Review, and Done. Workflows define the permitted transitions; execution entities consume those rules rather than embedding their own ad hoc state machines. See [Epic #4](https://github.com/logact/becoming/issues/4).
3. **Resource and budget management** — Projects operate under finite resources such as time, money, AI tokens, compute, or energy. Resource pools fund Project budgets, budgets can be allocated to Tasks, and actual consumption is recorded against the relevant Project, Task, time, and amount. This allows users to compare plans with reality and see over-allocation or exhaustion clearly. See [Epic #2](https://github.com/logact/becoming/issues/2).
4. **Data provenance and history** — Important mutations across all core entities produce structured, append-oriented history. Records identify what changed, who or what caused it, when it happened, relevant before-and-after data, and an entity's origin or transformation links. This explains how the system reached its current state without replacing the current-state domain model. See [Epic #1](https://github.com/logact/becoming/issues/1).

The core product flow is:

`Goal -> Project -> sub-goals and Tasks -> workflow-governed execution -> resource consumption -> inspectable outcomes and history`

The major domain relationships are:

- A Goal can be pursued through one or more Projects.
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
- `src/application/` — framework-independent command/query services for core entities, relations, workflow applicability and machine initialization, lifecycle execution/audit, decomposition/lineage, and resource planning/usage projections; services compose through `Clock`, `IdGenerator`, repositories, and `UnitOfWork` ports.
- `src/persistence/` — framework-independent persistence port (`SqliteDatabase`), `withTransaction` unit-of-work helper, append-only migrations, and repositories for implemented entities, relations, and state-machine tables.
- `src/persistence/sqlite/` — port adapters: `appDatabase.ts` (production, expo-sqlite) and `nodeSqliteDatabase.ts` (tests/CI, `node:sqlite`).
- `src/ui/` — React Native UI layer: `composition/` (database startup, service-graph composition, `AppServicesProvider` context), `navigation/` (lightweight state-driven shell with Goals/Projects/Tasks tabs; no navigation library), `shared/` (design primitives: entity list scaffold, status badge, sheet, confirm dialog, toast), `goals/` (Goal planning screens: list, detail with pursuit-action slots for #134, New/Edit sheet). UI owns no domain logic; it consumes application services only.
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



DAG of tasks



Tasks within a wave may run in parallel once their individual blockers are complete.

  Wave 1

  #106

  Wave 2

  #31  #34  #49  #53  #73  #88

  Wave 3

  #32  #35  #37  #46  #51  #58  #74  #77

  Wave 4

  #33  #36  #38  #40  #47  #50  #54  #56

  #59  #64  #75  #89  #91  #94

  Wave 5

  #39  #41  #52  #57  #60  #61  #65  #70  #90

  Wave 6

  #42  #55  #62  #66  #71  #85  #92  #95

  Wave 7

  #43  #48  #63  #72  #79  #93  #96

  Wave 8

  #44  #67  #76  #81  #100

  Wave 9

  #45  #68  #78  #82  #86  #101

  Wave 10

  #69  #80  #87  #97  #102

  Wave 11

  #83  #103

  Wave 12

  #84  #98  #104

  Wave 13

  #99  #105

  ### Task-level DAG

  This is the transitively reduced graph, omitting redundant edges while preserving the same

  ordering:

  #106 → #31, #34, #49, #53, #73, #88

  #31 → #32, #37

  #32 → #33

  #34 → #35, #37, #46

  #35 → #36, #43, #50, #57

  #36 → #104

  #37 → #38, #40

  #38 → #39, #41

  #40 → #41

  #41 → #42

  #42 → #43

  #43 → #44, #100

  #44 → #45

  #46 → #47, #50

  #47 → #44, #52

  #50 → #52

  #52 → #55

  #55 → #48, #79, #104

  #49 → #51

  #51 → #54, #61

  #54 → #62

  #61 → #62

  #62 → #63

  #63 → #67, #76

  #67 → #68, #82

  #68 → #69

  #69 → #83

  #76 → #78, #82

  #78 → #80

  #80 → #83

  #82 → #83, #97

  #83 → #84, #98

  #84 → #99

  #97 → #98

  #98 → #99

  #53 → #56, #58, #77

  #56 → #57, #78

  #57 → #81

  #58 → #54, #59, #64, #89, #91, #94

  #59 → #60

  #60 → #86

  #64 → #65, #70

  #65 → #62, #66, #71, #92, #95

  #66 → #72

  #70 → #45, #71, #85

  #71 → #72

  #72 → #86

  #73 → #61, #64, #74

  #74 → #43, #56, #65, #75

  #75 → #57, #66, #93, #96

  #77 → #79, #85

  #79 → #81

  #81 → #86

  #85 → #86

  #86 → #87

  #88 → #89

  #89 → #90

  #90 → #92, #100

  #91 → #43, #61, #92, #95

  #92 → #93

  #93 → #103

  #94 → #95

  #95 → #67, #76, #96

  #96 → #100

  #100 → #101

  #101 → #102

  #102 → #103

  #103 → #104

  #104 → #105
