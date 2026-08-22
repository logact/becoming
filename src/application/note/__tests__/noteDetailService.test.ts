import { Goal } from '../../../domain/goal/Goal';
import { Idea } from '../../../domain/idea/Idea';
import { Label } from '../../../domain/label/Label';
import { Note } from '../../../domain/note/Note';
import { Project } from '../../../domain/project/Project';
import { Record } from '../../../domain/record/Record';
import { Relation } from '../../../domain/relation/Relation';
import { makeFakeRepos } from '../../__tests__/fakes';
import { NoteDetailService } from '../NoteDetailService';

const t0 = new Date('2026-08-01T00:00:00Z');

function makeService(repos: Awaited<ReturnType<typeof makeFakeRepos>>): NoteDetailService {
  return new NoteDetailService(
    repos.noteRepo, repos.labelRepo, repos.relationRepo, repos.ideaRepo,
    repos.goalRepo, repos.projectRepo, repos.recordRepo,
  );
}

describe('NoteDetailService', () => {
  it('returns an explicit empty detail for an unknown Note', async () => {
    const repos = await makeFakeRepos();

    expect(await makeService(repos).getDetail('missing')).toEqual({
      note: null, labels: [], source: null, links: [], recentActivity: [],
    });
  });

  it('resolves labels, the source Idea, Goal/Project links, and scoped activity', async () => {
    const repos = await makeFakeRepos();
    await repos.labelRepo.save(Label.create({ id: 'label-a', name: 'Method', color: '#123456' }));
    await repos.labelRepo.save(Label.create({ id: 'label-b', name: 'Later' }));
    const note = Note.create({ id: 'note-1', content: 'Review weekly', now: t0 });
    note.addLabel('label-a');
    note.addLabel('missing-label');
    note.addLabel('label-b');
    await repos.noteRepo.save(note);

    const idea = Idea.create({ id: 'idea-1', content: 'Build a review habit', now: t0 });
    await repos.ideaRepo.save(idea);
    const goal = Goal.create({ id: 'goal-1', title: 'Stay intentional', now: t0 });
    await repos.goalRepo.save(goal);
    const project = Project.create({
      id: 'project-1', name: 'Weekly system', goalId: goal.id, now: t0,
    });
    project.activate(new Date('2026-08-02T00:00:00Z'));
    await repos.projectRepo.save(project);

    await Promise.all([
      Relation.derivedFromIdea({
        id: 'source', sourceType: 'note', sourceId: note.id, ideaId: idea.id,
        now: new Date('2026-08-03T00:00:00Z'),
      }),
      Relation.create({
        id: 'goal-link', sourceType: 'note', sourceId: note.id,
        targetType: 'goal', targetId: goal.id, kind: 'relatesTo',
        now: new Date('2026-08-04T00:00:00Z'),
      }),
      Relation.create({
        id: 'project-link', sourceType: 'note', sourceId: note.id,
        targetType: 'project', targetId: project.id, kind: 'relatesTo',
        now: new Date('2026-08-05T00:00:00Z'),
      }),
    ].map((relation) => repos.relationRepo.save(relation)));

    await repos.recordRepo.append(Record.create({
      id: 'record-old', kind: 'noteCaptured', detail: 'old',
      occurredAt: new Date('2026-08-06T00:00:00Z'),
    }));
    await repos.recordRepo.append(Record.create({
      id: 'record-new', kind: 'noteEdited', detail: 'new',
      occurredAt: new Date('2026-08-07T00:00:00Z'),
    }));
    await repos.recordRepo.append(Record.create({
      id: 'record-other', kind: 'noteCaptured', occurredAt: new Date('2026-08-08T00:00:00Z'),
    }));
    await Promise.all([
      Relation.create({
        id: 'log-old', sourceType: 'record', sourceId: 'record-old',
        targetType: 'note', targetId: note.id, kind: 'logs', now: t0,
      }),
      Relation.create({
        id: 'log-new', sourceType: 'record', sourceId: 'record-new',
        targetType: 'note', targetId: note.id, kind: 'logs', now: t0,
      }),
      Relation.create({
        id: 'log-other', sourceType: 'record', sourceId: 'record-other',
        targetType: 'note', targetId: 'other-note', kind: 'logs', now: t0,
      }),
    ].map((relation) => repos.relationRepo.save(relation)));

    const detail = await makeService(repos).getDetail(note.id);

    expect(detail.note?.id).toBe(note.id);
    expect(detail.labels).toEqual([
      { id: 'label-a', name: 'Method', color: '#123456' },
      { id: 'label-b', name: 'Later' },
    ]);
    expect(detail.source).toEqual({ ideaId: idea.id, content: idea.content });
    expect(detail.links).toEqual([
      { type: 'project', id: project.id, title: project.name, status: 'active' },
      { type: 'goal', id: goal.id, title: goal.title, status: 'todo' },
    ]);
    expect(detail.recentActivity).toEqual([
      { id: 'record-new', kind: 'noteEdited', detail: 'new', occurredAt: new Date('2026-08-07T00:00:00Z') },
      { id: 'record-old', kind: 'noteCaptured', detail: 'old', occurredAt: new Date('2026-08-06T00:00:00Z') },
    ]);
  });

  it('uses note --derivedFrom--> idea direction and skips dangling or inverse relations', async () => {
    const repos = await makeFakeRepos();
    const note = Note.create({ id: 'note-1', content: 'A note', now: t0 });
    const idea = Idea.create({ id: 'idea-valid', content: 'Valid source', now: t0 });
    await repos.noteRepo.save(note);
    await repos.ideaRepo.save(idea);
    await Promise.all([
      repos.relationRepo.save(Relation.derivedFromIdea({
        id: 'valid-source', sourceType: 'note', sourceId: note.id, ideaId: idea.id, now: t0,
      })),
      repos.relationRepo.save(Relation.derivedFromIdea({
        id: 'dangling-newer', sourceType: 'note', sourceId: note.id,
        ideaId: 'missing-idea', now: new Date('2026-08-03T00:00:00Z'),
      })),
      repos.relationRepo.save(Relation.create({
        id: 'inverse', sourceType: 'idea', sourceId: idea.id,
        targetType: 'note', targetId: note.id, kind: 'derivedFrom', now: t0,
      })),
    ]);

    expect((await makeService(repos).getDetail(note.id)).source).toEqual({
      ideaId: idea.id, content: idea.content,
    });
  });

  it('skips dangling and unsupported relatesTo targets', async () => {
    const repos = await makeFakeRepos();
    const note = Note.create({ id: 'note-1', content: 'A note', now: t0 });
    await repos.noteRepo.save(note);
    await Promise.all([
      repos.relationRepo.save(Relation.create({
        id: 'missing-goal', sourceType: 'note', sourceId: note.id,
        targetType: 'goal', targetId: 'missing', kind: 'relatesTo', now: t0,
      })),
      repos.relationRepo.save(Relation.create({
        id: 'missing-project', sourceType: 'note', sourceId: note.id,
        targetType: 'project', targetId: 'missing', kind: 'relatesTo', now: t0,
      })),
      repos.relationRepo.save(Relation.create({
        id: 'unsupported', sourceType: 'note', sourceId: note.id,
        targetType: 'idea', targetId: 'missing', kind: 'relatesTo', now: t0,
      })),
    ]);

    expect((await makeService(repos).getDetail(note.id)).links).toEqual([]);
  });
});
