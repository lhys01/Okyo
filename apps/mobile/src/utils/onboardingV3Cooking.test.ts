import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { initialOnboardingV3State, onboardingV3Reducer } from '../onboarding-v3/controller/onboardingV3Machine';

test('guided cooking is optional and reports completion explicitly', () => {
  const cooking = { ...initialOnboardingV3State, step: 'cooking' as const, recipeId: 'recipe-1' };
  assert.equal(onboardingV3Reducer(cooking, { type: 'COOKING_EXITED' }).step, 'complete');
  const complete = onboardingV3Reducer(cooking, { type: 'COOKING_COMPLETED' });
  assert.equal(complete.step, 'cookingComplete');
  assert.equal(onboardingV3Reducer(complete, { type: 'CONTINUE' }).step, 'complete');
});

test('V3 cooking never enters the main tab navigator', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/screens/OnboardingCookingScreen.tsx'), 'utf8');
  assert.doesNotMatch(source, /MainTabs|RecipeStepsScreen|navigation\.navigate/);
  assert.match(source, /onComplete\(\)/);
});
