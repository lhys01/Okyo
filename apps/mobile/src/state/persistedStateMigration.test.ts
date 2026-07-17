import assert from 'node:assert/strict';
import test from 'node:test';

import { migrateOkyoPersistedState } from './persistedStateMigration';

test('preserves durable user and scan data while dropping retired fields', () => {
  const migrated = migrateOkyoPersistedState({
    hasCompletedOnboarding: true,
    latestScanStatus: 'success',
    latestScanRecipe: { id: 'recipe-1', title: 'Noodles' },
    savedRecipes: [{ id: 'recipe-1', title: 'Noodles' }],
    savedFoodIdeas: [{ id: 'idea-1', title: 'Soup' }],
    xp: 42,
    awardedXpEvents: ['scan-1', 'scan-1', 'save-1'],
    isPremium: true,
    leaderboardEntries: [{ id: 'fake-user' }],
    completedChallenges: [{ id: 'challenge-1' }],
    weeklyGoal: '7_meals',
  });

  assert.deepEqual(migrated.savedRecipes, [{ id: 'recipe-1', title: 'Noodles' }]);
  assert.deepEqual(migrated.savedFoodIdeas, [{ id: 'idea-1', title: 'Soup' }]);
  assert.deepEqual(migrated.awardedXpEvents, ['scan-1', 'save-1']);
  assert.equal(migrated.hasCompletedOnboarding, true);
  assert.equal(migrated.latestScanStatus, 'success');
  assert.equal(migrated.xp, 42);
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
  assert.deepEqual(migrated.savedFoodIdeas, [{ id: 'idea-1' }]);
  assert.equal(migrated.xp, 0);
  assert.equal('selectedMode' in migrated, false);
  assert.equal('latestScanStatus' in migrated, false);
});

test('caps migrated XP event history at the current store limit', () => {
  const awardedXpEvents = Array.from({ length: 5_010 }, (_, index) => `event-${index}`);
  const migrated = migrateOkyoPersistedState({ awardedXpEvents });

  assert.equal((migrated.awardedXpEvents as string[]).length, 5_000);
  assert.equal((migrated.awardedXpEvents as string[])[0], 'event-10');
});
