import type { ReactNode } from 'react';

import type { Project } from '../../domain/project';

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
 *
 * When a slot is absent the shell renders a clearly-labeled placeholder pane
 * for that segment.
 */
export interface ProjectDetailSlots {
  renderStructure?: (context: ProjectDetailSegmentContext) => ReactNode;
  renderProgress?: (context: ProjectDetailSegmentContext) => ReactNode;
}
