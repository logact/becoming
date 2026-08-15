import type { ReactNode } from 'react';

import type { Goal } from '../../domain/goal';

/** Context handed to the Goal detail pursuit-actions slot. */
export interface GoalPursuitSlotContext {
  /** The Goal currently shown, after the latest committed refresh. */
  goal: Goal;
  /** Re-run the detail queries after a pursuit mutation commits. */
  refresh: () => void;
}

/**
 * Stable extension slots on the Goal detail screen. Task #134 wires the Goal
 * pursuit actions (Connect / Remove from a Project) into
 * `renderPursuitActions` without changing the screen, destination, or shell
 * contracts. The slot renders inside the "Pursued by" section header and is
 * only invoked for active Goals — archived Goals stay read-only.
 */
export interface GoalDetailSlots {
  renderPursuitActions?: (context: GoalPursuitSlotContext) => ReactNode;
}
