import type { Migration } from './migration';
import { initialSchema } from './0001_initialSchema';
import { workflowVersionLineage } from './0002_workflowVersionLineage';

/**
 * All migrations, in ascending version order. Never reorder or edit an entry
 * that has shipped; append new migrations at the end.
 */
export const MIGRATIONS: readonly Migration[] = [
  initialSchema,
  workflowVersionLineage,
];
