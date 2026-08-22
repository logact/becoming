import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type {
  GoalId,
  ProjectId,
  RecordId,
  RelationId,
} from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';

export const PROJECT_ACTIVATED_RECORD_KIND = 'projectActivated';

export interface SelectCurrentPlanCommand {
  goalId: GoalId;
  selectedProjectId: ProjectId;
  recordId: RecordId;
  goalRecordRelationId: RelationId;
  projectRecordRelationId: RelationId;
  now: Date;
}

/** Atomically makes an eligible Project the Goal's single current plan. */
export class SelectCurrentPlanService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly projects: ProjectRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  select(command: SelectCurrentPlanCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const goal = await this.goals.findById(command.goalId);
      if (goal === null) throw new DomainError(`Unknown goal: ${command.goalId}`);
      if (goal.archived) {
        throw new DomainError(`Cannot select a plan for archived goal: ${command.goalId}`);
      }

      const selected = await this.projects.findById(command.selectedProjectId);
      if (selected === null) {
        throw new DomainError(`Unknown project: ${command.selectedProjectId}`);
      }
      if (selected.archived) {
        throw new DomainError(`Cannot select archived project: ${command.selectedProjectId}`);
      }
      if (selected.goalId !== goal.id) {
        throw new DomainError('Project does not belong to this goal');
      }
      if (selected.status === 'active') {
        throw new DomainError(`Project is already the current plan: ${command.selectedProjectId}`);
      }
      if (selected.status === 'done' || selected.status === 'failed') {
        throw new DomainError(`Cannot select Project from ${selected.status}`);
      }

      // Deliberately omit an archived filter: even an archived active Project
      // must be paused before another plan becomes active.
      const currentActive = (
        await this.projects.list({ goalId: goal.id, status: 'active' })
      )[0];

      goal.activateProject(selected, currentActive, command.now);

      if (currentActive !== undefined) await this.projects.save(currentActive);
      await this.projects.save(selected);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: PROJECT_ACTIVATED_RECORD_KIND,
        detail: this.activityDetail(selected, currentActive),
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.goalRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'goal',
        targetId: command.goalId,
        kind: 'logs',
        now: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.projectRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'project',
        targetId: command.selectedProjectId,
        kind: 'logs',
        now: command.now,
      }));
    });
  }

  private activityDetail(selected: Project, replaced: Project | undefined): string {
    if (replaced === undefined) return `Selected Project “${selected.name}” as current plan`;
    return `Selected Project “${selected.name}” as current plan, replacing “${replaced.name}”`;
  }
}
