import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('V3 recipe preview has no identification or cooking gate', () => {
  const preview = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/screens/OnboardingRecipePreview.tsx'), 'utf8');
  const machine = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/controller/onboardingV3Machine.ts'), 'utf8');
  for (const forbidden of ['Quick Check', 'Does this look right', 'Yes, looks good', 'hasAcceptedOnboardingRecipe']) {
    assert.doesNotMatch(preview, new RegExp(forbidden, 'i'));
    assert.doesNotMatch(machine, new RegExp(forbidden, 'i'));
  }
  assert.match(machine, /event\.type === 'CONTINUE' && state\.recipeId[\s\S]{0,100}step: 'complete'/);
});
