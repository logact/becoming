import { createProjectEntityState } from '../src/domain/projectEntityState';
import { createProjectState } from '../src/domain/projectState';
import { archiveProjectStateTransition, createProjectStateTransition } from '../src/domain/projectStateTransition';
import {
  ProjectTransitionValidationService,
} from '../src/application/projectTransitionValidationService';
import type {
  ProjectTransitionConditionEvaluationInput,
  ProjectTransitionExitCriteriaEvaluationInput,
  ProjectTransitionValidationServicePorts,
} from '../src/application/projectTransitionValidationService';
import { SqliteProjectEntityStateRepository } from '../src/persistence/projectEntityStateRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteProjectStateTransitionRepository } from '../src/persistence/projectStateTransitionRepository';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const MACHINE = { projectId: 'project-1', entityType: 'task' as const, labelId: 'label-1' };
const REQUEST = { ...MACHINE, entityId: 'task-1', toProjectStateId: 'done' };
const NOW = '2026-08-13T00:00:00.000Z';

async function setup(options: {
  transition?: 'active' | 'archived' | 'none';
  sourceArchived?: boolean;
  destinationArchived?: boolean;
  condition?: string | null;
  requiresExitCriteria?: boolean;
  sourceExitCriteria?: string | null;
} = {}) {
  const db = await createTestDatabase();
  const states = new SqliteProjectStateRepository(db);
  const transitions = new SqliteProjectStateTransitionRepository(db);
  const periods = new SqliteProjectEntityStateRepository(db);
  const source = createProjectState({ ...MACHINE, title: 'Ready', exitCriteria: options.sourceExitCriteria }, { id: 'ready', now: NOW });
  const destination = createProjectState({ ...MACHINE, title: 'Done' }, { id: 'done', now: NOW });
  await states.add(options.sourceArchived ? { ...source, archivedAt: NOW } : source);
  await states.add(options.destinationArchived ? { ...destination, archivedAt: NOW } : destination);
  await periods.add(createProjectEntityState({ ...MACHINE, entityId: REQUEST.entityId, projectStateId: source.id }, { id: 'period-1', now: NOW }));
  if (options.transition !== 'none') {
    const edge = createProjectStateTransition({ ...MACHINE, fromStateId: source.id, toStateId: destination.id, condition: options.condition, requiresExitCriteria: options.requiresExitCriteria }, { id: 'edge-1', now: NOW });
    await transitions.add(options.transition === 'archived' ? archiveProjectStateTransition(edge, NOW) : edge);
  }
  const ports: ProjectTransitionValidationServicePorts = { entityStates: periods, states, transitions };
  return { db, source, destination, periods, ports };
}

describe('ProjectTransitionValidationService decision table', () => {
  it.each([
    ['unsupported type', { ...REQUEST, entityType: 'not-real' }, {}, 'unsupported_entity_type'],
    ['current state absent', REQUEST, { current: null }, 'current_state_missing'],
    ['source state absent', REQUEST, { source: null }, 'source_state_missing'],
    ['source state archived', REQUEST, { sourceArchived: true }, 'source_state_archived'],
    ['destination state absent', REQUEST, { destination: null }, 'destination_state_missing'],
    ['destination state archived', REQUEST, { destinationArchived: true }, 'destination_state_archived'],
    ['no edge', REQUEST, { transition: 'none' }, 'transition_missing'],
    ['only archived edge', REQUEST, { transition: 'archived' }, 'transition_archived'],
  ])('%s rejects with %s', async (_name, request, override, expected) => {
    const fixture = await setup(override as Parameters<typeof setup>[0]);
    const ports = { ...fixture.ports };
    if ('current' in override) ports.entityStates = { findCurrent: async () => override.current };
    if ('source' in override) ports.states = { getById: async (id) => id === fixture.destination.id ? fixture.destination : override.source };
    if ('destination' in override) ports.states = { getById: async (id) => id === fixture.source.id ? fixture.source : override.destination };
    const result = await new ProjectTransitionValidationService(ports).validate(request);
    expect(result).toMatchObject({ authorized: false, reason: expected });
    await closeQuietly(fixture.db);
  });

  it('checks every machine identity dimension before resolving edges', async () => {
    const fixture = await setup();
    for (const [kind, state] of [
      ['current_state_identity_mismatch', { ...createProjectEntityState({ ...MACHINE, entityId: 'other-task', projectStateId: fixture.source.id }, { id: 'mismatch-period', now: NOW }), labelId: 'other-label' }],
      ['source_state_identity_mismatch', { ...fixture.source, projectId: 'other-project' }],
      ['destination_state_identity_mismatch', { ...fixture.destination, entityType: 'goal' as const }],
    ] as const) {
      const ports = { ...fixture.ports };
      if (kind === 'current_state_identity_mismatch') ports.entityStates = { findCurrent: async () => state };
      if (kind === 'source_state_identity_mismatch') ports.states = { getById: async (id) => id === fixture.source.id ? state : fixture.destination };
      if (kind === 'destination_state_identity_mismatch') ports.states = { getById: async (id) => id === fixture.destination.id ? state : fixture.source };
      await expect(new ProjectTransitionValidationService(ports).validate(REQUEST)).resolves.toMatchObject({ authorized: false, reason: kind });
    }
    await closeQuietly(fixture.db);
  });

  it('distinguishes ambiguous active edge results and malformed transition identity', async () => {
    const fixture = await setup();
    const active = await fixture.ports.transitions.listActiveOutgoingForState(MACHINE, fixture.source.id);
    const ambiguous = { ...fixture.ports, transitions: { ...fixture.ports.transitions, listActiveOutgoingForState: async () => [active[0], { ...active[0], id: 'edge-2' }] } };
    await expect(new ProjectTransitionValidationService(ambiguous).validate(REQUEST)).resolves.toMatchObject({ authorized: false, reason: 'transition_ambiguous' });
    const malformed = { ...fixture.ports, transitions: { ...fixture.ports.transitions, listActiveOutgoingForState: async () => [{ ...active[0], projectId: 'other-project' }] } };
    await expect(new ProjectTransitionValidationService(malformed).validate(REQUEST)).resolves.toMatchObject({ authorized: false, reason: 'transition_identity_mismatch' });
    await closeQuietly(fixture.db);
  });
});

describe('ProjectTransitionValidationService evaluators and purity', () => {
  it('supplies exact structured contracts and carries successful evidence', async () => {
    const fixture = await setup({ condition: 'owner-approved', requiresExitCriteria: true, sourceExitCriteria: 'tests-pass' });
    let conditionInput: ProjectTransitionConditionEvaluationInput | undefined;
    let exitInput: ProjectTransitionExitCriteriaEvaluationInput | undefined;
    const result = await new ProjectTransitionValidationService({
      ...fixture.ports,
      conditionEvaluator: { evaluate: async (input) => { conditionInput = input; return { passed: true, evidence: { checked: 'owner' } }; } },
      exitCriteriaEvaluator: { evaluate: async (input) => { exitInput = input; return { passed: true, evidence: { checked: 'tests' } }; } },
    }).validate(REQUEST);
    expect(result).toMatchObject({ authorized: true, condition: { evidence: { checked: 'owner' } }, exitCriteria: { evidence: { checked: 'tests' } } });
    expect(conditionInput).toMatchObject({ request: REQUEST, condition: 'owner-approved', currentState: { projectStateId: 'ready' }, sourceState: { id: 'ready' }, destinationState: { id: 'done' } });
    expect(exitInput).toMatchObject({ request: REQUEST, exitCriteria: 'tests-pass', transition: { id: 'edge-1' } });
    await closeQuietly(fixture.db);
  });

  it.each([
    ['condition', { condition: 'must-pass' }, 'condition_evaluator_missing'],
    ['exit criteria', { requiresExitCriteria: true }, 'exit_criteria_evaluator_missing'],
  ])('requires an explicit evaluator for %s', async (_name, options, reason) => {
    const fixture = await setup(options);
    await expect(new ProjectTransitionValidationService(fixture.ports).validate(REQUEST)).resolves.toMatchObject({ authorized: false, reason });
    await closeQuietly(fixture.db);
  });

  it('distinguishes false and error evaluator results, retaining false evidence', async () => {
    const conditionFixture = await setup({ condition: 'must-pass' });
    await expect(new ProjectTransitionValidationService({ ...conditionFixture.ports, conditionEvaluator: { evaluate: async () => ({ passed: false, evidence: { failed: 'policy' } }) } }).validate(REQUEST)).resolves.toEqual({ authorized: false, reason: 'condition_false', evidence: { failed: 'policy' } });
    await closeQuietly(conditionFixture.db);
    const conditionErrorFixture = await setup({ condition: 'must-pass' });
    await expect(new ProjectTransitionValidationService({ ...conditionErrorFixture.ports, conditionEvaluator: { evaluate: async () => { throw new Error('unavailable'); } } }).validate(REQUEST)).resolves.toEqual({ authorized: false, reason: 'condition_evaluator_error', error: { name: 'Error', message: 'unavailable' } });
    await closeQuietly(conditionErrorFixture.db);
    const exitFixture = await setup({ requiresExitCriteria: true });
    await expect(new ProjectTransitionValidationService({ ...exitFixture.ports, exitCriteriaEvaluator: { evaluate: async () => { throw new TypeError('unavailable'); } } }).validate(REQUEST)).resolves.toEqual({ authorized: false, reason: 'exit_criteria_evaluator_error', error: { name: 'TypeError', message: 'unavailable' } });
    await closeQuietly(exitFixture.db);
    const exitFalseFixture = await setup({ requiresExitCriteria: true });
    await expect(new ProjectTransitionValidationService({ ...exitFalseFixture.ports, exitCriteriaEvaluator: { evaluate: async () => ({ passed: false, evidence: { incomplete: true } }) } }).validate(REQUEST)).resolves.toEqual({ authorized: false, reason: 'exit_criteria_false', evidence: { incomplete: true } });
    await closeQuietly(exitFalseFixture.db);
  });

  it('does not write, end, or add state periods for rejected validation', async () => {
    const fixture = await setup({ condition: 'must-pass' });
    const before = await fixture.periods.listHistory({ ...MACHINE, entityId: REQUEST.entityId });
    const result = await new ProjectTransitionValidationService({ ...fixture.ports, conditionEvaluator: { evaluate: async () => ({ passed: false }) } }).validate(REQUEST);
    const after = await fixture.periods.listHistory({ ...MACHINE, entityId: REQUEST.entityId });
    expect(result).toMatchObject({ authorized: false, reason: 'condition_false' });
    expect(after).toEqual(before);
    await closeQuietly(fixture.db);
  });
});
