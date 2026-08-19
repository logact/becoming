import { Milestone } from '../../domain/milestone/Milestone';
import type { MilestoneRepository } from '../../domain/milestone/repository/MilestoneRepository';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import { DomainError } from '../../domain/shared/errors';
import type { MilestoneId, ProjectId } from '../../domain/shared/ids';

/** Use case: add a dated milestone to a project. */
export class AddMilestoneService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly milestones: MilestoneRepository,
  ) {}

  async add(params: {
    id: MilestoneId;
    projectId: ProjectId;
    title: string;
    date: Date;
    now: Date;
  }): Promise<void> {
    const project = await this.projects.findById(params.projectId);
    if (project === null) {
      throw new DomainError(`Unknown project: ${params.projectId}`);
    }

    await this.milestones.save(
      Milestone.create({
        id: params.id,
        title: params.title,
        date: params.date,
        projectId: params.projectId,
        now: params.now,
      }),
    );
  }
}
