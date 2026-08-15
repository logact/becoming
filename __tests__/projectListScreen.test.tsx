import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Project } from '../src/domain/project';
import type { AppServices } from '../src/ui/composition/appServices';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { overrideServiceMethod } from './helpers/goalScreenHarness';
import { renderProjectsApp } from './helpers/projectScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function seedProject(overrides: Partial<{ title: string; purpose: string }> = {}): Promise<Project> {
  return harness.services.projects.createProject({
    actor: 'test',
    title: overrides.title ?? 'Becoming for iOS',
    purpose: overrides.purpose ?? 'Deliver the M2 planning loop',
  });
}

async function seedMemberTask(projectId: string): Promise<void> {
  const task = await harness.services.tasks.createTask({
    actor: 'test',
    title: 'Wire Goal pursuit',
    targetDescription: 'Relationships can be added and removed',
  });
  await harness.services.taskMembership.startMembership({
    taskId: task.id,
    projectId,
    actor: 'test',
  });
}

describe('ProjectListScreen', () => {
  it('shows the loading state while the query runs', () => {
    const services: AppServices = {
      ...harness.services,
      projects: overrideServiceMethod(
        harness.services.projects,
        'listActiveProjects',
        () => new Promise<Project[]>(() => undefined),
      ),
    };
    renderProjectsApp(services);
    expect(screen.getByLabelText('Loading projects')).toBeTruthy();
    expect(screen.queryByLabelText('New project')).toBeNull();
  });

  it('shows a recoverable error state and retries successfully', async () => {
    let calls = 0;
    const services: AppServices = {
      ...harness.services,
      projects: overrideServiceMethod(harness.services.projects, 'listActiveProjects', async () => {
        calls += 1;
        if (calls === 1) throw new Error('The query failed.');
        return harness.services.projects.listActiveProjects();
      }),
    };
    renderProjectsApp(services);

    expect(await screen.findByText('Projects unavailable')).toBeTruthy();
    expect(screen.getByText('The query failed.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading projects'));
    expect(await screen.findByText('No projects yet')).toBeTruthy();
  });

  it('renders the explicit empty state with an active-only create action', async () => {
    renderProjectsApp(harness.services);
    expect(await screen.findByText('No projects yet')).toBeTruthy();
    expect(screen.getByText('Organize effort toward a Goal.')).toBeTruthy();
    expect(screen.getByLabelText('New project')).toBeTruthy();
  });

  it('renders populated rows with purpose and task-count context', async () => {
    await seedProject({ title: 'Becoming for iOS', purpose: 'Deliver the M2 planning loop' });
    await seedProject({ title: 'Marathon plan', purpose: 'Structure the training' });
    renderProjectsApp(harness.services);

    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();
    expect(screen.getByText('Deliver the M2 planning loop')).toBeTruthy();
    expect(screen.getByText('Marathon plan')).toBeTruthy();
    expect(screen.getAllByLabelText('0 tasks')).toHaveLength(2);
  });

  it('shows the member-Task count from the membership query on active rows', async () => {
    const project = await seedProject();
    await seedMemberTask(project.id);
    renderProjectsApp(harness.services);

    expect(await screen.findByLabelText('1 task')).toBeTruthy();
    expect(screen.queryByLabelText('0 tasks')).toBeNull();
  });

  it('filters rows by title search without changing persisted data', async () => {
    await seedProject({ title: 'Becoming for iOS' });
    await seedProject({ title: 'Marathon plan' });
    const before = await harness.services.projects.listProjectHistory();

    renderProjectsApp(harness.services);
    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Search projects'), 'marathon');
    await waitFor(() => {
      expect(screen.queryByText('Becoming for iOS')).toBeNull();
    });
    expect(screen.getByText('Marathon plan')).toBeTruthy();

    const after = await harness.services.projects.listProjectHistory();
    expect(after).toEqual(before);
  });

  it('shows an explicit no-match state for searches with no results', async () => {
    await seedProject();
    renderProjectsApp(harness.services);
    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Search projects'), 'triathlon');
    expect(await screen.findByText('No matching projects')).toBeTruthy();
    expect(screen.getByText('Try a different search.')).toBeTruthy();
  });

  it('separates Active and Archived projects and hides create on Archived', async () => {
    const active = await seedProject({ title: 'Stay active' });
    const archived = await seedProject({ title: 'Old effort' });
    await harness.services.projects.archiveProject({ id: archived.id, actor: 'test' });

    renderProjectsApp(harness.services);
    expect(await screen.findByText('Stay active')).toBeTruthy();
    expect(screen.queryByText('Old effort')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show archived projects'));
    expect(await screen.findByText('Old effort')).toBeTruthy();
    expect(screen.getByLabelText('Archived')).toBeTruthy();
    expect(screen.queryByText('Stay active')).toBeNull();
    expect(screen.queryByLabelText('New project')).toBeNull();

    // The active Project itself remains active.
    expect((await harness.services.projects.getProject(active.id))?.archivedAt).toBeNull();
  });

  it('shows an explicit empty state on the Archived filter', async () => {
    renderProjectsApp(harness.services);
    fireEvent.press(screen.getByLabelText('Show archived projects'));
    expect(await screen.findByText('No archived projects')).toBeTruthy();
    expect(screen.getByText('Archived Projects remain inspectable here.')).toBeTruthy();
  });
});
