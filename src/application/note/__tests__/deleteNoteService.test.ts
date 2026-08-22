import { Note } from '../../../domain/note/Note';
import { makeFakeRepos } from '../../__tests__/fakes';
import { DeleteNoteService } from '../DeleteNoteService';

const now = new Date('2026-08-22T08:00:00Z');

describe('DeleteNoteService', () => {
  it('deletes an existing Note and rejects an unknown id', async () => {
    const repos = await makeFakeRepos();
    await repos.noteRepo.save(Note.create({ id: 'note-1', content: 'Delete me', now }));
    const service = new DeleteNoteService(repos.noteRepo, repos.transactionRunner);

    await service.delete('note-1');
    expect(await repos.noteRepo.findById('note-1')).toBeNull();
    await expect(service.delete('missing')).rejects.toThrow('Unknown note: missing');
  });
});
