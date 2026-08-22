# Execution Plan: Goal/Task Start Dates and Date Input Optimization

Status: approved for implementation.

Source issues:

- `docs/issues/add-start-time.md`
- `docs/issues/dateinput-optimization.md`

## 1. Scope and proposed product decisions

- Add an optional `startAt` to Goals and Tasks. In this iteration it is a local calendar date, matching the existing date-only `due` behavior; hour/minute scheduling is not added to Goal or Task.
- `startAt` means "planned to become actionable on this date." It is separate from `createdAt`, `updatedAt`, and the lifecycle `start(now)` operation.
- Reaching `startAt` never changes lifecycle status automatically. A Goal or Task still moves from `todo` to `doing` only through the existing explicit Start action.
- A non-archived `todo` Goal or Task whose start date has arrived is rule-derived attention with reason `readyToStart`.
- Existing higher-priority conditions win when an item qualifies more than once: failed, overdue/due-soon, resource exhaustion, then ready-to-start, then pinned. Each target still appears only once.
- `startAt` may be omitted or cleared. When both dates exist, `startAt` must be on or before `due`; the same calendar date is valid.
- Add scheduling controls to Goal and Task detail so every existing item can set, change, or clear its Start and Due dates.
- Structured Goal/Task creation flows accept Start and Due values. Quick Capture remains quick and creates unscheduled items; users can schedule them from detail afterward.
- Replace every current manual `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` field with a shared native picker interaction:
  - Goal due date in Create from Idea.
  - Sub-goal and Task due dates in Add to plan.
  - Milestone date in Add to plan.
  - Resource-allocation start/end date-times.
  - New Goal/Task Start and Due schedule fields.
- Project and Milestone models do not gain `startAt` in this scope.

Approval of this plan confirms the product decisions above, especially date-only Goal/Task starts, explicit lifecycle transitions, ready-to-start attention, and keeping Quick Capture compact.

## 2. Shared date and date-time picker UI

Primary files:

- `package.json` and the package lockfile
- New shared components under `src/ui/components/`, tentatively `DatePickerRow.tsx`
- Shared formatting helpers under `src/ui/shared/`
- Component tests under `src/ui/components/__tests__/`

Tasks:

1. Install Expo's compatible `@react-native-community/datetimepicker` version through `npx expo install` (Expo 54 currently declares `8.4.4` in its bundled native-module map).
2. Create one controlled shared picker abstraction with:
   - `date` and `datetime` modes.
   - Optional and required values.
   - Clear support for optional values.
   - Minimum/maximum bounds when the caller needs them.
   - Locale-aware display text while preserving `Date` values in local time.
   - Stable accessibility labels and test IDs.
3. Keep platform behavior inside the wrapper:
   - iOS presents the native picker in the app's existing sheet/panel style with explicit Done and Cancel actions.
   - Android uses the native dialog flow; datetime mode selects date and time without exposing intermediate values to the form.
4. Make Cancel lossless, Clear explicit, and opening an empty optional field default to today without committing until the user confirms.
5. Mock only the native picker boundary in Jest; test the wrapper's value, cancel, clear, min/max, date, and datetime contracts.
6. Remove `parseDateText` and `parseDateTimeText` only after all callers migrate. Retain shared formatting helpers instead of duplicating `toLocaleDateString` functions across pages.

Completion checks:

- No production date form requires keyboard entry or knowledge of a date string format.
- Date values do not shift by a day through UTC conversion.
- Date-time values preserve the locally selected hour and minute.

## 3. Goal and Task domain model

Primary files:

- `src/domain/goal/Goal.ts`
- `src/domain/task/Task.ts`
- `src/domain/goal/__tests__/goal.test.ts`
- `src/domain/task/__tests__/task.test.ts`

Tasks:

1. Add optional `startAt` state, getters, and `create` / `restore` parameters to both models.
2. Add schedule behavior to each model rather than assigning fields in application services:
   - `setSchedule(startAt, due, now)` for an atomic replacement of the two optional dates.
   - The method accepts either value as absent, enabling set/change/clear without invalid intermediate state.
   - Reject `startAt > due` when both exist.
3. Add `isReadyToStart(now)` as the single source of the attention rule:
   - True only for non-archived `todo` items with `startAt <= now`.
   - False for doing, paused, done, failed, archived, or unscheduled items.
4. Keep lifecycle methods unchanged; `startAt` is planning metadata and does not record when work actually started.
5. Preserve the existing `setDue` / `clearDue` API only if current callers still require it; route it through the same schedule invariant so the model cannot hold an invalid date range.
6. Cover creation/restoration, set/change/clear, same-day dates, invalid order, readiness boundaries, lifecycle states, and archive behavior.

## 4. SQLite migration and repository mapping

Primary files:

- `src/infrastructure/sqliteRepository/schema.ts`
- `src/infrastructure/sqliteRepository/SqliteGoalRepository.ts`
- `src/infrastructure/sqliteRepository/SqliteTaskRepository.ts`
- Repository and migration tests under `src/infrastructure/sqliteRepository/__tests__/`

Tasks:

1. Add nullable `start_at INTEGER` columns to `goals` and `tasks`; continue storing all `Date` values as epoch milliseconds.
2. Add a conditional v4 migration for both columns and advance `PRAGMA user_version` to 4.
3. Update fresh-schema DDL and `EXPECTED_COLUMNS` together so fresh, v1, v2, v3, and partially migrated development databases converge on the same shape without destructive rebuilds.
4. Map `startAt` through Goal/Task row types, save/upsert statements, and hydration.
5. Test undefined and populated round trips plus a v3-to-v4 upgrade that retains existing Goal and Task rows with `start_at = NULL`.

## 5. Application write services and creation paths

Add new services, tentatively:

- `src/application/goal/ScheduleGoalService.ts`
- `src/application/task/ScheduleTaskService.ts`
- Corresponding tests using `makeFakeRepos()` and the SQLite-backed repositories

Tasks:

1. Give each service one command that atomically replaces optional Start and Due values on an existing entity.
2. Reject unknown or archived targets before mutation.
3. Call the domain `setSchedule` behavior, save the entity, append a concise immutable schedule-changed Record, and link it to the entity.
4. Run entity, Record, and Relation writes through `TransactionRunner`; test rollback when a later write fails.
5. Extend structured creation commands and their tests to carry optional `startAt` and `due` consistently:
   - `AddSubGoalService`.
   - `AddTaskService`.
   - `CreateGoalFromIdeaService`.
   - `CreateTaskFromIdeaService` (which currently has neither date field).
6. Leave `QuickCaptureService` and `CaptureComposer` unchanged; scheduling is available immediately from the created entity's detail screen.

Application tests must cover unknown/archived entities, every optional date combination, invalid ordering, same-day Start/Due, persisted Records, and transaction rollback.

## 6. Read models and ready-to-start attention

Primary files:

- `src/application/dashboard/DashboardService.ts`
- `src/application/goal/GoalsOverviewService.ts`
- `src/application/task/TasksOverviewService.ts`
- `src/application/goal/GoalDetailService.ts`
- `src/application/task/TaskDetailService.ts`
- Related application tests

Tasks:

1. Expose `startAt` in Goal and Task list/read items wherever date metadata is flattened rather than returning the domain entity.
2. Add `readyToStart` to Dashboard, Goals, and Tasks attention reason types.
3. Derive ready items through `Goal.isReadyToStart(now)` / `Task.isReadyToStart(now)` and preserve one item per target.
4. Preserve the existing priority of failed and due-related warnings; only use `readyToStart` when no higher-priority rule already represents the target.
5. Sort ready items by oldest `startAt` first so the longest-waiting work appears first.
6. Keep Doing now status-based; scheduled `todo` items must not be presented as already doing.
7. Verify existing pin/dismiss behavior also applies to ready-to-start items without adding persistence state.

## 7. Goal and Task scheduling UI

Primary files:

- `src/ui/pages/goals/GoalDetailPage.tsx`
- `src/ui/pages/tasks/TaskDetailPage.tsx`
- New focused schedule editor component under the Goal/Task page area or shared UI
- Goal/Task detail page tests

Tasks:

1. Display Start and Due together in each detail header, with a clear empty state when neither is set.
2. Add a Schedule action that opens a focused editor containing optional Start and Due picker rows.
3. Apply reciprocal bounds in the UI (`Start <= Due`) while retaining domain validation as the final authority.
4. Allow either value to be cleared and preserve the other when valid.
5. On success, close the editor and refresh detail so the dates and new activity record are visible.
6. On failure, keep selected values, show the service error, and prevent duplicate submission while a write is running.
7. Show ready-to-start copy and iconography consistently in Dashboard, Goals, and Tasks attention lists; do not alter lifecycle action labels.

UI tests must cover initial values, choosing/replacing/clearing each date, same-day bounds, invalid ranges, cancel, service errors, successful refresh, ready attention copy, and explicit Start behavior remaining unchanged.

## 8. Replace existing manual date fields

Primary files:

- `src/ui/pages/ideas/CreateFromIdeaSheet.tsx`
- `src/ui/pages/projects/AddPlanItemPage.tsx`
- `src/ui/pages/projects/AllocateResourcePage.tsx`
- Their existing UI tests

Tasks:

1. Create from Idea:
   - Replace the Goal Target date text field with the shared optional date picker.
   - Add optional Start and Due picker rows to both Goal and Task forms.
   - Pass the selected values through the corresponding creation service.
2. Add to plan:
   - Replace Sub-goal and Task Due text fields with optional date pickers.
   - Add optional Start picker rows for Sub-goal and Task.
   - Replace the required Milestone Date text field with a required date picker.
3. Allocate resource:
   - Replace manual start/end date-time strings with datetime picker rows.
   - Preserve the existing optional-span behavior and `startAt < endAt` validation.
4. Update tests to select semantic `Date` values through the wrapper rather than typing formatted strings.
5. Ensure the approved Goal Project Management plan uses this shared picker for Project Due when that separate plan is implemented.

## 9. Composition, documentation, and verification

Primary files:

- `src/ui/composition/AppServicesProvider.tsx`
- `src/ui/composition/composeServices.ts`
- `src/ui/appDestinations.tsx`
- `docs/domain/domain.md`
- `docs/design/design.md`
- `docs/design/design-style.md` if the picker receives reusable visual rules

Tasks:

1. Register and construct the two new schedule services and inject them into Goal and Task detail routes.
2. Update test service fixtures and composition regressions without handwritten fake repository behavior.
3. Document `startAt`, its separation from lifecycle state, the date-order invariant, and ready-to-start attention.
4. Document the shared picker interaction and the removal of manual date-format entry.
5. Run focused tests after each layer, then final verification:

   ```sh
   npm run typecheck
   npm test -- --runInBand
   ```

## 10. Implementation order and acceptance criteria

Implementation order:

1. Shared picker and its isolated tests.
2. Domain model and tests.
3. SQLite migration/repositories and tests.
4. New schedule services and structured creation command updates.
5. Read models and attention rules.
6. Goal/Task detail scheduling UI.
7. Migration of all existing manual date/date-time fields.
8. Composition, documentation, and full verification.

Acceptance criteria:

- Every Goal and Task can hold, change, and clear an optional Start date and Due date.
- The domain rejects Start dates later than Due dates; same-day Start and Due is accepted.
- Reaching Start does not silently change lifecycle status.
- A due `todo` Goal or Task appears once as ready to start unless a higher-priority attention reason applies.
- Doing now remains based on actual `doing` status.
- Existing databases migrate to v4 without losing Goal or Task data.
- All date and date-time forms use native picker interactions; no production field asks users to type `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`.
- Optional dates can be cleared, required dates cannot, and Cancel never mutates form state.
- Goal/Task schedule changes produce linked immutable activity records and roll back atomically on failure.
- Quick Capture remains unchanged and newly captured Goals/Tasks can be scheduled from detail.
- Typecheck and the full test suite pass.
