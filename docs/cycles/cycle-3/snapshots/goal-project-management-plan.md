# Execution Plan: Goal Project Management

Status: approved for implementation.

Source issue: `docs/issues/plan/goal-project-management.md`.

## 1. Scope and confirmed product decisions

- Goal detail provides separate entries for creating a Project and selecting the Goal's current plan.
- A newly created Project starts in `planning`; creation does not silently replace the current plan.
- A Project is permanently associated with its serving Goal through its immutable `goalId`.
- Only non-archived `planning` and `paused` Projects belonging to the Goal can become current.
- The current active Project is displayed as selected and cannot be selected again.
- Archived, `done`, and `failed` Projects cannot be selected.
- Selecting the first current plan does not require confirmation.
- Replacing an active plan requires confirmation because the former active Project will be paused.
- After creation or selection, Goal detail remains open, the sheet closes, and the refreshed Project list and current-plan marker are shown.
- Project creation and current-plan selection produce immutable activity records.
- Unknown or archived Goals cannot receive a new Project or change their current plan.
- No database schema migration is expected; existing Project, Record, Relation, and transaction infrastructure is sufficient.

## 2. Domain invariants

Primary files:

- `src/domain/project/Project.ts`
- `src/domain/project/__tests__/project.test.ts`
- `src/domain/goal/__tests__/goal.test.ts` when Goal-level coverage needs extension

Tasks:

1. Make `Project.create` reject a blank name, matching the model documentation and `rename` invariant.
2. Align `Project.activate` with its documented state machine:
   - Allow `planning -> active`.
   - Allow `paused -> active`.
   - Reject activation from `active`, `done`, and `failed`.
3. Retain the existing rule that a Project due date must be strictly earlier than its serving Goal's due date.
4. Retain `Goal.activateProject` as the domain operation that verifies ownership, pauses a different current Project, and activates the selected Project.
5. Add tests for blank creation and every permitted/rejected activation source state.

Completion checks:

- Eligibility cannot be bypassed by calling the Project domain model directly.
- Existing Project lifecycle tests remain valid.

## 3. Create a Project for a Goal

Add a new application service, tentatively:

- `src/application/project/CreateGoalProjectService.ts`
- `src/application/project/__tests__/createGoalProjectService.test.ts`

The service command should provide the new Project ID, Goal ID, name, optional due date, activity Record ID, Relation IDs, and timestamp. Keep identifiers supplied by the caller, consistent with existing application services.

Tasks:

1. Load the serving Goal.
2. Reject an unknown or archived Goal before writing anything.
3. Construct the Project through `Project.create`, passing the Goal due date into the domain validation.
4. Save the Project in `planning` status.
5. Append a `projectCreated` Record with concise user-facing detail.
6. Relate that Record to both the Goal and new Project so it appears in both detail timelines.
7. Run the Project, Record, and Relation writes through `TransactionRunner`.
8. Return a small result containing the created Project ID.

Application tests must use `makeFakeRepos()` and its real SQLite repositories and transaction runner. Cover:

- Successful creation with no due date.
- Successful creation with a due earlier than the Goal due.
- Permanent association with the requested Goal.
- Default `planning` status.
- Blank name rejection.
- Unknown and archived Goal rejection.
- Equal or later Project due rejection.
- Activity linked to both Goal and Project.
- Rollback of Project creation when a later activity write fails.

## 4. Select the current plan

Add a separate application service, tentatively:

- `src/application/goal/SelectCurrentPlanService.ts`
- `src/application/goal/__tests__/selectCurrentPlanService.test.ts`

The service command should provide the Goal ID, selected Project ID, activity Record ID, Relation IDs, and timestamp.

Tasks:

1. Load the Goal and selected Project.
2. Reject:
   - Unknown or archived Goal.
   - Unknown or archived Project.
   - A Project belonging to another Goal.
   - The already-active Project.
   - A `done` or `failed` Project.
3. Load the Goal's existing active Project, including an archived active Project if present, so the at-most-one-active invariant is preserved across all Projects of the Goal.
4. Invoke `Goal.activateProject(selected, currentActive, now)` rather than reproducing the switch rules in the service.
5. Atomically save the selected Project and, when switching, the paused former Project.
6. Append a `projectActivated` Record. Its detail should identify the selected Project and, when applicable, the Project it replaced.
7. Relate the Record to the Goal and selected Project so both timelines show the selection.
8. Run all status, Record, and Relation writes through `TransactionRunner`.

Application tests must cover:

- Activating a planning Project when there is no current plan.
- Reactivating a paused Project.
- Switching plans and pausing the former active Project.
- Rejecting an already-active Project without mutation.
- Rejecting foreign, archived, done, failed, or unknown Projects without mutation.
- Rejecting unknown and archived Goals.
- Activity visibility from both Goal and selected Project.
- Rollback of both Project status changes when a later activity write fails.

## 5. Goal-detail read model

Primary files:

- `src/application/goal/GoalDetailService.ts`
- `src/application/goal/__tests__/goalDetailService.test.ts`

Tasks:

1. Continue listing only non-archived Projects belonging to the Goal.
2. Add an application-level eligibility field, such as `canSelectAsCurrentPlan`, to each Project item so UI code does not reproduce lifecycle rules.
3. Mark only `planning` and `paused` Projects as selectable.
4. Preserve `activeProjectId` as the derived current plan.
5. Verify that the new creation and activation Records are returned through Goal recent activity.
6. Preserve existing sub-goal counts and Project-row navigation data.

Completion checks:

- The UI receives all information needed to render the picker without inspecting domain internals.
- Archived Projects remain absent from Goal detail.

## 6. Goal-detail UI

Primary files:

- `src/ui/pages/goals/GoalDetailPage.tsx`
- `src/ui/pages/goals/__tests__/goalDetailPage.test.tsx`
- Optional dedicated sheet components under `src/ui/pages/goals/`
- Existing shared form/date components where appropriate

Tasks:

1. Extend `GoalDetailPage` dependencies with the two new command services while keeping the existing read service injectable for tests.
2. Add a **New project — another way to reach this goal** row to the Projects section. It must remain visible when the Project list is empty.
3. Add a **Choose current plan** entry whenever the Goal has at least one selectable Project.
4. Implement the create-project sheet:
   - Required Project name.
   - Optional due date entered as `YYYY-MM-DD` through the existing strict date parser.
   - Clear inline validation for invalid input.
   - Service errors shown without clearing entered values.
   - Submission disabled while a write is in progress.
5. Implement the current-plan picker:
   - Display the active Project as selected and disabled.
   - Display planning and paused Projects as selectable.
   - Do not offer archived, done, or failed Projects as choices.
6. When no active Project exists, selection immediately calls the service.
7. When an active Project exists, present a confirmation step explaining that it will be paused before calling the service.
8. On successful create or selection:
   - Dismiss the sheet.
   - Refresh Goal detail.
   - Display the new Project or updated **Current plan** marker.
9. Preserve existing Project-row navigation to Project detail.
10. Preserve loading, unknown-Goal, and error states.

UI tests must cover:

- New-project entry in populated and empty Project sections.
- Successful Project creation command and refreshed display.
- Invalid date handling before service invocation.
- Service error display with preserved form values.
- Picker eligibility and current selection display.
- Immediate first-plan selection.
- Confirmation when replacing an active plan.
- Refreshed current-plan marker after selection.
- Existing Project-row navigation.

## 7. Composition and route wiring

Primary files:

- `src/ui/composition/AppServicesProvider.tsx`
- `src/ui/composition/composeServices.ts`
- `src/ui/appDestinations.tsx`
- UI test service fixtures and composition regression tests

Tasks:

1. Register `CreateGoalProjectService` and `SelectCurrentPlanService` in `AppServices`.
2. Construct both services with the existing Goal, Project, Record, Relation, and transaction dependencies.
3. Pass the services into every Goal-detail wrapper used by Library and Dashboard.
4. Update test service fixtures without introducing handwritten repository persistence logic.
5. Add a composition-level regression proving both routes render Goal detail with working management dependencies.

## 8. Documentation and verification

1. Update `docs/design/design.md` with:
   - Projects as alternative plans for a Goal.
   - New Projects starting in planning.
   - Current-plan selection and replacement behavior.
2. Run focused domain, application, Goal-detail, and composition tests during implementation.
3. Run final verification:

   ```sh
   npm run typecheck
   npm test -- --runInBand
   ```

## 9. Acceptance criteria

- Goal detail always provides a New Project entry, including in its empty state.
- A valid Project can be created for the Goal and starts in `planning`.
- Blank names and invalid due dates fail without partial persistence.
- Only non-archived planning and paused Projects belonging to the Goal can become current.
- Selecting the first plan activates it without an unnecessary confirmation.
- Replacing a current plan requires confirmation, activates the selected Project, and pauses the former active Project atomically.
- Archived, done, failed, foreign, unknown, and already-active Projects cannot be selected.
- Goal detail refreshes after both operations and shows the correct Project list and Current plan marker.
- Project creation and plan selection appear in the relevant activity timelines.
- Goal project management behaves identically when Goal detail was opened from Library or Dashboard.
- No database schema change is introduced.
- Typecheck and the full test suite pass.
