import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { Idea } from '../../../domain/idea/Idea';
import { appDestinations } from '../../appDestinations';
import { NavigationShell } from '../../navigation/NavigationShell';
import { ToastProvider } from '../../shared/Toast';
import { AppServicesProvider, type AppServices } from '../AppServicesProvider';

describe('Ideas navigation composition', () => {
  it('wires Library → Ideas → Idea detail through the composed service contract', async () => {
    const now = new Date('2026-08-22T08:00:00Z');
    const idea = Idea.create({ id: 'idea-1', content: 'Composed idea', now });
    const services = {
      libraryOverview: { getCounts: jest.fn(async () => ({ goals: 0, tasks: 0, projects: 0, ideas: 1, notes: 0, resources: 0 })) },
      ideasOverview: { getOverview: jest.fn(async () => ({
        counts: { open: 1, handled: 0 },
        open: { captured: [{ id: idea.id, content: idea.content, status: idea.status, labelIds: [], updatedAt: now }], exploring: [], paused: [] },
        handled: [], recentActivity: [],
      })) },
      ideaDetail: { getDetail: jest.fn(async () => ({ idea, labels: [], derivedItems: [], recentActivity: [] })) },
      ideaDerivationOptions: { getOptions: jest.fn(async () => []) },
      captureIdea: { capture: jest.fn(async () => undefined) },
      editIdea: { edit: jest.fn(async () => undefined) },
      changeIdeaStatus: { change: jest.fn(async () => undefined) },
      createGoalFromIdea: { create: jest.fn(async () => undefined) },
      createTaskFromIdea: { create: jest.fn(async () => undefined) },
      extractNoteFromIdea: { extract: jest.fn(async () => undefined) },
    } as unknown as AppServices;
    const library = appDestinations().find((destination) => destination.id === 'library');
    if (library === undefined) throw new Error('Library destination missing');

    render(
      <ToastProvider>
        <AppServicesProvider services={services}>
          <NavigationShell destinations={[library]} />
        </AppServicesProvider>
      </ToastProvider>,
    );

    fireEvent.press(await screen.findByTestId('library-row-ideas'));
    expect(await screen.findByTestId('ideas-page')).toBeTruthy();
    fireEvent.press(await screen.findByTestId('idea-row-idea-1'));
    expect(await screen.findByTestId('idea-detail-page')).toBeTruthy();
    expect(screen.getByText('Composed idea')).toBeTruthy();
    expect(services.ideasOverview.getOverview).toHaveBeenCalled();
    expect(services.ideaDetail.getDetail).toHaveBeenCalledWith('idea-1');
  });
});
