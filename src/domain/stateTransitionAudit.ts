import { isCoreEntityType } from './entityTypes';
import type { CoreEntityType } from './entityTypes';
import type { EntityId, IsoTimestamp } from './ids';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';

/**
 * The lifecycle-transition audit contract: the structured payload recorded for
 * every accepted project-scoped lifecycle transition (Feature #9), so the
 * event stays meaningful independently of later Workflow or Project machine
 * edits.
 *
 * One payload identifies:
 * - the Project management context (`projectId`), the managed core entity
 *   (`entityType` + `entityId`), and the management Label (`labelId`) —
 *   together the exact machine identity `projectId + entityType + labelId`;
 * - the from/to Project States and the Project Transition that was executed;
 * - who or what caused the transition (`actor`) and when it happened
 *   (`occurredAt`, the transition time);
 * - the payload contract version (`schemaVersion`).
 *
 * Because Records are append-oriented and their payloads are never rewritten,
 * the identifying fields above are themselves immutable. The `snapshot`
 * section additionally freezes the *descriptive* data — state titles and
 * categories, the transition title, and the label name — so the event remains
 * human-meaningful after the referenced machine definitions are edited or
 * archived.
 *
 * Condition and required-exit-criteria evaluations are captured through the
 * explicit, redacted `evaluation` structure: each entry carries only a
 * policy/rule identifier, an outcome, and a summary. Raw evaluation inputs
 * never enter the payload — the builder copies exactly those three fields, so
 * sensitive inputs are excluded by construction.
 *
 * The payload is persisted as the JSON `payload` of one append-oriented
 * Record of type `STATE_TRANSITION_RECORD_TYPE`; the application service in
 * `src/application/lifecycleAuditService.ts` appends that Record in the same
 * transaction as the `project_entity_states` history update. Exactly one
 * accepted transition maps to exactly one such Record; a rejected transition
 * maps to none.
 *
 * Scope notes:
 * - Defining state machines or allowed transitions is out of scope here; the
 *   executor (Feature #29) owns transition rules. This contract owns only the
 *   audit payload shape and its invariants.
 * - Core-entity mutation provenance (Feature #30) and relation-change
 *   payloads (Feature #5) are separate contracts layered on the same Record
 *   mechanism.
 */

/** Record type of the lifecycle-transition audit Records this contract appends. */
export const STATE_TRANSITION_RECORD_TYPE = 'state_transition';

/**
 * The current payload schema version. The builder always stamps this version;
 * readers use it to interpret stored payloads after the contract evolves.
 */
export const STATE_TRANSITION_AUDIT_SCHEMA_VERSION = 1;

/** Outcomes a condition or exit-criteria evaluation can report. */
export const EVALUATION_OUTCOMES = [
  'satisfied',
  'not_satisfied',
  'not_evaluated',
] as const;

export type EvaluationOutcome = (typeof EVALUATION_OUTCOMES)[number];

export function isEvaluationOutcome(value: string): value is EvaluationOutcome {
  return (EVALUATION_OUTCOMES as readonly string[]).includes(value);
}

/**
 * The redacted result of evaluating one condition or exit-criteria rule. Only
 * the rule identifier, the outcome, and a human-readable summary are
 * captured; the inputs the rule was evaluated against never appear here.
 */
export interface EvaluationResult {
  ruleId: string;
  outcome: EvaluationOutcome;
  summary: string;
}

/** Structured evaluation outcomes for one transition. */
export interface EvaluationReport {
  /** Results for the transition's conditions, in evaluation order. */
  conditions: EvaluationResult[];
  /** Results for the source state's required exit criteria. */
  exitCriteria: EvaluationResult[];
}

/** Frozen descriptive snapshot of a Project State at transition time. */
export interface StateSnapshot {
  title: string;
  category: string | null;
}

/** Frozen descriptive snapshot of the executed Project Transition. */
export interface TransitionSnapshot {
  title: string | null;
}

/** Frozen descriptive snapshot of the management Label. */
export interface LabelSnapshot {
  name: string;
}

/**
 * Immutable descriptive snapshots keeping the event understandable after the
 * referenced machine definitions change or are archived.
 */
export interface AuditSnapshots {
  fromState: StateSnapshot;
  toState: StateSnapshot;
  transition: TransitionSnapshot;
  label: LabelSnapshot;
}

/**
 * The validated audit payload for one accepted lifecycle transition. The
 * identifying ids double as the frozen machine identity
 * (`projectId + entityType + labelId`); `snapshot` carries the descriptive
 * data; `evaluation` carries the redacted condition/exit-criteria outcomes.
 */
export interface StateTransitionAuditPayload {
  schemaVersion: number;
  projectId: EntityId;
  entityType: CoreEntityType;
  entityId: EntityId;
  labelId: EntityId;
  fromProjectStateId: EntityId;
  toProjectStateId: EntityId;
  projectTransitionId: EntityId;
  actor: string;
  occurredAt: IsoTimestamp;
  snapshot: AuditSnapshots;
  evaluation: EvaluationReport;
}

/** Input for one redacted evaluation result; extra fields are dropped. */
export interface EvaluationResultInput {
  ruleId: string;
  outcome: string;
  summary: string;
}

/** Input for building an audit payload; validated field by field. */
export interface StateTransitionAuditInput {
  projectId: EntityId;
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
  fromProjectStateId: EntityId;
  toProjectStateId: EntityId;
  projectTransitionId: EntityId;
  actor: string;
  occurredAt: IsoTimestamp;
  snapshot: {
    fromState: { title: string; category?: string | null };
    toState: { title: string; category?: string | null };
    transition: { title?: string | null };
    label: { name: string };
  };
  evaluation?: {
    conditions?: readonly EvaluationResultInput[];
    exitCriteria?: readonly EvaluationResultInput[];
  };
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`State-transition audit ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `State-transition audit ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireNullableCategory(
  field: string,
  value: string | null,
): string | null {
  if (value !== null && value.trim().length === 0) {
    throw new Error(`State-transition audit ${field} must not be blank when present`);
  }
  return value;
}

/**
 * Redact one evaluation result: copy exactly the rule identifier, outcome,
 * and summary. Any other field the evaluator produced — inputs, intermediate
 * values, secrets — is dropped here by construction.
 */
function buildEvaluationResult(
  field: string,
  input: EvaluationResultInput,
): EvaluationResult {
  const ruleId = requireNonBlank(`${field}.ruleId`, input.ruleId);
  if (!isEvaluationOutcome(input.outcome)) {
    throw new Error(
      `State-transition audit ${field}.outcome must be one of ${EVALUATION_OUTCOMES.join(', ')}, got ${JSON.stringify(input.outcome)}`,
    );
  }
  const summary = requireNonBlank(`${field}.summary`, input.summary);
  return { ruleId, outcome: input.outcome, summary };
}

function buildEvaluationReport(
  input: StateTransitionAuditInput['evaluation'],
): EvaluationReport {
  return {
    conditions: (input?.conditions ?? []).map((entry, index) =>
      buildEvaluationResult(`evaluation.conditions[${index}]`, entry),
    ),
    exitCriteria: (input?.exitCriteria ?? []).map((entry, index) =>
      buildEvaluationResult(`evaluation.exitCriteria[${index}]`, entry),
    ),
  };
}

/**
 * Build and validate the audit payload for one accepted transition, stamping
 * the current schema version. All validation runs before any persistence, so
 * an invalid payload can never reach a repository.
 */
export function buildStateTransitionAuditPayload(
  input: StateTransitionAuditInput,
): StateTransitionAuditPayload {
  if (!isCoreEntityType(input.entityType)) {
    throw new Error(
      `State-transition audit entityType must be a core entity type, got ${JSON.stringify(input.entityType)}`,
    );
  }
  const payload: StateTransitionAuditPayload = {
    schemaVersion: STATE_TRANSITION_AUDIT_SCHEMA_VERSION,
    projectId: requireNonBlank('projectId', input.projectId),
    entityType: input.entityType,
    entityId: requireNonBlank('entityId', input.entityId),
    labelId: requireNonBlank('labelId', input.labelId),
    fromProjectStateId: requireNonBlank(
      'fromProjectStateId',
      input.fromProjectStateId,
    ),
    toProjectStateId: requireNonBlank('toProjectStateId', input.toProjectStateId),
    projectTransitionId: requireNonBlank(
      'projectTransitionId',
      input.projectTransitionId,
    ),
    actor: requireNonBlank('actor', input.actor),
    occurredAt: requireTimestamp('occurredAt', input.occurredAt),
    snapshot: {
      fromState: {
        title: requireNonBlank('snapshot.fromState.title', input.snapshot.fromState.title),
        category: requireNullableCategory(
          'snapshot.fromState.category',
          input.snapshot.fromState.category ?? null,
        ),
      },
      toState: {
        title: requireNonBlank('snapshot.toState.title', input.snapshot.toState.title),
        category: requireNullableCategory(
          'snapshot.toState.category',
          input.snapshot.toState.category ?? null,
        ),
      },
      transition: { title: input.snapshot.transition.title ?? null },
      label: {
        name: requireNonBlank('snapshot.label.name', input.snapshot.label.name),
      },
    },
    evaluation: buildEvaluationReport(input.evaluation),
  };
  // The whole payload must serialize as lossless JSON before it can be
  // stored as a Record payload.
  assertJsonValue(stateTransitionAuditPayloadToJson(payload));
  return payload;
}

/** Serialize an audit payload as the JSON payload of a Record. */
export function stateTransitionAuditPayloadToJson(
  payload: StateTransitionAuditPayload,
): JsonValue {
  return {
    schemaVersion: payload.schemaVersion,
    projectId: payload.projectId,
    entityType: payload.entityType,
    entityId: payload.entityId,
    labelId: payload.labelId,
    fromProjectStateId: payload.fromProjectStateId,
    toProjectStateId: payload.toProjectStateId,
    projectTransitionId: payload.projectTransitionId,
    actor: payload.actor,
    occurredAt: payload.occurredAt,
    snapshot: {
      fromState: {
        title: payload.snapshot.fromState.title,
        category: payload.snapshot.fromState.category,
      },
      toState: {
        title: payload.snapshot.toState.title,
        category: payload.snapshot.toState.category,
      },
      transition: { title: payload.snapshot.transition.title },
      label: { name: payload.snapshot.label.name },
    },
    evaluation: {
      conditions: payload.evaluation.conditions.map((entry) => ({ ...entry })),
      exitCriteria: payload.evaluation.exitCriteria.map((entry) => ({ ...entry })),
    },
  };
}
