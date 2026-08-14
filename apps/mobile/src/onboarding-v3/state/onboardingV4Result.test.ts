import assert from 'node:assert/strict';
import test from 'node:test';

import { PREFERRED_TRANSFORMATIONS, resolveNotSurePrimaryGoal } from './branchContracts';
import { mergeOnboardingV4DraftIntoEmptyCanonicalProfile } from './onboardingV4CanonicalBridge';
import { emptyOnboardingV4Draft, setOnboardingV4InitialGoal, setOnboardingV4PreferredTransformation } from './onboardingV4Draft';
import { getV4ResolvedTransformationLabel, getV4ResultSectionOrder, resolveV4ResultRecipe } from './onboardingV4Result';

test('result hierarchy is savings-first, health-first, and macros-first by branch', () => {
  assert.equal(getV4ResultSectionOrder('save_money')[0], 'cost');
  assert.equal(getV4ResultSectionOrder('eat_healthier')[0], 'nutrition');
  assert.equal(getV4ResultSectionOrder('hit_macros')[0], 'nutrition');
  assert.ok(getV4ResultSectionOrder('save_money').indexOf('cost') < getV4ResultSectionOrder('save_money').indexOf('nutrition'));
  assert.ok(getV4ResultSectionOrder('eat_healthier').indexOf('nutrition') < getV4ResultSectionOrder('eat_healthier').indexOf('cost'));
});

test('each not_sure transformation resolves before Step 09 and canonical commit receives the same real goal', () => {
  for (const transformation of PREFERRED_TRANSFORMATIONS) {
    const draft = setOnboardingV4PreferredTransformation(setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'not_sure'), transformation);
    const expected = resolveNotSurePrimaryGoal(transformation);
    const canonical = mergeOnboardingV4DraftIntoEmptyCanonicalProfile(draft);
    assert.equal(draft.initialGoal, 'not_sure');
    assert.equal(draft.notSureAnswers.preferredTransformation, transformation);
    assert.equal(draft.resolvedPrimaryGoal, expected);
    assert.equal(canonical.primaryGoal, expected);
    assert.equal(getV4ResultSectionOrder(draft.resolvedPrimaryGoal!)[0], expected === 'save_money' ? 'cost' : 'nutrition');
    assert.ok(getV4ResolvedTransformationLabel(transformation));
  }
});

test('direct goals retain their original hierarchy and ignore transformation resolution', () => {
  for (const goal of ['save_money', 'eat_healthier', 'hit_macros'] as const) {
    const direct = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, goal);
    const unchanged = setOnboardingV4PreferredTransformation(direct, 'more_protein');
    assert.equal(unchanged, direct);
    assert.equal(unchanged.resolvedPrimaryGoal, goal);
    assert.equal(getV4ResultSectionOrder(goal)[0], goal === 'save_money' ? 'cost' : 'nutrition');
  }
});

test('stable scanSessionId resolves the exact committed canonical recipe without insertion', () => {
  const recipe = { id: 'recipe-stable-session', recipeId: 'recipe-stable-session', title: 'Exact bowl', ingredients: [{ name: 'Tofu', quantity: '1 block' }], steps: ['Cook it'] } as never;
  const recipes = { 'recipe-stable-session': recipe };
  assert.equal(resolveV4ResultRecipe(recipes, null, 'stable-session'), recipe);
  assert.equal(Object.keys(recipes).length, 1);
  assert.equal(resolveV4ResultRecipe(recipes, 'missing', 'stable-session'), null);
});
