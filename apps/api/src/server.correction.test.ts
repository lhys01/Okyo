import assert from 'node:assert/strict';
import { once } from 'node:events';
import http, { type Server } from 'node:http';
import test, { after } from 'node:test';

import type { Recipe } from './types.js';
import {
  getGeneratedRecipe,
  getGeneratedRecipeRevisionMetadata,
  storeGeneratedRecipe,
} from './store.js';

process.env.NODE_ENV = 'test';
process.env.AI_ENABLED = 'true';
process.env.OPENROUTER_API_KEY = 'sk-test';
process.env.EPICURE_ENABLED = 'false';
process.env.AI_MAX_OUTPUT_TOKENS = '4096';

type ProviderRecipeOptions = {
  title: string;
  description?: string;
  servings?: number;
  ingredients: string[];
  instructions: string[];
  proteinGrams?: number;
  calories?: number;
  totalMinutes?: number;
  equipment?: string[];
  substitutions?: string[];
};

function sourceRecipe(id: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    scanResultId: `scan-${id}`,
    title: 'Shrimp Rice Bowl',
    mode: 'Normal',
    description: 'A savory shrimp rice bowl.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    activeTimeMinutes: 20,
    passiveTimeMinutes: 10,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 8,
    estimatedSavings: 10,
    ingredients: [
      { name: 'shrimp', quantity: '12 oz' },
      { name: 'cooked rice', quantity: '2 cups' },
      { name: 'olive oil', quantity: '1 tbsp' },
    ],
    steps: [
      'Sear the shrimp in olive oil for 5 minutes.',
      'Serve the shrimp over the cooked rice.',
    ],
    structuredSteps: [
      { title: 'Sear Shrimp', text: 'Sear the shrimp in olive oil for 5 minutes.', ingredientsUsed: ['shrimp', 'olive oil'], toolsUsed: ['skillet'], activeMinutes: 5, passiveMinutes: 0, elapsedMinutes: 5 },
      { title: 'Assemble Bowl', text: 'Serve the shrimp over the cooked rice.', ingredientsUsed: ['shrimp', 'cooked rice'], toolsUsed: ['bowl'], activeMinutes: 2, passiveMinutes: 0, elapsedMinutes: 2 },
    ],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated recipe.',
    equipment: ['skillet', 'bowl'],
    nutritionEstimate: {
      calories: 430,
      proteinGrams: 28,
      carbohydratesGrams: 50,
      fatGrams: 12,
      fiberGrams: 3,
    },
    ...overrides,
  };
}

function providerRecipe(options: ProviderRecipeOptions) {
  const totalMinutes = options.totalMinutes ?? 25;
  return {
    title: options.title,
    description: options.description ?? `${options.title}, revised for the requested edit.`,
    prepTime: '10 minutes',
    cookTime: `${Math.max(1, totalMinutes - 10)} minutes`,
    totalTime: `${totalMinutes} minutes`,
    activeTime: `${totalMinutes} minutes`,
    servings: options.servings ?? 2,
    skillLevel: 'Easy',
    nutritionEstimate: {
      calories: options.calories ?? 420,
      proteinGrams: options.proteinGrams ?? 30,
      carbohydratesGrams: 45,
      fatGrams: 12,
      fiberGrams: 5,
    },
    equipment: options.equipment ?? ['bowl', 'skillet'],
    ingredients: options.ingredients,
    substitutions: options.substitutions ?? [],
    spicePairings: ['black pepper'],
    storageAndReheating: 'Store covered and reheat gently with a splash of water.',
    avoidMistake: 'Taste before making the final adjustment.',
    steps: options.instructions.map((instruction, index) => ({
      stepNumber: index + 1,
      phase: index === options.instructions.length - 1 ? 5 : Math.min(4, index + 1),
      title: `Step ${index + 1}`,
      step: instruction,
      ingredients: options.ingredients.map((ingredient) => ingredient.replace(/^\S+(?:\s+\S+)?\s+/, '')).slice(0, 2),
      tools: [options.equipment?.[0] ?? 'bowl'],
      activeMinutes: 5,
      passiveMinutes: 0,
      elapsedMinutes: 5,
      timeEstimate: '5 minutes hands-on',
    })),
  };
}

function providerResponse(content: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
}

function rawProviderResponse(content: string): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { content } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
}

function userVisibleRecipeText(recipe: Recipe): string {
  return [
    recipe.title,
    recipe.description,
    ...recipe.ingredients.flatMap(({ name, quantity }) => [name, quantity]),
    ...recipe.steps,
    ...(recipe.structuredSteps ?? []).flatMap((step) => [
      step.title ?? '',
      step.text,
      ...(step.ingredientsUsed ?? []),
    ]),
    ...recipe.substitutions,
    ...(recipe.spicePairings ?? []),
    recipe.pantryNote,
    recipe.storageAndReheating ?? '',
  ].join(' ').toLowerCase();
}

let sharedServer: Server | null = null;

async function getSharedServer() {
  if (!sharedServer) {
    const { app } = await import('./server.js');
    sharedServer = app.listen(0, '127.0.0.1');
    await once(sharedServer, 'listening');
  }
  return sharedServer;
}

after(async () => {
  if (!sharedServer) return;
  await new Promise<void>((resolve, reject) => {
    sharedServer?.close((error) => error ? reject(error) : resolve());
  });
  sharedServer = null;
});

async function request(method: string, path: string, body?: unknown) {
  const server = await getSharedServer();
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      localAddress: '127.0.0.1',
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
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        body: raw ? JSON.parse(raw) : undefined,
      }));
    });
    req.on('error', reject);
    if (payload) req.end(payload); else req.end();
  });
}

async function editStoredRecipe(input: {
  source: Recipe;
  note: string;
  providerOutput: unknown;
  correctionRequestId?: string;
  requestOverrides?: Record<string, unknown>;
}) {
  storeGeneratedRecipe(input.source);
  const originalFetch = globalThis.fetch;
  const prompts: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_request, init) => {
    calls += 1;
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { messages?: Array<{ content?: unknown }> }
      : {};
    prompts.push(JSON.stringify(body.messages ?? []));
    return providerResponse(input.providerOutput);
  };
  try {
    const response = await request('POST', `/v1/recipes/${input.source.id}/correct`, {
      correctionNote: input.note,
      correctionRequestId: input.correctionRequestId,
      expectedSourceRecipeId: input.source.id,
      canonicalRecipeId: `canonical-${input.source.id}`,
      currentRecipe: input.source,
      scanSessionId: input.source.scanResultId,
      mode: 'Normal',
      ...input.requestOverrides,
    });
    return { response, calls, prompts };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('mobile correction payload accepts dietary context and carries it into the edit prompt', async () => {
  const source = sourceRecipe(`dietary-contract-${Date.now()}`);
  const revised = providerRecipe({
    title: 'Dairy-Free Tofu Rice Bowl',
    ingredients: ['12 oz tofu', '2 cups cooked rice', '1 tbsp olive oil'],
    instructions: ['Sear tofu in olive oil.', 'Serve tofu over cooked rice.'],
  });

  const { response, calls, prompts } = await editStoredRecipe({
    source,
    note: 'Replace the shrimp with tofu and make it dairy free',
    providerOutput: revised,
    requestOverrides: {
      dietaryRestrictions: ['dairy'],
      dietaryDislikes: [],
    },
  });

  assert.equal(response.status, 201);
  assert.equal(calls, 1);
  assert.match(prompts[0], /HARD DIETARY RESTRICTION/);
  assert.match(prompts[0], /dairy/);
  assert.equal(userVisibleRecipeText(response.body.data.recipe as Recipe).includes('shrimp'), false);
});

test('Mango Sticky Rice can be corrected to strawberries as a complete persisted revision', async () => {
  const source = sourceRecipe(`mango-sticky-rice-${Date.now()}`, {
    title: 'Mango Sticky Rice',
    description: 'Coconut sticky rice topped with ripe mango.',
    ingredients: [
      { name: 'glutinous rice', quantity: '1 cup' },
      { name: 'coconut milk', quantity: '1 cup' },
      { name: 'ripe mango', quantity: '1 large' },
    ],
    steps: [
      'Cook the glutinous rice until tender.',
      'Fold in coconut milk, then top with sliced mango.',
    ],
    structuredSteps: [
      { title: 'Cook Rice', text: 'Cook the glutinous rice until tender.', ingredientsUsed: ['glutinous rice'], toolsUsed: ['pot'] },
      { title: 'Finish', text: 'Fold in coconut milk, then top with sliced mango.', ingredientsUsed: ['coconut milk', 'ripe mango'], toolsUsed: ['bowl'] },
    ],
    equipment: ['pot', 'bowl'],
    nutritionEstimate: { calories: 440, proteinGrams: 5, carbohydratesGrams: 82, fatGrams: 11 },
  });
  const original = structuredClone(source);
  const revised = providerRecipe({
    title: 'Strawberry Sticky Rice',
    description: 'Coconut sticky rice topped with fresh strawberries.',
    ingredients: ['1 cup glutinous rice', '1 cup coconut milk', '1 1/2 cups fresh strawberries'],
    instructions: [
      'Cook the glutinous rice until tender.',
      'Fold in coconut milk, then top with sliced strawberries.',
    ],
    calories: 405,
    proteinGrams: 6,
    equipment: ['pot', 'bowl'],
  });

  const { response, calls, prompts } = await editStoredRecipe({
    source,
    note: 'Replace the mango with strawberries.',
    providerOutput: revised,
  });

  assert.equal(response.status, 201);
  assert.equal(calls, 1);
  assert.match(prompts[0], /Replace the mango with strawberries\./);
  const recipe = response.body.data.recipe as Recipe;
  const visibleText = userVisibleRecipeText(recipe);
  assert.equal(visibleText.includes('mango'), false);
  assert.equal(visibleText.includes('strawberr'), true);
  assert.equal(recipe.nutritionEstimate?.calories, 405);
  assert.notEqual(recipe.id, source.id);
  assert.deepEqual(getGeneratedRecipe(source.id), original);
  assert.equal(getGeneratedRecipeRevisionMetadata(recipe.id)?.parentRevisionId, source.id);
  assert.equal(getGeneratedRecipeRevisionMetadata(source.id)?.supersededBy, recipe.id);
});

test('a validated current recipe rehydrates customization after process-local recipe state is missing', async () => {
  const source = sourceRecipe(`rehydrated-${Date.now()}`);
  const revised = providerRecipe({
    title: 'Strawberry Sticky Rice',
    description: 'Sticky rice topped with fresh strawberries.',
    ingredients: ['1 cup glutinous rice', '1 cup coconut milk', '1 1/2 cups strawberries'],
    instructions: ['Cook the glutinous rice.', 'Top the rice with sliced strawberries.'],
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => providerResponse(revised);
  try {
    const response = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Replace the mango with strawberries.',
      currentRecipe: source,
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(response.status, 201);
    assert.match(response.body.data.recipe.title, /Strawberry/);
    assert.equal(getGeneratedRecipe(response.body.data.recipe.id)?.title, 'Strawberry Sticky Rice');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('No Oreo and more protein succeeds as one complete recipe edit', async () => {
  const source = sourceRecipe(`edit-a-${Date.now()}`, {
    title: 'High Protein Oreo Dessert',
    description: 'A yogurt dessert with Oreo cookies.',
    ingredients: [
      { name: 'Oreo cookies', quantity: '1 cup' },
      { name: 'Greek yogurt', quantity: '1 1/2 cups' },
      { name: 'cocoa powder', quantity: '2 tbsp' },
    ],
    steps: ['Crush the Oreo cookies.', 'Fold Oreo cookies into the yogurt.'],
    structuredSteps: [
      { title: 'Crush Cookies', text: 'Crush the Oreo cookies.', ingredientsUsed: ['Oreo cookies'], toolsUsed: ['bag'] },
      { title: 'Fold Dessert', text: 'Fold Oreo cookies into the yogurt.', ingredientsUsed: ['Oreo cookies', 'Greek yogurt'], toolsUsed: ['bowl'] },
    ],
    nutritionEstimate: { calories: 400, proteinGrams: 25, carbohydratesGrams: 45, fatGrams: 12 },
  });
  const revised = providerRecipe({
    title: 'High-Protein Chocolate Yogurt Dessert',
    description: 'A chocolate yogurt dessert with extra protein.',
    ingredients: ['2 cups Greek yogurt', '1/2 cup vanilla protein powder', '2 tbsp cocoa powder'],
    instructions: ['Whisk Greek yogurt with protein powder for 2 minutes.', 'Fold in cocoa powder and chill for 20 minutes.'],
    proteinGrams: 38,
  });
  const { response, calls, prompts } = await editStoredRecipe({ source, note: 'No Oreo and more protein', providerOutput: revised });
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
  const recipe = response.body.data.recipe as Recipe;
  assert.equal(userVisibleRecipeText(recipe).includes('oreo'), false);
  assert.ok((recipe.nutritionEstimate?.proteinGrams ?? 0) > 25);
  assert.match(prompts[0], /No Oreo and more protein/);
  assert.doesNotMatch(prompts[0], /PATCH-FIRST|ingredientOperations|stepOperations/);
});

test('the live ingredient-group object shape normalizes and saves without schema retry', async () => {
  const source = sourceRecipe(`edit-live-shape-${Date.now()}`, {
    title: 'High Protein Oreo Dessert',
    description: 'A yogurt dessert with Oreo cookies.',
    ingredients: [
      { name: 'Oreo cookies', quantity: '1 cup' },
      { name: 'Greek yogurt', quantity: '1 1/2 cups' },
    ],
    nutritionEstimate: { calories: 400, proteinGrams: 25, carbohydratesGrams: 45, fatGrams: 12 },
  });
  const revised = {
    title: 'High Protein Chocolate Dessert',
    description: 'A chilled chocolate dessert with extra protein.',
    servings: 2,
    difficulty: 'Easy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 0,
    totalTimeMinutes: 40,
    activeTimeMinutes: 10,
    passiveTimeMinutes: 30,
    ingredients: [
      { name: 'Greek yogurt', quantity: '2 cups' },
      { name: 'protein powder', quantity: '1/2 cup' },
      { name: 'cocoa powder', quantity: '2 tbsp' },
    ],
    ingredientGroups: [{
      component: 'Dessert',
      items: [
        { name: 'Greek yogurt', quantity: '2 cups' },
        { name: 'protein powder', quantity: '1/2 cup' },
        { name: 'cocoa powder', quantity: '2 tbsp' },
      ],
    }],
    steps: [{
      stepNumber: 1,
      phase: 2,
      title: 'Mix Dessert',
      step: 'Whisk the Greek yogurt, protein powder, and cocoa powder, then chill for 30 minutes.',
      ingredients: ['Greek yogurt', 'protein powder', 'cocoa powder'],
      tools: ['mixing bowl'],
      activeMinutes: 5,
      passiveMinutes: 30,
      elapsedMinutes: 35,
      timeEstimate: '5 minutes hands-on plus 30 minutes waiting',
    }],
    nutritionEstimate: {
      calories: 320,
      proteinGrams: 38,
      carbohydratesGrams: 24,
      fatGrams: 8,
      fiberGrams: 3,
    },
  };

  const { response, calls } = await editStoredRecipe({
    source,
    note: 'No Oreo and more protein',
    providerOutput: revised,
  });
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
  const recipe = response.body.data.recipe as Recipe;
  assert.equal(userVisibleRecipeText(recipe).includes('oreo'), false);
  assert.ok((recipe.nutritionEstimate?.proteinGrams ?? 0) > 25);
});

test('one full revision applies replacement, flavor, and servings together', async () => {
  const source = sourceRecipe(`edit-b-${Date.now()}`);
  const revised = providerRecipe({
    title: 'Spicy Tofu Rice Bowl',
    servings: 4,
    ingredients: ['16 oz extra-firm tofu', '4 cups cooked rice', '2 tbsp chili crisp', '1 tbsp olive oil'],
    instructions: ['Sear tofu in olive oil for 8 minutes.', 'Fold chili crisp into tofu and serve over rice.'],
  });
  const { response, calls } = await editStoredRecipe({
    source,
    note: 'Use tofu instead of shrimp, make it spicy, and serve 4',
    providerOutput: revised,
  });
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
  const recipe = response.body.data.recipe as Recipe;
  const text = userVisibleRecipeText(recipe);
  assert.equal(recipe.servings, 4);
  assert.match(text, /tofu/);
  assert.match(text, /chili/);
  assert.equal(text.includes('shrimp'), false);
});

test('arbitrary ingredient and conceptual dairy-free edit needs no ingredient-specific code', async () => {
  const source = sourceRecipe(`edit-c-${Date.now()}`, {
    title: 'Creamy Pasta',
    ingredients: [{ name: 'pasta', quantity: '8 oz' }, { name: 'cream', quantity: '1 cup' }],
  });
  const revised = providerRecipe({
    title: 'Creamy Black Garlic Pasta',
    ingredients: ['8 oz pasta', '3 cloves black garlic', '1 cup cashew cream'],
    instructions: ['Boil pasta for 9 minutes.', 'Blend black garlic with cashew cream and toss with pasta.'],
  });
  const { response } = await editStoredRecipe({
    source,
    note: 'Add black garlic and make it creamy without dairy',
    providerOutput: revised,
  });
  assert.equal(response.status, 201);
  const text = userVisibleRecipeText(response.body.data.recipe);
  assert.match(text, /black garlic/);
  assert.match(text, /cashew cream/);
  assert.doesNotMatch(text, /\bdairy\b|\bmilk\b|\bbutter\b|\bcheese\b/);
});

test('semantic style plus explicit time target succeeds through the same full-recipe path', async () => {
  const source = sourceRecipe(`edit-d-${Date.now()}`, { title: 'Chicken Skillet' });
  const revised = providerRecipe({
    title: 'Mediterranean Chicken Skillet',
    totalMinutes: 24,
    ingredients: ['12 oz chicken thighs', '1 cup tomatoes', '1/2 cup olives', '1 tbsp olive oil'],
    instructions: ['Sear chicken in olive oil for 10 minutes.', 'Simmer with tomatoes and olives for 14 minutes.'],
  });
  const { response } = await editStoredRecipe({
    source,
    note: 'Make it Mediterranean and take under 25 minutes',
    providerOutput: revised,
  });
  assert.equal(response.status, 201);
  const recipe = response.body.data.recipe as Recipe;
  assert.match(userVisibleRecipeText(recipe), /mediterranean|olive/);
  assert.ok((recipe.totalTimeMinutes ?? Infinity) <= 25);
});

test('subjective flavor edits succeed without deterministic ingredient requirements', async () => {
  const source = sourceRecipe(`edit-e-${Date.now()}`, { title: 'Chocolate Dessert' });
  const revised = providerRecipe({
    title: 'Dark Chocolate Yogurt Dessert',
    description: 'A less-sweet dessert with a deeper chocolate flavor.',
    ingredients: ['2 cups Greek yogurt', '1/3 cup unsweetened cocoa', '1 tbsp maple syrup'],
    instructions: ['Whisk yogurt with cocoa.', 'Add maple syrup, taste, and chill for 15 minutes.'],
  });
  const { response, calls } = await editStoredRecipe({
    source,
    note: 'Make it taste less sweet but more chocolatey',
    providerOutput: revised,
  });
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
});

test('an unfamiliar ingredient string passes through without a whitelist', async () => {
  const source = sourceRecipe(`edit-f-${Date.now()}`);
  const revised = providerRecipe({
    title: 'Zorvani Root Rice Bowl',
    ingredients: ['2 cups cooked rice', '1 cup zorvani root', '1 tbsp olive oil'],
    instructions: ['Sear zorvani root in olive oil for 8 minutes.', 'Serve zorvani root over cooked rice.'],
  });
  const { response } = await editStoredRecipe({
    source,
    note: 'Add zorvani root',
    providerOutput: revised,
  });
  assert.equal(response.status, 201);
  assert.match(userVisibleRecipeText(response.body.data.recipe), /zorvani root/);
});

test('an unchanged first recipe receives exactly one complete-recipe edit retry', async () => {
  const source = sourceRecipe(`retry-${Date.now()}`);
  storeGeneratedRecipe(source);
  const unchanged = providerRecipe({
    title: source.title,
    description: source.description,
    servings: source.servings,
    ingredients: source.ingredients.map(({ quantity, name }) => `${quantity} ${name}`),
    instructions: source.steps,
    proteinGrams: source.nutritionEstimate?.proteinGrams,
    totalMinutes: source.totalTimeMinutes,
    equipment: source.equipment,
    substitutions: source.substitutions,
  });
  const revised = providerRecipe({
    title: 'Ginger Tofu Rice Bowl',
    ingredients: ['12 oz tofu', '2 cups cooked rice', '1 tbsp ginger oil'],
    instructions: ['Sear tofu in ginger oil for 8 minutes.', 'Serve tofu over rice.'],
  });
  const originalFetch = globalThis.fetch;
  const prompts: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_request, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { messages?: unknown } : {};
    prompts.push(JSON.stringify(body.messages ?? []));
    calls += 1;
    return providerResponse(calls === 1 ? unchanged : revised);
  };
  try {
    const response = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Use tofu and ginger instead',
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(response.status, 201);
    assert.equal(calls, 2);
    assert.match(prompts[1], /Previous revised recipe/);
    assert.match(prompts[1], /edit_not_applied/);
    assert.doesNotMatch(prompts.join(' '), /PATCH-FIRST|ONE FOCUSED REPAIR|FINAL CORRECTION FALLBACK/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an unsatisfied complete-recipe retry stops after two culinary edit attempts', async () => {
  const source = sourceRecipe(`unsatisfied-${Date.now()}`);
  storeGeneratedRecipe(source);
  const unchanged = providerRecipe({
    title: source.title,
    description: source.description,
    servings: source.servings,
    ingredients: source.ingredients.map(({ quantity, name }) => `${quantity} ${name}`),
    instructions: source.steps,
    proteinGrams: source.nutritionEstimate?.proteinGrams,
    totalMinutes: source.totalTimeMinutes,
    equipment: source.equipment,
    substitutions: source.substitutions,
  });
  const original = structuredClone(source);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(unchanged);
  };
  try {
    const response = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Use tofu and ginger instead',
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(response.status, 422);
    assert.equal(response.body.error.code, 'recipe_correction_failed');
    assert.equal(calls, 2);
    assert.deepEqual(getGeneratedRecipe(source.id), original);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('malformed provider output uses bounded failover and then accepts a complete recipe', async () => {
  const source = sourceRecipe(`malformed-${Date.now()}`);
  storeGeneratedRecipe(source);
  const revised = providerRecipe({
    title: 'Lemon Tofu Rice Bowl',
    ingredients: ['12 oz tofu', '2 cups cooked rice', '1 tbsp lemon oil'],
    instructions: ['Sear tofu in lemon oil.', 'Serve tofu over rice.'],
  });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? rawProviderResponse('{not json') : providerResponse(revised);
  };
  try {
    const response = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Use lemon tofu instead',
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(response.status, 201);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider failure preserves the original recipe and returns an upstream error', async () => {
  const source = sourceRecipe(`provider-down-${Date.now()}`);
  storeGeneratedRecipe(source);
  const original = structuredClone(source);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('network unavailable');
  };
  try {
    const response = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Make it smoky',
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'recipe_correction_unavailable');
    assert.ok(calls > 0 && calls <= 3);
    assert.deepEqual(getGeneratedRecipe(source.id), original);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('two unusable recipe-like responses return unavailable and preserve the original', async () => {
  const source = sourceRecipe(`unusable-provider-${Date.now()}`);
  const original = structuredClone(source);
  const { response, calls } = await editStoredRecipe({
    source,
    note: 'Make it smoky',
    providerOutput: { message: 'No recipe fields were returned.' },
  });
  assert.equal(response.status, 502);
  assert.equal(response.body.error.code, 'recipe_correction_unavailable');
  assert.equal(calls, 2);
  assert.deepEqual(getGeneratedRecipe(source.id), original);
});

test('a successful edit creates one immutable revision and leaves the original unchanged', async () => {
  const source = sourceRecipe(`revision-${Date.now()}`);
  const original = structuredClone(source);
  const revised = providerRecipe({
    title: 'Crispy Tofu Rice Bowl',
    ingredients: ['12 oz tofu', '2 cups cooked rice', '1 tbsp olive oil'],
    instructions: ['Sear tofu until crisp.', 'Serve tofu over rice.'],
  });
  Object.assign(revised, {
    id: 'model-generated-id-must-be-ignored',
    canonicalRecipeId: 'model-generated-canonical-id-must-be-ignored',
    revisionId: 'model-generated-revision-id-must-be-ignored',
  });
  const { response } = await editStoredRecipe({ source, note: 'Use crispy tofu instead', providerOutput: revised });
  assert.equal(response.status, 201);
  const revisionId = response.body.data.recipe.id as string;
  assert.notEqual(revisionId, source.id);
  assert.notEqual(revisionId, 'model-generated-id-must-be-ignored');
  assert.deepEqual(getGeneratedRecipe(source.id), original);
  assert.equal(getGeneratedRecipeRevisionMetadata(revisionId)?.parentRevisionId, source.id);
  assert.equal(getGeneratedRecipeRevisionMetadata(source.id)?.supersededBy, revisionId);
});

test('duplicate correction submissions return the same revision without a second provider call', async () => {
  const source = sourceRecipe(`duplicate-${Date.now()}`);
  storeGeneratedRecipe(source);
  const revised = providerRecipe({
    title: 'Herbed Tofu Rice Bowl',
    ingredients: ['12 oz tofu', '2 cups cooked rice', '2 tbsp fresh herbs'],
    instructions: ['Sear tofu with fresh herbs.', 'Serve tofu over rice.'],
  });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(revised);
  };
  const correctionRequestId = `request-${Date.now()}`;
  const body = {
    correctionNote: 'Use tofu and fresh herbs',
    correctionRequestId,
    expectedSourceRecipeId: source.id,
    mode: 'Normal',
  };
  try {
    const first = await request('POST', `/v1/recipes/${source.id}/correct`, body);
    const duplicate = await request('POST', `/v1/recipes/${source.id}/correct`, body);
    assert.equal(first.status, 201);
    assert.equal(duplicate.status, 201);
    assert.equal(first.body.data.recipe.id, duplicate.body.data.recipe.id);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a stale source revision remains protected', async () => {
  const source = sourceRecipe(`stale-${Date.now()}`);
  const firstRevision = providerRecipe({
    title: 'Tofu Rice Bowl',
    ingredients: ['12 oz tofu', '2 cups cooked rice', '1 tbsp olive oil'],
    instructions: ['Sear tofu.', 'Serve tofu over rice.'],
  });
  const first = await editStoredRecipe({ source, note: 'Use tofu', providerOutput: firstRevision });
  assert.equal(first.response.status, 201);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(firstRevision);
  };
  try {
    const stale = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Make it smoky',
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'stale_recipe_revision');
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown recipes and empty edit messages fail before provider work', async () => {
  const unknown = await request('POST', '/v1/recipes/does-not-exist/correct', {
    correctionNote: 'Make it brighter',
    mode: 'Normal',
  });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'recipe_not_found');

  const empty = await request('POST', '/v1/recipes/does-not-exist/correct', {
    correctionNote: '   ',
    mode: 'Normal',
  });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'validation_error');
});
