## APP Shell
Each app screen follows this vertical structure:

┌──────────────────────────────┐
│ Status / safe area           │
├──────────────────────────────┤
│ Navigation bar               │
├──────────────────────────────┤
│                              │
│ Scrollable screen content    │
│                              │
├──────────────────────────────┤
│ Bottom navigation            │
└──────────────────────────────┘

### Bottom navigation 

the bottom navigation has the buttons (Dashboard,Library,Setting)

### Universal capture

- The Capture entry is owned by the app shell, so it is available on ordinary list, detail, and pushed screens without becoming a new tab or route. On list screens the floating button sits above the bottom tab bar; on pushed screens it sits above the bottom safe area.
- Opening Capture dims the current screen and presents a bottom composer above the app content and tab bar. Focus moves directly to the text input. When the keyboard appears, the composer moves with it so the input, required context, and submit action remain visible.
- Decide later, Idea, Task, Goal, and Note are presentation intents over the existing models. Changing intent updates the placeholder, explanatory copy, required fields, and submit label. Task alone shows a required Project picker; without a Project its submit action remains disabled and the composer offers a clear return to Decide later.
- A modal or bottom sheet already on screen suppresses the Capture entry rather than stacking another overlay.
- A successful save closes the composer, shows confirmation, and returns focus to the unchanged originating screen. The current navigation stack is never replaced or advanced by capture.


## pages
1. dashboard  page show 
   1. Doing items (doing goals/tasks + unexplored ideas)
   2. Needs attention
   3. Recent activity

   the attention section combines built-in rules (failed items, approaching overdue — goal/project 1 day, task 2 h — and projects whose quantity resource is >=90% consumed) with user control: the user can pin any item into the section and remove (dismiss) items from it.

   Entity rows in Doing now and Needs attention open their corresponding detail on the Dashboard navigation stack. Recent activity is informational and remains non-interactive.

2. goals page is a dashboard for all goals, not only a goal list:
   1. Overview stats (active goals, avg. progress, done)
   2. Needs attention (failed goals, goals due within 1 day)
   3. Focus goals (doing goals closest to their target / most progressed, as rich cards)
   4. Breakdown by status and by label
   5. All goals: compact panel list grouped by status
   6. Recent activity

3. tasks page is the dashboard for all tasks:
   1. Overview stats for doing, todo, done, and overdue
   2. Needs attention ordered by failed, overdue, then due soon
   3. Doing now, breakdowns by status and label, and all tasks grouped by status
   4. Recent task activity

   Task detail shows project/goal context, description, immutable execution records,
   and only the lifecycle actions valid for its current status.

4. Ideas page supports capture and workflow triage:
   1. Open contains non-archived `captured`, `exploring`, and `paused` Ideas, grouped as To process, Exploring, and Paused.
   2. Handled contains non-archived `handled` Ideas. Handled means processed, not archived; a handled Idea remains available for further derivation.
   3. Each row opens Idea detail, while its separate `+` action opens Create from Idea without triggering row navigation.
   4. Recent activity contains Idea record kinds and appears at the bottom of the page.

   Idea detail presents the complete content, labels, update time, and a status picker in which all four statuses are directly selectable. Create from this idea offers Goal, Task, and Note. The original Idea is preserved and each new item links back through `goal|task|note --derivedFrom--> idea`; creating an item moves the Idea to Handled without preventing later derivations. Created items and Idea-related activity remain visible on the detail page.

5. Notes page is a uniform-row overview with Active and Archived segments:
   1. Active Notes are split into Pinned and All notes. Pinned rows sort by `pinnedAt` descending; unpinned rows sort by `updatedAt` descending.
   2. Archived Notes use one dimmed list sorted by `updatedAt` and ignore pin state for grouping and order.
   3. Note detail shows content, pin and archive actions, labels, and a Linked section containing its source Idea and related Goals or Projects.
   4. Pinning is an organization action and does not change the content update time. Archive and pin remain independent.



## Show Recent Activity under each model pages
show the recent record realted the current page's topic on the bottom of the page.


## Decisions
1. Every core models' page's bottom should show the activity(record) refer to it, including the list page,and the detail page.
