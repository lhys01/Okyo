import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiConfig } from '../config/aiConfig.js';
import type { ProviderQuota } from '../quota/providerQuota.js';
import {
  foodImageAnalysisSchema,
  type FoodImageAnalysis,
} from './aiService.js';
import {
  analyzeFoodImageWithOpenRouter,
  generateRecipeWithOpenRouter,
  normalizeFullRecipeOutput,
  openRouterRecipeOutputSchema,
} from './openRouterProvider.js';
import { RecipeValidationError } from './recipeGenerationError.js';
import {
  fullCoreRepairInitialFixture,
  fullCoreRepairSuccessfulPatchFixture,
  fullCoreRepairUnknownIngredientPatchFixture,
} from './recipeRepairRegression.fixture.js';
import { ScanDeadlineExceededError } from './scanDeadline.js';
import {
  createScanAggregateTiming,
  getScanAggregateTimingEvent,
  recordLogicalProviderCall,
  recordProviderAttempt,
} from '../telemetry/scanTelemetry.js';

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

function fullRecipeRepairPatch(
  recipe: Record<string, unknown> = fullRecipe(),
): { ingredients: string[]; steps: Array<Record<string, unknown>> } {
  return {
    ingredients: [...(recipe.ingredients as string[])],
    steps: (recipe.steps as Array<Record<string, unknown>>).map((step) => ({
      title: String(step.title ?? ''),
      step: String(step.step ?? step.instruction ?? ''),
      ...(step.doneWhen ? { doneWhen: String(step.doneWhen) } : {}),
      ...(step.safetyNote ? { safetyNote: String(step.safetyNote) } : {}),
    })),
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
    const withoutStepMetadata = fullRecipe();
    withoutStepMetadata.steps = (withoutStepMetadata.steps as Array<Record<string, unknown>>)
      .map(({ ingredients: _ingredients, ingredientsUsed: _ingredientsUsed, tools: _tools, toolsUsed: _toolsUsed, ...step }) => step);
    return providerResponse(withoutStepMetadata);
  };
  try {
    const timing = createScanAggregateTiming({ requestId: 'full-initial-success' });
    // A completed vision call precedes recipe generation in the real scan.
    recordLogicalProviderCall(timing);
    recordProviderAttempt(timing);
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Initial Full Tomato Garlic Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-initial-success',
      timing,
    });
    assert.equal(calls, 1);
    assert.equal(timing.logicalProviderCalls, 2);
    assert.equal(timing.providerAttempts, 2);
    assert.deepEqual(timing.repairReasons, []);
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

test('production-shaped full-core fixture captures every stage and succeeds after one targeted repair', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  let repairPrompt = '';
  const maxTokenRequests: number[] = [];
  const initialOutput = structuredClone(fullCoreRepairInitialFixture);
  const repairedOutput = structuredClone(fullCoreRepairSuccessfulPatchFixture);
  const fixtureAnalysis = analysis({ dishName: 'Repair Full Tomato Garlic Pasta' });
  const initialNormalized = normalizeFullRecipeOutput(
    openRouterRecipeOutputSchema.parse(initialOutput),
    fixtureAnalysis,
  );

  globalThis.fetch = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as {
      max_tokens?: number;
      messages?: Array<{ role?: string; content?: string }>;
    };
    maxTokenRequests.push(body.max_tokens ?? 0);
    if (calls === 1) return providerResponse(initialOutput);
    repairPrompt = body.messages?.find((message) => message.role === 'user')?.content ?? '';
    return providerResponse(repairedOutput);
  };
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    const timing = createScanAggregateTiming({ requestId: 'full-repair-success' });
    recordLogicalProviderCall(timing);
    recordProviderAttempt(timing);
    const output = await generateRecipeWithOpenRouter({
      analysis: fixtureAnalysis,
      config: { ...fullConfig, maxOutputTokens: 1_024 },
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-repair-success',
      timing,
    });
    assert.equal(calls, 2);
    assert.deepEqual(maxTokenRequests, [1_024, 1_024]);
    assert.equal(timing.logicalProviderCalls, 3);
    assert.equal(timing.providerAttempts, 3);
    assert.deepEqual(timing.repairReasons, ['step_missing_time_or_completion_cue']);
    assert.equal(output.steps.length, 7);
    assert.deepEqual(
      typeof initialNormalized.steps[1] === 'object' && initialNormalized.steps[1].ingredients,
      ['olive oil'],
    );
    assert.equal(
      typeof output.steps[1] === 'object' && output.steps[1].doneWhen,
      'The olive oil looks glossy and moves easily across the skillet.',
    );
    assert.match(repairPrompt, /step_missing_time_or_completion_cue/);
    assert.match(repairPrompt, /exactly two keys/);
    assert.match(repairPrompt, /Exact invalid active-cooking step indices \(zero-based\): \[1\]/);
    assert.match(repairPrompt, /do not introduce, substitute, or remove any ingredient concept/i);
    assert.match(repairPrompt, /Full canonical ingredient list/);
    assert.match(repairPrompt, /Complete previous recipe object/);
    assert.match(repairPrompt, /8 oz spaghetti/);
    const telemetryLabels = new Set([
      '[recipe_contract_size]',
      '[token_usage]',
      '[scan_metric]',
      '[failover_summary]',
      '[recipe_validation_details]',
      '[recipe_repair_validation]',
    ]);
    const telemetry = events.filter(([label]) => telemetryLabels.has(String(label)));
    assert.ok([...telemetryLabels].every((label) =>
      telemetry.some(([actual]) => actual === label)));
    assert.ok(telemetry.every(([, value]) =>
      (value as { requestId?: string }).requestId === 'full-repair-success'));
    const repairValidation = events.find(([label]) => label === '[recipe_repair_validation]')?.[1] as {
      initialInvalidStepIndices: number[];
      repairedInvalidStepIndices: number[];
      unknownIngredientsBeforeRepair: string[];
      unknownIngredientsAfterRepair: string[];
      presentationOnlyStepIndices: number[];
      repairChangedFields: string[];
    };
    assert.deepEqual(repairValidation.initialInvalidStepIndices, [1]);
    assert.deepEqual(repairValidation.repairedInvalidStepIndices, []);
    assert.deepEqual(repairValidation.unknownIngredientsBeforeRepair, []);
    assert.deepEqual(repairValidation.unknownIngredientsAfterRepair, []);
    assert.deepEqual(repairValidation.presentationOnlyStepIndices, [5, 6]);
    assert.deepEqual(repairValidation.repairChangedFields, ['steps.1.doneWhen']);
    const aggregate = getScanAggregateTimingEvent(timing, 'success');
    assert.equal(aggregate.logicalProviderCalls, 3);
    assert.equal(aggregate.providerAttempts, 3);
    assert.equal(aggregate.recipeMs, timing.recipeMs);
    assert.equal(aggregate.repairMs, timing.repairMs);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('repair output cannot introduce an unlisted ingredient before merge', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1
      ? structuredClone(fullCoreRepairInitialFixture)
      : structuredClone(fullCoreRepairUnknownIngredientPatchFixture));
  };
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    const timing = createScanAggregateTiming({ requestId: 'full-repair-unknown-ingredient' });
    recordLogicalProviderCall(timing);
    recordProviderAttempt(timing);
    await assert.rejects(
      generateRecipeWithOpenRouter({
        analysis: analysis({ dishName: 'Unknown Ingredient Repair Pasta' }),
        config: fullConfig,
        mode: 'Restaurant Copy',
        quota,
        requestId: 'full-repair-unknown-ingredient',
        timing,
      }),
      (error: unknown) => error instanceof RecipeValidationError &&
        error.issues.includes('step_uses_unlisted_ingredients'),
    );
    assert.equal(calls, 2);
    assert.equal(timing.logicalProviderCalls, 3);
    assert.equal(timing.providerAttempts, 3);
    const validation = events.find(([label]) => label === '[recipe_repair_validation]')?.[1] as {
      initialInvalidStepIndices: number[];
      repairedInvalidStepIndices: number[];
      unknownIngredientsBeforeRepair: string[];
      unknownIngredientsAfterRepair: string[];
      presentationOnlyStepIndices: number[];
      repairChangedFields: string[];
    };
    assert.deepEqual(validation.initialInvalidStepIndices, [1]);
    assert.deepEqual(validation.repairedInvalidStepIndices, []);
    assert.deepEqual(validation.unknownIngredientsBeforeRepair, []);
    assert.deepEqual(validation.unknownIngredientsAfterRepair, ['butter']);
    assert.deepEqual(validation.presentationOnlyStepIndices, [5, 6]);
    assert.ok(validation.repairChangedFields.includes('steps.1.step'));
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('safe generic ingredient aliases remain valid in a repaired step', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const aliasPatch = structuredClone(fullCoreRepairSuccessfulPatchFixture);
  aliasPatch.steps[1] = {
    ...aliasPatch.steps[1],
    step: 'Heat the oil in the large skillet for 1 minute until glossy.',
  };
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1
      ? structuredClone(fullCoreRepairInitialFixture)
      : aliasPatch);
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Alias Repair Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-repair-safe-alias',
    });
    assert.equal(calls, 2);
    assert.match(typeof output.steps[1] === 'object' ? output.steps[1].step : '', /\boil\b/i);
    assert.deepEqual(
      typeof output.steps[1] === 'object' && output.steps[1].ingredients,
      ['olive oil'],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an invalid full repair schema fails closed after one repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1
      ? structuredClone(fullCoreRepairInitialFixture)
      : { ingredients: fullCoreRepairInitialFixture.ingredients, unexpected: true });
  };
  try {
    await assert.rejects(
      generateRecipeWithOpenRouter({
        analysis: analysis({ dishName: 'Invalid Repair Schema Pasta' }),
        config: fullConfig,
        mode: 'Restaurant Copy',
        quota,
        requestId: 'full-repair-invalid-schema',
      }),
      (error: unknown) => error instanceof RecipeValidationError &&
        error.issues.includes('repair_invalid_schema'),
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('vague completion language remains invalid after the one repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const vaguePatch = structuredClone(fullCoreRepairSuccessfulPatchFixture);
  vaguePatch.steps[1] = {
    ...vaguePatch.steps[1],
    doneWhen: 'The oil is ready and cooked thoroughly.',
  };
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1
      ? structuredClone(fullCoreRepairInitialFixture)
      : vaguePatch);
  };
  try {
    let caught: unknown;
    try {
      await generateRecipeWithOpenRouter({
        analysis: analysis({ dishName: 'Vague Repair Pasta' }),
        config: fullConfig,
        mode: 'Restaurant Copy',
        quota,
        requestId: 'full-repair-vague-cue',
      });
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof RecipeValidationError);
    assert.ok(caught.issues.includes('step_missing_time_or_completion_cue'));
    assert.ok(caught.issues.includes('vague_step'));
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('preparation and presentation-only steps do not trigger a content repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const recipe = fullRecipe();
  recipe.steps = (recipe.steps as Array<Record<string, unknown>>).map((step, index, steps) => {
    if (index === 0) {
      return { title: 'Gather', step: 'Gather the spaghetti, water, olive oil, garlic, tomatoes, and salt.' };
    }
    if (index === steps.length - 1) {
      return { title: 'Serve', step: 'Divide the tomato garlic pasta into bowls, garnish, and serve.' };
    }
    return step;
  });
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(recipe);
  };
  try {
    await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Presentation Step Tomato Garlic Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-presentation-step',
    });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extra cookable steps do not trigger an expensive repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const recipe = fullRecipe();
  const steps = recipe.steps as Array<Record<string, unknown>>;
  recipe.steps = [...steps, ...steps.slice(0, 4)];
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(recipe);
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Detailed Tomato Garlic Pasta' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-extra-steps',
    });
    assert.equal(output.steps.length, 9);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('four visible ingredients do not make an ordinary dish a platter', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(fullRecipe());
  };
  try {
    await generateRecipeWithOpenRouter({
      analysis: analysis({
        dishName: 'Ordinary Tomato Garlic Pasta',
        detectedComponents: [
          { name: 'spaghetti', confidence: 0.9 },
          { name: 'tomatoes', confidence: 0.9 },
          { name: 'garlic', confidence: 0.9 },
          { name: 'parsley', confidence: 0.9 },
        ],
      }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-not-false-platter',
    });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('vision token and provider telemetry retain the scan request ID', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  globalThis.fetch = async () => providerResponse({
    dishName: 'Tomato Garlic Pasta',
    scanState: 'clear_food',
    broadDishCategory: 'pasta/noodles',
    cuisine: 'Italian',
    confidence: 0.92,
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
      cookingMethod: 'boiled and sauteed',
    },
    confidenceReason: 'The dish is clearly visible.',
  });
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    const requestId = 'vision-request-id-test';
    const timing = createScanAggregateTiming({ requestId });
    await analyzeFoodImageWithOpenRouter({
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId,
      timing,
    });
    const telemetry = events.filter(([label]) =>
      label === '[token_usage]' || label === '[scan_metric]');
    assert.ok(telemetry.some(([label]) => label === '[token_usage]'));
    assert.ok(telemetry.some(([label, value]) =>
      label === '[scan_metric]' &&
      (value as { stage?: string }).stage === 'provider_vision'));
    assert.ok(telemetry.every(([, value]) =>
      (value as { requestId?: string }).requestId === requestId));
    assert.equal(timing.logicalProviderCalls, 1);
    assert.equal(timing.providerAttempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
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
    return providerResponse(calls === 1 ? unlistedButter : fullRecipeRepairPatch());
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
