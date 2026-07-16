import assert from 'node:assert/strict';
import test from 'node:test';

import { getAiConfig } from './aiConfig.js';

test('compact recipe pipeline is opt-in and defaults off', () => {
  const previous = process.env.COMPACT_RECIPE_PIPELINE;
  delete process.env.COMPACT_RECIPE_PIPELINE;
  assert.equal(getAiConfig().compactRecipeEnabled, false);
  process.env.COMPACT_RECIPE_PIPELINE = 'true';
  assert.equal(getAiConfig().compactRecipeEnabled, true);
  if (previous === undefined) delete process.env.COMPACT_RECIPE_PIPELINE;
  else process.env.COMPACT_RECIPE_PIPELINE = previous;
});
