import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiConfig } from '../config/aiConfig.js';
import type { ProviderQuota } from '../quota/providerQuota.js';
import {
  foodImageAnalysisSchema,
  type FoodImageAnalysis,
} from './aiService.js';
import {
  generateRecipeWithOpenRouter,
} from './openRouterProvider.js';
import { ScanDeadlineExceededError } from './scanDeadline.js';

const fullConfig: AiConfig = {
  enabled: true,
  provider: 'openrouter',
  openRouterApiKey: 'server-only-test-key',
  openRouterVisionModel: 'vision-model',
  openRouterTextModel: 'recipe-model',
  timeoutMs: 1_000,
  maxOutputTokens: 2_048,
  compactRecipeEnabled: false,
  fableEnabled: false,
  fableModel: 'fable-model',
  isFableActive: false,
};

const quota: ProviderQuota = {
  async reserveAttempt(input) {
    return { spendEventId: `spend-${input.operation}`, operation: input.operation };
  },
  async completeAttempt() {},
};

function analysis(overrides: Partial<FoodImageAnalysis> = {}): FoodImageAnalysis {
  return foodImageAnalysisSchema.parse({
    candidateScanId: 'full-reliability-fixture',
    aiSource: 'openrouter_ai',
    dishName: 'Tomato Garlic Pasta',
    cuisine: 'Italian',
    restaurantStyle: 'Restaurant-style',
    scanState: 'clear_food',
    broadDishCategory: 'pasta/noodles',
    confidence: 0.9,
    confidenceReason: 'Clear plated pasta.',
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['spaghetti', 'tomatoes', 'garlic'],
    likelyIngredients: ['olive oil', 'salt'],
    possibleDishNames: ['Tomato Garlic Pasta'],
    visibleComponents: {
      protein: '',
      sauce: 'tomato garlic sauce',
      baseStarch: 'spaghetti',
      vegetables: 'tomatoes',
      toppingsGarnish: '',
      cookingMethod: 'boiled and sautéed',
    },
    restaurantPriceEstimate: 0,
    homemadeCostEstimate: 0,
    matchScore: 8.5,
    difficulty: 'Easy',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    notes: ['fixture'],
    detectedComponents: [],
    ...overrides,
  });
}

function fullRecipe(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: 'Tomato Garlic Pasta',
    ingredients: [
      '8 oz spaghetti',
      '8 cups water',
      '2 tbsp olive oil',
      '3 cloves garlic, minced',
      '1 cup tomatoes, chopped',
      '1/2 tsp salt',
    ],
    equipment: ['large pot', 'large skillet'],
    steps: [
      { title: 'Boil Water', step: 'Bring 8 cups water to a rolling boil for 8 minutes.' },
      { title: 'Cook Pasta', step: 'Cook the spaghetti for 9 minutes until al dente.' },
      {
        title: 'Heat Oil',
        step: 'Heat the olive oil in a large skillet for 1 minute until shimmering.',
        ingredients: ['oil'],
      },
      { title: 'Build Sauce', step: 'Cook the garlic and tomatoes for 5 minutes until softened and fragrant.' },
      { title: 'Finish Pasta', step: 'Toss the spaghetti with the tomato sauce for 2 minutes until evenly coated.' },
    ],
    prepTime: 8,
    cookTime: 17,
    totalTime: 25,
    servings: 2,
    skillLevel: 'Easy',
    ...overrides,
  };
}

test('full recipe succeeds on the initial provider output with local step metadata', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let maxTokens = 0;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as { max_tokens?: number };
    maxTokens = body.max_tokens ?? 0;
    return providerResponse(fullRecipe());
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Initial Full Tomato Garlic Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-initial-success',
    });
    assert.equal(calls, 1);
    assert.equal(maxTokens, 1_400);
    const step = output.steps[2];
    assert.equal(typeof step === 'object' && step.stepNumber, 3);
    assert.deepEqual(typeof step === 'object' && step.ingredients, ['olive oil']);
    assert.ok(typeof step === 'object' && step.tools.includes('large skillet'));
    assert.deepEqual(output.substitutions, []);
    assert.deepEqual(output.spicePairings, []);
    assert.equal(output.description, '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('full recipe succeeds after one complete targeted repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let repairPrompt = '';
  const initialOutput = fullRecipe({
    steps: [
      ...((fullRecipe().steps as Array<Record<string, unknown>>).slice(0, 2)),
      { title: 'Heat Oil', step: 'Heat the olive oil in a large skillet.' },
      ...((fullRecipe().steps as Array<Record<string, unknown>>).slice(3)),
    ],
  });
  const repairedOutput = fullRecipe();

  globalThis.fetch = async (_url, init) => {
    calls += 1;
    if (calls === 1) return providerResponse(initialOutput);
    const body = JSON.parse(String(init?.body)) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    repairPrompt = body.messages?.find((message) => message.role === 'user')?.content ?? '';
    return providerResponse(repairedOutput);
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Repair Full Tomato Garlic Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-repair-success',
    });
    assert.equal(calls, 2);
    assert.equal(output.steps.length, 5);
    assert.match(repairPrompt, /step_missing_time_or_completion_cue/);
    assert.match(repairPrompt, /Full canonical ingredient list/);
    assert.match(repairPrompt, /Complete previous recipe object/);
    assert.match(repairPrompt, /8 oz spaghetti/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a truly unlisted full-recipe ingredient triggers the one repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const unlistedButter = fullRecipe({
    steps: (fullRecipe().steps as Array<Record<string, unknown>>).map((step, index) =>
      index === 2
        ? { ...step, step: 'Heat butter in a large skillet for 1 minute until melted.' }
        : step),
  });
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1 ? unlistedButter : fullRecipe());
  };
  try {
    await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Closure Repair Tomato Garlic Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-closure-repair',
    });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the recipe path preserves the stable scan-deadline error', async () => {
  await assert.rejects(
    generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Expired Deadline Tomato Garlic Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-expired-deadline',
      deadlineAt: Date.now() - 1,
    }),
    ScanDeadlineExceededError,
  );
});

function providerResponse(content: unknown): Response {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      message: { content: JSON.stringify(content) },
    }],
    usage: {
      prompt_tokens: 500,
      completion_tokens: 350,
      total_tokens: 850,
      cost: 0.001,
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
