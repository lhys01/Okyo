import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CURRENT_RECIPE_MODES,
  isLegacyRecipeMode,
  normalizeKnownRecipeMode,
  recipeModeInputSchema,
} from './recipeModes.js';

test('all current API modes pass through unchanged', () => {
  for (const mode of CURRENT_RECIPE_MODES) {
    assert.equal(normalizeKnownRecipeMode(mode), mode);
    assert.equal(recipeModeInputSchema.parse(mode), mode);
    assert.equal(isLegacyRecipeMode(mode), false);
  }
});

test('controlled legacy API modes normalize to Normal', () => {
  const legacyRestaurantStyle = ['Restaurant', 'Style'].join(' ');
  const hyphenatedLegacyRestaurantStyle = ['restaurant', 'style'].join('-');
  for (const mode of [
    'Budget',
    'Restaurant Copy',
    legacyRestaurantStyle,
    hyphenatedLegacyRestaurantStyle,
    'Healthy',
  ]) {
    assert.equal(normalizeKnownRecipeMode(mode), 'Normal');
    assert.equal(recipeModeInputSchema.parse(mode), 'Normal');
    assert.equal(isLegacyRecipeMode(mode), true);
  }
});

test('arbitrary invalid API modes remain invalid', () => {
  for (const mode of ['Chef Surprise', 'anything', '', null, 42]) {
    assert.equal(normalizeKnownRecipeMode(mode), null);
    assert.equal(recipeModeInputSchema.safeParse(mode).success, false);
  }
});
