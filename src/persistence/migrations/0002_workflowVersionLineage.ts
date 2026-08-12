import type { Migration } from './migration';

/**
 * Workflow version lineage: each `workflows` row is one version of a
 * definition. `supersedes_id` is a logical reference (no foreign key) to the
 * previous published version's row; `published_at` marks the row as an
 * immutable published version. Both are nullable so existing rows migrate as
 * unpublished root drafts.
 */
export const workflowVersionLineage: Migration = {
  version: 2,
  name: 'workflow_version_lineage',
  async up(db) {
    await db.execAsync(`
      ALTER TABLE workflows ADD COLUMN supersedes_id TEXT;
      ALTER TABLE workflows ADD COLUMN published_at TEXT;
    `);
  },
};
