// DEV ONLY — remove once creation flows exist. Seeds a prototype-like dataset
// so the dashboard is visibly alive on first launch.
import type { ConsumeResourceService } from '../../application/resource/ConsumeResourceService';
import { Goal } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import { Idea } from '../../domain/idea/Idea';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Milestone } from '../../domain/milestone/Milestone';
import type { MilestoneRepository } from '../../domain/milestone/repository/MilestoneRepository';
import { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
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
  relations: RelationRepository;
  milestones: MilestoneRepository;
  consumeResource: ConsumeResourceService;
}

/**
 * Inserts the prototype-like dataset: doing goals/tasks (one task overdue),
 * a failed goal, a captured idea, and an active project with a due, three
 * milestones, a nested sub-goal tree whose tasks carry goalId/milestoneId,
 * a quantity resource allocated in full and consumed past the exhaustion
 * threshold, and a time resource allocated as a span. Ids are deterministic;
 * all dates are relative to now. Callers must only run this on an empty
 * database (composeServices guards on goals).
 */
export async function seedDevData(deps: DevSeedDeps): Promise<void> {
  const now = new Date();
  const ago = (ms: number): Date => new Date(now.getTime() - ms);
  /** A future date at an exact hour/minute (time spans need minute precision). */
  const atTime = (daysFromNow: number, hour: number, minute: number): Date => {
    const date = new Date(now.getTime() + daysFromNow * DAY_MS);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

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

  // Active project serving the running goal; created five weeks ago and due
  // in ten, so the detail header reads "Week 6 of 15".
  const trainingProject = Project.create({
    id: 'seed-project-training',
    name: 'Spring training plan',
    goalId: runGoal.id,
    due: new Date(now.getTime() + 70 * DAY_MS),
    now: ago(35 * DAY_MS),
  });
  trainingProject.activate(ago(35 * DAY_MS));
  await deps.projects.save(trainingProject);

  // Milestones anchoring the plan phases: one reached, two upcoming.
  const baseMilestone = Milestone.create({
    id: 'seed-milestone-base',
    title: 'Base phase',
    date: ago(14 * DAY_MS),
    projectId: trainingProject.id,
    now: ago(30 * DAY_MS),
  });
  await deps.milestones.save(baseMilestone);

  const midMilestone = Milestone.create({
    id: 'seed-milestone-mid',
    title: 'Mid-plan test',
    date: new Date(now.getTime() + 21 * DAY_MS),
    projectId: trainingProject.id,
    now: ago(20 * DAY_MS),
  });
  await deps.milestones.save(midMilestone);

  const raceMilestone = Milestone.create({
    id: 'seed-milestone-race',
    title: 'Race week',
    date: new Date(now.getTime() + 70 * DAY_MS),
    projectId: trainingProject.id,
    now: ago(20 * DAY_MS),
  });
  await deps.milestones.save(raceMilestone);

  // Sub-goals of the plan tree; threshold endurance nests under the 10 km goal.
  const fiveKGoal = Goal.create({
    id: 'seed-subgoal-5k',
    title: '5 km under 24:00',
    projectId: trainingProject.id,
    milestoneId: baseMilestone.id,
    now: ago(30 * DAY_MS),
  });
  fiveKGoal.start(ago(30 * DAY_MS));
  fiveKGoal.complete(ago(15 * DAY_MS));
  await deps.goals.save(fiveKGoal);

  const tenKGoal = Goal.create({
    id: 'seed-subgoal-10k',
    title: '10 km under 50:00',
    projectId: trainingProject.id,
    milestoneId: midMilestone.id,
    now: ago(20 * DAY_MS),
  });
  tenKGoal.start(ago(20 * DAY_MS));
  await deps.goals.save(tenKGoal);

  const thresholdGoal = Goal.create({
    id: 'seed-subgoal-threshold',
    title: 'Threshold endurance',
    projectId: trainingProject.id,
    parentGoalId: tenKGoal.id,
    milestoneId: midMilestone.id,
    now: ago(10 * DAY_MS),
  });
  await deps.goals.save(thresholdGoal);

  const raceDayGoal = Goal.create({
    id: 'seed-subgoal-race-day',
    title: 'Race day: finish under 1:55',
    projectId: trainingProject.id,
    milestoneId: raceMilestone.id,
    now: ago(10 * DAY_MS),
  });
  await deps.goals.save(raceDayGoal);

  // Tasks: two doing; the easy run was due an hour ago, so it shows overdue.
  const easyRunTask = Task.create({
    id: 'seed-task-easy-run',
    title: 'Easy run 8 km',
    due: ago(HOUR_MS),
    projectId: trainingProject.id,
    goalId: tenKGoal.id,
    now: ago(5 * HOUR_MS),
  });
  easyRunTask.start(ago(5 * HOUR_MS));
  await deps.tasks.save(easyRunTask);

  // Root-level task: no goal, so it sits directly under the plan tree root.
  const shoesTask = Task.create({
    id: 'seed-task-shoes',
    title: 'Buy new running shoes',
    projectId: trainingProject.id,
    now: ago(2 * DAY_MS),
  });
  shoesTask.start(ago(2 * DAY_MS));
  await deps.tasks.save(shoesTask);

  const baseRunTask = Task.create({
    id: 'seed-task-base-run',
    title: 'Base run 8 km',
    projectId: trainingProject.id,
    goalId: fiveKGoal.id,
    now: ago(16 * DAY_MS),
  });
  baseRunTask.start(ago(16 * DAY_MS));
  baseRunTask.complete(ago(15 * DAY_MS));
  await deps.tasks.save(baseRunTask);

  await deps.tasks.save(
    Task.create({
      id: 'seed-task-tempo-run',
      title: 'Tempo run 6 km',
      projectId: trainingProject.id,
      goalId: tenKGoal.id,
      now: ago(3 * DAY_MS),
    }),
  );

  const lactateTask = Task.create({
    id: 'seed-task-lactate',
    title: 'Lactate test 3 km',
    projectId: trainingProject.id,
    goalId: thresholdGoal.id,
    now: ago(9 * DAY_MS),
  });
  lactateTask.start(ago(9 * DAY_MS));
  lactateTask.complete(ago(8 * DAY_MS));
  await deps.tasks.save(lactateTask);

  await deps.tasks.save(
    Task.create({
      id: 'seed-task-cruise',
      title: 'Cruise intervals 4 × 1600 m',
      projectId: trainingProject.id,
      goalId: thresholdGoal.id,
      milestoneId: midMilestone.id,
      now: ago(3 * DAY_MS),
    }),
  );

  await deps.tasks.save(
    Task.create({
      id: 'seed-task-long-run',
      title: 'Long run 16 km',
      projectId: trainingProject.id,
      goalId: raceDayGoal.id,
      milestoneId: raceMilestone.id,
      now: ago(3 * DAY_MS),
    }),
  );

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

  // A time resource allocated to the training project as a span (tomorrow
  // 6:30–9:30, 3 h of the 10 h pool); the project detail shows its duration.
  const focusTime = Resource.create({
    id: 'seed-resource-focus-time',
    typeId: 'seed-resourcetype-time',
    kind: 'time',
    name: 'Weekly focus time',
    amount: 600,
    now: ago(4 * DAY_MS),
  });
  focusTime.allocate(
    {
      id: 'seed-allocation-focus-time',
      projectId: trainingProject.id,
      span: { startAt: atTime(1, 6, 30), endAt: atTime(1, 9, 30) },
    },
    ago(4 * DAY_MS),
  );
  await deps.resources.save(focusTime);

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
  const taskRecordTargets: Array<[string, string]> = [
    ['seed-record-task-completed', 'seed-task-base-run'],
    ['seed-record-task-created', 'seed-task-easy-run'],
    ['seed-record-task-started', 'seed-task-shoes'],
  ];
  for (const [recordId, taskId] of taskRecordTargets) {
    await deps.relations.save(Relation.create({
      id: `seed-relation-${recordId}`,
      sourceType: 'record',
      sourceId: recordId,
      targetType: 'task',
      targetId: taskId,
      kind: 'logs',
      now,
    }));
  }
}
