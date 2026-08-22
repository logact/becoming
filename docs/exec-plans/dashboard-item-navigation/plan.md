# Execution Plan: Dashboard Item Navigation

Status: approved for implementation.

Source issue: `docs/issues/plan/item-not-nav-in-main.md`, limited to the numbered Dashboard entity-navigation requirements. The stale Goal-detail sentence at the end of that issue is excluded; Goal project management is covered by `docs/exec-plans/goal-project-management/plan.md`.

## 1. Scope and decisions

- Rows in **Doing now** and **Needs attention** open the corresponding entity detail.
- Direct Dashboard targets are Goal, Task, Project, and Idea.
- Goal uses the shell detail route; Task, Project, and Idea use their existing typed screen routes.
- Detail screens are pushed on the Dashboard destination's own stack. Back returns to Dashboard and restores its tab bar and context.
- The **Remove** control dismisses an attention item without opening its detail.
- **Recent activity** remains non-interactive because its read model does not expose a target entity.
- The existing `NavigationShell` per-destination stack model is retained unless implementation tests expose a missing capability.
- Domain models, repositories, and the Dashboard application read model do not require changes for this issue.

## 2. Shared entity route rendering

Primary files:

- `src/ui/appDestinations.tsx`
- `src/ui/navigation/__tests__/navigationShell.test.tsx`
- Relevant composition regression tests under `src/ui/composition/__tests__/`

Tasks:

1. Generalize the existing Library-specific entity-detail wrappers so they can be reused by both Library and Dashboard destinations.
2. Extract or otherwise share the screen resolver for:
   - `project:<id>` and the nested `add-plan-item` / `allocate-resource` project routes.
   - `task:<id>`.
   - `idea:<id>`.
   - `note:<id>`, even though Note is not a direct Dashboard item, so navigation launched from an Idea detail continues to work.
3. Configure the Dashboard destination with:
   - A Goal `renderDetail` handler.
   - The shared entity `renderScreen` handler.
   - Its existing `attention-pin` handler.
4. Preserve the existing Library route contracts and behavior.
5. Verify that details opened from Dashboard can continue into their nested routes without falling back to the Dashboard list.

Completion checks:

- Dashboard and Library render the same entity detail implementations.
- `attention-pin` remains available only through the Dashboard route.
- Unknown route IDs continue to render no pushed content and do not crash the shell.

## 3. Dashboard row interaction

Primary files:

- `src/ui/pages/dashboard/DashboardPage.tsx`
- If needed, `src/ui/components/ListRow.tsx`
- If needed, `src/ui/components/PrimaryChipButton.tsx`

Tasks:

1. Add one typed entity-opening helper inside the Dashboard UI:
   - Goal calls `navigation.openDetail(id)`.
   - Task, Project, and Idea call `navigation.pushScreen(`${type}:${id}`)`.
2. Give each Doing row a stable test ID and an `onPress` handler derived from its entity type and ID.
3. Give each Needs attention row a stable test ID and an `onPress` handler derived from its entity type and ID.
4. Preserve the Remove button as a separate interactive target.
5. Prevent the Remove press from propagating to the row navigation handler. If the current nested pressable behavior cannot guarantee this, introduce the smallest shared component API needed to separate the trailing action from the row action.
6. Preserve `pin-an-item` behavior.
7. Leave Recent activity rows without navigation handlers.
8. Keep current loading, error, refresh, and attention-dismissal behavior unchanged.

Completion checks:

- All supported Dashboard entity rows are visibly and semantically pressable.
- Removing attention does not push a screen.
- Recent activity remains non-pressable.

## 4. Tests

Primary files:

- `src/ui/pages/dashboard/__tests__/dashboardPage.test.tsx`
- `src/ui/navigation/__tests__/navigationShell.test.tsx`
- Relevant composition regression tests under `src/ui/composition/__tests__/`

Add or extend tests for:

1. A Doing Goal opening Goal detail.
2. A Doing Task opening Task detail.
3. A Doing Idea opening Idea detail.
4. A Needs attention Project opening Project detail.
5. The remaining attention entity types following the same route contract.
6. Back returning to Dashboard and restoring the tab bar.
7. Remove dismissing an attention item without opening detail.
8. Recent activity remaining non-interactive.
9. A nested route opened from a Dashboard-launched detail resolving through the shared route renderer.
10. Existing Library navigation continuing to pass unchanged.

Use the existing SQLite-backed `makeFakeRepos()` setup for application-integrated page tests; do not introduce handwritten repository logic.

## 5. Documentation and verification

1. Update `docs/design/design.md` to state that Doing now and Needs attention entity rows open detail while Recent activity remains non-interactive.
2. Run focused Dashboard, navigation, and composition tests during implementation.
3. Run final verification:

   ```sh
   npm run typecheck
   npm test -- --runInBand
   ```

## 6. Acceptance criteria

- Tapping a Dashboard Goal opens the correct Goal detail.
- Tapping a Dashboard Task opens the correct Task detail.
- Tapping a Dashboard Project opens the correct Project detail.
- Tapping a Dashboard Idea opens the correct Idea detail.
- The behavior applies to Doing now and Needs attention wherever the entity type can appear.
- Back returns to Dashboard rather than switching to Library.
- Remove dismisses an attention item and never navigates.
- Recent activity remains non-interactive.
- Nested detail navigation works from both Dashboard and Library.
- Typecheck and the full test suite pass.
