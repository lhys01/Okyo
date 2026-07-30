import assert from 'node:assert/strict';
import test from 'node:test';

// Keep tests hermetic: no analytics file writes during the run.
process.env.EPICURE_ANALYTICS = 'off';

import type { OpenRouterConfig } from '../config/openRouter.js';
import {
  buildEpicurePromptSection,
  countSuggestions,
  enrichRecipeContext,
  getEpicureSuggestions,
  normalizeEpicureSuggestions,
  normalizeIngredientList,
  type EnrichedRecipeContext,
} from './epicureService.js';

function makeConfig(overrides: Partial<OpenRouterConfig> = {}): OpenRouterConfig {
  return {
    apiKey: 'sk-test-key',
    model: 'openai/gpt-4o-mini',
    epicureEnabled: true,
    timeoutMs: 12_000,
    ...overrides,
  };
}

// ── Requirement 11: enrichment returns valid JSON (strict shape) ──────────────

test('normalizeEpicureSuggestions coerces a valid model response into the strict shape', () => {
  const raw = {
    complementaryIngredients: ['basil', 'parmesan', 'garlic'],
    healthySubstitutions: { cream: 'greek yogurt', butter: 'olive oil' },
    budgetSubstitutions: { parmesan: 'pecorino', 'heavy cream': 'milk + flour' },
  };
  const result = normalizeEpicureSuggestions(raw);
  assert.deepEqual(result.complementaryIngredients, ['basil', 'parmesan', 'garlic']);
  assert.deepEqual(result.healthySubstitutions, { cream: 'greek yogurt', butter: 'olive oil' });
  assert.equal(result.budgetSubstitutions.parmesan, 'pecorino');
});

test('normalizeEpicureSuggestions tolerates garbage/missing fields without throwing', () => {
  assert.deepEqual(normalizeEpicureSuggestions(null), {
    complementaryIngredients: [],
    healthySubstitutions: {},
    budgetSubstitutions: {},
  });
  assert.deepEqual(normalizeEpicureSuggestions('not an object'), {
    complementaryIngredients: [],
    healthySubstitutions: {},
    budgetSubstitutions: {},
  });
  // Wrong inner types collapse to empty rather than crash.
  const partial = normalizeEpicureSuggestions({
    complementaryIngredients: 'tomato',
    healthySubstitutions: ['nope'],
    budgetSubstitutions: { good: 'swap', bad: 42 },
  });
  assert.deepEqual(partial.complementaryIngredients, []);
  assert.deepEqual(partial.healthySubstitutions, {});
  assert.deepEqual(partial.budgetSubstitutions, { good: 'swap' });
});

test('normalizeIngredientList trims, dedupes (case-insensitive), and caps length', () => {
  const result = normalizeIngredientList(['  Tomato ', 'tomato', 'BASIL', '', 42, 'garlic']);
  assert.deepEqual(result, ['Tomato', 'BASIL', 'garlic']);
});

// ── Requirement 9 + 11: feature flag works ────────────────────────────────────

test('enrichRecipeContext returns null when EPICURE_ENABLED is off (no provider call)', async () => {
  const result = await enrichRecipeContext(
    { dishName: 'Creamy Tomato Pasta', ingredients: ['pasta', 'tomato'], mode: 'Healthier' },
    makeConfig({ epicureEnabled: false }),
  );
  assert.equal(result, null);
});

// ── Requirement 11: missing API key handled gracefully ────────────────────────

test('getEpicureSuggestions returns empty suggestions when the API key is missing', async () => {
  const result = await getEpicureSuggestions(
    ['pasta', 'tomato', 'cream'],
    makeConfig({ apiKey: undefined }),
  );
  assert.deepEqual(result, {
    complementaryIngredients: [],
    healthySubstitutions: {},
    budgetSubstitutions: {},
  });
});

test('enrichRecipeContext returns null when there are no ingredients to enrich', async () => {
  const result = await enrichRecipeContext(
    { dishName: 'Mystery Dish', ingredients: [], mode: 'Normal' },
    makeConfig(),
  );
  assert.equal(result, null);
});

// ── Requirement 11: recipe generation still works when Epicure fails ──────────
// When enrichment is null the injected prompt section is empty, so the recipe
// prompt is byte-for-byte unchanged from the pre-Epicure behavior.

test('buildEpicurePromptSection returns empty string for null enrichment (base prompt unchanged)', () => {
  assert.equal(buildEpicurePromptSection(null, 'Normal'), '');
  assert.equal(buildEpicurePromptSection(null, 'Healthier'), '');
  assert.equal(buildEpicurePromptSection(null, 'Lighter'), '');
});

// ── Requirement 7: mode-specific behavior ─────────────────────────────────────

const enrichment: EnrichedRecipeContext = {
  detectedIngredients: ['pasta', 'tomato', 'cream'],
  complementaryIngredients: ['basil', 'parmesan'],
  healthySubstitutions: { cream: 'greek yogurt' },
  budgetSubstitutions: { parmesan: 'pecorino' },
};

test('current presentation modes do not request different recipe variants', () => {
  for (const mode of ['Normal', 'Lighter', 'Healthier', 'More Protein'] as const) {
    const section = buildEpicurePromptSection(enrichment, mode);
    assert.match(section, /Complementary ingredients: basil, parmesan/);
    assert.match(section, /Optional wellness-oriented substitutions: cream → greek yogurt/);
    assert.match(section, /Optional cost-conscious substitutions: parmesan → pecorino/);
    assert.match(section, /presentation mode is not a recipe variant/i);
  }
});

test('countSuggestions sums complementary + both substitution maps', () => {
  assert.equal(countSuggestions(enrichment), 4);
  assert.equal(
    countSuggestions({ complementaryIngredients: [], healthySubstitutions: {}, budgetSubstitutions: {} }),
    0,
  );
});
