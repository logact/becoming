# M1 Architecture

The Milestone 1 domain foundation is deliberately local-first and
framework-independent. It establishes the durable model and application
services that later UI work composes; it does not yet provide a complete user
interface or a server API.

## Platform and stack

- Native iOS application built with TypeScript, React Native, and Expo.
- Application data persists on-device in local SQLite via `expo-sqlite`.
  There is no server database.
- Testing uses Jest with the `jest-expo` preset. Domain and persistence tests
  run in the Node test environment; UI tests may add iOS/Android environments
  later.
- The currently enabled GitHub workflow is manual iOS publishing. Local
  validation commands are `npm run typecheck` (`tsc --noEmit`) and `npm test`.

## Module boundaries

```text
src/domain/        Framework-independent types, aggregates, policies, and
                   pure projections. It owns core entities, labels and
                   relations; workflow and Project state-machine definitions;
                   exact Decimal/Quantity values; planning, usage, balance,
                   exception, provenance, and timeline contracts.
src/application/   Framework-independent command and query services. These
                   compose repositories through injected Clock, IdGenerator,
                   and UnitOfWork ports. Services cover core entity mutation,
                   labels and relations, workflow applicability and machine
                   initialization, lifecycle execution/audit, decomposition
                   and lineage, project/Task membership, and resource
                   planning, usage, balances, exceptions, and timelines.
src/persistence/   Framework-independent SQLite port, transaction helper,
                   append-only migration runner, and repositories for the
                   implemented aggregates and state-machine tables.
src/persistence/sqlite/
                   Adapter implementations of the port:
                   appDatabase.ts        production adapter over expo-sqlite
                   nodeSqliteDatabase.ts test/CI adapter over node:sqlite
__tests__/         Jest suites plus the shared test harness
                   (__tests__/helpers/testDatabase.ts).
```

React Native UI must not own domain logic; it composes domain services and
repositories through the ports above. The only module allowed to import
`expo-sqlite` is `src/persistence/sqlite/appDatabase.ts`; the only module
allowed to import `node:sqlite` is the test adapter, and app code must never
import it.

## Domain model and execution

- The schema reserves eight independent core tables: Task, Goal, Project,
  Idea, Philosophy, Workflow, Resource, and Record. M1 application services
  currently operate on Tasks, Goals, Projects, Workflows, Resources, Records,
  Labels, and their relations; Idea and Philosophy remain schema-level core
  concepts for later domain work. There is never a shared `entities` table.
- Relations form the semantic graph between core entities. They are temporal:
  ending a relation preserves its row and makes a replacement a new relation.
  Per-type policies enforce endpoint direction, metadata, duplicate identity,
  and cycle rules where applicable. Project-goal pursuit, Task-project
  membership, decomposition, workflow applicability, lineage, budgets, and
  Task allocations each have dedicated services and contracts.
- A reusable Workflow has versioned definitions and state-machine templates.
  Publishing freezes its definition; a later definition is a new Workflow row
  linked by `supersedes_id`. A selected applicable Workflow is copied into a
  Project-owned state machine, so later template edits do not rewrite the
  Project's execution rules.
- Runtime state is append-oriented `project_entity_states` periods. Transition
  validation checks the Project machine, then execution closes the current
  period and opens the next one atomically. Lifecycle audit Records retain
  immutable identifiers, descriptive snapshots, and redacted evaluation
  results for accepted transitions; rejected transitions create neither state
  history nor audit evidence.
- Decomposition is Project-scoped and permits Goal -> Goal/Task and Task ->
  Task only. Its service validates active endpoints, workflow guidance, and
  acyclicity before writing the relation and provenance together.

## Resources, planning, and history

- A Project budget is a temporal `project -> budgeted_by -> resource` relation;
  a Task allocation is a temporal `task -> allocated -> resource` relation
  explicitly tied to a funding Project and budget context. Both use versioned
  metadata, exact positive quantities, half-open effective intervals, and
  explicit reject-or-surface/flag policies. A budget or allocation change
  ends the prior relation and appends a successor rather than overwriting it.
- Actual consumption is an append-only `resource_usage` Record with semantic
  links to its Project, Resource, and optional Task. Corrections are later
  Records with a negative aggregation effect, not edits to the original
  occurrence. Pure balance projections keep budgeted, allocated, and consumed
  contributors separate and retain negative variances as facts.
- Resource exceptions are deterministic read-side signals: Project
  over-allocation, Project exhaustion, and Task over-consumption. They report
  active or resolved status and provenance contributors but do not mutate
  plans, usage, or lifecycle state.
- Core mutations, relation changes, decomposition, lineage, planning, and
  lifecycle transitions append structured Records. Entity timeline, lineage,
  lifecycle-audit, resource, and planning query services provide inspectable
  current and historical views without treating the Record table as a mutable
  event-sourced replacement for current-state aggregates.

## Persistence rules

- The initial schema contains sixteen domain tables: eight independent core
  tables, `relations`, `labels`, `entity_labels`, workflow-state and
  workflow-transition tables, Project-state and Project-transition tables,
  and `project_entity_states`. `schema_migrations` is migration bookkeeping.
  There is no shared `entities` table.
- No database-level foreign keys anywhere. Columns such as `workflow_id`,
  `label_id`, `entity_id`, and `from_state_id` are logical references
  validated by the application/domain layer. Persistence may reinforce
  uniqueness and value constraints (primary keys, CHECK constraints) but never
  referential integrity.
- Column encodings: UUID ids as `TEXT` primary keys; datetimes as ISO 8601
  UTC `TEXT`; JSON payloads/metadata as `TEXT`; booleans as `INTEGER` 0/1 with
  CHECK constraints.
- Repository boundaries map snake_case SQLite rows to camelCase domain values
  and NULL to `null`; their writes validate the applicable aggregate or
  relation invariants. Repositories do not import Expo, React Native, or Node.
- Workflow definitions are versioned: each `workflows` row is one version.
  Publishing (`publishWorkflow`) freezes the row's definition — the
  repository rejects any later change to it — and the next version is a new
  row from `createWorkflowVersion` linked by `supersedes_id`, so execution
  history pinned to a published version is never silently rewritten.
- Exact quantities (resource capacity, budgets, allocations, consumption) are
  `Decimal` values (`src/domain/decimal.ts`): a bigint-mantissa exact decimal
  persisted as its canonical `TEXT` form. Quantities never pass through binary
  floating point. A `Quantity` (`src/domain/quantity.ts`) pairs a `Decimal`
  amount with a unit; combining quantities with different units is a domain
  error, never an implicit conversion.
- Planned budgets/allocations and actual consumption stay distinguishable:
  planned amounts live on temporal relations and versioned metadata; usage and
  reversals live in append-oriented Records linked through relations.

## Migrations and transactions

- Migrations are ordered, append-only, and immutable once shipped. The runner
  (`src/persistence/migrate.ts`) records applied versions in
  `schema_migrations` and is idempotent; each migration executes inside its
  own transaction so a failure rolls back to the last good version.
- `withTransaction` (`src/persistence/transactions.ts`) is the only
  sanctioned unit-of-work boundary. A mutation and its provenance/history
  writes run in one transaction and commit or roll back atomically.

## Test harness

Every persistence test starts from `createTestDatabase()`, which builds a
fresh, fully migrated, in-memory database through the `node:sqlite` adapter.
Tests therefore exercise the real SQLite engine (same SQL, same migrations,
same transaction semantics as the production adapter) without a device, and
are fully isolated from one another.

The suites cover migrations, transactions, isolation, exact-decimal and
quantity behavior, aggregate and repository contracts, relation policy and
provenance, workflow/version/state-machine rules, Project lifecycle execution
and audit history, decomposition and lineage, resource budgets/allocations/
usage/balances/exceptions, and timeline/query behavior.

## Explicitly deferred scope

M1 is not a general ledger, billing, accounting, or resource-scheduling
system. It does not automate remediation when a budget is exhausted or an
exception is detected, and it does not provide every possible audit-history
UI. Those capabilities can consume the durable plans, usage, records, and
query services established here without changing their historical meaning.
