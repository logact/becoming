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



## Show Recent Activity under each model pages
show the recent record realted the current page's topic on the bottom of the page.


## Decisions
1. Every core models' page's bottom should show the activity(record) refer to it, including the list page,and the detail page.
   