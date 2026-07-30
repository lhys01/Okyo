import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AI_ENABLED = 'true';
process.env.OPENROUTER_API_KEY = 'sk-test';
process.env.EPICURE_ENABLED = 'false';
process.env.AI_MAX_OUTPUT_TOKENS = '4096';

function buildStep(index: number, overrides: Record<string, unknown> = {}) {
  return {
    stepNumber: index,
    title: `Step ${index}`,
    step: `Do action number ${index} for about ${index} minutes until golden.`,
    ingredients: ['olive oil'],
    tools: ['skillet'],
    ...overrides,
  };
}

function shrimpAnalysis() {
  return {
    scanState: 'clear_food',
    dishName: 'Shrimp Fettuccine Alfredo',
    possibleDishNames: ['Shrimp Fettuccine Alfredo'],
    broadDishCategory: 'pasta/noodles',
    cuisine: 'Italian-American',
    confidence: 0.9,
    isFoodImage: true,
    isRestaurantMeal: true,
    rejectionReason: '',
    visibleIngredients: ['fettuccine pasta', 'shrimp', 'cream sauce'],
    likelyIngredients: ['butter', 'olive oil', 'garlic', 'heavy cream', 'parmesan cheese', 'salt', 'black pepper', 'parsley'],
    visibleComponents: {
      protein: 'shrimp',
      sauce: 'Alfredo sauce',
      baseStarch: 'fettuccine pasta',
      vegetables: '',
      toppingsGarnish: 'parsley',
      cookingMethod: 'boiled and sauteed',
    },
    restaurantPriceEstimate: 24,
    homemadeCostEstimate: 8,
    confidenceReason: 'Clear plated pasta with shrimp and cream sauce.',
  };
}

function completeShrimpRecipe() {
  return {
    dishName: 'Shrimp Fettuccine Alfredo',
    title: 'Shrimp Fettuccine Alfredo',
    description: 'A creamy homemade pasta with shrimp.',
    prepTime: '15 minutes',
    cookTime: '20 minutes',
    totalTime: '35 minutes',
    servings: 2,
    equipment: ['large pot', 'skillet', 'tongs', 'whisk'],
    ingredients: [
      '8 oz fettuccine pasta',
      '12 oz shrimp, peeled and deveined',
      '2 tbsp unsalted butter',
      '1 tbsp olive oil',
      '3 cloves garlic, minced',
      '1 cup heavy cream',
      '1/2 cup grated parmesan cheese',
      '1/2 tsp kosher salt',
      '1/4 tsp black pepper',
      '2 tbsp chopped parsley',
    ],
    steps: [
      buildStep(1, { title: 'Boil Pasta', step: 'Boil fettuccine pasta in salted water for 10 minutes until al dente.', ingredients: ['fettuccine pasta', 'salt', 'water'], tools: ['large pot'] }),
      buildStep(2, { title: 'Season Shrimp', step: 'Pat shrimp dry and season with salt and black pepper for 1 minute.', ingredients: ['shrimp', 'salt', 'black pepper'], tools: ['paper towels', 'bowl'] }),
      buildStep(3, { title: 'Sear Shrimp', step: 'Sear shrimp in olive oil for 3 minutes until pink and just firm.', ingredients: ['shrimp', 'olive oil'], tools: ['skillet'] }),
      buildStep(4, { title: 'Melt Butter', step: 'Melt butter with garlic for 1 minute until fragrant.', ingredients: ['butter', 'garlic'], tools: ['skillet'] }),
      buildStep(5, { title: 'Build Sauce', step: 'Simmer heavy cream for 3 minutes until lightly thickened.', ingredients: ['heavy cream'], tools: ['skillet'] }),
      buildStep(6, { title: 'Add Cheese', step: 'Whisk parmesan cheese into the cream for 1 minute until smooth.', ingredients: ['parmesan cheese', 'heavy cream'], tools: ['whisk'] }),
      buildStep(7, { title: 'Toss Pasta', step: 'Cook until done.', ingredients: ['fettuccine pasta', 'shrimp', 'heavy cream', 'parmesan cheese'], tools: ['tongs'] }),
      buildStep(8, { title: 'Finish Bowl', step: 'Top with parsley and black pepper, then serve hot.', ingredients: ['parsley', 'black pepper'], tools: ['serving bowl'] }),
    ],
  };
}

function openRouterResponse(content: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      message: { content: JSON.stringify(content) },
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
}

function openRouterRawResponse(content: string, finishReason: string): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    choices: [{
      finish_reason: finishReason,
      message: { content },
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
}

async function postScan(body: unknown) {
  const { app } = await import('./server.js');
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const request = http.request({
        hostname: '127.0.0.1',
        localAddress: '127.0.0.1',
        port: address.port,
        path: '/v1/scans',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      }, (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { raw += chunk; });
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body: JSON.parse(raw) });
        });
      });
      request.on('error', reject);
      request.end(payload);
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('POST /v1/scans uses deterministic recovery with only vision and recipe provider calls', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs: unknown[][] = [];
  const recipe = completeShrimpRecipe();
  const responses = [shrimpAnalysis(), recipe];
  let calls = 0;

  globalThis.fetch = async () => openRouterResponse(responses[calls++]);
  console.log = (...args: unknown[]) => { logs.push(args); };
  try {
    const response = await postScan({
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,AAAA',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.ok, true);
    assert.equal(calls, 2);

    const ingredientNames = response.body.data.recipe.ingredients.map((ingredient: { name: string }) => ingredient.name.toLowerCase());
    for (const expected of ['fettuccine', 'shrimp', 'butter', 'olive oil', 'garlic', 'heavy cream', 'parmesan', 'salt', 'black pepper']) {
      assert.ok(ingredientNames.some((name: string) => name.includes(expected)), `missing ${expected}`);
    }
    const logText = logs.map((entry) => entry.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')).join('\n');
    assert.doesNotMatch(logText, /recipe_structure_repair|recipe_quality_repair/);
    const timing = logs.find((entry) => entry[0] === '[scan_timing]')?.[1] as { providerCallCount?: number; deterministicRepairMs?: number; combinedRepairMs?: number } | undefined;
    assert.equal(timing?.providerCallCount, 2);
    assert.equal(timing?.combinedRepairMs, 0);
    assert.equal(typeof timing?.deterministicRepairMs, 'number');
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('POST /v1/scans normalizes recoverable malformed recipe output without retry', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs: unknown[][] = [];
  const recipe = {
    ...completeShrimpRecipe(),
    dishName: 'Generic Rice Bowl',
    title: 'Generic Rice Bowl',
    equipment: 'large pot, skillet',
    substitutions: 'Use tofu instead of shrimp.',
    spicePairings: 'sesame seeds\nchili flakes',
    steps: completeShrimpRecipe().steps.map((step, index) => index === 0
      ? { ...step, ingredients: 'fettuccine pasta, salt, water', tools: 'large pot' }
      : step),
  };
  const analysis = {
    ...shrimpAnalysis(),
    dishName: 'Generic Rice Bowl',
    broadDishCategory: 'rice bowl',
    visibleIngredients: ['rice', 'shrimp', 'sauce'],
  };
  const responses = [analysis, recipe];
  let calls = 0;

  globalThis.fetch = async () => openRouterResponse(responses[calls++]);
  console.log = (...args: unknown[]) => { logs.push(args); };
  try {
    const response = await postScan({
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,CCCC',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.ok, true);
    assert.equal(calls, 2);
    const logText = logs.map((entry) => entry.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')).join('\n');
    assert.doesNotMatch(logText, /recipe_retry|recipe_structure_repair|recipe_quality_repair|recipe_combined_repair/);
    const timing = logs.find((entry) => entry[0] === '[scan_timing]')?.[1] as { providerCallCount?: number; normalizationMs?: number } | undefined;
    assert.equal(timing?.providerCallCount, 2);
    assert.equal(typeof timing?.normalizationMs, 'number');
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('POST /v1/scans retries truncated JSON once then normalizes malformed retry output', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs: unknown[][] = [];
  const retryRecipe = {
    ...completeShrimpRecipe(),
    dishName: 'Generic Noodle Bowl',
    title: 'Generic Noodle Bowl',
    substitutions: 'Use tofu instead of shrimp.',
  };
  const analysis = {
    ...shrimpAnalysis(),
    dishName: 'Generic Noodle Bowl',
    broadDishCategory: 'pasta/noodles',
  };
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return openRouterResponse(analysis);
    if (calls === 2) return openRouterRawResponse('{"dishName":"Generic Noodle Bowl","title":"Generic Noodle Bowl","ingredients":[', 'length');
    return openRouterResponse(retryRecipe);
  };
  console.log = (...args: unknown[]) => { logs.push(args); };
  try {
    const response = await postScan({
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,DDDD',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.ok, true);
    assert.equal(calls, 3);
    const logText = logs.map((entry) => entry.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')).join('\n');
    assert.match(logText, /recipe_retry/);
    assert.doesNotMatch(logText, /recipe_structure_repair|recipe_quality_repair|recipe_combined_repair/);
    const timing = logs.find((entry) => entry[0] === '[scan_timing]')?.[1] as { providerCallCount?: number } | undefined;
    assert.equal(timing?.providerCallCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('POST /v1/scans uses one combined repair call and maps unrecoverable validation to recipe_validation_failed', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs: unknown[][] = [];
  const recipe = completeShrimpRecipe();
  recipe.dishName = 'Unrecoverable Validation Pasta';
  recipe.title = 'Unrecoverable Validation Pasta';
  recipe.steps = recipe.steps.slice(0, 3);
  const repaired = {
    ...recipe,
    ingredients: ['8 oz fettuccine pasta', '12 oz shrimp'],
    steps: recipe.steps,
  };
  const analysis = { ...shrimpAnalysis(), dishName: 'Unrecoverable Validation Pasta' };
  const responses = [analysis, recipe, repaired];
  let calls = 0;

  globalThis.fetch = async () => openRouterResponse(responses[calls++]);
  console.log = (...args: unknown[]) => { logs.push(args); };
  try {
    const response = await postScan({
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,BBBB',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error.code, 'recipe_validation_failed');
    assert.notEqual(response.body.error.code, 'internal_error');
    assert.match(response.body.error.details.validationMessage, /too_few_steps/);
    assert.equal(calls, 3);
    const logText = logs.map((entry) => entry.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')).join('\n');
    assert.match(logText, /recipe_combined_repair/);
    assert.doesNotMatch(logText, /recipe_structure_repair|recipe_quality_repair/);
    const timing = logs.find((entry) => entry[0] === '[scan_timing]')?.[1] as { providerCallCount?: number; combinedRepairMs?: number } | undefined;
    assert.equal(timing?.providerCallCount, 3);
    assert.equal(typeof timing?.combinedRepairMs, 'number');
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('description scans accept legacy modes but store and return Normal', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs: unknown[][] = [];
  const recipe = {
    ...completeShrimpRecipe(),
    dishName: 'Warm Weeknight Pasta',
    title: 'Warm Weeknight Pasta',
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openRouterResponse(recipe);
  };
  console.log = (...args: unknown[]) => { logs.push(args); };

  try {
    const response = await postScan({
      source: 'description',
      mode: 'Restaurant Copy',
      mealDescription: 'A warm weeknight pasta',
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.recipe.mode, 'Normal');
    assert.equal(calls, 1);
    const migrationLog = logs.find((entry) => entry[0] === 'recipe_mode_migrated');
    assert.deepEqual(migrationLog?.[1], {
      endpoint: '/v1/scans',
      receivedMode: 'Restaurant Copy',
      normalizedMode: 'Normal',
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('legacy and Normal scan modes share the same normalized cache identity', async () => {
  const originalFetch = globalThis.fetch;
  const analysis = {
    ...shrimpAnalysis(),
    dishName: 'Normalized Cache Pasta',
    possibleDishNames: ['Normalized Cache Pasta'],
  };
  const recipe = {
    ...completeShrimpRecipe(),
    dishName: 'Normalized Cache Pasta',
    title: 'Normalized Cache Pasta',
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openRouterResponse(calls === 1 ? analysis : recipe);
  };
  const requestBody = {
    source: 'photos',
    image: {
      dataUrl: 'data:image/png;base64,Q0FDSE1PREU=',
      mimeType: 'image/png',
      dataUrlSizeBytes: 38,
    },
  };

  try {
    const legacyResponse = await postScan({ ...requestBody, mode: 'Budget' });
    const currentResponse = await postScan({ ...requestBody, mode: 'Normal' });
    assert.equal(legacyResponse.status, 201);
    assert.equal(currentResponse.status, 201);
    assert.equal(legacyResponse.body.data.recipe.mode, 'Normal');
    assert.equal(currentResponse.body.data.recipe.mode, 'Normal');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a cached repeat scan receives a fresh independent API source root', async () => {
  const originalFetch = globalThis.fetch;
  const sourceImage = `data:image/png;base64,${Buffer.from(`cache-root-${Date.now()}`).toString('base64')}`;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openRouterResponse(calls === 1 ? shrimpAnalysis() : completeShrimpRecipe());
  };

  try {
    const first = await postScan({
      source: 'photos',
      mode: 'Normal',
      image: { dataUrl: sourceImage, mimeType: 'image/png', dataUrlSizeBytes: sourceImage.length },
    });
    const callsAfterFirst = calls;
    const second = await postScan({
      source: 'photos',
      mode: 'Normal',
      image: { dataUrl: sourceImage, mimeType: 'image/png', dataUrlSizeBytes: sourceImage.length },
    });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(calls, callsAfterFirst);
    assert.notEqual(first.body.data.recipe.id, second.body.data.recipe.id);
    assert.notEqual(first.body.data.scan.id, second.body.data.scan.id);
    assert.equal(first.body.data.scan.recipeId, first.body.data.recipe.id);
    assert.equal(second.body.data.scan.recipeId, second.body.data.recipe.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid scan modes return a safe 400 and log only the invalid field value', async () => {
  const originalLog = console.log;
  const logs: unknown[][] = [];
  console.log = (...args: unknown[]) => { logs.push(args); };

  try {
    const response = await postScan({
      source: 'photos',
      mode: 'Chef Surprise',
      image: {
        dataUrl: 'data:image/png;base64,U0VDUkVU',
        mimeType: 'image/png',
      },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'validation_error');
    assert.equal(response.body.error.message, 'Request validation failed.');
    assert.equal(response.body.error.details, undefined);

    const validationLog = logs.find((entry) => entry[0] === 'request_validation_failed');
    assert.ok(validationLog);
    assert.deepEqual(validationLog[1], {
      endpoint: '/v1/scans',
      invalidField: 'mode',
      receivedValue: 'Chef Surprise',
      expectedCurrentValues: ['Normal', 'Lighter', 'Healthier', 'More Protein'],
      finalStatus: 400,
    });
    assert.doesNotMatch(JSON.stringify(validationLog), /U0VDUkVU|data:image/);
  } finally {
    console.log = originalLog;
  }
});
