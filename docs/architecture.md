# V1 Architecture

Settled product architecture for Milestone 1 (authoritative; do not revisit
without an explicit product decision).

## Platform and stack

- Native iOS application built with TypeScript, React Native, and Expo.
- Application data persists on-device in local SQLite via `expo-sqlite`.
  There is no server database.
- Testing uses Jest with the `jest-expo` preset. Domain and persistence tests
  run in the Node test environment; UI tests may add iOS/Android environments
  later.
- CI runs `npm run typecheck` (`tsc --noEmit`) and `npm test` on every pull
  request and push to `main`.

## Module boundaries

```text
src/domain/        Framework-independent domain layer. No React Native, Expo,
                   or Node imports. Owns entity types, identifiers, exact
                   decimals and quantities, core aggregates (`workflow.ts`,
                   `label.ts`, `resource.ts`, `record.ts`), and their
                   invariants and validation.
src/application/   Framework-independent application services
                   (`recordService.ts`). Services compose domain aggregates
                   through injected `Clock`, `IdGenerator`, and repository
                   ports, so create/read behavior is usable without selecting
                   an HTTP, UI, or serialization framework.
src/persistence/   Persistence port and migrations, also framework-
                   independent. Defines the SqliteDatabase interface, the
                   transaction helper, the migration runner, and one
                   repository boundary per aggregate (`workflowRepository.ts`,
                   `labelRepository.ts`, `resourceRepository.ts`,
                   `recordRepository.ts`).
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

## Persistence rules

- The eight core concepts (Task, Goal, Project, Idea, Philosophy, Workflow,
  Resource, Record) live in eight independent tables. There is no shared
  `entities` table.
- No database-level foreign keys anywhere. Columns such as `workflow_id`,
  `label_id`, `entity_id`, and `from_state_id` are logical references
  validated by the application/domain layer. Persistence may reinforce
  uniqueness and value constraints (primary keys, CHECK constraints) but never
  referential integrity.
- Column encodings: UUID ids as `TEXT` primary keys; datetimes as ISO 8601
  UTC `TEXT`; JSON payloads/metadata as `TEXT`; booleans as `INTEGER` 0/1 with
  CHECK constraints.
- Each aggregate is persisted through a repository boundary in
  `src/persistence/` (interface plus a `Sqlite*` implementation over the
  `SqliteDatabase` port, e.g. `SqliteWorkflowRepository`). Repositories map
  rows to domain aggregates (snake_case columns to camelCase fields, NULL to
  `null` fields) and validate aggregate invariants on every write; they never
  import Expo, React Native, or Node.
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
  planned amounts live on relations/metadata, actual usage in append-oriented
  `records`.

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

Executable wave-1 gate checks live in `__tests__/`:

- `migrations.test.ts` — the 16-table schema builds from empty, re-runs are
  no-ops, and prior data survives re-migration.
- `transactions.test.ts` — commit and rollback semantics, including
  mid-transaction failures.
- `decimalRoundTrip.test.ts` — exact decimal storage and retrieval as TEXT.
- `schemaIntegrity.test.ts` — no foreign keys and no `entities` table,
  verified against the live schema.
- `isolation.test.ts` — test databases never share state.
- `decimal.test.ts` — exact decimal arithmetic and canonicalization.
- `quantity.test.ts` — exact unit-safe quantity arithmetic.
- `workflow.test.ts`, `label.test.ts`, `resource.test.ts`, `record.test.ts` —
  aggregate invariants and repository contracts per core concept.
