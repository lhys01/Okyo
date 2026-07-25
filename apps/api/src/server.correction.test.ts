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

function chickenAnalysis() {
  return {
    scanState: 'clear_food',
    dishName: 'Grilled Chicken Tikka',
    possibleDishNames: ['Grilled Chicken Tikka'],
    broadDishCategory: 'grilled protein',
    cuisine: 'Indian',
    confidence: 0.82,
    isFoodImage: true,
    isRestaurantMeal: true,
    rejectionReason: '',
    visibleIngredients: ['grilled meat', 'spices'],
    likelyIngredients: ['yogurt', 'garam masala', 'ginger', 'garlic', 'lemon'],
    visibleComponents: {
      protein: 'grilled meat',
      sauce: '',
      baseStarch: '',
      vegetables: '',
      toppingsGarnish: 'cilantro',
      cookingMethod: 'grilled',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 7,
    confidenceReason: 'Grilled meat on skewers with charred edges.',
  };
}

function chickenRecipe() {
  return {
    dishName: 'Grilled Chicken Tikka',
    title: 'Grilled Chicken Tikka',
    description: 'A smoky, marinated grilled chicken inspired-by recipe.',
    prepTime: '20 minutes',
    cookTime: '15 minutes',
    totalTime: '35 minutes',
    servings: 2,
    equipment: ['skewers', 'grill pan', 'bowl'],
    ingredients: [
      '1 lb chicken thighs, cubed',
      '1 cup plain yogurt',
      '2 tsp garam masala',
      '1 tbsp ginger garlic paste',
      '1 tbsp lemon juice',
      '1 tsp salt',
      '1 tbsp vegetable oil',
    ],
    steps: [
      buildStep(1, { title: 'Marinate', step: 'Mix chicken with yogurt and spices for 2 minutes then rest.', ingredients: ['chicken thighs', 'yogurt', 'garam masala'], tools: ['bowl'] }),
      buildStep(2, { title: 'Skewer', step: 'Thread chicken onto skewers for 2 minutes.', ingredients: ['chicken thighs'], tools: ['skewers'] }),
      buildStep(3, { title: 'Grill', step: 'Grill chicken for 12 minutes, turning occasionally, until cooked through.', ingredients: ['chicken thighs', 'vegetable oil'], tools: ['grill pan'] }),
      buildStep(4, { title: 'Rest', step: 'Rest chicken for 3 minutes before serving.', ingredients: ['chicken thighs'], tools: ['plate'] }),
    ],
  };
}

function lambRecipe() {
  return {
    dishName: 'Grilled Lamb Chops',
    title: 'Grilled Lamb Chops',
    description: 'Herb-marinated grilled lamb chops, homemade.',
    prepTime: '20 minutes',
    cookTime: '15 minutes',
    totalTime: '35 minutes',
    servings: 2,
    equipment: ['grill pan', 'tongs', 'bowl'],
    ingredients: [
      '4 lamb chops',
      '2 tbsp olive oil',
      '2 cloves garlic, minced',
      '1 tsp rosemary',
      '1 tsp salt',
      '1/2 tsp black pepper',
    ],
    steps: [
      buildStep(1, { title: 'Mix Marinade', step: 'Whisk olive oil, garlic, and rosemary together for 1 minute.', ingredients: ['olive oil', 'garlic', 'rosemary'], tools: ['bowl'] }),
      buildStep(2, { title: 'Season Chops', step: 'Pat lamb chops dry and season with salt and pepper for 1 minute.', ingredients: ['lamb chops', 'salt', 'black pepper'], tools: ['plate'] }),
      buildStep(3, { title: 'Marinate', step: 'Rub lamb chops with the marinade for 2 minutes.', ingredients: ['lamb chops', 'olive oil', 'garlic', 'rosemary'], tools: ['bowl'] }),
      buildStep(4, { title: 'Rest Marinade', step: 'Let lamb chops rest for 10 minutes to absorb the marinade.', ingredients: ['lamb chops'], tools: ['plate'] }),
      buildStep(5, { title: 'Heat Pan', step: 'Heat the grill pan for 2 minutes until hot.', ingredients: [], tools: ['grill pan'] }),
      buildStep(6, { title: 'Sear First Side', step: 'Sear lamb chops for 4 minutes until browned.', ingredients: ['lamb chops'], tools: ['grill pan', 'tongs'] }),
      buildStep(7, { title: 'Sear Second Side', step: 'Flip and sear the other side for 4 minutes until browned.', ingredients: ['lamb chops'], tools: ['grill pan', 'tongs'] }),
      buildStep(8, { title: 'Rest', step: 'Rest lamb chops for 3 minutes before serving.', ingredients: ['lamb chops'], tools: ['plate'] }),
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

async function request(method: string, path: string, body?: unknown) {
  const { app } = await import('./server.js');
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const req = http.request({
        hostname: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : {},
      }, (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { raw += chunk; });
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body: raw ? JSON.parse(raw) : undefined });
        });
      });
      req.on('error', reject);
      if (payload) req.end(payload); else req.end();
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('POST /v1/recipes/:recipeId/correct regenerates ingredients/steps from a correction, not just the title', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [chickenAnalysis(), chickenRecipe()];
  let calls = 0;
  globalThis.fetch = async () => openRouterResponse(calls++ < responses.length ? responses[calls - 1] : lambRecipe());

  try {
    const scanResponse = await request('POST', '/v1/scans', {
      source: 'photos',
      mode: 'Restaurant Copy',
      image: {
        dataUrl: 'data:image/png;base64,AAAA',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });
    assert.equal(scanResponse.status, 201);
    const originalRecipeId = scanResponse.body.data.recipe.id as string;
    assert.equal(scanResponse.body.data.scan.dishName, 'Grilled Chicken Tikka');

    const correctionResponse = await request('POST', `/v1/recipes/${originalRecipeId}/correct`, {
      correctionNote: 'These are lamb chops, not chicken.',
      dishNameOverride: 'Grilled Lamb Chops',
      mode: 'Restaurant Copy',
    });

    assert.equal(correctionResponse.status, 201);
    assert.equal(correctionResponse.body.ok, true);
    assert.equal(correctionResponse.body.data.scan.dishName, 'Grilled Lamb Chops');
    const correctedIngredients = correctionResponse.body.data.recipe.ingredients.map((ingredient: { name: string }) => ingredient.name.toLowerCase());
    assert.ok(correctedIngredients.some((name: string) => name.includes('lamb')));
    assert.ok(!correctedIngredients.some((name: string) => name.includes('chicken')));
    assert.ok(calls >= 3, `expected at least 3 provider calls, saw ${calls}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POST /v1/recipes/:recipeId/correct returns 404 for an unknown or expired recipe', async () => {
  const response = await request('POST', '/v1/recipes/does-not-exist/correct', {
    correctionNote: 'These are lamb chops, not chicken.',
  });
  assert.equal(response.status, 404);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'recipe_not_found');
});

test('POST /v1/recipes/:recipeId/correct rejects an empty correction note', async () => {
  const response = await request('POST', '/v1/recipes/does-not-exist/correct', {
    correctionNote: '   ',
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'validation_error');
});
