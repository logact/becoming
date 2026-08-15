import { createLabel } from '../../src/domain/label';
import { createWorkflow } from '../../src/domain/workflow';
import { createWorkflowState } from '../../src/domain/workflowState';
import { WORKFLOW_APPLICABILITY_RELATION_TYPE } from '../../src/application/workflowApplicabilityService';
import { DECOMPOSITION_MANAGEMENT_LABEL_ID } from '../../src/ui/projects/structure/structureTree';
import { SqliteLabelRepository } from '../../src/persistence/labelRepository';
import { SqliteRelationRepository } from '../../src/persistence/relationRepository';
import { SqliteWorkflowRepository } from '../../src/persistence/workflowRepository';
import { SqliteWorkflowStateRepository } from '../../src/persistence/workflowStateRepository';
import type { SqliteDatabase } from '../../src/persistence/database';

const NOW = '2026-08-14T00:00:00.000Z';

/**
 * Seed the workflow guidance the real DecompositionService requires before it
 * commits an edge: one active management label (the id the structure UI
 * passes), one 'decompose' Workflow holding Goal and Task state machines, and
 * Project-scoped applicability relations for both parent entity types. Tests
 * that exercise committed decomposition mutations need this; without it the
 * service correctly rejects with workflow-guidance feedback.
 */
export async function seedDecompositionGuidance(
  db: SqliteDatabase,
  projectId: string,
  labelId: string = DECOMPOSITION_MANAGEMENT_LABEL_ID,
): Promise<void> {
  const label = createLabel({ name: 'Management' });
  await new SqliteLabelRepository(db).add({
    ...label,
    id: labelId,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const workflow = createWorkflow({
    title: 'Decomposition workflow',
    workflowType: 'execution',
    purpose: 'decompose',
    version: 1,
  });
  await new SqliteWorkflowRepository(db).add(workflow);
  const states = new SqliteWorkflowStateRepository(db);
  await states.add(
    createWorkflowState(
      { workflowId: workflow.id, entityType: 'goal', labelId, title: 'Ready', isInitial: true },
      { id: `guidance-state-goal-${projectId}`, now: NOW },
    ),
  );
  await states.add(
    createWorkflowState(
      { workflowId: workflow.id, entityType: 'task', labelId, title: 'Ready', isInitial: true },
      { id: `guidance-state-task-${projectId}`, now: NOW },
    ),
  );
  const relations = new SqliteRelationRepository(db);
  for (const entityType of ['goal', 'task'] as const) {
    await relations.add({
      id: `guidance-applicability-${entityType}-${projectId}`,
      sourceType: 'project',
      sourceId: projectId,
      relationType: WORKFLOW_APPLICABILITY_RELATION_TYPE,
      targetType: 'workflow',
      targetId: workflow.id,
      metadata: { entityType, purpose: 'decompose', labelId, workflowVersion: 1 },
      createdAt: NOW,
      endedAt: null,
    });
  }
}
