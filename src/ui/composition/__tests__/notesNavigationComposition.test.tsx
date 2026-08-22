import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { Idea } from '../../../domain/idea/Idea';
import { Note } from '../../../domain/note/Note';
import { appDestinations } from '../../appDestinations';
import { NavigationShell } from '../../navigation/NavigationShell';
import { ToastProvider } from '../../shared/Toast';
import { AppServicesProvider, type AppServices } from '../AppServicesProvider';

const now = new Date('2026-08-22T08:00:00Z');

function servicesFixture() {
  const idea = Idea.create({ id: 'idea-1', content: 'Turn reviews into notes', now });
  const note = Note.create({ id: 'note-1', content: 'A composed note', now });
  return {
    libraryOverview: { getCounts: jest.fn(async () => ({ goals: 0, tasks: 0, projects: 0, ideas: 1, notes: 1, resources: 0 })) },
    notesOverview: { getOverview: jest.fn(async () => ({
      counts: { active: 1, archived: 0 },
      pinned: [], active: [{ id: note.id, content: note.content, pinnedAt: null, labels: [], updatedAt: now }], archived: [], recentActivity: [],
    })) },
    captureNote: { capture: jest.fn(async () => undefined) },
    noteDetail: { getDetail: jest.fn(async (noteId: string) => ({
      note: Note.create({ id: noteId, content: noteId === 'note-1' ? note.content : 'Extracted note', now }),
      labels: [], source: null, links: [], recentActivity: [],
    })) },
    editNote: { edit: jest.fn(async () => undefined) },
    setNotePin: { setPinned: jest.fn(async () => undefined) },
    archiveNote: { setArchived: jest.fn(async () => undefined) },
    linkNote: { link: jest.fn(async () => undefined) },
    noteLinkOptions: { getOptions: jest.fn(async () => []) },
    deleteNote: { delete: jest.fn(async () => undefined) },
    ideasOverview: { getOverview: jest.fn(async () => ({
      counts: { open: 1, handled: 0 },
      open: { captured: [{ id: idea.id, content: idea.content, status: idea.status, labelIds: [], updatedAt: now }], exploring: [], paused: [] },
      handled: [], recentActivity: [],
    })) },
    ideaDerivationOptions: { getOptions: jest.fn(async () => []) },
    captureIdea: { capture: jest.fn(async () => undefined) },
    createGoalFromIdea: { create: jest.fn(async () => undefined) },
    createTaskFromIdea: { create: jest.fn(async () => undefined) },
    extractNoteFromIdea: { extract: jest.fn(async () => undefined) },
  } as unknown as AppServices;
}

function renderLibrary(services: AppServices) {
  const library = appDestinations().find((destination) => destination.id === 'library');
  if (library === undefined) throw new Error('Library destination missing');
  render(
    <ToastProvider>
      <AppServicesProvider services={services}>
        <NavigationShell destinations={[library]} />
      </AppServicesProvider>
    </ToastProvider>,
  );
}

describe('Notes navigation composition', () => {
  it('wires Library → Notes → Note detail through composed service contracts', async () => {
    const services = servicesFixture();
    renderLibrary(services);

    fireEvent.press(await screen.findByTestId('library-row-notes'));
    expect(await screen.findByTestId('notes-page')).toBeTruthy();
    fireEvent.press(await screen.findByTestId('note-row-note-1'));
    expect(await screen.findByTestId('note-detail-page')).toBeTruthy();
    expect(screen.getByText('A composed note')).toBeTruthy();
    expect(services.notesOverview.getOverview).toHaveBeenCalled();
    expect(services.noteDetail.getDetail).toHaveBeenCalledWith('note-1');
  });

  it('keeps Create from Idea Note extraction and opens the registered note:<id> route', async () => {
    const services = servicesFixture();
    renderLibrary(services);

    fireEvent.press(await screen.findByTestId('library-row-ideas'));
    fireEvent.press(await screen.findByTestId('idea-quick-create-idea-1'));
    fireEvent.press(screen.getByTestId('create-choice-note'));
    fireEvent.changeText(screen.getByTestId('create-note-content'), 'Extracted from composition');
    fireEvent.press(screen.getByTestId('create-from-submit'));

    await waitFor(() => expect(services.extractNoteFromIdea.extract).toHaveBeenCalledWith(expect.objectContaining({
      ideaId: 'idea-1', content: 'Extracted from composition', noteId: expect.any(String),
    })));
    expect(await screen.findByTestId('note-detail-page')).toBeTruthy();
    expect(await screen.findByText('Extracted note')).toBeTruthy();
    expect(services.noteDetail.getDetail).toHaveBeenCalledWith(expect.any(String));
  });
});
