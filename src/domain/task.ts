import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * Intrinsic executable work. Project membership, decomposition, lifecycle,
 * labels, workflow selection, scheduling, and resources are intentionally
 * represented outside this aggregate.
 */
export interface Task {
  id: EntityId;
  title: string;
  description: string | null;
  targetDescription: string;
  exitCriteria: string | null;
  priority: TaskPriority | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/**
 * Relative execution priority: 1 is highest and 5 is lowest. Omit priority
 * when a task has no explicit ordering relative to other tasks.
 */
export type TaskPriority = number;
export const TASK_PRIORITY_MIN = 1;
export const TASK_PRIORITY_MAX = 5;

export interface NewTask {
  title: string;
  targetDescription: string;
  description?: string;
  exitCriteria?: string;
  priority?: TaskPriority;
}

/** Editable intrinsic fields of an active Task. Null clears an optional field. */
export interface TaskChanges {
  title?: string;
  targetDescription?: string;
  description?: string | null;
  exitCriteria?: string | null;
  priority?: TaskPriority | null;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Task ${field} must not be blank`);
  }
  return value;
}

export function validateTaskPriority(priority: TaskPriority): void {
  if (
    !Number.isInteger(priority) ||
    priority < TASK_PRIORITY_MIN ||
    priority > TASK_PRIORITY_MAX
  ) {
    throw new Error(
      `Task priority must be an integer from ${TASK_PRIORITY_MIN} (highest) to ${TASK_PRIORITY_MAX} (lowest)`,
    );
  }
}

/** Validate the invariants every Task aggregate must satisfy. */
export function validateTask(task: Task): void {
  requireNonBlank('title', task.title);
  requireNonBlank('targetDescription', task.targetDescription);
  if (task.priority !== null) {
    validateTaskPriority(task.priority);
  }
}

/** Define a new Task with a fresh id and current creation/update timestamps. */
export function createTask(input: NewTask): Task {
  const now = nowIso();
  const task: Task = {
    id: newId(),
    title: requireNonBlank('title', input.title),
    description: input.description ?? null,
    targetDescription: requireNonBlank(
      'targetDescription',
      input.targetDescription,
    ),
    exitCriteria: input.exitCriteria ?? null,
    priority: input.priority ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateTask(task);
  return task;
}

/** Update an active Task without mutating its identity or creation timestamp. */
export function updateTask(
  task: Task,
  changes: TaskChanges,
  updatedAt: IsoTimestamp = nowIso(),
): Task {
  if (task.archivedAt !== null) {
    throw new Error(`Task ${task.id} is archived and cannot be updated`);
  }
  const updated: Task = {
    ...task,
    title: changes.title ?? task.title,
    targetDescription: changes.targetDescription ?? task.targetDescription,
    description:
      changes.description === undefined ? task.description : changes.description,
    exitCriteria:
      changes.exitCriteria === undefined ? task.exitCriteria : changes.exitCriteria,
    priority: changes.priority === undefined ? task.priority : changes.priority,
    updatedAt,
  };
  validateTask(updated);
  return updated;
}

/** Archive an active Task while retaining it for history and id resolution. */
export function archiveTask(
  task: Task,
  archivedAt: IsoTimestamp = nowIso(),
): Task {
  if (task.archivedAt !== null) {
    throw new Error(`Task ${task.id} is already archived`);
  }
  return { ...task, updatedAt: archivedAt, archivedAt };
}
