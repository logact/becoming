# Dashboard: 3 sections — domain + application + prototype

Dashboard sections: **Doing Items** (doing goals/tasks, captured ideas), **Attention Items**
(rule-derived + user-managed), **Recent Activity** (latest 10 records).

Confirmed decisions:
- Attention = **built-in rules** (failed, approaching-overdue, resource ≤10% left)
  **plus user control**: the user can add (pin) any item to the attention section and
  remove (dismiss) items from it. Dismissal hides the target from attention until the
  user removes the dismissal.
- Overdue rule includes already-overdue items (`due - now <= window`), flagged until done/failed.
- Consumption (non-time resources only) = a `Record` + a `Relation` (record → resource, kind `'consumes'`).
- Recent activity = latest 10.

## Step 1 — Domain layer

### 1a. `src/domain/goal/Goal.ts` and `src/domain/task/Task.ts`
- Add `fail(now)`: `doing | paused → failed` (relax the private `transition()` helper to accept
  a list of allowed source statuses, or inline the check like `Idea.explore` does).
- Extend `reopen(now)`: `done | failed → todo` (currently only `done → todo`).
- Add `isDueImminent(windowMs: number, now: Date): boolean` — true when **not archived**,
  status is not `done`/`failed`, `due` is set, and `due.getTime() - now.getTime() <= windowMs`
  (covers already-overdue).

### 1b. `src/domain/project/Project.ts`
- Add `fail(now)`: `active | paused → failed`. (No reopen for project — out of scope.)
- Add `isDueImminent(windowMs, now)` with the same rule as above.

### 1c. New module `src/domain/attention/AttentionEntry.ts`
User intent for the attention section; rule-derived items are **not** stored.
```ts
export type AttentionTargetType = 'goal' | 'task' | 'project' | 'idea';
export type AttentionEntryKind = 'pin' | 'dismiss';

export class AttentionEntry {
  readonly id: AttentionEntryId;
  readonly targetType: AttentionTargetType;
  readonly targetId: string;
  readonly kind: AttentionEntryKind; // pin = user added; dismiss = user hid the target
  readonly createdAt: Date;
}
```
- `create()` validates non-blank `targetId`.
- New repository `src/domain/attention/repository/AttentionEntryRepository.ts`:
  `save`, `findById`, `list(filter?: { kind?, targetType?, targetId? })`, `delete`.
- Add `AttentionEntryId` to `src/domain/shared/ids.ts`.

### 1d. `src/domain/relation/Relation.ts`
- Add `'record'` to `RelationEndType` so a consumption relation can link a record to a resource.

### 1e. `src/domain/record/Record.ts`
- Fix the existing type error: `RecordRepository` imports `RecordTargetType` but `Record.ts`
  never exports it. Add
  `export type RecordTargetType = 'goal' | 'task' | 'idea' | 'project' | 'resource' | 'note'`.

### 1f. Tests
- Extend `goal.test.ts`, `task.test.ts`, `project.test.ts`: `fail()` sources/rejections,
  `reopen()` from failed (goal/task), `isDueImminent()` boundaries (within window, past due,
  outside window, no due, done/failed, archived).
- New `src/domain/attention/__tests__/attentionEntry.test.ts`: create validation.

## Step 2 — Application layer (new services, per project rules)

### 2a. `src/application/attention/AttentionService.ts` (new)
- `pin({ id, targetType, targetId, now })`: save a `pin` entry; removes any existing
  `dismiss` entry for the same target (one active entry per target).
- `dismiss({ id, targetType, targetId, now })`: save a `dismiss` entry; removes any existing
  `pin` entry for the same target.
- `clear(targetType, targetId)`: delete any entry for the target (un-pin / un-dismiss).

### 2b. `src/application/resource/ConsumeResourceService.ts` (new)
`consume({ recordId, relationId, resourceId, projectId, amount, now })`:
1. Load resource via `ResourceRepository`; must exist, not archived, `kind === 'quantity'`
   (time resources are excluded — user decision).
2. Find its allocation to `projectId`; sum existing `'consumes'` relations for that
   resource+project (via `RelationRepository.list({ targetType: 'resource', targetId, kind: 'consumes' })`,
   detail is JSON `{ projectId, amount }`). Reject with `DomainError` if
   `consumed + amount > allocation.amount`.
3. Append `Record` (kind `'resourceConsumed'`, human-readable detail) via `RecordRepository`.
4. Save `Relation` (source `'record'` → target `'resource'`, kind `'consumes'`,
   detail `JSON.stringify({ projectId, amount })`) via `RelationRepository`.

### 2c. `src/application/dashboard/DashboardService.ts` (new)
Constructor takes the repositories (goal, task, idea, project, resource, relation, record,
attentionEntry). `getDashboard(now): Promise<DashboardView>`:

- **doing**: `goalRepo.list({ status: 'doing', archived: false })` +
  `taskRepo.list({ status: 'doing', archived: false })` +
  `ideaRepo.list({ status: 'captured', archived: false })`, mapped to
  `{ type, id, title, status, due? }` (idea maps `content` → `title`), sorted by `updatedAt` desc.
- **attention**: `AttentionItem { type, id, title, reason, due? }`,
  `reason: 'failed' | 'overdue' | 'resourceExhausted' | 'pinned'`:
  1. Rule-derived candidates:
     - goals/tasks with `status: 'failed'`, not archived → `'failed'`;
     - `goal.isDueImminent(24h, now)` / `project.isDueImminent(24h, now)` /
       `task.isDueImminent(2h, now)` → `'overdue'` (window constants in the service file);
     - active, non-archived projects where any **quantity** allocation has
       `consumed >= 0.9 * allocation.amount` → `'resourceExhausted'`
       (consumed summed from `'consumes'` relations as in 2b).
  2. Pinned entries → load each target (skip archived/missing), add with reason `'pinned'`.
  3. Remove any candidate whose target has a `dismiss` entry.
  4. Order: failed, overdue by `due` asc, resourceExhausted, pinned.
- **recentActivity**: `recordRepo.listRecent(10)` → `{ id, kind, detail, occurredAt }`.

### 2d. Tests (new, with in-memory fake repositories)
- `attentionService.test.ts`: pin/dismiss/clear, pin↔dismiss conflict resolution.
- `dashboardService.test.ts`: each rule, archived/done exclusion, window boundaries, 90%
  threshold, pinned item appears, dismissed rule-item hidden, dismissed pinned item hidden,
  activity limit 10.
- `consumeResourceService.test.ts`: happy path, time-resource rejection, missing allocation,
  over-consumption rejection.

## Step 3 — Prototype: `docs/design/prototype/index.html`
- Dashboard screen: add a **"Recent activity"** section at the bottom using the existing
  `activityPanel()` helper (4–5 mock rows).
- Rework the **"Needs attention"** mock rows to match the real reasons
  (failed item, "Due in 22 h" goal, "Due in 1 h" task, "Budget 92% used" project, one pinned item).
- Every attention row gets a small **"Remove"** chip-button (dismiss affordance); a row whose
  item is user-added shows a "Pinned" hint instead of a rule subtitle.
- Keep the stats row and "Doing now" section as-is.

## Step 4 — Docs
- `docs/domain/domain.md`: states — Goal/Task add `Failed`; Project becomes
  `Planning Active Paused Done Failed`. Note the optional `due` on Goal/Task/Project and the
  dashboard due-warning windows. New model entry: `AttentionEntry` (pin/dismiss user intent for
  the dashboard attention section). Add decision: non-time resource consumption is recorded as
  a `Record` plus a `'consumes'` Relation from the record to the resource.
- `docs/design/design.md`: dashboard shows three sections (Doing, Needs attention,
  Recent activity); attention items can be removed by the user and arbitrary items pinned.

## Step 5 — Verify
- `npx jest` (domain + new application tests) and `npx tsc --noEmit`.
- Open the prototype HTML and visually check the dashboard screen.

## Phase 2 (future, NOT in this plan) — UI integration
Listed now so the Phase-1 shapes serve it; executed as a follow-up plan.

1. **Infrastructure first** (prerequisite): sqlite implementations in
   `src/infrastructure/sqliteRepository/` for the repositories the dashboard reads
   (goal, task, idea, project, resource, relation, record, attentionEntry), since the real
   app can't run on test fakes.
2. **Composition**: add `dashboardService` and `attentionService` to `AppServices` in
   `src/ui/composition/AppServicesProvider.tsx`; construct them with the sqlite repositories
   in `App.tsx`.
3. **Dashboard page**: `src/ui/pages/dashboard/DashboardPage.tsx` rendering the three
   sections per the prototype — Doing items, Needs attention (rows carry a reason subtitle
   and a Remove button that calls `attentionService.dismiss`, then refetch), Recent activity.
   Shared row components live in `src/ui/components/` (styled after the prototype's
   `row`/`chip`/`sec-head` patterns).
4. **Navigation**: register a `dashboard` destination in `appDestinations()` (per
   `docs/design/design.md` the bottom nav becomes Dashboard / Library / Setting) and load
   `dashboardService.getDashboard(new Date())` on mount and whenever the tab regains focus.
5. **UI tests**: section rendering and dismiss/pin interactions with a stubbed
   `AppServices`.

## Notes / non-goals (this plan)
- No UI pages / navigation wiring (`src/ui/pages` is still empty) — this plan covers domain,
  application, and the HTML prototype only. UI integration is Phase 2 above.
- No sqlite implementation yet (`src/infrastructure/sqliteRepository` is empty); repository
  interfaces are exercised through fakes in tests.
- No `fail()`-triggering application service (e.g. `FailGoal`) — the domain methods are added
  so the status exists; mutation use cases come later.
