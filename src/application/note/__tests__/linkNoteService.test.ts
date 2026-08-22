import { Goal } from '../../../domain/goal/Goal';
import { Note } from '../../../domain/note/Note';
import { Project } from '../../../domain/project/Project';
import { Relation } from '../../../domain/relation/Relation';
import type { RelationRepository } from '../../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../../domain/shared/errors';
import { makeFakeRepos, type TestRepositories } from '../../__tests__/fakes';
import { LinkNoteService, type LinkNoteCommand } from '../LinkNoteService';

const createdAt = new Date('2026-08-01T00:00:00Z');
const now = new Date('2026-08-22T10:00:00Z');

function command(overrides: Partial<LinkNoteCommand> = {}): LinkNoteCommand {
  return {
    relationId: 'link-1',
    noteId: 'note-1',
    targetType: 'goal',
    targetId: 'goal-1',
    recordId: 'record-1',
    recordRelationId: 'note-log-1',
    now,
    ...overrides,
  } as LinkNoteCommand;
}

async function seedActiveEntities(repos: TestRepositories): Promise<void> {
  await repos.noteRepo.save(Note.create({
    id: 'note-1', content: 'Protect deep-work mornings.', now: createdAt,
  }));
  await repos.goalRepo.save(Goal.create({
    id: 'goal-1', title: 'Write the book', now: createdAt,
  }));
  await repos.projectRepo.save(Project.create({
    id: 'project-1', name: 'Draft manuscript', goalId: 'goal-1', now: createdAt,
  }));
}

function makeService(repos: TestRepositories, relations = repos.relationRepo) {
  return new LinkNoteService(
    repos.noteRepo,
    repos.goalRepo,
    repos.projectRepo,
    repos.recordRepo,
    relations,
    repos.transactionRunner,
  );
}

describe('LinkNoteService', () => {
  it('creates note --relatesTo--> goal and appends a noteLinked activity', async () => {
    const repos = await makeFakeRepos();
    await seedActiveEntities(repos);

    await makeService(repos).link(command());

    expect(await repos.relationRepo.findById('link-1')).toMatchObject({
      sourceType: 'note', sourceId: 'note-1', targetType: 'goal',
      targetId: 'goal-1', kind: 'relatesTo',
    });
    expect(await repos.recordRepo.listRecent(10)).toEqual([
      expect.objectContaining({
        id: 'record-1', kind: 'noteLinked',
        detail: 'Linked note to goal “Write the book”', occurredAt: now,
      }),
    ]);
    expect(await repos.relationRepo.findById('note-log-1')).toMatchObject({
      sourceType: 'record', sourceId: 'record-1', targetType: 'note',
      targetId: 'note-1', kind: 'logs',
    });
    expect((await repos.recordRepo.listByTarget('note', 10, 'note-1')).map(({ id }) => id))
      .toEqual(['record-1']);
  });

  it('links a Note to a Project in the confirmed direction', async () => {
    const repos = await makeFakeRepos();
    await seedActiveEntities(repos);

    await makeService(repos).link(command({
      targetType: 'project', targetId: 'project-1',
    }));

    expect(await repos.relationRepo.findById('link-1')).toMatchObject({
      sourceType: 'note', sourceId: 'note-1', targetType: 'project',
      targetId: 'project-1', kind: 'relatesTo',
    });
    expect((await repos.recordRepo.listRecent(10))[0]).toMatchObject({
      kind: 'noteLinked', detail: 'Linked note to project “Draft manuscript”',
    });
  });

  it('treats an existing link to the same target as a no-op', async () => {
    const repos = await makeFakeRepos();
    await seedActiveEntities(repos);
    await repos.relationRepo.save(Relation.create({
      id: 'existing-link', sourceType: 'note', sourceId: 'note-1',
      targetType: 'goal', targetId: 'goal-1', kind: 'relatesTo', now: createdAt,
    }));

    await makeService(repos).link(command());

    expect((await repos.relationRepo.list({ kind: 'relatesTo' })).map(({ id }) => id))
      .toEqual(['existing-link']);
    expect(await repos.relationRepo.findById('link-1')).toBeNull();
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    expect(await repos.relationRepo.findById('note-log-1')).toBeNull();
  });

  it('rejects an unknown or archived Note without writes', async () => {
    const unknownRepos = await makeFakeRepos();
    await unknownRepos.goalRepo.save(Goal.create({
      id: 'goal-1', title: 'Write the book', now: createdAt,
    }));
    await expect(makeService(unknownRepos).link(command())).rejects.toThrow(
      'Unknown note: note-1',
    );
    expect(await unknownRepos.relationRepo.list()).toEqual([]);
    expect(await unknownRepos.recordRepo.listRecent(10)).toEqual([]);

    const archivedRepos = await makeFakeRepos();
    await seedActiveEntities(archivedRepos);
    const note = await archivedRepos.noteRepo.findById('note-1');
    if (note === null) throw new Error('Expected seeded note');
    note.archive(now);
    await archivedRepos.noteRepo.save(note);
    await expect(makeService(archivedRepos).link(command())).rejects.toThrow(DomainError);
    expect(await archivedRepos.relationRepo.list()).toEqual([]);
    expect(await archivedRepos.recordRepo.listRecent(10)).toEqual([]);
  });

  it('rejects unknown and archived Goal or Project targets without writes', async () => {
    const unknownGoalRepos = await makeFakeRepos();
    await unknownGoalRepos.noteRepo.save(Note.create({
      id: 'note-1', content: 'A note', now: createdAt,
    }));
    await expect(makeService(unknownGoalRepos).link(command())).rejects.toThrow(
      'Unknown goal: goal-1',
    );

    const unknownProjectRepos = await makeFakeRepos();
    await unknownProjectRepos.noteRepo.save(Note.create({
      id: 'note-1', content: 'A note', now: createdAt,
    }));
    await expect(makeService(unknownProjectRepos).link(command({
      targetType: 'project', targetId: 'project-1',
    }))).rejects.toThrow('Unknown project: project-1');

    const archivedGoalRepos = await makeFakeRepos();
    await seedActiveEntities(archivedGoalRepos);
    const goal = await archivedGoalRepos.goalRepo.findById('goal-1');
    if (goal === null) throw new Error('Expected seeded goal');
    goal.archive(now);
    await archivedGoalRepos.goalRepo.save(goal);
    await expect(makeService(archivedGoalRepos).link(command())).rejects.toThrow(
      'Cannot link archived goal: goal-1',
    );

    const archivedProjectRepos = await makeFakeRepos();
    await seedActiveEntities(archivedProjectRepos);
    const project = await archivedProjectRepos.projectRepo.findById('project-1');
    if (project === null) throw new Error('Expected seeded project');
    project.archive(now);
    await archivedProjectRepos.projectRepo.save(project);
    await expect(makeService(archivedProjectRepos).link(command({
      targetType: 'project', targetId: 'project-1',
    }))).rejects.toThrow('Cannot link archived project: project-1');

    for (const repos of [
      unknownGoalRepos, unknownProjectRepos, archivedGoalRepos, archivedProjectRepos,
    ]) {
      expect(await repos.relationRepo.list()).toEqual([]);
      expect(await repos.recordRepo.listRecent(10)).toEqual([]);
    }
  });

  it('rolls back the link and activity record after a late logs write failure', async () => {
    const repos = await makeFakeRepos();
    await seedActiveEntities(repos);
    let relationWrites = 0;
    const failingRelations: RelationRepository = {
      save: async (relation) => {
        relationWrites += 1;
        if (relationWrites === 2) throw new Error('note link activity failed');
        await repos.relationRepo.save(relation);
      },
      findById: (id) => repos.relationRepo.findById(id),
      list: (filter) => repos.relationRepo.list(filter),
      delete: (id) => repos.relationRepo.delete(id),
    };

    await expect(makeService(repos, failingRelations).link(command())).rejects.toThrow(
      'note link activity failed',
    );

    expect(await repos.relationRepo.list()).toEqual([]);
    expect(await repos.recordRepo.listRecent(10)).toEqual([]);
  });

  it('leaves deletion cleanup out of scope; dangling links remain query-safe', async () => {
    const repos = await makeFakeRepos();
    await seedActiveEntities(repos);
    await makeService(repos).link(command());

    await repos.noteRepo.delete('note-1');

    expect(await repos.noteRepo.findById('note-1')).toBeNull();
    expect(await repos.relationRepo.findById('link-1')).toMatchObject({
      sourceType: 'note', sourceId: 'note-1', kind: 'relatesTo',
    });
  });
});
