import assert from 'node:assert/strict';
import test from 'node:test';

import { migrateOkyoPersistedState } from './persistedStateMigration';

test('preserves durable user and scan data while dropping retired fields', () => {
  const migrated = migrateOkyoPersistedState({
    latestScanStatus: 'success',
    latestScanRecipe: { id: 'recipe-1', title: 'Noodles' },
    savedRecipes: [{ id: 'recipe-1', title: 'Noodles' }],
    savedFoodIdeas: [{ id: 'idea-1', title: 'Soup', extractedRecipe: { id: 'recipe-2', title: 'Soup' } }],
    xp: 42,
    awardedXpEvents: ['scan-1', 'scan-1', 'save-1'],
    isPremium: true,
    leaderboardEntries: [{ id: 'fake-user' }],
    completedChallenges: [{ id: 'challenge-1' }],
    weeklyGoal: '7_meals',
  });

  assert.deepEqual(migrated.savedRecipes, [
    { id: 'recipe-1', title: 'Noodles' },
    { id: 'recipe-2', title: 'Soup' },
  ]);
  assert.equal('savedFoodIdeas' in migrated, false);
  assert.deepEqual(migrated.recentScanRecipes, [{ id: 'recipe-1', title: 'Noodles' }]);
  assert.equal(migrated.latestScanStatus, 'success');
  assert.equal('xp' in migrated, false);
  assert.equal('awardedXpEvents' in migrated, false);
  assert.equal('isPremium' in migrated, false);
  assert.equal('leaderboardEntries' in migrated, false);
  assert.equal('completedChallenges' in migrated, false);
  assert.equal('weeklyGoal' in migrated, false);
});

test('returns safe defaults for corrupt persisted values', () => {
  assert.deepEqual(migrateOkyoPersistedState(null), {});
  assert.deepEqual(migrateOkyoPersistedState(['not', 'state']), {});

  const migrated = migrateOkyoPersistedState({
    savedRecipes: 'not-an-array',
    savedFoodIdeas: [null, 'bad', { id: 'idea-1' }],
    xp: Number.NaN,
    selectedMode: 'invalid',
    latestScanStatus: 'unknown',
  });

  assert.deepEqual(migrated.savedRecipes, []);
  assert.equal('savedFoodIdeas' in migrated, false);
  assert.equal('xp' in migrated, false);
  assert.equal('selectedMode' in migrated, false);
  assert.equal('latestScanStatus' in migrated, false);
});

test('preserves valid grocery selections and caps checked item history', () => {
  const groceryCheckedItemIds = Array.from({ length: 1_010 }, (_, index) => `item-${index}`);
  const migrated = migrateOkyoPersistedState({
    savedRecipes: [{ id: 'recipe-1' }, { id: 'recipe-2' }],
    groceryRecipeIds: ['recipe-1', 'missing', 'recipe-1'],
    groceryCheckedItemIds,
  });

  assert.deepEqual(migrated.groceryRecipeIds, ['recipe-1']);
  assert.equal((migrated.groceryCheckedItemIds as string[]).length, 1_000);
  assert.equal((migrated.groceryCheckedItemIds as string[])[0], 'item-10');
});

test('safely migrates every known persisted store version', () => {
  for (const persistedVersion of [0, 1, 2]) {
    const migrated = migrateOkyoPersistedState({
      savedRecipes: [{ id: `recipe-${persistedVersion}` }],
      cookingProgress: {
        recipeId: `recipe-${persistedVersion}`,
        stepIndex: 2.8,
        completed: persistedVersion === 2,
      },
      hasCompletedOnboarding: true,
      userRestaurantPrice: 19.99,
    }, persistedVersion);

    assert.deepEqual(migrated.savedRecipes, [{ id: `recipe-${persistedVersion}` }]);
    assert.deepEqual(migrated.cookingProgress, {
      recipeId: `recipe-${persistedVersion}`,
      stepIndex: 2,
      completed: persistedVersion === 2,
    });
    assert.equal('hasCompletedOnboarding' in migrated, false);
    assert.equal('userRestaurantPrice' in migrated, false);
  }
});
