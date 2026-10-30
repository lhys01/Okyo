import assert from 'node:assert/strict';
import test from 'node:test';

import { mockRecipes } from './mockData.js';
import { runWithRequestContext } from './observability/requestContext.js';
import {
  awardXp,
  clearUserData,
  createChallenge,
  getAnalysisContext,
  getGeneratedRecipe,
  getLibrary,
  getSavingsSummary,
  getWeeklyRankings,
  saveRecipe,
  storeAnalysisContext,
  storeGeneratedRecipe,
} from './store.js';

const recipe = mockRecipes[0]!;

test('saved recipes, challenges, XP and account deletion are isolated per authenticated user', () => {
  const userA = `user_test_a_${Date.now()}`;
  const userB = `user_test_b_${Date.now()}`;

  saveRecipe(recipe, userA);
  awardXp(userA, 'first_scan', 'ownership-test');
  createChallenge({ recipeId: recipe.id, mode: recipe.mode, rating: 'Nailed it' }, userA);

  assert.equal(getLibrary(userA).length, 1);
  assert.equal(getLibrary(userB).length, 0);
  assert.equal(getSavingsSummary(userB).totalEstimatedSaved, 0);
  assert.equal(getWeeklyRankings(userB).awardedXpEvents.length, 0);

  clearUserData(userA);
  assert.equal(getLibrary(userA).length, 0);
  assert.equal(getWeeklyRankings(userA).completedChallenges.length, 0);
  assert.equal(getWeeklyRankings(userA).awardedXpEvents.length, 0);
});

test('generated recipe reads require the originating request owner scope', () => {
  const uniqueRecipe = { ...recipe, id: `ownership-test-${Date.now()}` };
  runWithRequestContext({ requestId: 'test-a', anonId: null, ownerKey: 'guest:owner-a' }, () => {
    storeGeneratedRecipe(uniqueRecipe);
  });

  assert.equal(runWithRequestContext(
    { requestId: 'test-b', anonId: null, ownerKey: 'guest:owner-b' },
    () => getGeneratedRecipe(uniqueRecipe.id),
  ), null);
  assert.equal(runWithRequestContext(
    { requestId: 'test-a2', anonId: null, ownerKey: 'guest:owner-a' },
    () => getGeneratedRecipe(uniqueRecipe.id)?.id,
  ), uniqueRecipe.id);
});

test('account deletion clears owned generated recipes and scan analyses without touching another user', () => {
  const userA = `user_cache_a_${Date.now()}`;
  const userB = `user_cache_b_${Date.now()}`;
  const recipeA = { ...recipe, id: `delete-recipe-a-${Date.now()}` };
  const recipeB = { ...recipe, id: `delete-recipe-b-${Date.now()}` };
  const analysisContext = {
    analysis: {}, config: {}, mode: 'Normal', source: 'photo', uploadedImage: true,
    visionMs: 1, scanStartedAt: Date.now(),
  } as unknown as Parameters<typeof storeAnalysisContext>[0];
  let analysisIdA = '';
  let analysisIdB = '';

  runWithRequestContext({ requestId: 'store-a', anonId: null, ownerKey: `user:${userA}` }, () => {
    storeGeneratedRecipe(recipeA);
    analysisIdA = storeAnalysisContext(analysisContext).analysisId;
  });
  runWithRequestContext({ requestId: 'store-b', anonId: null, ownerKey: `user:${userB}` }, () => {
    storeGeneratedRecipe(recipeB);
    analysisIdB = storeAnalysisContext(analysisContext).analysisId;
  });

  clearUserData(userA);
  clearUserData(userA);

  assert.equal(runWithRequestContext(
    { requestId: 'read-a', anonId: null, ownerKey: `user:${userA}` },
    () => getGeneratedRecipe(recipeA.id),
  ), null);
  assert.equal(runWithRequestContext(
    { requestId: 'read-b', anonId: null, ownerKey: `user:${userB}` },
    () => getGeneratedRecipe(recipeB.id)?.id,
  ), recipeB.id);
  assert.equal(runWithRequestContext(
    { requestId: 'analysis-a', anonId: null, ownerKey: `user:${userA}` },
    () => getAnalysisContext(analysisIdA).status,
  ), 'missing');
  assert.equal(runWithRequestContext(
    { requestId: 'analysis-b', anonId: null, ownerKey: `user:${userB}` },
    () => getAnalysisContext(analysisIdB).status,
  ), 'found');
});

test('cache cleanup continues after an individual in-memory deletion failure', () => {
  const userId = `user_cleanup_failure_${Date.now()}`;
  const generated = { ...recipe, id: `delete-failure-${Date.now()}` };
  let analysisId = '';
  runWithRequestContext({ requestId: 'seed-failure', anonId: null, ownerKey: `user:${userId}` }, () => {
    storeGeneratedRecipe(generated);
    analysisId = storeAnalysisContext({
      analysis: {}, config: {}, mode: 'Normal', source: 'photo', uploadedImage: true,
      visionMs: 1, scanStartedAt: Date.now(),
    } as unknown as Parameters<typeof storeAnalysisContext>[0]).analysisId;
  });

  const originalDelete = Map.prototype.delete;
  let failedOnce = false;
  Map.prototype.delete = function <K, V>(this: Map<K, V>, key: K): boolean {
    if (!failedOnce && key === generated.id) {
      failedOnce = true;
      throw new Error('simulated cache failure');
    }
    return originalDelete.call(this, key);
  };
  try {
    assert.throws(() => clearUserData(userId), /cleanup did not fully complete/);
  } finally {
    Map.prototype.delete = originalDelete;
  }

  assert.equal(runWithRequestContext(
    { requestId: 'verify-analysis', anonId: null, ownerKey: `user:${userId}` },
    () => getAnalysisContext(analysisId).status,
  ), 'missing');
  clearUserData(userId);
  assert.equal(runWithRequestContext(
    { requestId: 'verify-recipe', anonId: null, ownerKey: `user:${userId}` },
    () => getGeneratedRecipe(generated.id),
  ), null);
});

test('clearing a user with no cached entries is safe', () => {
  assert.doesNotThrow(() => clearUserData(`user_without_cache_${Date.now()}`));
});
