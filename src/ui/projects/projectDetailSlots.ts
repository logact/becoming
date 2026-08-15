import type { ReactNode } from 'react';

import type { Project } from '../../domain/project';
import type { TaskProjectMembershipView } from '../../application/taskProjectMembershipQueryService';

/** Context handed to the Overview membership-actions slot. */
export interface ProjectMembershipSlotContext {
  /** The Project currently shown, after the latest committed refresh. */
  project: Project;
  /** The Project's active Task memberships, from the membership query. */
  memberTasks: TaskProjectMembershipView[];
  /** Re-run the detail queries after a membership mutation commits. */
  refresh: () => void;
}

/** The segments the Project detail shell owns. */
export type ProjectDetailSegmentId = 'overview' | 'structure' | 'progress';

/** Context handed to the Project detail segment slots. */
export interface ProjectDetailSegmentContext {
  /** The Project currently shown, after the latest committed refresh. */
  project: Project;
  /** Re-run the detail queries after a committed segment mutation. */
  refresh: () => void;
}

/**
 * Stable extension slots on the Project detail screen. #134 owns the detail
 * header, archive state, segment shell, and Overview content; later tasks
 * inject their segment content through these slots without rewriting the
 * detail screen:
 *
 * - #135 wires `renderStructure` (Project-scoped decomposition tree).
 * - #136 wires `renderProgress` (Project execution snapshot).
 * - #132 wires `renderMembershipActions` (Add an existing Task, rendered in
 *   the Overview's Member tasks section header for active Projects).
 *
 * When a slot is absent the shell renders a clearly-labeled placeholder pane
 * for that segment.
 */
export interface ProjectDetailSlots {
  renderStructure?: (context: ProjectDetailSegmentContext) => ReactNode;
  renderProgress?: (context: ProjectDetailSegmentContext) => ReactNode;
  renderMembershipActions?: (context: ProjectMembershipSlotContext) => ReactNode;
}
