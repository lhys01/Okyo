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
  hasUsableIngredientAmount,
  normalizeFullRecipeOutput,
  openRouterRecipeOutputSchema,
} from './openRouterProvider.js';
import { RecipeValidationError } from './recipeGenerationError.js';
import {
  fullCoreIndexThreeInitialFixture,
  fullCoreIndexThreeSensoryPatchFixture,
  fullCoreIndexThreeTimePatchFixture,
  fullCoreMochiMixedInitialFixture,
  fullCoreMochiMixedSuccessfulPatchFixture,
  fullCoreRepairInitialFixture,
  fullCoreRawTunaInitialFixture,
  fullCoreRawTunaSuccessfulPatchFixture,
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

type RepairTraceEvent = {
  requestedIngredientIndices: number[];
  returnedIngredientIndices: number[];
  missingIngredientIndices: number[];
  duplicateIngredientIndices: number[];
  unrequestedIngredientIndices: number[];
  changedIngredientIndices: number[];
  requestedStepIndices: number[];
  returnedStepIndices: number[];
  missingStepIndices: number[];
  changedStepIndices: number[];
  originalStepCount: number;
  mergedStepCount: number;
  requestedInvalidIndices: number[];
  requiredReturnedIndices: number[];
  returnedIndices: number[];
  missingReturnedIndices: number[];
  duplicateReturnedIndices: number[];
  unrequestedReturnedIndices: number[];
  changedRequestedIndices: number[];
  unchangedRequestedIndices: number[];
  resolvedRequestedIndices: number[];
  unresolvedRequestedIndices: number[];
  aliasMatchesApplied: string[];
  suppressedNestedIngredientMentions: string[];
  unresolvedIngredientMentions: string[];
  deterministicSafetyApplied: boolean;
  finalFailureReasons: string[];
  rawReturnedStepNumbers: Array<{
    returnedPosition: number;
    stepIndex?: number;
    stepNumber?: number;
  }>;
  parsedReturnedStepNumbers: Array<{
    returnedPosition: number;
    stepIndex?: number;
    stepNumber?: number;
  }>;
  acceptedStepIndices: number[];
  rejectedStepIndices: Array<{
    returnedPosition: number;
    targetIndex?: number;
    reason: string;
  }>;
  originalStepTextHashes: Array<{ stepIndex: number; hash: string }>;
  repairedStepTextHashes: Array<{ returnedPosition: number; stepIndex?: number; hash: string }>;
  mergedStepTextHashes: Array<{ stepIndex: number; hash: string }>;
  changedFields: string[];
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

function mixedStructuralRepairInitialRecipe(): Record<string, unknown> {
  return {
    title: 'Chicken Ramen',
    ingredients: [
      '2 chicken breasts',
      '2 cups chicken broth',
      'salt for garnish',
      '1 tbsp olive oil',
      '2 ramen noodle cakes',
    ],
    equipment: ['large pot', 'large skillet'],
    steps: [
      {
        title: 'Gather',
        step: 'Gather the chicken, chicken broth, salt, olive oil, and ramen noodles.',
      },
      {
        title: 'Heat Oil',
        step: 'Heat the olive oil for 1 minute until shimmering.',
      },
      {
        title: 'Cook Chicken',
        step: 'Cook the chicken in butter in the large skillet.',
      },
      {
        title: 'Simmer Noodles',
        step: 'Simmer the chicken broth and ramen noodles for 5 minutes until bubbling.',
      },
      {
        title: 'Serve',
        step: 'Serve the chicken ramen with the salt garnish.',
      },
    ],
    prepTime: 10,
    cookTime: 15,
    totalTime: 25,
    servings: 2,
    skillLevel: 'Easy',
  };
}

async function runIndexThreeRepairSuccess(
  dishName: string,
  repairOutput: unknown,
) {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1
      ? structuredClone(fullCoreIndexThreeInitialFixture)
      : structuredClone(repairOutput));
  };
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    const timing = createScanAggregateTiming({ requestId: `trace-${dishName}` });
    recordLogicalProviderCall(timing);
    recordProviderAttempt(timing);
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName, broadDishCategory: 'burger/sandwich' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: `trace-${dishName}`,
      timing,
    });
    return { calls, events, output, timing };
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
}

let rawTunaRepairRun = 0;

async function runRawTunaRepair(repairOutput: unknown) {
  rawTunaRepairRun += 1;
  const runId = `raw-tuna-repair-${rawTunaRepairRun}`;
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  let output: Awaited<ReturnType<typeof generateRecipeWithOpenRouter>> | undefined;
  let caught: unknown;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1
      ? structuredClone(fullCoreRawTunaInitialFixture)
      : structuredClone(repairOutput));
  };
  console.log = (...args: unknown[]) => { events.push(args); };
  const timing = createScanAggregateTiming({ requestId: runId });
  recordLogicalProviderCall(timing);
  recordProviderAttempt(timing);
  try {
    output = await generateRecipeWithOpenRouter({
      analysis: analysis({
        dishName: `Ahi Tuna Poke Bowl ${rawTunaRepairRun}`,
        broadDishCategory: 'poke / raw fish',
        cuisine: 'Hawaiian',
        visibleIngredients: ['ahi tuna', 'rice', 'cucumber', 'avocado'],
        likelyIngredients: ['olive oil', 'soy sauce', 'sesame seeds'],
      }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: runId,
      timing,
    });
  } catch (error) {
    caught = error;
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
  return { calls, caught, events, output, timing };
}

let mochiRepairRun = 0;

async function runMochiMixedRepair(repairOutput: unknown) {
  mochiRepairRun += 1;
  const runId = `mochi-mixed-repair-${mochiRepairRun}`;
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  let repairPrompt = '';
  let output: Awaited<ReturnType<typeof generateRecipeWithOpenRouter>> | undefined;
  let caught: unknown;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    if (calls === 2) {
      const body = JSON.parse(String(init?.body)) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      repairPrompt = body.messages?.find((message) => message.role === 'user')?.content ?? '';
    }
    return providerResponse(calls === 1
      ? structuredClone(fullCoreMochiMixedInitialFixture)
      : structuredClone(repairOutput));
  };
  console.log = (...args: unknown[]) => { events.push(args); };
  const timing = createScanAggregateTiming({ requestId: runId });
  recordLogicalProviderCall(timing);
  recordProviderAttempt(timing);
  try {
    output = await generateRecipeWithOpenRouter({
      analysis: analysis({
        dishName: `Mochi ${mochiRepairRun}`,
        broadDishCategory: 'dessert',
        cuisine: 'Japanese',
        visibleIngredients: ['mochi', 'sweet rice flour', 'cornstarch'],
        likelyIngredients: ['water', 'sugar'],
      }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: runId,
      timing,
    });
  } catch (error) {
    caught = error;
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
  return { calls, caught, events, output, repairPrompt, timing };
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
    assert.match(repairPrompt, /Selected repair contract: indexed/);
    assert.match(repairPrompt, /stepCorrections/);
    assert.match(repairPrompt, /Required step correction indices \(zero-based\): \[1\]/);
    assert.doesNotMatch(repairPrompt, /Selected repair contract: full regeneration/);
    assert.doesNotMatch(repairPrompt, /complete corrected step list/);
    assert.match(repairPrompt, /Full canonical ingredient list/);
    assert.match(repairPrompt, /Complete previous recipe object/);
    assert.match(repairPrompt, /8 oz spaghetti/);
    const telemetryLabels = new Set([
      '[recipe_contract_size]',
      '[token_usage]',
      '[scan_metric]',
      '[failover_summary]',
      '[recipe_validation_details]',
      '[recipe_repair_mode]',
      '[recipe_repair_validation]',
      '[recipe_repair_trace]',
    ]);
    const telemetry = events.filter(([label]) => telemetryLabels.has(String(label)));
    assert.ok([...telemetryLabels].every((label) =>
      telemetry.some(([actual]) => actual === label)));
    assert.ok(telemetry.every(([, value]) =>
      (value as { requestId?: string }).requestId === 'full-repair-success'));
    const repairMode = events.find(([label]) => label === '[recipe_repair_mode]')?.[1] as {
      selectedRepairMode: string;
      initialIssues: string[];
    };
    assert.equal(repairMode.selectedRepairMode, 'indexed');
    assert.deepEqual(repairMode.initialIssues, ['step_missing_time_or_completion_cue']);
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
    const repairTrace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
    assert.deepEqual(repairTrace.requiredReturnedIndices, [1]);
    assert.deepEqual(repairTrace.returnedIndices, [1]);
    assert.deepEqual(repairTrace.resolvedRequestedIndices, [1]);
    assert.deepEqual(repairTrace.unresolvedRequestedIndices, []);
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

test('deterministic poultry safety preserves indexed repair for completion and closure defects', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  let repairPrompt = '';
  const initial = mixedStructuralRepairInitialRecipe();
  (initial.ingredients as string[])[2] = '1/2 tsp salt, for garnish';
  const repair = {
    stepCorrections: [{
      stepIndex: 2,
      title: 'Cook Chicken',
      step: 'Cook the chicken in olive oil for 6 minutes until golden.',
    }],
  };
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    if (calls === 1) return providerResponse(initial);
    const body = JSON.parse(String(init?.body)) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    repairPrompt = body.messages?.find((message) => message.role === 'user')?.content ?? '';
    return providerResponse(repair);
  };
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    const timing = createScanAggregateTiming({ requestId: 'deterministic-poultry-indexed-repair' });
    recordLogicalProviderCall(timing);
    recordProviderAttempt(timing);
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({
        dishName: 'Chicken Ramen Indexed Safety',
        broadDishCategory: 'ramen/noodles',
        visibleIngredients: ['chicken', 'ramen noodles', 'broth'],
        likelyIngredients: ['olive oil', 'salt'],
      }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'deterministic-poultry-indexed-repair',
      timing,
    });
    assert.equal(calls, 2);
    assert.equal(output.ingredients.length, (initial.ingredients as string[]).length);
    assert.equal(output.steps.length, (initial.steps as unknown[]).length);
    assert.deepEqual(output.ingredients, initial.ingredients);
    assert.match(
      output.steps.map((step) => typeof step === 'object' ? step.safetyNote ?? '' : '').join(' '),
      /165°F \/ 74°C/,
    );
    assert.match(repairPrompt, /Selected repair contract: indexed/);
    assert.match(repairPrompt, /Required step correction indices \(zero-based\): \[2\]/);
    assert.doesNotMatch(repairPrompt, /Selected repair contract: full regeneration/);

    const mode = events.find(([label]) => label === '[recipe_repair_mode]')?.[1] as {
      selectedRepairMode: string;
      initialIssues: string[];
      issuesBeforeDeterministicFixes: string[];
      deterministicFixesApplied: string[];
      issuesAfterDeterministicFixes: string[];
    };
    assert.equal(mode.selectedRepairMode, 'indexed');
    assert.deepEqual(mode.issuesBeforeDeterministicFixes, [
      'step_missing_time_or_completion_cue',
      'step_uses_unlisted_ingredients',
      'missing_safety_poultry',
    ]);
    assert.deepEqual(mode.deterministicFixesApplied, ['missing_safety_poultry']);
    assert.deepEqual(mode.issuesAfterDeterministicFixes, [
      'step_missing_time_or_completion_cue',
      'step_uses_unlisted_ingredients',
    ]);
    assert.deepEqual(mode.initialIssues, mode.issuesAfterDeterministicFixes);
    const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
    assert.deepEqual(trace.requestedInvalidIndices, [2]);
    assert.deepEqual(trace.changedRequestedIndices, [2]);
    assert.deepEqual(trace.resolvedRequestedIndices, [2]);
    assert.equal(trace.originalStepCount, 5);
    assert.equal(trace.mergedStepCount, 5);
    assert.deepEqual(trace.changedFields, ['steps.2.step']);
    assert.equal(trace.deterministicSafetyApplied, true);
    assert.deepEqual(trace.finalFailureReasons, []);
    assert.equal(timing.logicalProviderCalls, 3);
    assert.equal(timing.providerAttempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('full-regeneration mode rejects an indexed repair response', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const structuralInitial = mixedStructuralRepairInitialRecipe();
  structuralInitial.steps = (structuralInitial.steps as unknown[]).slice(0, 4);
  globalThis.fetch = async () => providerResponse(++calls === 1
    ? structuralInitial
    : {
        ingredientCorrections: [{
          ingredientIndex: 2,
          value: '1/2 tsp salt, for garnish',
        }],
        stepCorrections: [{
          stepIndex: 2,
          title: 'Cook Chicken',
          step: 'Cook the chicken in olive oil for 6 minutes until it reaches 165°F/74°C.',
          safetyNote: 'Cook chicken to 165°F/74°C.',
        }],
      });
  try {
    await assert.rejects(
      generateRecipeWithOpenRouter({
        analysis: analysis({
          dishName: 'Chicken Ramen Wrong Repair Schema',
          broadDishCategory: 'ramen/noodles',
        }),
        config: fullConfig,
        mode: 'Restaurant Copy',
        quota,
        requestId: 'full-regeneration-schema-mismatch',
      }),
      (error: unknown) => error instanceof RecipeValidationError &&
        error.issues.includes('repair_invalid_schema'),
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('targeted defects plus too_few_steps select full regeneration with matching schema', async () => {
  const initial = structuredClone(fullCoreMochiMixedInitialFixture);
  initial.steps = initial.steps.slice(0, 4);
  initial.steps[2] = {
    ...initial.steps[2],
    step: 'Heat the batter with butter in the microwave-safe bowl.',
  };
  const repair = {
    ingredients: [
      ...initial.ingredients.slice(0, 3),
      '2 tbsp cornstarch, for dusting',
      initial.ingredients[4],
    ],
    steps: [
      initial.steps[0],
      initial.steps[1],
      {
        title: 'Heat Batter',
        step: 'Heat the batter for 1 minute until it begins to thicken.',
      },
      initial.steps[3],
      {
        title: 'Serve',
        step: 'Plate the mochi, dust with cornstarch, divide into pieces, and serve.',
      },
    ],
  };
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  globalThis.fetch = async () => providerResponse(++calls === 1 ? initial : repair);
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Short Mochi Full Regeneration', broadDishCategory: 'dessert' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'full-regeneration-structural-issue',
    });
    assert.equal(calls, 2);
    assert.equal(output.steps.length, 5);
    const mode = events.find(([label]) => label === '[recipe_repair_mode]')?.[1] as {
      selectedRepairMode: string;
      initialIssues: string[];
    };
    assert.equal(mode.selectedRepairMode, 'full_regeneration');
    assert.deepEqual(mode.initialIssues, [
      'too_few_steps',
      'ingredients_missing_amounts',
      'step_missing_time_or_completion_cue',
      'step_uses_unlisted_ingredients',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('zero-based sparse repair updates exactly invalid step index 3 and survives normalization', async () => {
  const { calls, events, output, timing } = await runIndexThreeRepairSuccess(
    'Zero Based Chicken Sandwich',
    fullCoreIndexThreeTimePatchFixture,
  );
  assert.equal(calls, 2);
  assert.equal(timing.logicalProviderCalls, 3);
  assert.equal(timing.providerAttempts, 3);
  assert.equal(getScanAggregateTimingEvent(timing, 'success').status, 'success');
  assert.equal(
    typeof output.steps[3] === 'object' && output.steps[3].step,
    'Cook the chicken in the large skillet for 6 minutes, flipping halfway.',
  );
  assert.deepEqual(
    typeof output.steps[3] === 'object' && output.steps[3].ingredients,
    ['chicken breast'],
  );
  assert.equal(
    typeof output.steps[4] === 'object' && output.steps[4].step,
    fullCoreIndexThreeInitialFixture.steps[4].step,
  );
  assert.deepEqual(output.ingredients, fullCoreIndexThreeInitialFixture.ingredients);

  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.requestedInvalidIndices, [3]);
  assert.deepEqual(trace.rawReturnedStepNumbers, [{ returnedPosition: 0, stepIndex: 3 }]);
  assert.deepEqual(trace.parsedReturnedStepNumbers, [{ returnedPosition: 0, stepIndex: 3 }]);
  assert.deepEqual(trace.acceptedStepIndices, [3]);
  assert.deepEqual(trace.rejectedStepIndices, []);
  assert.ok(trace.changedFields.includes('steps.3.step'));
  assert.notEqual(trace.originalStepTextHashes[3].hash, trace.mergedStepTextHashes[3].hash);
  assert.equal(trace.repairedStepTextHashes[0].hash, trace.mergedStepTextHashes[3].hash);
  assert.equal(trace.originalStepTextHashes[4].hash, trace.mergedStepTextHashes[4].hash);
  const validation = events.find(([label]) => label === '[recipe_repair_validation]')?.[1] as {
    repairedInvalidStepIndices: number[];
    repairChangedFields: string[];
  };
  assert.deepEqual(validation.repairedInvalidStepIndices, []);
  assert.ok(validation.repairChangedFields.includes('steps.3.step'));
});

test('a sparse sensory-cue correction resolves zero-based index 3', async () => {
  const { calls, events, output, timing } = await runIndexThreeRepairSuccess(
    'One Based Chicken Sandwich',
    fullCoreIndexThreeSensoryPatchFixture,
  );
  assert.equal(calls, 2);
  assert.equal(timing.logicalProviderCalls, 3);
  assert.equal(
    typeof output.steps[3] === 'object' && output.steps[3].doneWhen,
    'The center reaches 165°F/74°C and the juices run clear.',
  );
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.rawReturnedStepNumbers, [{ returnedPosition: 0, stepIndex: 3 }]);
  assert.deepEqual(trace.parsedReturnedStepNumbers, [{ returnedPosition: 0, stepIndex: 3 }]);
  assert.deepEqual(trace.acceptedStepIndices, [3]);
  assert.ok(trace.changedFields.includes('steps.3.doneWhen'));
});

test('production-shaped raw tuna repair resolves both steps, aliases, and safety locally', async () => {
  const { calls, caught, events, output, timing } = await runRawTunaRepair(
    fullCoreRawTunaSuccessfulPatchFixture,
  );
  assert.equal(caught, undefined);
  assert.ok(output);
  assert.equal(calls, 2);
  assert.equal(timing.logicalProviderCalls, 3);
  assert.equal(timing.providerAttempts, 3);
  assert.deepEqual(timing.repairReasons, ['step_missing_time_or_completion_cue']);
  assert.match(typeof output.steps[4] === 'object' ? output.steps[4].step : '', /5 minutes/);
  assert.match(typeof output.steps[6] === 'object' ? output.steps[6].step : '', /10 minutes/);
  assert.deepEqual(
    typeof output.steps[4] === 'object' && output.steps[4].ingredients,
    ['ahi tuna', 'olive oil', 'soy sauce'],
  );
  assert.match(
    output.steps.map((step) => typeof step === 'object' ? step.safetyNote ?? '' : '').join(' '),
    /sushi-grade or previously frozen fish.*refrigerated until serving/i,
  );

  const initial = events.find(([label]) => label === '[recipe_validation_details]')?.[1] as {
    issues: string[];
    stepsMissingCompletionCue: number[];
    unknownIngredients: string[];
  };
  assert.deepEqual(initial.issues, ['step_missing_time_or_completion_cue']);
  assert.deepEqual(initial.stepsMissingCompletionCue, [4, 6]);
  assert.deepEqual(initial.unknownIngredients, []);

  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.requestedInvalidIndices, [4, 6]);
  assert.deepEqual(trace.requiredReturnedIndices, [4, 6]);
  assert.deepEqual(trace.returnedIndices, [4, 6]);
  assert.deepEqual(trace.missingReturnedIndices, []);
  assert.deepEqual(trace.duplicateReturnedIndices, []);
  assert.deepEqual(trace.unrequestedReturnedIndices, []);
  assert.deepEqual(trace.changedRequestedIndices, [4, 6]);
  assert.deepEqual(trace.unchangedRequestedIndices, []);
  assert.deepEqual(trace.resolvedRequestedIndices, [4, 6]);
  assert.deepEqual(trace.unresolvedRequestedIndices, []);
  assert.deepEqual(trace.aliasMatchesApplied.sort(), [
    'oil->olive oil',
    'tuna->ahi tuna',
  ]);
  assert.equal(trace.deterministicSafetyApplied, true);
  assert.deepEqual(trace.finalFailureReasons, []);
  assert.deepEqual(trace.changedFields.sort(), ['steps.4.step', 'steps.6.step']);
});

test('six-step Mochi mixed repair applies exact ingredient and step patches without shortening', async () => {
  const { calls, caught, events, output, repairPrompt, timing } = await runMochiMixedRepair(
    fullCoreMochiMixedSuccessfulPatchFixture,
  );
  assert.equal(caught, undefined);
  assert.ok(output);
  assert.equal(calls, 2);
  assert.equal(timing.logicalProviderCalls, 3);
  assert.equal(timing.providerAttempts, 3);
  assert.equal(output.ingredients.length, fullCoreMochiMixedInitialFixture.ingredients.length);
  assert.equal(output.steps.length, 6);
  assert.equal(output.ingredients[3], '2 tbsp cornstarch, for dusting');
  assert.equal(
    typeof output.steps[2] === 'object' && output.steps[2].step,
    fullCoreMochiMixedSuccessfulPatchFixture.stepCorrections[0].step,
  );
  assert.equal(
    typeof output.steps[4] === 'object' && output.steps[4].step,
    fullCoreMochiMixedSuccessfulPatchFixture.stepCorrections[1].step,
  );
  for (const stepIndex of [0, 1, 3, 5]) {
    assert.equal(
      typeof output.steps[stepIndex] === 'object' && output.steps[stepIndex].step,
      fullCoreMochiMixedInitialFixture.steps[stepIndex].step,
    );
  }

  assert.match(repairPrompt, /ingredientCorrections/);
  assert.match(repairPrompt, /stepCorrections/);
  assert.match(repairPrompt, /Required ingredient correction indices \(zero-based\): \[3\]/);
  assert.match(repairPrompt, /Required step correction indices \(zero-based\): \[2,4\]/);
  assert.match(repairPrompt, /Never return complete ingredients or steps arrays/);

  const initial = events.find(([label]) => label === '[recipe_validation_details]')?.[1] as {
    issues: string[];
    ingredientIndicesMissingAmounts: number[];
    stepsMissingCompletionCue: number[];
    unknownIngredients: string[];
    suppressedNestedIngredientMentions: string[];
    presentationOnlyStepIndices: number[];
  };
  assert.deepEqual(initial.issues, [
    'ingredients_missing_amounts',
    'step_missing_time_or_completion_cue',
  ]);
  assert.deepEqual(initial.ingredientIndicesMissingAmounts, [3]);
  assert.deepEqual(initial.stepsMissingCompletionCue, [2, 4]);
  assert.deepEqual(initial.unknownIngredients, []);
  assert.ok(initial.suppressedNestedIngredientMentions.includes('rice'));
  assert.ok(initial.suppressedNestedIngredientMentions.includes('flour'));
  assert.deepEqual(initial.presentationOnlyStepIndices, [5]);

  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.requestedIngredientIndices, [3]);
  assert.deepEqual(trace.returnedIngredientIndices, [3]);
  assert.deepEqual(trace.missingIngredientIndices, []);
  assert.deepEqual(trace.changedIngredientIndices, [3]);
  assert.deepEqual(trace.requestedStepIndices, [2, 4]);
  assert.deepEqual(trace.returnedStepIndices, [2, 4]);
  assert.deepEqual(trace.missingStepIndices, []);
  assert.deepEqual(trace.changedStepIndices, [2, 4]);
  assert.equal(trace.originalStepCount, 6);
  assert.equal(trace.mergedStepCount, 6);
  assert.ok(trace.suppressedNestedIngredientMentions.includes('rice'));
  assert.deepEqual(trace.unresolvedIngredientMentions, []);
  assert.deepEqual(trace.resolvedRequestedIndices, [2, 4]);
  assert.deepEqual(trace.unresolvedRequestedIndices, []);
  assert.deepEqual(trace.finalFailureReasons, []);
  assert.deepEqual(trace.changedFields.sort(), [
    'ingredients.3',
    'steps.2.step',
    'steps.4.step',
  ]);
});

test('Mochi quantity validation remains strict for dusting ingredients', () => {
  assert.equal(hasUsableIngredientAmount('cornstarch for dusting'), false);
  assert.equal(hasUsableIngredientAmount('2 tbsp cornstarch, for dusting'), true);
  assert.equal(hasUsableIngredientAmount('cornstarch as needed'), false);
});

test('standalone rice remains an unknown ingredient when only sweet rice flour is listed', async () => {
  const initial = structuredClone(fullCoreMochiMixedInitialFixture);
  initial.ingredients[3] = '2 tbsp cornstarch, for dusting';
  initial.steps[2] = fullCoreMochiMixedSuccessfulPatchFixture.stepCorrections[0];
  initial.steps[4] = fullCoreMochiMixedSuccessfulPatchFixture.stepCorrections[1];
  initial.steps[1] = {
    ...initial.steps[1],
    step: 'Mix the sweet rice flour, cooked rice, water, and sugar into a smooth batter.',
  };
  const repair = {
    stepCorrections: [{
      stepIndex: 1,
      ...fullCoreMochiMixedInitialFixture.steps[1],
    }],
  };
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  globalThis.fetch = async () => providerResponse(++calls === 1 ? initial : repair);
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Standalone Rice Mochi', broadDishCategory: 'dessert' }),
      config: fullConfig,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'standalone-rice-mochi',
    });
    assert.equal(calls, 2);
    const validation = events.find(([label]) => label === '[recipe_validation_details]')?.[1] as {
      unknownIngredients: string[];
      stepsUsingUnlistedIngredientIndices: number[];
    };
    assert.deepEqual(validation.unknownIngredients, ['rice']);
    assert.deepEqual(validation.stepsUsingUnlistedIngredientIndices, [1]);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('Mochi mixed repair fails closed when an ingredient correction is missing', async () => {
  const patch = structuredClone(fullCoreMochiMixedSuccessfulPatchFixture);
  patch.ingredientCorrections = [];
  const { caught, events } = await runMochiMixedRepair(patch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_missing_required_correction'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.missingIngredientIndices, [3]);
});

test('Mochi mixed repair fails closed when a step correction is missing', async () => {
  const patch = structuredClone(fullCoreMochiMixedSuccessfulPatchFixture);
  patch.stepCorrections = [patch.stepCorrections[0]];
  const { caught, events } = await runMochiMixedRepair(patch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_missing_required_correction'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.missingStepIndices, [4]);
});

test('Mochi mixed repair rejects duplicate indexed corrections', async () => {
  const patch = structuredClone(fullCoreMochiMixedSuccessfulPatchFixture);
  patch.ingredientCorrections.push({
    ingredientIndex: 3,
    value: '3 tbsp cornstarch, for dusting',
  });
  const { caught, events } = await runMochiMixedRepair(patch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_duplicate_correction'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.duplicateIngredientIndices, [3]);
});

test('Mochi mixed repair rejects unrequested indexed corrections', async () => {
  const patch = structuredClone(fullCoreMochiMixedSuccessfulPatchFixture);
  patch.ingredientCorrections.push({
    ingredientIndex: 0,
    value: '2 cups sweet rice flour',
  });
  const { caught, events } = await runMochiMixedRepair(patch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_unrequested_correction'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.unrequestedIngredientIndices, [0]);
});

test('Mochi mixed repair rejects an unchanged requested correction', async () => {
  const patch = structuredClone(fullCoreMochiMixedSuccessfulPatchFixture);
  patch.ingredientCorrections[0].value = fullCoreMochiMixedInitialFixture.ingredients[3];
  const { caught, events } = await runMochiMixedRepair(patch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_partial_effect'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.changedIngredientIndices, []);
  assert.ok(trace.finalFailureReasons.includes('repair_partial_effect'));
});

test('Mochi mixed repair rejects a legacy full-array response', async () => {
  const { caught } = await runMochiMixedRepair({
    ingredients: [...fullCoreMochiMixedInitialFixture.ingredients],
    steps: [...fullCoreMochiMixedInitialFixture.steps],
  });
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_invalid_schema'));
});

test('cooked tuna does not receive raw-fish handling instructions', () => {
  const cookedTuna = structuredClone(fullCoreRawTunaInitialFixture);
  cookedTuna.title = 'Seared Ahi Tuna Rice Bowl';
  cookedTuna.steps[3] = {
    title: 'Sear Tuna',
    step: 'Sear the ahi tuna for 2 minutes per side until the center reaches 145°F/63°C.',
  };
  const normalized = normalizeFullRecipeOutput(
    openRouterRecipeOutputSchema.parse(cookedTuna),
    analysis({
      dishName: 'Seared Ahi Tuna Rice Bowl',
      broadDishCategory: 'cooked seafood rice bowl',
      visibleIngredients: ['seared ahi tuna', 'rice'],
    }),
  );
  const safetyText = normalized.steps.map((step) =>
    typeof step === 'object' ? step.safetyNote ?? '' : '').join(' ');
  assert.doesNotMatch(safetyText, /sushi-grade|previously frozen|refrigerated until serving/i);
});

test('deterministic safety adds the required cooked-food temperatures locally', () => {
  const cases = [
    {
      dishName: 'Roast Chicken',
      category: 'poultry',
      ingredient: '2 chicken breasts',
      instruction: 'Roast the chicken until golden.',
      expected: /165°F \/ 74°C/,
    },
    {
      dishName: 'Beef Meatballs',
      category: 'ground meat',
      ingredient: '1 lb ground beef',
      instruction: 'Bake the ground beef meatballs until browned.',
      expected: /160°F \/ 71°C/,
    },
    {
      dishName: 'Roast Pork',
      category: 'pork',
      ingredient: '1 lb pork loin',
      instruction: 'Roast the pork until browned.',
      expected: /145°F \/ 63°C/,
    },
    {
      dishName: 'Baked Cod',
      category: 'cooked fish',
      ingredient: '1 lb cod fillets',
      instruction: 'Bake the cod until flaky.',
      expected: /145°F \/ 63°C/,
    },
  ];

  for (const testCase of cases) {
    const candidate = openRouterRecipeOutputSchema.parse(fullRecipe({
      title: testCase.dishName,
      ingredients: [testCase.ingredient, '1 tbsp olive oil', '1/2 tsp salt'],
      steps: [
        { title: 'Prepare', step: 'Gather the ingredients.' },
        { title: 'Cook', step: testCase.instruction },
        { title: 'Rest', step: 'Set the cooked food aside for 5 minutes.' },
        { title: 'Plate', step: 'Plate the food.' },
        { title: 'Serve', step: 'Serve immediately.' },
      ],
    }));
    const normalized = normalizeFullRecipeOutput(candidate, analysis({
      dishName: testCase.dishName,
      broadDishCategory: testCase.category,
      visibleIngredients: [testCase.ingredient],
    }));
    const safetyText = normalized.steps.map((step) =>
      typeof step === 'object' ? step.safetyNote ?? '' : '').join(' ');
    assert.match(safetyText, testCase.expected);
  }
});

test('repair omitting one requested index fails as repair_missing_required_correction', async () => {
  const partialPatch = {
    stepCorrections: [fullCoreRawTunaSuccessfulPatchFixture.stepCorrections[0]],
  };
  const { calls, caught, events, timing } = await runRawTunaRepair(partialPatch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_missing_required_correction'));
  assert.equal(calls, 2);
  assert.equal(timing.logicalProviderCalls, 3);
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.missingReturnedIndices, [6]);
  assert.deepEqual(trace.resolvedRequestedIndices, [4]);
  assert.deepEqual(trace.unresolvedRequestedIndices, [6]);
  assert.ok(trace.finalFailureReasons.includes('repair_missing_required_correction'));
});

test('repair returning an unchanged requested step fails as repair_partial_effect', async () => {
  const unchangedPatch = structuredClone(fullCoreRawTunaSuccessfulPatchFixture);
  unchangedPatch.stepCorrections[1] = {
    stepIndex: 6,
    ...fullCoreRawTunaInitialFixture.steps[6],
  };
  const { caught, events } = await runRawTunaRepair(unchangedPatch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_partial_effect'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.changedRequestedIndices, [4]);
  assert.deepEqual(trace.unchangedRequestedIndices, [6]);
  assert.deepEqual(trace.resolvedRequestedIndices, [4]);
  assert.deepEqual(trace.unresolvedRequestedIndices, [6]);
});

test('repair returning an unrequested index is rejected', async () => {
  const unrequestedPatch = structuredClone(fullCoreRawTunaSuccessfulPatchFixture);
  unrequestedPatch.stepCorrections.push({
    stepIndex: 7,
    title: 'Serve',
    step: 'Serve the bowls immediately.',
  });
  const { caught, events } = await runRawTunaRepair(unrequestedPatch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_unrequested_correction'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.unrequestedReturnedIndices, [7]);
  assert.ok(trace.rejectedStepIndices.some(({ targetIndex, reason }) =>
    targetIndex === 7 && reason === 'step_index_not_requested'));
});

test('duplicate returned step indices are rejected', async () => {
  const duplicatePatch = structuredClone(fullCoreRawTunaSuccessfulPatchFixture);
  duplicatePatch.stepCorrections.push({
    ...duplicatePatch.stepCorrections[0],
    step: 'Coat the tuna for 2 minutes until glossy.',
  });
  const { caught, events } = await runRawTunaRepair(duplicatePatch);
  assert.ok(caught instanceof RecipeValidationError);
  assert.ok(caught.issues.includes('repair_duplicate_correction'));
  const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
  assert.deepEqual(trace.duplicateReturnedIndices, [4]);
  assert.ok(trace.rejectedStepIndices.some(({ targetIndex, reason }) =>
    targetIndex === 4 && reason === 'duplicate_step_index'));
});

test('a completion-only repair rejects a legacy full returned steps array', async () => {
  const fullArrayPatch = {
    ingredients: [...fullCoreIndexThreeInitialFixture.ingredients],
    steps: fullCoreIndexThreeInitialFixture.steps.map((step, index) => {
      if (index === 2) {
        return { ...step, step: 'Toast the buns for 9 minutes until charred.' };
      }
      if (index === 3) {
        return {
          ...step,
          step: 'Cook the chicken for 6 minutes until it reaches 165°F/74°C.',
        };
      }
      if (index === 4) {
        return { ...step, step: 'Serve the sandwich with an unrelated rewrite.' };
      }
      return { ...step };
    }),
  };
  await assert.rejects(
    runIndexThreeRepairSuccess('Full Array Chicken Sandwich', fullArrayPatch),
    (error: unknown) => error instanceof RecipeValidationError &&
      error.issues.includes('repair_invalid_schema'),
  );
});

test('a completion-only repair rejects an unnumbered sparse correction', async () => {
  const sparsePatch = {
    stepCorrections: [{
      title: 'Cook Chicken',
      step: 'Cook the chicken for 6 minutes until it reaches 165°F/74°C.',
      safetyNote: 'Cook chicken to 165°F/74°C.',
    }],
  };
  await assert.rejects(
    runIndexThreeRepairSuccess('Sparse Chicken Sandwich', sparsePatch),
    (error: unknown) => error instanceof RecipeValidationError &&
      error.issues.includes('repair_invalid_schema'),
  );
});

test('an unchanged requested correction fails as repair_no_effect', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const events: unknown[][] = [];
  let calls = 0;
  const unchangedPatch = {
    stepCorrections: [{
      stepIndex: 3,
      ...fullCoreIndexThreeInitialFixture.steps[3],
    }],
  };
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1
      ? structuredClone(fullCoreIndexThreeInitialFixture)
      : unchangedPatch);
  };
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    await assert.rejects(
      generateRecipeWithOpenRouter({
        analysis: analysis({
          dishName: 'No Effect Chicken Sandwich',
          broadDishCategory: 'burger/sandwich',
        }),
        config: fullConfig,
        mode: 'Restaurant Copy',
        quota,
        requestId: 'full-repair-no-effect',
      }),
      (error: unknown) => error instanceof RecipeValidationError &&
        error.issues.includes('repair_no_effect'),
    );
    assert.equal(calls, 2);
    const trace = events.find(([label]) => label === '[recipe_repair_trace]')?.[1] as RepairTraceEvent;
    assert.deepEqual(trace.acceptedStepIndices, [3]);
    assert.deepEqual(trace.unchangedRequestedIndices, [3]);
    assert.deepEqual(trace.unresolvedRequestedIndices, [3]);
    assert.ok(trace.finalFailureReasons.includes('repair_no_effect'));
    assert.deepEqual(trace.changedFields, []);
    assert.equal(trace.originalStepTextHashes[3].hash, trace.mergedStepTextHashes[3].hash);
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
  aliasPatch.stepCorrections[0] = {
    ...aliasPatch.stepCorrections[0],
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
  vaguePatch.stepCorrections[0] = {
    ...vaguePatch.stepCorrections[0],
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
    return providerResponse(calls === 1 ? unlistedButter : {
      stepCorrections: [{
        stepIndex: 2,
        title: 'Heat Oil',
        step: 'Heat the olive oil in a large skillet for 1 minute until shimmering.',
      }],
    });
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
