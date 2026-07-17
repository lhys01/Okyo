import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DatabaseGatewayError,
  type GeneratedRecipeRow,
  type ScanRecipeDatabaseGateway,
  type ScanSessionRow,
} from '../database/client.js';
import type { Recipe } from '../types.js';
import {
  createScanRecipeRepository,
  InvalidPersistedRecipeError,
} from './scanRecipeRepository.js';

const userA = '162b7af3-e489-4cc9-8f11-09913a4b142a';
const userB = 'd883a3a8-60f7-4aa7-b706-850f93c8e15d';
const recipeId = 'a90e5c8c-ca41-4a53-8e4c-d331876a9d1a';

test('scan-session writes always include the verified user ID', async () => {
  const database = fakeDatabase();
  const repository = createScanRecipeRepository(database.gateway);
  await repository.createScanSession({ id: recipeId, userId: userA });
  await repository.updateScanSession({ id: recipeId, userId: userA, status: 'processing' });

  assert.equal(database.insertedScans[0].user_id, userA);
  assert.deepEqual(database.updatedScanScopes[0], { userId: userA, scanId: recipeId });
});

test('generated recipe reads are scoped by both user ID and recipe ID', async () => {
  const recipe = makeRecipe();
  const database = fakeDatabase({
    getRecipe: (userId, requestedId) => userId === userA && requestedId === recipeId
      ? row(userA, recipe)
      : null,
  });
  const repository = createScanRecipeRepository(database.gateway);

  assert.equal((await repository.findOwnedRecipe(userA, recipeId))?.id, recipeId);
  assert.equal(await repository.findOwnedRecipe(userB, recipeId), null);
  assert.equal(await repository.findOwnedRecipe(userB, '05ff0bf6-a18f-4d2d-9469-204fe0f521f3'), null);
  assert.deepEqual(database.recipeReadScopes[1], { userId: userB, recipeId });
});

test('a duplicate retry returns the existing identical owned recipe without another insert', async () => {
  const recipe = makeRecipe();
  const reorderedRecipe = Object.fromEntries(Object.entries(recipe).reverse()) as Recipe;
  const database = fakeDatabase({ getRecipe: () => row(userA, reorderedRecipe) });
  const repository = createScanRecipeRepository(database.gateway);

  await repository.createGeneratedRecipe({
    id: recipeId,
    userId: userA,
    recipe,
    expiresAt: '2030-01-02T00:00:00.000Z',
  });
  assert.equal(database.insertedRecipes.length, 0);
});

test('a duplicate ID owned elsewhere cannot be adopted or overwritten', async () => {
  const recipe = makeRecipe();
  const database = fakeDatabase({
    insertRecipeError: new DatabaseGatewayError({ duplicate: true }),
  });
  const repository = createScanRecipeRepository(database.gateway);

  await assert.rejects(repository.createGeneratedRecipe({
    id: recipeId,
    userId: userB,
    recipe,
    expiresAt: '2030-01-02T00:00:00.000Z',
  }));
  assert.equal(database.insertedRecipes[0].user_id, userB);
});

test('invalid stored recipe data fails closed', async () => {
  const database = fakeDatabase({
    getRecipe: () => ({
      id: recipeId,
      user_id: userA,
      recipe: { id: recipeId },
      expires_at: '2030-01-02T00:00:00.000Z',
    }),
  });
  const repository = createScanRecipeRepository(database.gateway);
  await assert.rejects(repository.findOwnedRecipe(userA, recipeId), InvalidPersistedRecipeError);
});

test('invalid generated recipe data is rejected before insertion', async () => {
  const database = fakeDatabase();
  const repository = createScanRecipeRepository(database.gateway);
  await assert.rejects(repository.createGeneratedRecipe({
    id: recipeId,
    userId: userA,
    recipe: { id: recipeId } as Recipe,
    expiresAt: '2030-01-02T00:00:00.000Z',
  }), InvalidPersistedRecipeError);
  assert.equal(database.insertedRecipes.length, 0);
});

function fakeDatabase(options: {
  getRecipe?: (userId: string, recipeId: string) => GeneratedRecipeRow | null;
  insertRecipeError?: Error;
} = {}) {
  const insertedScans: ScanSessionRow[] = [];
  const insertedRecipes: GeneratedRecipeRow[] = [];
  const updatedScanScopes: Array<{ userId: string; scanId: string }> = [];
  const recipeReadScopes: Array<{ userId: string; recipeId: string }> = [];
  const gateway: ScanRecipeDatabaseGateway = {
    async insertScanSession(value) { insertedScans.push(value); },
    async updateOwnedScanSession(userId, scanId) {
      updatedScanScopes.push({ userId, scanId });
      return true;
    },
    async insertGeneratedRecipe(value) {
      insertedRecipes.push(value);
      if (options.insertRecipeError) throw options.insertRecipeError;
    },
    async getOwnedGeneratedRecipe(userId, requestedId) {
      recipeReadScopes.push({ userId, recipeId: requestedId });
      return options.getRecipe?.(userId, requestedId) ?? null;
    },
  };
  return { gateway, insertedScans, insertedRecipes, updatedScanScopes, recipeReadScopes };
}

function row(userId: string, recipe: Recipe): GeneratedRecipeRow {
  return {
    id: recipe.id,
    user_id: userId,
    recipe,
    expires_at: '2030-01-02T00:00:00.000Z',
  };
}

function makeRecipe(): Recipe {
  return {
    id: recipeId,
    scanResultId: recipeId,
    title: 'Test Bowl',
    mode: 'Restaurant Copy',
    description: 'A test recipe.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [{ name: 'rice', quantity: '1 cup' }],
    steps: ['Cook the rice.'],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Test only.',
  };
}
