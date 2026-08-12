import {
  archiveWorkflow,
  createWorkflow,
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
