import { fireEvent, screen } from '@testing-library/react-native';

import type { Project } from '../src/domain/project';
import type { Task } from '../src/domain/task';
import { composeAppServices } from '../src/ui/composition/appServices';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { expectTransientToast, overrideServiceMethod } from './helpers/goalScreenHarness';
import { renderPlanningApp } from './helpers/projectScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function seedTask(title: string): Promise<Task> {
  return harness.services.tasks.createTask({
    actor: 'test',
    title,
    targetDescription: `Target for ${title}`,
  });
}

function seedProject(title: string): Promise<Project> {
  return harness.services.projects.createProject({ actor: 'test', title });
}

async function openTaskDetail(title: string) {
  fireEvent.press(screen.getByLabelText('Tasks tab'));
  fireEvent.press(await screen.findByLabelText(`Open task ${title}`));
  await screen.findByText('Executable work');
}

async function openProjectDetail(title: string) {
  fireEvent.press(screen.getByLabelText('Projects tab'));
  fireEvent.press(await screen.findByLabelText(`Open project ${title}`));
  await screen.findByText('Execution context');
}

describe('Task membership — Task context', () => {
  it('adds an unassigned Task to a Project and refreshes every affected view', async () => {
    const task = await seedTask('Draft the launch checklist');
    const project = await seedProject('Beta rollout');
    renderPlanningApp(harness.services);
    await openTaskDetail('Draft the launch checklist');
    expect(screen.getByText('No membership')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add task to a project'));
    fireEvent.press(await screen.findByLabelText('Choose Beta rollout'));
    await expectTransientToast('Added to Project');

    // Task detail refreshes: Project fact, membership row, persisted activity.
    expect((await screen.findAllByText('Beta rollout')).length).toBeGreaterThan(0);
    expect(screen.getByText('Actively executing in this Project')).toBeTruthy();
    expect(screen.getByText('Added to a Project')).toBeTruthy();
    expect(screen.getByLabelText('Remove task from project')).toBeTruthy();

    // The committed relation is persisted through the membership service.
    const memberships = await harness.services.taskMembershipQueries.listActiveProjectsForTask(task.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].projectId).toBe(project.id);

    // Project Overview refreshes: member count and row.
    await openProjectDetail('Beta rollout');
    expect(await screen.findByText('Draft the launch checklist')).toBeTruthy();
    expect(screen.getByText('Target for Draft the launch checklist')).toBeTruthy();
  });

  it('keeps archived Projects visible with a rejection and cancellation commits nothing', async () => {
    const task = await seedTask('Draft the launch checklist');
    const archived = await seedProject('Old effort');
    await harness.services.projects.archiveProject({ id: archived.id, actor: 'test' });
    await seedProject('Beta rollout');

    renderPlanningApp(harness.services);
    await openTaskDetail('Draft the launch checklist');

    fireEvent.press(screen.getByLabelText('Add task to a project'));
    expect(
      await screen.findByLabelText('Old effort, unavailable: Archived endpoint'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Choose Beta rollout')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Close Add to a Project'));
    expect(await screen.findByText('No membership')).toBeTruthy();
    expect(
      await harness.services.taskMembershipQueries.listActiveProjectsForTask(task.id),
    ).toHaveLength(0);
  });

  it('shows the rejection sheet on commit-time failure and succeeds on retry', async () => {
    const task = await seedTask('Draft the launch checklist');
    await seedProject('Beta rollout');
    let attempts = 0;
    const services = {
      ...harness.services,
      taskMembership: overrideServiceMethod(
        harness.services.taskMembership,
        'startMembership',
        async (command: Parameters<typeof harness.services.taskMembership.startMembership>[0]) => {
          attempts += 1;
          if (attempts === 1) {
            throw Object.assign(new Error('duplicate'), {
              name: 'DuplicateActiveTaskProjectMembershipError',
              existing: { sourceId: command.taskId, targetId: command.projectId, id: 'x' },
            });
          }
          return harness.services.taskMembership.startMembership(command);
        },
      ),
    };

    renderPlanningApp(services);
    await openTaskDetail('Draft the launch checklist');
    fireEvent.press(screen.getByLabelText('Add task to a project'));
    fireEvent.press(await screen.findByLabelText('Choose Beta rollout'));

    expect(await screen.findByText('Change not allowed')).toBeTruthy();
    expect(screen.getByText('Already connected')).toBeTruthy();
    // Nothing was committed and the picker state is preserved.
    expect(
      await harness.services.taskMembershipQueries.listActiveProjectsForTask(task.id),
    ).toHaveLength(0);

    fireEvent.press(screen.getByLabelText('Try again'));
    await expectTransientToast('Added to Project');
    expect(
      await harness.services.taskMembershipQueries.listActiveProjectsForTask(task.id),
    ).toHaveLength(1);
  });

  it('removes an active membership only after confirmation and retains history', async () => {
    const task = await seedTask('Draft the launch checklist');
    const project = await seedProject('Beta rollout');
    const membership = await harness.services.taskMembership.startMembership({
      taskId: task.id,
      projectId: project.id,
      actor: 'test',
    });

    renderPlanningApp(harness.services);
    await openTaskDetail('Draft the launch checklist');

    // Cancel keeps the membership active.
    fireEvent.press(screen.getByLabelText('Remove task from project'));
    expect(
      await screen.findByText(/will no longer be an active member of/),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(
      await harness.services.taskMembershipQueries.listActiveProjectsForTask(task.id),
    ).toHaveLength(1);

    fireEvent.press(screen.getByLabelText('Remove task from project'));
    fireEvent.press(await screen.findByLabelText('Remove from Project'));
    await expectTransientToast('Removed from Project');

    // The Task is unassigned again; the activity records the end.
    expect(await screen.findByText('No membership')).toBeTruthy();
    expect(screen.getByLabelText('Add task to a project')).toBeTruthy();
    expect(
      screen.getByText('Removed from a Project; the previous membership remains in history'),
    ).toBeTruthy();
    expect(
      await harness.services.taskMembershipQueries.listActiveProjectsForTask(task.id),
    ).toHaveLength(0);

    // The ended membership, the Task, and the Project remain in history.
    const history = await harness.services.taskMembershipQueries.listTaskMembershipHistoryForTask(
      task.id,
    );
    expect(history).toHaveLength(1);
    expect(history[0].relationId).toBe(membership.id);
    expect(history[0].endedAt).not.toBeNull();
    expect((await harness.services.projects.getProject(project.id))?.archivedAt).toBeNull();

    // The Project Overview count drops after the committed end.
    await openProjectDetail('Beta rollout');
    expect(await screen.findByText('No member Tasks')).toBeTruthy();
  });
});

describe('Task membership — Project Overview context', () => {
  it('adds an existing Task from the Project Overview', async () => {
    const task = await seedTask('Draft the launch checklist');
    const project = await seedProject('Beta rollout');

    renderPlanningApp(harness.services);
    await openProjectDetail('Beta rollout');
    expect(await screen.findByText('No member Tasks')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add an existing task to this project'));
    fireEvent.press(await screen.findByLabelText('Choose Draft the launch checklist'));
    await expectTransientToast('Task added to Project');

    // Overview rows and counts refresh after the commit.
    expect(await screen.findByText('Draft the launch checklist')).toBeTruthy();
    expect(screen.getByText('Target for Draft the launch checklist')).toBeTruthy();
    const members = await harness.services.taskMembershipQueries.listActiveTasksForProject(project.id);
    expect(members).toHaveLength(1);
    expect(members[0].taskId).toBe(task.id);
  });

  it('keeps duplicate, archived, and already-belongs-to-another-Project Tasks visible', async () => {
    const member = await seedTask('Already a member');
    const elsewhere = await seedTask('Committed elsewhere');
    const archived = await seedTask('Archived work');
    await seedTask('Free task');
    const project = await seedProject('Beta rollout');
    const other = await seedProject('Other project');
    await harness.services.taskMembership.startMembership({
      taskId: member.id,
      projectId: project.id,
      actor: 'test',
    });
    await harness.services.taskMembership.startMembership({
      taskId: elsewhere.id,
      projectId: other.id,
      actor: 'test',
    });
    await harness.services.tasks.archiveTask(archived.id, 'test');

    renderPlanningApp(harness.services);
    await openProjectDetail('Beta rollout');

    fireEvent.press(screen.getByLabelText('Add an existing task to this project'));
    expect(
      await screen.findByLabelText('Already a member, unavailable: Duplicate active relationship'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Archived work, unavailable: Archived endpoint'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Committed elsewhere, unavailable: Already belongs to "Other project"'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Choose Free task')).toBeTruthy();
  });
});

describe('Task membership — persistence across reload', () => {
  it('keeps Task values and semantic memberships after services recompose over the same database', async () => {
    const task = await harness.services.tasks.createTask({
      actor: 'test',
      title: 'Draft the launch checklist',
      targetDescription: 'A reviewed launch checklist',
      description: 'Start from last quarter\'s list.',
      exitCriteria: 'Two reviewers signed off',
      priority: 5,
    });
    const project = await seedProject('Beta rollout');
    await harness.services.taskMembership.startMembership({
      taskId: task.id,
      projectId: project.id,
      actor: 'test',
    });

    // Recompose the service graph over the same database handle — the same
    // wiring an application restart performs.
    const reloaded = composeAppServices(harness.db);
    const stored = await reloaded.tasks.getTask(task.id);
    expect(stored).toMatchObject({
      title: 'Draft the launch checklist',
      targetDescription: 'A reviewed launch checklist',
      description: 'Start from last quarter\'s list.',
      exitCriteria: 'Two reviewers signed off',
      priority: 5,
    });
    const memberships = await reloaded.taskMembershipQueries.listActiveProjectsForTask(task.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].projectId).toBe(project.id);
    // No Project field is persisted on Task — membership is a relation.
    expect(stored).not.toHaveProperty('projectId');
  });
});
