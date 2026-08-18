import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { ProjectId, ResourceId } from '../../domain/shared/ids';

/**
 * Payload stored in the `detail` of a 'consumes' relation (record → resource)
 * as JSON; records how much of the resource a project has consumed.
 */
export interface ConsumptionDetail {
  projectId: ProjectId;
  amount: number;
}

export function formatConsumptionDetail(detail: ConsumptionDetail): string {
  return JSON.stringify({ projectId: detail.projectId, amount: detail.amount });
}

/** Parses a 'consumes' relation detail; returns null for missing/invalid JSON. */
export function parseConsumptionDetail(detail: string | undefined): ConsumptionDetail | null {
  if (detail === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(detail);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const { projectId, amount } = parsed as { projectId?: unknown; amount?: unknown };
    if (typeof projectId !== 'string' || typeof amount !== 'number') {
      return null;
    }
    return { projectId, amount };
  } catch {
    return null;
  }
}

/**
 * Total amount of `resourceId` consumed by `projectId`, summed over the
 * resource's 'consumes' relations whose detail names that project.
 */
export async function sumConsumedAmount(
  relations: RelationRepository,
  resourceId: ResourceId,
  projectId: ProjectId,
): Promise<number> {
  const consumes = await relations.list({
    targetType: 'resource',
    targetId: resourceId,
    kind: 'consumes',
  });
  let total = 0;
  for (const relation of consumes) {
    const detail = parseConsumptionDetail(relation.detail);
    if (detail !== null && detail.projectId === projectId) {
      total += detail.amount;
    }
  }
  return total;
}
