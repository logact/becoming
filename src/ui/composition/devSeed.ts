// DEV ONLY — remove once creation flows exist. Seeds a prototype-like dataset
// so the dashboard is visibly alive on first launch.
import type { ConsumeResourceService } from '../../application/resource/ConsumeResourceService';
import { Goal } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import { Idea } from '../../domain/idea/Idea';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Resource } from '../../domain/resource/Resource';
import type { ResourceRepository } from '../../domain/resource/repository/ResourceRepository';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import { Task } from '../../domain/task/Task';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Repositories and services the seed writes through (never raw SQL). */
export interface DevSeedDeps {
  goals: GoalRepository;
  tasks: TaskRepository;
  ideas: IdeaRepository;
  projects: ProjectRepository;
  resources: ResourceRepository;
  records: RecordRepository;
  consumeResource: ConsumeResourceService;
}

/**
 * Inserts the prototype-like dataset: doing goals/tasks (one task overdue),
 * a failed goal, a captured idea, and an active project whose quantity
 * resource is allocated in full and consumed past the exhaustion threshold.
 * Ids are deterministic; all dates are relative to now. Callers must only
 * run this on an empty database (composeServices guards on goals).
 */
export async function seedDevData(deps: DevSeedDeps): Promise<void> {
  const now = new Date();
  const ago = (ms: number): Date => new Date(now.getTime() - ms);

  // Goals: two doing, one failed (create → start → fail).
  const runGoal = Goal.create({
    id: 'seed-goal-run',
    title: 'Run a half marathon',
    due: new Date(now.getTime() + 75 * DAY_MS),
    now: ago(5 * DAY_MS),
  });
  runGoal.start(ago(5 * DAY_MS));
  await deps.goals.save(runGoal);

  const booksGoal = Goal.create({
    id: 'seed-goal-books',
    title: 'Read 12 books this year',
    now: ago(4 * DAY_MS),
  });
  booksGoal.start(ago(4 * DAY_MS));
  await deps.goals.save(booksGoal);

  const mvpGoal = Goal.create({
    id: 'seed-goal-mvp',
    title: 'Ship Becoming MVP',
    now: ago(5 * DAY_MS),
  });
  mvpGoal.start(ago(4 * DAY_MS));
  mvpGoal.fail(ago(DAY_MS));
  await deps.goals.save(mvpGoal);

  // Active project serving the running goal; the running tasks belong to it.
  const trainingProject = Project.create({
    id: 'seed-project-training',
    name: 'Spring training plan',
    goalId: runGoal.id,
    now: ago(4 * DAY_MS),
  });
  trainingProject.activate(ago(4 * DAY_MS));
  await deps.projects.save(trainingProject);

  // Tasks: two doing; the easy run was due an hour ago, so it shows overdue.
  const easyRunTask = Task.create({
    id: 'seed-task-easy-run',
    title: 'Easy run 8 km',
    due: ago(HOUR_MS),
    projectId: trainingProject.id,
    now: ago(5 * HOUR_MS),
  });
  easyRunTask.start(ago(5 * HOUR_MS));
  await deps.tasks.save(easyRunTask);

  const shoesTask = Task.create({
    id: 'seed-task-shoes',
    title: 'Buy new running shoes',
    projectId: trainingProject.id,
    now: ago(2 * DAY_MS),
  });
  shoesTask.start(ago(2 * DAY_MS));
  await deps.tasks.save(shoesTask);

  // One captured idea.
  await deps.ideas.save(
    Idea.create({
      id: 'seed-idea-trail',
      content: 'Try a trail race this autumn',
      now: ago(3 * DAY_MS),
    }),
  );

  // The gear budget is fully allocated to the training project and consumed
  // past the 90% exhaustion threshold.

  const gearBudget = Resource.create({
    id: 'seed-resource-gear',
    typeId: 'seed-resourcetype-budget',
    kind: 'quantity',
    name: 'Gear budget',
    amount: 1000,
    now: ago(4 * DAY_MS),
  });
  gearBudget.allocate(
    { id: 'seed-allocation-gear', projectId: trainingProject.id, amount: 1000 },
    ago(4 * DAY_MS),
  );
  await deps.resources.save(gearBudget);

  await deps.consumeResource.consume({
    recordId: 'seed-record-consume-gear',
    relationId: 'seed-relation-consume-gear',
    resourceId: gearBudget.id,
    projectId: trainingProject.id,
    amount: 920,
    now: ago(6 * HOUR_MS),
  });

  // Recent activity, newest first.
  const records: [string, string, string, Date][] = [
    ['seed-record-task-completed', 'taskCompleted', 'Completed "Long run 14 km"', ago(2 * HOUR_MS)],
    ['seed-record-task-created', 'taskCreated', 'Created "Easy run 8 km"', ago(5 * HOUR_MS)],
    ['seed-record-goal-failed', 'goalFailed', 'Failed "Ship Becoming MVP"', ago(DAY_MS)],
    ['seed-record-task-started', 'taskStarted', 'Started "Buy new running shoes"', ago(2 * DAY_MS)],
    ['seed-record-idea-captured', 'ideaCaptured', 'Captured "Try a trail race this autumn"', ago(3 * DAY_MS)],
    ['seed-record-goal-created', 'goalCreated', 'Created "Run a half marathon"', ago(5 * DAY_MS)],
  ];
  for (const [id, kind, detail, occurredAt] of records) {
    await deps.records.append(Record.create({ id, kind, detail, occurredAt }));
  }
}
