/** Immutable activity kinds emitted by the cross-domain quick capture use case. */
export const CAPTURE_RECORD_KIND = {
  quickCapturedIdea: 'quickCapturedIdea',
  quickCapturedGoal: 'quickCapturedGoal',
  quickCapturedTask: 'quickCapturedTask',
  quickCapturedNote: 'quickCapturedNote',
} as const;

export type CaptureRecordKind =
  typeof CAPTURE_RECORD_KIND[keyof typeof CAPTURE_RECORD_KIND];
