import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AI_ENABLED = 'true';
process.env.OPENROUTER_API_KEY = 'sk-test';
process.env.EPICURE_ENABLED = 'false';
process.env.EPICURE_ANALYTICS = 'off';
process.env.AI_MAX_OUTPUT_TOKENS = '4096';

import {
  analyzePreparedDish,
  FoodRejectionError,
  generateRecipeForAnalysis,
  type FoodImageAnalysis,
} from './aiService.js';
import { ANALYSIS_TTL_MS, getAnalysisContext, storeAnalysisContext } from '../store.js';
import { getAiConfig } from '../config/aiConfig.js';

function providerResponse(content: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
}

function validRecipe() {
  const ingredients = [
    '8 oz fettuccine pasta', '12 oz shrimp, peeled and deveined', '2 tbsp unsalted butter',
    '1 tbsp olive oil', '3 cloves garlic, minced', '1 cup heavy cream',
    '1/2 cup grated parmesan cheese', '1/2 tsp kosher salt', '1/4 tsp black pepper',
  ];
  return {
    dishName: 'Shrimp Fettuccine Alfredo',
    title: 'Shrimp Fettuccine Alfredo',
    description: 'Creamy pasta with seared shrimp.',
    prepTime: '15 minutes', cookTime: '20 minutes', totalTime: '35 minutes', servings: 2,
    equipment: ['large pot', 'skillet', 'tongs', 'whisk'],
    ingredients,
    steps: Array.from({ length: 8 }, (_, index) => ({
      stepNumber: index + 1,
      title: `Cook step ${index + 1}`,
      step: `Cook the pasta, shrimp, sauce, and seasonings for ${index + 1} minutes until ready.`,
      ingredients: index === 0 ? ingredients : ['shrimp', 'heavy cream', 'parmesan cheese'],
      tools: ['skillet'],
    })),
  };
}

function minimalAnalysis(): FoodImageAnalysis {
  return {
    candidateScanId: 'ttl-test', aiSource: 'openrouter_ai', inputKind: 'prepared_dish',
    dishName: 'Test Dish', cuisine: 'Test', restaurantStyle: 'Test', scanState: 'clear_food',
    broadDishCategory: 'test', confidence: 0.8, confidenceReason: 'test', isFoodImage: true,
    isRestaurantMeal: false, visibleIngredients: [], likelyIngredients: [], possibleDishNames: [],
    visibleComponents: {}, restaurantPriceEstimate: 10, homemadeCostEstimate: 4, matchScore: 8,
    difficulty: 'Easy', modes: ['Normal'], notes: [], detectedComponents: [],
  } as unknown as FoodImageAnalysis;
}

async function postAnalysisRecipe(analysisId: string) {
  const { app } = await import('../server.js');
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const payload = JSON.stringify({ mode: 'Normal' });
      const request = http.request({
        hostname: '127.0.0.1', localAddress: '127.0.0.1', port: address.port,
        path: `/v1/scans/analyze/${analysisId}/recipe`, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
      }, (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { raw += chunk; });
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(raw) }));
      });
      request.on('error', reject);
      request.end(payload);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('description analysis waits for dietary choices and duplicate phase-2 requests share one recipe call', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    requestBodies.push(String(init?.body));
    return providerResponse(validRecipe());
  };

  try {
    const analyzed = await analyzePreparedDish({
      source: 'description',
      mealDescription: 'Shrimp Fettuccine Alfredo',
      mode: 'Normal',
    });
    assert.equal(calls, 0, 'description phase must not generate a recipe');
    assert.equal(analyzed.dishName, 'Shrimp Fettuccine Alfredo');
    assert.ok(Date.parse(analyzed.expiresAt) > Date.now());

    const request = {
      analysisId: analyzed.analysisId,
      mode: 'Normal' as const,
      dietaryRestrictions: ['peanuts'],
      dietaryDislikes: ['mushrooms'],
      recipeRequestId: 'onboarding-recipe-request-1',
    };
    const [first, duplicate] = await Promise.all([
      generateRecipeForAnalysis(request),
      generateRecipeForAnalysis(request),
    ]);

    assert.equal(calls, 1);
    assert.equal(first.recipe?.id, duplicate.recipe?.id);
    assert.match(requestBodies[0] ?? '', /HARD DIETARY RESTRICTION/);
    assert.match(requestBodies[0] ?? '', /peanuts/);
    assert.match(requestBodies[0] ?? '', /Soft preference/);
    assert.match(requestBodies[0] ?? '', /mushrooms/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('raw ingredient analysis rejects after vision without making a recipe call', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse({
      scanState: 'clear_food',
      dishName: 'Raw Chicken and Vegetables',
      possibleDishNames: [], broadDishCategory: 'raw ingredients', cuisine: 'Unknown', confidence: 0.94,
      inputKind: 'raw_ingredients', isFoodImage: true, isRestaurantMeal: false,
      rejectionReason: 'Scan a prepared dish you would like to recreate.',
      visibleIngredients: ['raw chicken', 'carrots'], likelyIngredients: [], visibleComponents: {},
      restaurantPriceEstimate: 0, homemadeCostEstimate: 0,
      confidenceReason: 'Loose uncooked ingredients are visible.',
    });
  };

  try {
    await assert.rejects(
      analyzePreparedDish({
        source: 'photos', mode: 'Normal',
        image: { dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
      }),
      (error: unknown) => error instanceof FoodRejectionError && error.rejectionType === 'ingredients_only',
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('analysis contexts lazily expire after fifteen minutes without retaining images', () => {
  const stored = storeAnalysisContext({
    analysis: minimalAnalysis(), config: getAiConfig(), mode: 'Normal', source: 'photos', uploadedImage: true,
    visionMs: 10, scanStartedAt: 1,
  }, 1_000);

  const found = getAnalysisContext(stored.analysisId, 1_000 + ANALYSIS_TTL_MS - 1);
  assert.equal(found.status, 'found');
  if (found.status === 'found') {
    assert.equal('image' in found.context, false);
    assert.equal('dataUrl' in found.context, false);
  }
  assert.equal(getAnalysisContext(stored.analysisId, 1_000 + ANALYSIS_TTL_MS).status, 'expired');
  assert.equal(getAnalysisContext(stored.analysisId, 1_000 + ANALYSIS_TTL_MS + 1).status, 'missing');
});

test('recipe endpoint returns 410 for an expired analysis and 404 for a malformed handle', async () => {
  const expired = storeAnalysisContext({
    analysis: minimalAnalysis(), config: getAiConfig(), mode: 'Normal', source: 'photos', uploadedImage: true,
    visionMs: 10, scanStartedAt: Date.now() - ANALYSIS_TTL_MS - 2,
  }, Date.now() - ANALYSIS_TTL_MS - 1);

  const expiredResponse = await postAnalysisRecipe(expired.analysisId);
  assert.equal(expiredResponse.status, 410);
  assert.equal(expiredResponse.body.error.code, 'analysis_expired');

  const missingResponse = await postAnalysisRecipe('not-a-valid-analysis-id');
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.body.error.code, 'analysis_not_found');
});
