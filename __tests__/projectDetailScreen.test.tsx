import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import type { Project } from '../src/domain/project';
import type { AppServices } from '../src/ui/composition/appServices';
import type { CreateProjectCommand } from '../src/application/projectService';
import { NavigationShell } from '../src/ui/navigation/NavigationShell';
import { useShellNavigation } from '../src/ui/navigation/NavigationShell';
import { ProjectDetailScreen } from '../src/ui/projects/ProjectDetailScreen';
import { ToastProvider } from '../src/ui/shared/Toast';
import { closeUiTestHarness, createUiTestHarness, renderWithServices } from './helpers/uiTestHarness';
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

function seedProject(command: Partial<CreateProjectCommand> = {}): Promise<Project> {
  return harness.services.projects.createProject({
    actor: 'test',
    title: 'Becoming for iOS',
    ...command,
  });
}

async function openDetail(title: string) {
  fireEvent.press(await screen.findByLabelText(`Open project ${title}`));
  await screen.findByText('Execution context');
}

describe('ProjectDetailScreen', () => {
  it('renders header, facts, empty sections, and persisted activity', async () => {
    await seedProject({
      purpose: 'Deliver the M2 planning loop',
      description: 'Native planning UI for Epic #3.',
    });
    renderProjectsApp(harness.services);
    await openDetail('Becoming for iOS');

    expect(screen.getByText('Becoming for iOS')).toBeTruthy();
    expect(screen.getByText('Deliver the M2 planning loop')).toBeTruthy();
    expect(screen.getByLabelText('Active project')).toBeTruthy();
    // Fact labels and section headers share these names.
    expect(screen.getAllByText('Pursued goals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Member tasks').length).toBeGreaterThan(0);
    expect(screen.getByText('No pursued Goals')).toBeTruthy();
    expect(screen.getByText('Connect a Goal to explain why this Project exists.')).toBeTruthy();
    expect(screen.getByText('No member Tasks')).toBeTruthy();
    expect(screen.getByText('Recent activity')).toBeTruthy();
    expect(screen.getByText('Project created')).toBeTruthy();
    expect(screen.getByLabelText('Edit project')).toBeTruthy();
    expect(screen.getByLabelText('Archive project')).toBeTruthy();
  });

  it('falls back to description, then to explicit copy when no purpose exists', async () => {
    await seedProject({ description: 'Only a description.' });
    await seedProject({ title: 'Bare project' });
    renderProjectsApp(harness.services);

    await openDetail('Becoming for iOS');
    expect(screen.getAllByText('Only a description.').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('Back to projects'));
    await openDetail('Bare project');
    expect(screen.getAllByText('No purpose defined yet').length).toBeGreaterThan(0);
  });

  it('switches segments and shows labeled placeholder panes for Structure and Progress', async () => {
    await seedProject();
    renderProjectsApp(harness.services);
    await openDetail('Becoming for iOS');

    // Overview is the default segment.
    expect(screen.getByText('No pursued Goals')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Show structure'));
    expect(await screen.findByText('Structure arrives with the decomposition task')).toBeTruthy();
    expect(screen.queryByText('No pursued Goals')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show progress'));
    expect(await screen.findByText('Progress arrives with the execution task')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Show overview'));
    expect(await screen.findByText('No pursued Goals')).toBeTruthy();
  });

  it('exposes stable segment slots that later tasks inject content through', async () => {
    await seedProject();
    renderProjectsApp(harness.services, {
      renderStructure: ({ project }) => <Text>{`Structure slot for ${project.title}`}</Text>,
      renderProgress: ({ project }) => <Text>{`Progress slot for ${project.title}`}</Text>,
    });
    await openDetail('Becoming for iOS');

    fireEvent.press(screen.getByLabelText('Show structure'));
    expect(await screen.findByText('Structure slot for Becoming for iOS')).toBeTruthy();
    expect(screen.queryByText('Structure arrives with the decomposition task')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show progress'));
    expect(await screen.findByText('Progress slot for Becoming for iOS')).toBeTruthy();
  });

  it('lists pursued Goals and member Tasks read-only with navigation affordances', async () => {
    const project = await seedProject();
    const goal = await harness.services.goals.createGoal({
      actor: 'test',
      title: 'Run a marathon',
      targetState: 'Finish 42 km',
    });
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goal.id,
      actor: 'test',
    });
    const task = await harness.services.tasks.createTask({
      actor: 'test',
      title: 'Wire Goal pursuit',
      targetDescription: 'Relationships can be added and removed',
      priority: 2,
    });
    await harness.services.taskMembership.startMembership({
      taskId: task.id,
      projectId: project.id,
      actor: 'test',
    });

    renderProjectsApp(harness.services);
    await openDetail('Becoming for iOS');

    expect(screen.getByLabelText('Open goal Run a marathon')).toBeTruthy();
    expect(screen.getByText('Finish 42 km')).toBeTruthy();
    expect(screen.getByLabelText('Open task Wire Goal pursuit')).toBeTruthy();
    expect(screen.getByLabelText('P2')).toBeTruthy();
    // Facts reflect the query results.
    expect(screen.getAllByText('Pursued goals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Member tasks').length).toBeGreaterThan(0);
    // Overview owns no membership or hierarchy mutation action.
    expect(screen.queryByLabelText('Remove task from project')).toBeNull();
  });

  it('renders archived Projects read-only: no edit, archive, or pursuit actions', async () => {
    const project = await seedProject();
    await harness.services.projects.archiveProject({ id: project.id, actor: 'test' });

    renderProjectsApp(harness.services);
    fireEvent.press(await screen.findByLabelText('Show archived projects'));
    fireEvent.press(await screen.findByLabelText('Open project Becoming for iOS'));
    await screen.findByText('Execution context');

    expect(screen.getByLabelText('Archived')).toBeTruthy();
    expect(screen.getByText('Project archived')).toBeTruthy();
    expect(screen.queryByLabelText('Edit project')).toBeNull();
    expect(screen.queryByLabelText('Archive project')).toBeNull();
    expect(screen.queryByLabelText('Add pursued goals')).toBeNull();
  });

  it('shows a recoverable error state when the query fails and retries', async () => {
    const project = await seedProject();
    let calls = 0;
    const services: AppServices = {
      ...harness.services,
      projects: overrideServiceMethod(harness.services.projects, 'getProject', async (id) => {
        if (id === project.id) {
          calls += 1;
          if (calls === 1) throw new Error('The query failed.');
        }
        return harness.services.projects.getProject(id);
      }),
    };
    renderProjectsApp(services);
    fireEvent.press(await screen.findByLabelText('Open project Becoming for iOS'));

    expect(await screen.findByText('Project unavailable')).toBeTruthy();
    expect(screen.getByText('The query failed.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading project'));
    expect(await screen.findByText('Execution context')).toBeTruthy();
  });

  it('shows an explicit not-found state for a missing Project', async () => {
    function MissingOpener() {
      const navigation = useShellNavigation();
      useEffect(() => {
        navigation.openDetail('missing-project');
      }, [navigation]);
      return null;
    }
    renderWithServices(
      <ToastProvider>
        <NavigationShell
          destinations={[{
            id: 'projects',
            title: 'Projects',
            icon: '▦',
            renderList: () => <MissingOpener />,
            renderDetail: (entityId) => <ProjectDetailScreen entityId={entityId} />,
          }]}
        />
      </ToastProvider>,
      harness.services,
    );

    expect(await screen.findByText('Project unavailable')).toBeTruthy();
    expect(
      screen.getByText('This Project could not be found. It may have been removed.'),
    ).toBeTruthy();
  });
});
