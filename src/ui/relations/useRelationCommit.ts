import { useCallback } from 'react';

import { useToast } from '../shared/Toast';
import { mapRelationError } from './relationErrorMapping';
import type { RelationErrorFeedback } from './relationErrorMapping';

/**
 * Re-runs one affected projection after a commit: a screen's list refetch,
 * detail-facts refetch, picker-candidate refetch, hierarchy refetch, activity
 * timeline refetch, or progress-snapshot refetch. Screens compose these from
 * their query services; this module never queries on its own.
 */
export type RefreshProjections = () => void | Promise<void>;

export interface RelationCommitOptions {
  /**
   * Concise confirmation shown via `useToast` — only after the service
   * commits. A toast is transient feedback, never persisted state.
   */
  successMessage: string;
  /**
   * Refresh-affected-projections hook: one callback or an ordered list,
   * invoked after the commit succeeds (and after the toast is announced).
   * Later tasks (#134 Goal pursuit, #132 Task membership, #135 decomposition)
   * pass every projection their mutation affects — Goal/Project/Task lists
   * and facts, pickers, hierarchy, activity, and progress — so a committed
   * change is visible everywhere without a screen reload.
   */
  refresh?: RefreshProjections | readonly RefreshProjections[];
}

export type RelationCommitOutcome<T> =
  | { status: 'committed'; result: T }
  | { status: 'rejected'; feedback: RelationErrorFeedback };

export interface RelationCommitApi {
  /**
   * Run one relation-mutation command (pursuit start/end, membership
   * start/end, decomposition create/end) with the M2 feedback contract:
   *
   * - Nothing renders optimistically: the caller updates committed-state
   *   projections only inside `refresh` callbacks, which run post-commit.
   * - On success: toast, then refresh callbacks in order, then the outcome.
   * - On rejection: no toast, no refresh; the structured error is mapped to
   *   feedback for `RelationRejectionSheet`. The promise never rejects, so a
   *   failed mutation cannot take down the screen or discard its state.
   */
  commit<T>(
    operation: () => Promise<T>,
    options: RelationCommitOptions,
  ): Promise<RelationCommitOutcome<T>>;
}

/**
 * Success-path helper for relation mutations. Must be used inside a
 * `ToastProvider`. See `RelationCommitApi.commit` for the contract.
 */
export function useRelationCommit(): RelationCommitApi {
  const toast = useToast();

  const commit = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options: RelationCommitOptions,
    ): Promise<RelationCommitOutcome<T>> => {
      let result: T;
      try {
        result = await operation();
      } catch (error) {
        return { status: 'rejected', feedback: mapRelationError(error) };
      }
      toast.showToast(options.successMessage);
      const refreshers: readonly RefreshProjections[] =
        options.refresh === undefined
          ? []
          : Array.isArray(options.refresh)
            ? (options.refresh as readonly RefreshProjections[])
            : [options.refresh as RefreshProjections];
      for (const refresh of refreshers) {
        await refresh();
      }
      return { status: 'committed', result };
    },
    [toast],
  );

  return { commit };
}
