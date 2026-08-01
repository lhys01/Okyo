import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canStartCookingSession,
  clearActiveCookingSession,
  createActiveCookingSession,
  isActiveCookingSession,
  resolveActiveCookingStep,
  updateActiveCookingSession,
} from './activeCooking';

test('ordinary recipe activity does not create an active cooking session', () => {
  const session = null;
  assert.equal(session, null);
  assert.equal(canStartCookingSession(session, 'recipe-1'), true);
});

test('starting cooking creates one persisted session with the required identity and timestamps', () => {
  const session = createActiveCookingSession('recipe-1', 'recipe-1', 8, '2026-07-31T10:00:00.000Z');
  assert.deepEqual(session, {
    recipeId: 'recipe-1',
    recipeRevisionId: 'recipe-1',
    currentStepIndex: 0,
    totalStepCount: 8,
    startedAt: '2026-07-31T10:00:00.000Z',
    lastUpdatedAt: '2026-07-31T10:00:00.000Z',
    completionStatus: 'active',
  });
  assert.equal(isActiveCookingSession(JSON.parse(JSON.stringify(session))), true);
});

test('the exact guided step survives updates and persisted-state round trips', () => {
  const started = createActiveCookingSession('recipe-1', 'revision-7', 8, '2026-07-31T10:00:00.000Z');
  const updated = updateActiveCookingSession(started, 4, 8, '2026-07-31T10:12:00.000Z');
  const restored = JSON.parse(JSON.stringify(updated));
  assert.equal(restored.currentStepIndex, 4);
  assert.equal(restored.totalStepCount, 8);
  assert.equal(restored.recipeRevisionId, 'revision-7');
  assert.equal(canStartCookingSession(restored, 'recipe-1'), true);
});

test('hydration restores Step 4 without writing Step 1 back to the session', () => {
  const persisted = createActiveCookingSession('recipe-a', 'revision-a', 8);
  const hydrated = updateActiveCookingSession(persisted, 4, 8);
  const restoredIndex = Math.min(hydrated.currentStepIndex, 7);

  assert.equal(restoredIndex, 4);
  assert.equal(hydrated.currentStepIndex, 4);
});

test('progress writes represent intentional navigation from the restored step', () => {
  const persisted = updateActiveCookingSession(
    createActiveCookingSession('recipe-a', 'revision-a', 8),
    4,
    8,
  );

  assert.equal(updateActiveCookingSession(persisted, 5, 8).currentStepIndex, 5);
  assert.equal(updateActiveCookingSession(persisted, 3, 8).currentStepIndex, 3);
});

test('route changes isolate recipe progress and returning restores the original step', () => {
  const recipeA = updateActiveCookingSession(createActiveCookingSession('recipe-a', 'revision-a', 8), 4, 8);
  const recipeB = createActiveCookingSession('recipe-b', 'revision-b', 6);

  assert.equal(recipeA.currentStepIndex, 4);
  assert.equal(recipeB.currentStepIndex, 0);
  assert.equal(resolveActiveCookingStep(['A1', 'A2', 'A3', 'A4', 'A5'], recipeA.currentStepIndex), 'A5');
  assert.equal(resolveActiveCookingStep(['B1', 'B2'], recipeB.currentStepIndex), 'B1');
});

test('out-of-range progress clamps without changing revision identity', () => {
  const session = updateActiveCookingSession(
    createActiveCookingSession('recipe-a', 'revision-a', 8),
    99,
    5,
  );

  assert.equal(session.currentStepIndex, 4);
  assert.equal(session.totalStepCount, 5);
  assert.equal(session.recipeRevisionId, 'revision-a');
});

test('starting a different recipe requires an explicit end choice', () => {
  const session = createActiveCookingSession('recipe-1', 'recipe-1', 4);
  assert.equal(canStartCookingSession(session, 'recipe-2'), false);
  assert.equal(canStartCookingSession(session, 'recipe-1'), true);
});

test('the active session keeps canonical identity separate from the immutable revision identity', () => {
  const session = createActiveCookingSession('canonical-scan-1', 'recipe-revision-7', 6);
  assert.equal(session.recipeId, 'canonical-scan-1');
  assert.equal(session.recipeRevisionId, 'recipe-revision-7');
  assert.notEqual(session.recipeId, session.recipeRevisionId);
});

test('shared active-step resolution clamps route and hydrated indexes to the guided sequence', () => {
  const steps = ['Mix', 'Shape', 'Proof', 'Bake'];
  assert.equal(resolveActiveCookingStep(steps, 2), 'Proof');
  assert.equal(resolveActiveCookingStep(steps, 99), 'Bake');
  assert.equal(resolveActiveCookingStep(steps, -4), 'Mix');
});

test('explicit end or final completion clears only the matching session', () => {
  const session = createActiveCookingSession('recipe-1', 'revision-1', 6);
  assert.equal(clearActiveCookingSession(session, 'recipe-2'), session);
  assert.equal(clearActiveCookingSession(session, 'recipe-1'), null);
});
