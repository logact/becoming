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


## pages
1. dashboard  page show 
   1. Doing items (doing goals/tasks + unexplored ideas)
   2. Needs attention
   3. Recent activity

   the attention section combines built-in rules (failed items, approaching overdue — goal/project 1 day, task 2 h — and projects whose quantity resource is >=90% consumed) with user control: the user can pin any item into the section and remove (dismiss) items from it.

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



## Show Recent Activity under each model pages
show the recent record realted the current page's topic on the bottom of the page.


## Decisions
1. Every core models' page's bottom should show the activity(record) refer to it, including the list page,and the detail page.
