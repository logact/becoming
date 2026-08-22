/** Record kinds emitted by Idea commands and derivation workflows. */
export const IDEA_RECORD_KIND = {
  captured: 'ideaCaptured',
  edited: 'ideaEdited',
  statusChanged: 'ideaStatusChanged',
  derivedGoal: 'ideaDerivedGoal',
  derivedTask: 'ideaDerivedTask',
} as const;

export type IdeaRecordKind = typeof IDEA_RECORD_KIND[keyof typeof IDEA_RECORD_KIND];
