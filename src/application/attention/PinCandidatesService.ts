import type { AttentionEntryRepository } from '../../domain/attention/repository/AttentionEntryRepository';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';

export interface PinCandidate {
  type: 'goal' | 'task' | 'idea';
  id: string;
  /** Idea content is mapped to title. */
  title: string;
  status: string;
  /** True when an active 'pin' AttentionEntry exists for the target. */
  pinned: boolean;
}

function pinKey(type: string, id: string): string {
  return `${type}:${id}`;
}

/**
 * Lists every pinnable target — all non-archived goals, tasks, and ideas —
 * with its current pin state, newest-updated first. Dismiss entries do not
 * affect the pin state.
 */
export class PinCandidatesService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly ideas: IdeaRepository,
    private readonly attentionEntries: AttentionEntryRepository,
  ) {}

  async list(): Promise<PinCandidate[]> {
    const [goals, tasks, ideas, pins] = await Promise.all([
      this.goals.list({ archived: false }),
      this.tasks.list({ archived: false }),
      this.ideas.list({ archived: false }),
      this.attentionEntries.list({ kind: 'pin' }),
    ]);
    const pinnedKeys = new Set(pins.map((pin) => pinKey(pin.targetType, pin.targetId)));

    const entries: { candidate: PinCandidate; updatedAt: Date }[] = [
      ...goals.map((goal) => ({
        candidate: {
          type: 'goal' as const,
          id: goal.id,
          title: goal.title,
          status: goal.status,
          pinned: pinnedKeys.has(pinKey('goal', goal.id)),
        },
        updatedAt: goal.updatedAt,
      })),
      ...tasks.map((task) => ({
        candidate: {
          type: 'task' as const,
          id: task.id,
          title: task.title,
          status: task.status,
          pinned: pinnedKeys.has(pinKey('task', task.id)),
        },
        updatedAt: task.updatedAt,
      })),
      ...ideas.map((idea) => ({
        candidate: {
          type: 'idea' as const,
          id: idea.id,
          title: idea.content,
          status: idea.status,
          pinned: pinnedKeys.has(pinKey('idea', idea.id)),
        },
        updatedAt: idea.updatedAt,
      })),
    ];
    entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return entries.map((entry) => entry.candidate);
  }
}
