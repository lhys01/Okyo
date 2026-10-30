import assert from 'node:assert/strict';
import test from 'node:test';

import { getAiConfig } from './aiConfig.js';
import { isFableModelOptIn, isApprovedOpenRouterModel } from './modelAllowlist.js';
import { getOpenRouterConfig } from './openRouter.js';
import { getRecipeModelChain } from '../services/openRouterProvider.js';

test('all model environment variables fall back to approved server defaults', () => {
  const names = ['OPENROUTER_VISION_MODEL', 'OPENROUTER_TEXT_MODEL', 'FABLE_MODEL', 'FABLE_ENABLED', 'OPENROUTER_MODEL', 'RECIPE_PAID_FALLBACK_MODEL'];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  try {
    process.env.OPENROUTER_VISION_MODEL = 'attacker/vision';
    process.env.OPENROUTER_TEXT_MODEL = 'attacker/recipe';
    process.env.FABLE_MODEL = 'attacker/fable';
    process.env.FABLE_ENABLED = 'true';
    process.env.OPENROUTER_MODEL = 'attacker/epicure';
    process.env.RECIPE_PAID_FALLBACK_MODEL = 'attacker/fallback';

    const config = getAiConfig({ fableActive: true });
    assert.equal(config.openRouterVisionModel, 'anthropic/claude-fable-5');
    assert.equal(config.openRouterTextModel, 'anthropic/claude-fable-5');
    assert.equal(getOpenRouterConfig().model, 'openai/gpt-4o-mini');
    assert.deepEqual(getRecipeModelChain(getAiConfig()), [
      'openai/gpt-4o-mini', 'google/gemini-3.1-flash-lite', 'google/gemini-3.5-flash',
    ]);
    assert.ok(getRecipeModelChain(config).every(isApprovedOpenRouterModel));
    assert.ok(getRecipeModelChain(config).length <= 3);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('the client model header only accepts the named Fable opt-in', () => {
  assert.equal(isFableModelOptIn('fable'), true);
  assert.equal(isFableModelOptIn('anthropic/claude-fable-5'), false);
  assert.equal(isFableModelOptIn('google/gemini-3.5-flash'), false);
  assert.equal(isFableModelOptIn(undefined), false);
});
