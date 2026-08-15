/**
 * Semantic-relation feedback presentation contract (issue #133).
 *
 * Reusable building blocks for Goal pursuit (#134), Task membership (#132),
 * and decomposition (#135) flows — not a generic relation editor:
 *
 * - `mapRelationError` translates every structured relation error the
 *   application/domain layers raise into consistent, actionable feedback
 *   (short title, explanation, affected action/candidate, retryability),
 *   preserving the original error identity on `cause`. Unknown errors get a
 *   safe fallback. `pickerHintForKind` produces picker-row reasons from the
 *   same table, so picker-time hints and commit-time feedback share language.
 * - `EndpointPickerSheet` keeps useful unavailable candidates visible with a
 *   Rejected state and reason; only available rows are selectable.
 * - `RelationRejectionSheet` is the focused "Change not allowed" commit-time
 *   feedback: no navigation, no draft clearing, no optimistic rendering;
 *   the user can review another choice, refresh stale endpoints, and retry.
 * - `useRelationCommit` is the success path: concise toast confirmation only
 *   after the service commits, then the caller's refresh-affected-projections
 *   callbacks.
 *
 * Presentation only — the application/domain result remains authoritative for
 * relation validity; these components translate outcomes, never decide them.
 */
export { mapRelationError, pickerHintForKind } from './relationErrorMapping';
export type {
  RelationErrorAffected,
  RelationErrorFeedback,
  RelationErrorKind,
} from './relationErrorMapping';
export { EndpointPickerSheet, candidateRejectionReason } from './EndpointPickerSheet';
export type {
  CandidateRejection,
  EndpointCandidate,
  EndpointPickerSheetProps,
} from './EndpointPickerSheet';
export { RelationRejectionSheet } from './RelationRejectionSheet';
export type { RelationRejectionSheetProps } from './RelationRejectionSheet';
export { useRelationCommit } from './useRelationCommit';
export type {
  RefreshProjections,
  RelationCommitApi,
  RelationCommitOptions,
  RelationCommitOutcome,
} from './useRelationCommit';
