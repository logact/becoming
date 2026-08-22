/** Record kinds emitted by Note commands and relation workflows. */
export const NOTE_RECORD_KIND = {
  captured: 'noteCaptured',
  edited: 'noteEdited',
  pinned: 'notePinned',
  unpinned: 'noteUnpinned',
  archived: 'noteArchived',
  unarchived: 'noteUnarchived',
  derivedFromIdea: 'noteDerivedFromIdea',
  linked: 'noteLinked',
} as const;

export type NoteRecordKind = typeof NOTE_RECORD_KIND[keyof typeof NOTE_RECORD_KIND];
