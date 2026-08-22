import type { ProjectStatus } from '../../domain/project/Project';
import type { ProjectRepository } from '../../domain/project/repository/ProjectRepository';
import type { ProjectId } from '../../domain/shared/ids';

export interface CaptureProjectOption {
  id: ProjectId;
  name: string;
  status: ProjectStatus;
}

export interface CaptureOptions {
  projects: CaptureProjectOption[];
}

function statusRank(status: ProjectStatus): number {
  if (status === 'active') return 0;
  if (status === 'planning' || status === 'paused') return 1;
  return 2;
}

/** Read model for the Project context required by quick-captured Tasks. */
export class CaptureOptionsService {
  constructor(private readonly projects: ProjectRepository) {}

  async getOptions(): Promise<CaptureOptions> {
    const projects = await this.projects.list({ archived: false });
    projects.sort((left, right) =>
      statusRank(left.status) - statusRank(right.status)
      || right.updatedAt.getTime() - left.updatedAt.getTime()
      || left.id.localeCompare(right.id));

    return {
      projects: projects.map(({ id, name, status }) => ({ id, name, status })),
    };
  }
}
