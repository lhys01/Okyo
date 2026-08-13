import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGoalContext } from './goalContext';
import { emptyPersonalizedProfile } from './personalizedOnboarding';

test('recipe generation context carries macro targets and only relevant preferences', () => {
  const context = buildGoalContext({
    ...emptyPersonalizedProfile,
    primaryGoal: 'hit_macros',
    secondaryGoals: ['hit_macros', 'save_time'],
    nutritionTargets: {
      calories: 2450,
      proteinGrams: 165,
      carbsGrams: 290,
      fatGrams: 75,
      source: 'estimated',
      calculationVersion: 1,
      calculatedAt: '2026-08-08T00:00:00.000Z',
    },
  });

  assert.deepEqual(context.nutritionTargets, {
    calories: 2450,
    proteinGrams: 165,
    carbsGrams: 290,
    fatGrams: 75,
  });
  assert.equal(context.primaryGoal, 'hit_macros');
  assert.deepEqual(context.secondaryGoals, ['hit_macros', 'save_time']);
  assert.equal(context.handsOnTimeMinutes, undefined);
});

test('savings context carries servings, time, and the practical cooking friction', () => {
  const context = buildGoalContext({
    ...emptyPersonalizedProfile,
    primaryGoal: 'save_money',
    savings: {
      ...emptyPersonalizedProfile.savings,
      householdSize: '3–4 people',
      handsOnTimeMinutes: 20,
      cookingPriority: 'Balance cost and taste',
      orderingFriction: ["I don't know what to make", "I don't have much time"],
    },
  });

  assert.equal(context.defaultServings, 4);
  assert.equal(context.handsOnTimeMinutes, 20);
  assert.equal(context.cookingPriority, 'Balance cost and taste');
  assert.equal(context.orderingFriction, "I don't know what to make, I don't have much time");
});
