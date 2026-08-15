import type {
  DecompositionWorkflowGuidanceResolver,
  DecompositionWorkflowGuidanceResolution,
} from '../../domain/decompositionPolicy';
import {
  WorkflowApplicabilityAmbiguousError,
  WorkflowApplicabilityArchivedError,
  WorkflowApplicabilityIncompatibleError,
  WorkflowApplicabilityMissingError,
} from '../../application/workflowApplicabilityService';
import type { WorkflowApplicabilityService } from '../../application/workflowApplicabilityService';
import type { SqliteDatabase } from '../../persistence/database';

/**
 * Adapt the Project-scoped workflow applicability read to the decomposition
 * guidance port. Guidance is resolved against the parent endpoint's entity
 * type (Goal -> child and Task -> Task edges are governed by the parent's
 * applicable workflow); the applicability service's typed failures map to
 * the guidance resolution statuses, and anything else propagates.
 */
export function workflowApplicabilityGuidanceResolver(
  applicability: WorkflowApplicabilityService<SqliteDatabase>,
): DecompositionWorkflowGuidanceResolver {
  return {
    async resolve(query): Promise<DecompositionWorkflowGuidanceResolution> {
      try {
        const resolved = await applicability.resolve({
          projectId: query.projectId,
          entityType: query.parentType,
          purpose: query.purpose,
          labelId: query.managementLabelId,
          version: query.version,
        });
        return { status: 'resolved', workflowId: resolved.workflowId, version: resolved.version };
      } catch (error) {
        if (error instanceof WorkflowApplicabilityMissingError) return { status: 'missing' };
        if (error instanceof WorkflowApplicabilityArchivedError) return { status: 'archived' };
        if (error instanceof WorkflowApplicabilityAmbiguousError) return { status: 'ambiguous' };
        if (error instanceof WorkflowApplicabilityIncompatibleError) {
          return { status: 'incompatible', reason: error.message };
        }
        throw error;
      }
    },
  };
}
