import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  foodImageAnalysisSchema,
  getFoodGateRejection,
  normalizeVisionOutput,
} from './aiService.js';
import { getVisionPrompt } from './openRouterProvider.js';

test('vision prompt defines prepared-dish reconstruction and rejects ingredient inventory', () => {
  const prompt = getVisionPrompt(undefined, 'Normal');

  assert.match(prompt, /prepared or completed dish the user wants to recreate/i);
  assert.match(prompt, /raw_ingredients means loose ingredients, a grocery haul, pantry\/fridge contents/i);
  assert.match(prompt, /do not invent or suggest a meal/i);
  assert.match(prompt, /Scan a prepared dish you would like to recreate/i);
});

test('ingredient-only classification is rejected before recipe generation', () => {
  const normalized = normalizeVisionOutput({
    broadDishCategory: 'raw ingredients',
    confidence: 92,
    confidenceReason: 'Loose vegetables and raw chicken are visible.',
    cuisine: 'Unknown',
    dishName: 'Raw Chicken and Vegetables',
    inputKind: 'raw_ingredients',
    isFoodImage: true,
    isRestaurantMeal: false,
    likelyIngredients: [],
    possibleDishNames: [],
    rejectionReason: 'Scan a prepared dish you would like to recreate.',
    restaurantPriceEstimate: 0,
    scanState: 'clear_food',
    visibleComponents: {},
    visibleIngredients: ['raw chicken', 'carrots', 'onion'],
  });
  const analysis = foodImageAnalysisSchema.parse({
    ...normalized,
    aiSource: 'openrouter_ai',
    candidateScanId: 'scan-ingredients-only',
    detectedComponents: [],
    difficulty: 'Easy',
    matchScore: 9.2,
    modes: ['Normal'],
    notes: [],
    restaurantStyle: 'Unknown',
  });
  const rejection = getFoodGateRejection(analysis, true);

  assert.equal(rejection?.rejectionType, 'ingredients_only');
  assert.equal(rejection?.message, "Scan a prepared dish you'd like to recreate.");
});

test('dish descriptions are explicitly treated as reconstruction requests, not pantry inventory', () => {
  const providerPath = fileURLToPath(new URL('./openRouterProvider.ts', import.meta.url));
  const source = readFileSync(providerPath, 'utf8');

  assert.match(source, /description names the prepared dish they want to recreate/);
  assert.match(source, /never as pantry inventory or a request to invent a meal from ingredients/);
});

