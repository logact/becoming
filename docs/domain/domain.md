## Core Models
The project has the following core model:
1. Goal: target state aim to achieve
3. Task: the action to implement some goal
2. Idea: casually written idea , maybe later transformed to any other model
4. Project: a container that manage the goal's status and how the goal decompose to subgoals and manage the task to implement thess task. A goal may have mutilp project(that means the goal have different plan)
5. Resource: the resource a project can allocate. Three parts:
   - ResourceType: a user-defined kind of resource; kind is `quantity` or `time`, and it owns the unit (e.g. 'USD', 'minutes').
   - Resource: a global pool of one type with a total amount (minutes for time resources); the total allocated never exceeds the pool.
   - ResourceAllocation: a portion of a pool assigned to a project. Quantity allocations carry an amount; time allocations carry a minute-precision span (part of a day or several days) whose amount equals its duration. Time spans never overlap.
6. Note: The extract thought,methodlogy from the user
7. Record: System model's change ,user's record have done for some tasks.
8. AttentionEntry: the user intent for the dashboard attention section. kind 'pin'(user added the item) or 'dismiss'(user hid the item); rule-derived attention items(failed/overdue/resource-exhausted) are computed, not stored.

## Other models
and some other models:
1. label: the Goal,Task,Idea,Project,Resouce,Note all have the labels for classification.
2. relation: store the relation between the 8 core models.

## States:
Goal: Todo Doing Done Paused Failed
Task: Todo Doing Done Paused Failed

Idea: Captured Exploring Paused Handled
Project: Planning Active Paused Done Failed

Goal/Task/Project have a optional due date. fail(): Goal/Task doing|paused -> failed, Project active|paused -> failed; Goal/Task reopen(): done|failed -> todo.
Dashboard due-warning windows: goal/project 1 day ahead, task 2 hours ahead (already-overdue counts), implemented via isDueImminent(windowMs, now).

## Archive
Archive is a indepent filed so that when archieve a item we won't cover its status.



## Decisions
1. The Relation between the records and other core models should be represent by the relation
2. Non-time(quantity) resource consumption is recorded as a Record(kind 'resourceConsumed') plus a Relation(kind 'consumes') from the record to the resource; the relation's detail is JSON { projectId, amount }. Relation end types now include 'record'.