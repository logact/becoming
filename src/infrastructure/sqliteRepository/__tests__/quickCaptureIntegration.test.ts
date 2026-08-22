import { QuickCaptureService } from '../../../application/capture/QuickCaptureService';
import { CAPTURE_RECORD_KIND } from '../../../application/capture/captureRecordKinds';
import { Goal } from '../../../domain/goal/Goal';
import { Project } from '../../../domain/project/Project';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { NodeSqliteDatabase } from '../NodeSqliteDatabase';
import { SqliteGoalRepository } from '../SqliteGoalRepository';
import { SqliteIdeaRepository } from '../SqliteIdeaRepository';
import { SqliteNoteRepository } from '../SqliteNoteRepository';
import { SqliteProjectRepository } from '../SqliteProjectRepository';
import { SqliteRecordRepository } from '../SqliteRecordRepository';
import { SqliteRelationRepository } from '../SqliteRelationRepository';
import { SqliteTaskRepository } from '../SqliteTaskRepository';
import { SqliteTransactionRunner } from '../SqliteTransactionRunner';
import { migrate } from '../schema';

const now = new Date('2026-08-22T10:00:00Z');

async function makeKit() {
  const db = new NodeSqliteDatabase(':memory:');
  await migrate(db);
  const ideas = new SqliteIdeaRepository(db);
  const goals = new SqliteGoalRepository(db);
  const tasks = new SqliteTaskRepository(db);
  const notes = new SqliteNoteRepository(db);
  const projects = new SqliteProjectRepository(db);
  const records = new SqliteRecordRepository(db);
  const relations = new SqliteRelationRepository(db);
  const transactionRunner = new SqliteTransactionRunner(db);
  const service = new QuickCaptureService(
    ideas, goals, tasks, notes, projects, records, relations, transactionRunner,
  );
  return { service, ideas, goals, tasks, notes, projects, records, relations, transactionRunner };
}

describe('QuickCaptureService SQLite integration', () => {
  it('round-trips all four entity types, Task Project context, and target activity', async () => {
    const kit = await makeKit();
    await kit.goals.save(Goal.create({ id: 'project-goal', title: 'Project goal', now }));
    await kit.projects.save(Project.create({
      id: 'project-1', name: 'Project one', goalId: 'project-goal', now,
    }));

    await kit.service.capture({
      intent: 'inbox', entityId: 'idea-1', content: '  Inbox thought  ',
      recordId: 'record-idea', recordRelationId: 'relation-idea', now,
    });
    await kit.service.capture({
      intent: 'goal', entityId: 'goal-1', content: '  New goal  ',
      recordId: 'record-goal', recordRelationId: 'relation-goal', now,
    });
    await kit.service.capture({
      intent: 'task', entityId: 'task-1', projectId: 'project-1', content: '  Next task  ',
      recordId: 'record-task', recordRelationId: 'relation-task', now,
    });
    await kit.service.capture({
      intent: 'note', entityId: 'note-1', content: '  Durable note  ',
      recordId: 'record-note', recordRelationId: 'relation-note', now,
    });

    expect(await kit.ideas.findById('idea-1')).toMatchObject({
      content: 'Inbox thought', status: 'captured',
    });
    expect(await kit.goals.findById('goal-1')).toMatchObject({
      title: 'New goal', status: 'todo', projectId: undefined, parentGoalId: undefined,
    });
    expect(await kit.tasks.findById('task-1')).toMatchObject({
      title: 'Next task', status: 'todo', projectId: 'project-1',
    });
    expect(await kit.notes.findById('note-1')).toMatchObject({
      content: 'Durable note', archived: false, pinnedAt: null,
    });

    const targets = [
      ['idea', 'idea-1', CAPTURE_RECORD_KIND.quickCapturedIdea],
      ['goal', 'goal-1', CAPTURE_RECORD_KIND.quickCapturedGoal],
      ['task', 'task-1', CAPTURE_RECORD_KIND.quickCapturedTask],
      ['note', 'note-1', CAPTURE_RECORD_KIND.quickCapturedNote],
    ] as const;
    for (const [targetType, targetId, kind] of targets) {
      expect(await kit.records.listByTarget(targetType, 10, targetId)).toEqual([
        expect.objectContaining({ kind, occurredAt: now }),
      ]);
      expect(await kit.relations.list({ targetType, targetId, kind: 'logs' }))
        .toHaveLength(1);
    }
  });

  it('rolls back an entity and activity Record after a late Relation failure', async () => {
    const kit = await makeKit();
    const failingRelations: RelationRepository = {
      save: async () => { throw new Error('late relation failure'); },
      findById: (id) => kit.relations.findById(id),
      list: (filter) => kit.relations.list(filter),
      delete: (id) => kit.relations.delete(id),
    };
    const service = new QuickCaptureService(
      kit.ideas,
      kit.goals,
      kit.tasks,
      kit.notes,
      kit.projects,
      kit.records,
      failingRelations,
      kit.transactionRunner,
    );

    await expect(service.capture({
      intent: 'goal', entityId: 'goal-rollback', content: 'Rollback goal',
      recordId: 'record-rollback', recordRelationId: 'relation-rollback', now,
    })).rejects.toThrow('late relation failure');

    expect(await kit.goals.findById('goal-rollback')).toBeNull();
    expect(await kit.records.listRecent(10)).toEqual([]);
    expect(await kit.relations.list()).toEqual([]);
  });
});
