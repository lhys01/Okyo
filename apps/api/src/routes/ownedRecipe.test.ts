import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';

import type { ScanRecipeRepository } from '../persistence/scanRecipeRepository.js';
import { createOwnedRecipeGetHandler } from './ownedRecipe.js';

const ownerId = '162b7af3-e489-4cc9-8f11-09913a4b142a';
const otherUserId = 'd883a3a8-60f7-4aa7-b706-850f93c8e15d';
const recipeId = 'a90e5c8c-ca41-4a53-8e4c-d331876a9d1a';
const missingId = '05ff0bf6-a18f-4d2d-9469-204fe0f521f3';

test('recipe route passes only the authenticated user ID into persistence', async () => {
  const scopes: Array<{ userId: string; recipeId: string }> = [];
  const repository = repositoryWithLookup(async (userId, requestedId) => {
    scopes.push({ userId, recipeId: requestedId });
    return null;
  });
  await request(createApp(ownerId, repository)).get(`/v1/recipes/${recipeId}`).expect(404);
  assert.deepEqual(scopes, [{ userId: ownerId, recipeId }]);
});

test('foreign and missing recipes have identical public responses', async () => {
  const repository = repositoryWithLookup(async () => null);
  const foreign = await request(createApp(otherUserId, repository))
    .get(`/v1/recipes/${recipeId}`)
    .expect(404);
  const missing = await request(createApp(otherUserId, repository))
    .get(`/v1/recipes/${missingId}`)
    .expect(404);
  assert.deepEqual(foreign.body, missing.body);
  assert.deepEqual(foreign.body, {
    ok: false,
    error: { code: 'recipe_not_found', message: 'Recipe was not found.' },
  });
});

function createApp(userId: string, repository: ScanRecipeRepository) {
  const app = express();
  app.use((incoming, _response, next) => {
    incoming.auth = { userId };
    next();
  });
  app.get('/v1/recipes/:recipeId', createOwnedRecipeGetHandler({
    getRepository: () => repository,
    getEditorialRecipe: () => null,
  }));
  return app;
}

function repositoryWithLookup(
  findOwnedRecipe: ScanRecipeRepository['findOwnedRecipe'],
): ScanRecipeRepository {
  return {
    async createScanSession() {},
    async updateScanSession() {},
    async createGeneratedRecipe() {},
    findOwnedRecipe,
    async listOwnedRecipes() { return []; },
  };
}
