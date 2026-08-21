import React from 'react';

import { useAppServices } from './composition/AppServicesProvider';
import type { ShellDestination } from './navigation/NavigationShell';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { AttentionPinPage } from './pages/dashboard/AttentionPinPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { GoalDetailPage } from './pages/goals/GoalDetailPage';
import { GoalsPage } from './pages/goals/GoalsPage';
import { LibraryPage } from './pages/library/LibraryPage';
import { AddPlanItemPage } from './pages/projects/AddPlanItemPage';
import { AllocateResourcePage } from './pages/projects/AllocateResourcePage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { TaskDetailPage } from './pages/tasks/TaskDetailPage';
import { TasksPage } from './pages/tasks/TasksPage';

/** Library list: the hub, fed by the composed read service. */
function LibraryListPage() {
  const services = useAppServices();
  return <LibraryPage overview={services.libraryOverview} />;
}

/** Goals screen, pushed from the Library hub's Goals row. */
function LibraryGoalsScreen() {
  const services = useAppServices();
  return <GoalsPage overview={services.goalsOverview} />;
}

/** Projects screen, pushed from the Library hub's Projects row. */
function LibraryProjectsScreen() {
  const services = useAppServices();
  return <ProjectsPage overview={services.projectsOverview} />;
}

function LibraryTasksScreen() {
  const services = useAppServices();
  return <TasksPage overview={services.tasksOverview} />;
}

function LibraryTaskDetailScreen({ taskId }: { taskId: string }) {
  const services = useAppServices();
  return <TaskDetailPage taskId={taskId} detail={services.taskDetail} lifecycle={services.taskLifecycle} />;
}

/** Library detail: a single goal, pushed via the shell's renderDetail. */
function LibraryGoalDetailPage({ goalId }: { goalId: string }) {
  const services = useAppServices();
  return <GoalDetailPage goalId={goalId} detail={services.goalDetail} />;
}

/**
 * Project screens, pushed as `project:<id>` plus the
 * `project:<id>:add-plan-item[:parent=<goalId>][:tab=<tab>]` and
 * `project:<id>:allocate-resource` screens (the projectId and the optional
 * add-plan-item params are parsed from the screenId).
 */
function LibraryProjectScreen({ screenId }: { screenId: string }) {
  const services = useAppServices();
  const rest = screenId.slice('project:'.length);
  if (rest.includes(':add-plan-item')) {
    const [projectId, rawParams = ''] = rest.split(':add-plan-item');
    const params = new Map(
      rawParams
        .split(':')
        .filter((segment) => segment !== '')
        .map((segment) => segment.split('=') as [string, string]),
    );
    const parent = params.get('parent');
    const tab = params.get('tab');
    return (
      <AddPlanItemPage
        projectId={projectId}
        detail={services.projectDetail}
        addSubGoal={services.addSubGoal}
        addTask={services.addTask}
        addMilestone={services.addMilestone}
        {...(parent === undefined ? {} : { initialParentGoalId: parent })}
        {...(tab === 'subgoal' || tab === 'task' || tab === 'milestone'
          ? { initialTab: tab }
          : {})}
      />
    );
  }
  if (rest.endsWith(':allocate-resource')) {
    return (
      <AllocateResourcePage
        projectId={rest.slice(0, -':allocate-resource'.length)}
        detail={services.projectDetail}
        resourcePools={services.resourcePools}
        allocateResource={services.allocateResource}
      />
    );
  }
  return <ProjectDetailPage projectId={rest} detail={services.projectDetail} />;
}

/**
 * Top-level destinations of the app shell. The dashboard renders its real
 * page and the "Pin to attention" pushed screen; Library renders its hub,
 * pushes the goals and projects screens from their rows, project detail as
 * the `project:<id>` screen (with the add-plan-item and allocate-resource
 * screens behind it), and goal detail on top; Setting still renders
 * PlaceholderPage until its task lands.
 */
export function appDestinations(): ShellDestination[] {
  return [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'grid',
      renderList: () => <DashboardPage />,
      renderScreen: (screenId) => (screenId === 'attention-pin' ? <AttentionPinPage /> : null),
    },
    {
      id: 'library',
      title: 'Library',
      icon: 'folder',
      renderList: () => <LibraryListPage />,
      renderScreen: (screenId) =>
        screenId === 'goals' ? (
          <LibraryGoalsScreen />
        ) : screenId === 'tasks' ? (
          <LibraryTasksScreen />
        ) : screenId === 'projects' ? (
          <LibraryProjectsScreen />
        ) : screenId.startsWith('project:') ? (
          <LibraryProjectScreen screenId={screenId} />
        ) : screenId.startsWith('task:') ? (
          <LibraryTaskDetailScreen taskId={screenId.slice('task:'.length)} />
        ) : null,
      renderDetail: (entityId) => <LibraryGoalDetailPage goalId={entityId} />,
    },
    {
      id: 'setting',
      title: 'Setting',
      icon: 'gear',
      renderList: () => <PlaceholderPage title="Setting" />,
    },
  ];
}
