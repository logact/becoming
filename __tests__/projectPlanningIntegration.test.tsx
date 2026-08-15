import { fireEvent, screen } from '@testing-library/react-native';

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

async function openProjectsTab() {
  fireEvent.press(await screen.findByLabelText('Projects tab'));
  await screen.findByText('Where intent becomes work');
}

describe('Project planning flow (integration through the real shell and services)', () => {
  it('create -> list -> detail -> edit -> archive -> archived history', async () => {
    renderPlanningApp(harness.services);
    await openProjectsTab();

    // Create through the sheet; the list refreshes immediately.
    fireEvent.press(screen.getByLabelText('New project'));
    fireEvent.changeText(await screen.findByLabelText('Project title'), 'Becoming for iOS');
    fireEvent.changeText(screen.getByLabelText('Project purpose'), 'Deliver the M2 planning loop');
    fireEvent.changeText(screen.getByLabelText('Project description'), 'Native planning UI.');
    fireEvent.press(screen.getByLabelText('Save new project'));
    await expectTransientToast('Project created');
    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();

    // Edit through the detail; the detail and list both refresh.
    fireEvent.press(screen.getByLabelText('Open project Becoming for iOS'));
    fireEvent.press(await screen.findByLabelText('Edit project'));
    fireEvent.changeText(
      await screen.findByLabelText('Project purpose'),
      'Deliver the M2 native planning loop',
    );
    fireEvent.press(screen.getByLabelText('Save project changes'));
    await expectTransientToast('Project updated');
    expect((await screen.findAllByText('Deliver the M2 native planning loop')).length)
      .toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('Back to projects'));
    expect(await screen.findByText('Deliver the M2 native planning loop')).toBeTruthy();

    // Confirmed archive removes the Project from Active and keeps it inspectable.
    fireEvent.press(screen.getByLabelText('Open project Becoming for iOS'));
    fireEvent.press(await screen.findByLabelText('Archive project'));
    fireEvent.press(await screen.findByLabelText('Confirm archive'));
    await expectTransientToast('Project archived');

    fireEvent.press(screen.getByLabelText('Back to projects'));
    expect(await screen.findByText('No projects yet')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Show archived projects'));
    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();
    expect(screen.queryByLabelText('New project')).toBeNull();

    // Archived detail is read-only and keeps the persisted activity.
    fireEvent.press(screen.getByLabelText('Open project Becoming for iOS'));
    expect(await screen.findByLabelText('Archived')).toBeTruthy();
    expect(screen.queryByLabelText('Edit project')).toBeNull();
    expect(screen.queryByLabelText('Archive project')).toBeNull();
    expect(screen.getByText('Project created')).toBeTruthy();
    expect(screen.getByText('Project updated')).toBeTruthy();
    expect(screen.getByText('Project archived')).toBeTruthy();
  }, 15000);

  it('preserves the draft and shows inline feedback when validation fails', async () => {
    renderPlanningApp(harness.services);
    await openProjectsTab();

    fireEvent.press(screen.getByLabelText('New project'));
    fireEvent.changeText(await screen.findByLabelText('Project purpose'), 'A kept draft');
    fireEvent.press(screen.getByLabelText('Save new project'));

    expect(await screen.findByText('Enter a title for this Project.')).toBeTruthy();
    // The entered purpose is preserved after the rejected submit.
    expect(screen.getByDisplayValue('A kept draft')).toBeTruthy();
    expect(await harness.services.projects.listActiveProjects()).toHaveLength(0);

    fireEvent.changeText(screen.getByLabelText('Project title'), 'Becoming for iOS');
    fireEvent.press(screen.getByLabelText('Save new project'));
    await expectTransientToast('Project created');
    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();
  });

  it('cancel leaves the Project unchanged', async () => {
    renderPlanningApp(harness.services);
    await openProjectsTab();

    fireEvent.press(screen.getByLabelText('New project'));
    fireEvent.changeText(await screen.findByLabelText('Project title'), 'Discarded draft');
    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(await screen.findByText('No projects yet')).toBeTruthy();
    expect(await harness.services.projects.listProjectHistory()).toHaveLength(0);
  });

  it('shows form feedback when the mutation fails and keeps the draft', async () => {
    const services = {
      ...harness.services,
      projects: overrideServiceMethod(
        harness.services.projects,
        'createProject',
        async () => {
          throw new Error('The write failed.');
        },
      ),
    };
    renderPlanningApp(services);
    await openProjectsTab();

    fireEvent.press(screen.getByLabelText('New project'));
    fireEvent.changeText(await screen.findByLabelText('Project title'), 'Becoming for iOS');
    fireEvent.press(screen.getByLabelText('Save new project'));

    expect(await screen.findByText('The write failed.')).toBeTruthy();
    expect(screen.getByDisplayValue('Becoming for iOS')).toBeTruthy();
  });

  it('a fresh services instance over the same database reconstructs the same values', async () => {
    const project = await harness.services.projects.createProject({
      actor: 'test',
      title: 'Becoming for iOS',
      purpose: 'Deliver the M2 planning loop',
      description: 'Native planning UI.',
    });

    const first = renderPlanningApp(harness.services);
    await openProjectsTab();
    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();
    first.unmount();

    // Simulate an application reload: a new service graph reads the same
    // persisted SQLite records — no in-memory UI state carries over.
    const reloadedServices = composeAppServices(harness.db);
    const second = renderPlanningApp(reloadedServices);
    await openProjectsTab();

    expect(await screen.findByText('Becoming for iOS')).toBeTruthy();
    expect(screen.getByText('Deliver the M2 planning loop')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open project Becoming for iOS'));
    expect(await screen.findByText('Execution context')).toBeTruthy();
    expect(screen.getByText('Project created')).toBeTruthy();

    const persisted = await reloadedServices.projects.getProject(project.id);
    expect(persisted).toMatchObject({
      title: 'Becoming for iOS',
      purpose: 'Deliver the M2 planning loop',
      description: 'Native planning UI.',
    });
    second.unmount();
  });
});
