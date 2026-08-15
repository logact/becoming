import type { DecompositionEndpointType } from '../domain/decompositionPolicy';
import type { Goal, NewGoal } from '../domain/goal';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { Relation } from '../domain/relation';
import type { NewTask, Task } from '../domain/task';
import type {
  CreateDecompositionCommand,
  DecompositionMutationResult,
  DecompositionService,
} from './decompositionService';
import type { GoalService } from './goalService';
import type { TaskProjectMembershipService } from './taskProjectMembershipService';
import type { TaskService } from './taskService';
import type { UnitOfWork } from './unitOfWork';

interface CreateStructureChildBase {
  projectId: EntityId;
  parentType: DecompositionEndpointType;
  parentId: EntityId;
  managementLabelId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface CreateGoalStructureChildCommand extends CreateStructureChildBase {
  goal: NewGoal;
}

export interface CreateTaskStructureChildCommand extends CreateStructureChildBase {
  task: NewTask;
}

export interface CreatedGoalStructureChild {
  goal: Goal;
  decomposition: DecompositionMutationResult;
}

export interface CreatedTaskStructureChild {
  task: Task;
  membership: Relation;
  decomposition: DecompositionMutationResult;
}

export interface ProjectStructureCreationServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  /** Services bound to the already-open compound mutation context. */
  goals: (context: TContext) => Pick<GoalService<TContext>, 'createGoal'>;
  tasks: (context: TContext) => Pick<TaskService<TContext>, 'createTask'>;
  memberships: (
    context: TContext,
  ) => Pick<TaskProjectMembershipService<TContext>, 'startMembership'>;
  decompositions: (context: TContext) => Pick<DecompositionService<TContext>, 'create'>;
  guidance: {
    ensure(
      context: TContext,
      projectId: EntityId,
      requestedLabelId: EntityId,
      actor: string,
      occurredAt?: IsoTimestamp,
    ): Promise<EntityId>;
  };
}

/**
 * Creates a new Goal or Task directly beneath an existing Project Structure
 * node. The entity, required Task membership, decomposition edge, and all
 * provenance records share one outer unit of work, so a rejected edge cannot
 * leave behind an orphan entity or partial Project context.
 */
export class ProjectStructureCreationService<TContext> {
  constructor(private readonly ports: ProjectStructureCreationServicePorts<TContext>) {}

  async createGoalChild(
    command: CreateGoalStructureChildCommand,
  ): Promise<CreatedGoalStructureChild> {
    return this.ports.unitOfWork.run(async (context) => {
      const managementLabelId = await this.ensureGuidance(context, command);
      const goal = await this.ports.goals(context).createGoal({
        ...command.goal,
        actor: command.actor,
        occurredAt: command.occurredAt,
      });
      const decomposition = await this.ports.decompositions(context).create({
        projectId: command.projectId,
        parentType: command.parentType,
        parentId: command.parentId,
        childType: 'goal',
        childId: goal.id,
        managementLabelId,
        actor: command.actor,
        occurredAt: command.occurredAt,
      });
      return { goal, decomposition };
    });
  }

  async createTaskChild(
    command: CreateTaskStructureChildCommand,
  ): Promise<CreatedTaskStructureChild> {
    return this.ports.unitOfWork.run(async (context) => {
      const managementLabelId = await this.ensureGuidance(context, command);
      const task = await this.ports.tasks(context).createTask({
        ...command.task,
        actor: command.actor,
        occurredAt: command.occurredAt,
      });
      const membership = await this.ports.memberships(context).startMembership({
        taskId: task.id,
        projectId: command.projectId,
        actor: command.actor,
        occurredAt: command.occurredAt,
      });
      const decomposition = await this.ports.decompositions(context).create({
        projectId: command.projectId,
        parentType: command.parentType,
        parentId: command.parentId,
        childType: 'task',
        childId: task.id,
        managementLabelId,
        actor: command.actor,
        occurredAt: command.occurredAt,
      });
      return { task, membership, decomposition };
    });
  }

  /** Attach an already-defined Goal or Task through the same default-guidance path. */
  async attachExistingChild(command: CreateDecompositionCommand): Promise<DecompositionMutationResult> {
    return this.ports.unitOfWork.run(async (context) => {
      const managementLabelId = await this.ensureGuidance(context, command);
      return this.ports.decompositions(context).create({ ...command, managementLabelId });
    });
  }

  private ensureGuidance(
    context: TContext,
    command: Pick<CreateStructureChildBase, 'projectId' | 'managementLabelId' | 'actor' | 'occurredAt'>,
  ): Promise<EntityId> {
    return this.ports.guidance.ensure(
      context,
      command.projectId,
      command.managementLabelId,
      command.actor,
      command.occurredAt,
    );
  }
}
