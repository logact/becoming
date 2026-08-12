import {
  archiveWorkflow,
  createWorkflow,
  createWorkflowVersion,
  publishWorkflow,
  updateWorkflowDraft,
  validateWorkflow,
} from '../src/domain/workflow';
import { SqliteWorkflowRepository } from '../src/persistence/workflowRepository';
import {
  closeQuietly,
  createTestDatabase,
} from './helpers/testDatabase';

describe('workflow domain model', () => {
  it('creates a Workflow with fresh id, timestamps, and version 1 by default', () => {
    const workflow = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });

    expect(workflow.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(workflow.version).toBe(1);
    expect(workflow.createdAt).toBe(workflow.updatedAt);
    expect(workflow.archivedAt).toBeNull();
    expect(workflow.description).toBeNull();
    expect(workflow.purpose).toBeNull();
    expect(workflow.entryCriteria).toBeNull();
    expect(workflow.exitCriteria).toBeNull();
    expect(() => validateWorkflow(workflow)).not.toThrow();
  });

  it('keeps explicit optional fields and version', () => {
    const workflow = createWorkflow({
      title: 'Project Management',
      workflowType: 'project_management',
      description: 'Manages software projects',
      purpose: 'Coordinate delivery',
      version: 3,
      entryCriteria: 'Project approved',
      exitCriteria: 'Project closed',
    });

    expect(workflow.description).toBe('Manages software projects');
    expect(workflow.purpose).toBe('Coordinate delivery');
    expect(workflow.version).toBe(3);
    expect(workflow.entryCriteria).toBe('Project approved');
    expect(workflow.exitCriteria).toBe('Project closed');
  });

  it('rejects a blank title or workflow type', () => {
    expect(() =>
      createWorkflow({ title: '  ', workflowType: 'task_execution' }),
    ).toThrow(/title/);
    expect(() =>
      createWorkflow({ title: 'Task Execution', workflowType: '' }),
    ).toThrow(/workflowType/);
  });

  it('rejects non-positive or non-integer versions', () => {
    for (const version of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        createWorkflow({
          title: 'Task Execution',
          workflowType: 'task_execution',
          version,
        }),
      ).toThrow(/version/);
    }
  });

  it('archives without mutating the original and bumps updatedAt', () => {
    const workflow = createWorkflow({
      title: 'Idea Triage',
      workflowType: 'idea_triage',
    });
    const archived = archiveWorkflow(workflow, '2026-08-12T12:00:00.000Z');

    expect(workflow.archivedAt).toBeNull();
    expect(archived.id).toBe(workflow.id);
    expect(archived.archivedAt).toBe('2026-08-12T12:00:00.000Z');
    expect(archived.updatedAt).toBe('2026-08-12T12:00:00.000Z');
  });

  it('rejects archiving an already archived Workflow', () => {
    const archived = archiveWorkflow(
      createWorkflow({ title: 'Idea Triage', workflowType: 'idea_triage' }),
    );
    expect(() => archiveWorkflow(archived)).toThrow(/already archived/);
  });
});

describe('workflow version publishing and lineage', () => {
  it('creates root drafts with no lineage and no publish timestamp', () => {
    const workflow = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });

    expect(workflow.supersedesId).toBeNull();
    expect(workflow.publishedAt).toBeNull();
  });

  it('publishes a draft without mutating it and bumps updatedAt', () => {
    const draft = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });
    const published = publishWorkflow(draft, '2026-08-12T12:00:00.000Z');

    expect(draft.publishedAt).toBeNull();
    expect(published.id).toBe(draft.id);
    expect(published.publishedAt).toBe('2026-08-12T12:00:00.000Z');
    expect(published.updatedAt).toBe('2026-08-12T12:00:00.000Z');
  });

  it('rejects re-publishing and publishing an archived Workflow', () => {
    const published = publishWorkflow(
      createWorkflow({ title: 'Task Execution', workflowType: 'task_execution' }),
    );
    expect(() => publishWorkflow(published)).toThrow(/already published/);

    const archived = archiveWorkflow(
      createWorkflow({ title: 'Idea Triage', workflowType: 'idea_triage' }),
    );
    expect(() => publishWorkflow(archived)).toThrow(/archived/);
  });

  it('creates a successor draft with explicit lineage and version + 1', () => {
    const published = publishWorkflow(
      createWorkflow({
        title: 'Task Execution',
        workflowType: 'task_execution',
        description: 'Standard task lifecycle',
        purpose: 'Execute tasks',
        entryCriteria: 'Task ready',
        exitCriteria: 'Task done',
      }),
    );
    const successor = createWorkflowVersion(published);

    expect(successor.id).not.toBe(published.id);
    expect(successor.version).toBe(published.version + 1);
    expect(successor.supersedesId).toBe(published.id);
    expect(successor.publishedAt).toBeNull();
    expect(successor.archivedAt).toBeNull();
    expect(successor.title).toBe(published.title);
    expect(successor.description).toBe(published.description);
    expect(successor.purpose).toBe(published.purpose);
    expect(successor.entryCriteria).toBe(published.entryCriteria);
    expect(successor.exitCriteria).toBe(published.exitCriteria);
  });

  it('applies overrides when creating a successor and validates them', () => {
    const published = publishWorkflow(
      createWorkflow({
        title: 'Task Execution',
        workflowType: 'task_execution',
      }),
    );
    const successor = createWorkflowVersion(published, {
      title: 'Task Execution v2',
      description: 'Revised',
      exitCriteria: null,
    });

    expect(successor.title).toBe('Task Execution v2');
    expect(successor.description).toBe('Revised');
    expect(successor.exitCriteria).toBeNull();
    expect(() =>
      createWorkflowVersion(published, { title: '  ' }),
    ).toThrow(/title/);
  });

  it('rejects successors of an unpublished draft', () => {
    const draft = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });
    expect(() => createWorkflowVersion(draft)).toThrow(/not published/);
  });

  it('edits a draft without mutating it, but never a published or archived one', () => {
    const draft = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });
    const edited = updateWorkflowDraft(
      draft,
      { description: 'Now documented' },
      '2026-08-12T12:00:00.000Z',
    );

    expect(draft.description).toBeNull();
    expect(edited.id).toBe(draft.id);
    expect(edited.version).toBe(draft.version);
    expect(edited.description).toBe('Now documented');
    expect(edited.updatedAt).toBe('2026-08-12T12:00:00.000Z');

    const published = publishWorkflow(draft);
    expect(() =>
      updateWorkflowDraft(published, { title: 'New title' }),
    ).toThrow(/immutable/);

    const archived = archiveWorkflow(draft);
    expect(() =>
      updateWorkflowDraft(archived, { title: 'New title' }),
    ).toThrow(/archived/);
  });
});

describe('WorkflowRepository contract', () => {
  it('round-trips a Workflow with every field preserved', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const workflow = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
      description: 'Standard task lifecycle',
      purpose: 'Execute tasks',
      version: 2,
      entryCriteria: 'Task ready',
      exitCriteria: 'Task done',
    });

    await repository.add(workflow);
    const loaded = await repository.getById(workflow.id);

    expect(loaded).toEqual(workflow);
    await closeQuietly(db);
  });

  it('round-trips omitted optional fields as null', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const workflow = createWorkflow({
      title: 'Goal Execution',
      workflowType: 'goal_execution',
    });

    await repository.add(workflow);
    const loaded = await repository.getById(workflow.id);

    expect(loaded).toEqual(workflow);
    expect(loaded?.description).toBeNull();
    expect(loaded?.archivedAt).toBeNull();
    await closeQuietly(db);
  });

  it('returns null for an unknown id', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);

    expect(await repository.getById('no-such-workflow')).toBeNull();
    await closeQuietly(db);
  });

  it('rejects a duplicate id on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const workflow = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });

    await repository.add(workflow);
    await expect(repository.add(workflow)).rejects.toThrow();
    await closeQuietly(db);
  });

  it('rejects an invalid aggregate on add', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const invalid = {
      ...createWorkflow({
        title: 'Task Execution',
        workflowType: 'task_execution',
      }),
      version: 0,
    };

    await expect(repository.add(invalid)).rejects.toThrow(/version/);
    expect(await repository.getById(invalid.id)).toBeNull();
    await closeQuietly(db);
  });

  it('persists archival through save and keeps it resolvable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const workflow = createWorkflow({
      title: 'Project Management',
      workflowType: 'project_management',
    });
    await repository.add(workflow);

    const archived = archiveWorkflow(workflow, '2026-08-12T12:00:00.000Z');
    await repository.save(archived);

    expect(await repository.getById(workflow.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('rejects saving an unknown Workflow', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const workflow = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });

    await expect(repository.save(workflow)).rejects.toThrow(/unknown/);
    await closeQuietly(db);
  });
});

describe('WorkflowRepository version immutability', () => {
  it('persists a publish and a draft edit through save', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const draft = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });
    await repository.add(draft);

    const edited = updateWorkflowDraft(draft, {
      description: 'Documented before publish',
    });
    await repository.save(edited);
    expect(await repository.getById(draft.id)).toEqual(edited);

    const published = publishWorkflow(edited, '2026-08-12T12:00:00.000Z');
    await repository.save(published);
    expect(await repository.getById(draft.id)).toEqual(published);
    await closeQuietly(db);
  });

  it('rejects definition changes to a published version but allows archival', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const published = publishWorkflow(
      createWorkflow({
        title: 'Task Execution',
        workflowType: 'task_execution',
      }),
    );
    await repository.add(published);

    await expect(
      repository.save({ ...published, title: 'Rewritten title' }),
    ).rejects.toThrow(/immutable/);
    await expect(
      repository.save({ ...published, exitCriteria: 'New criteria' }),
    ).rejects.toThrow(/immutable/);
    expect(await repository.getById(published.id)).toEqual(published);

    const archived = archiveWorkflow(published, '2026-08-12T13:00:00.000Z');
    await repository.save(archived);
    expect(await repository.getById(published.id)).toEqual(archived);
    await closeQuietly(db);
  });

  it('rejects version, lineage, and identity rewrites even on drafts', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);
    const draft = createWorkflow({
      title: 'Task Execution',
      workflowType: 'task_execution',
    });
    await repository.add(draft);

    await expect(
      repository.save({ ...draft, version: draft.version + 1 }),
    ).rejects.toThrow(/immutable/);
    await expect(
      repository.save({ ...draft, supersedesId: 'some-other-workflow' }),
    ).rejects.toThrow(/immutable/);
    await expect(
      repository.save({ ...draft, createdAt: '2000-01-01T00:00:00.000Z' }),
    ).rejects.toThrow(/immutable/);
    expect(await repository.getById(draft.id)).toEqual(draft);
    await closeQuietly(db);
  });

  it('persists a published lineage chain that stays resolvable', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteWorkflowRepository(db);

    const v1 = publishWorkflow(
      createWorkflow({
        title: 'Task Execution',
        workflowType: 'task_execution',
      }),
      '2026-08-12T12:00:00.000Z',
    );
    await repository.add(v1);

    const v2 = publishWorkflow(
      createWorkflowVersion(v1, { title: 'Task Execution v2' }),
      '2026-08-12T13:00:00.000Z',
    );
    await repository.add(v2);

    const loadedV2 = await repository.getById(v2.id);
    expect(loadedV2?.version).toBe(2);
    expect(loadedV2?.supersedesId).toBe(v1.id);
    expect(loadedV2?.publishedAt).toBe('2026-08-12T13:00:00.000Z');

    // The superseded version remains intact and historically resolvable.
    const loadedV1 = await repository.getById(v1.id);
    expect(loadedV1).toEqual(v1);
    await closeQuietly(db);
  });
});
