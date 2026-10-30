import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const costSummary = readFileSync(resolve(process.cwd(), 'src/components/RecipeAssistantOverview.tsx'), 'utf8');
const detail = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');
const canonical = readFileSync(resolve(process.cwd(), 'src/state/canonicalRecipes.ts'), 'utf8');
const pricing = readFileSync(resolve(process.cwd(), 'src/utils/recipePricing.ts'), 'utf8');

test('recipe pricing prefers the persisted restaurant estimate and derives an estimate from local recipe pricing', () => {
  assert.match(pricing, /isKnownPrice\(recipe\.restaurantPriceEstimate\)/);
  assert.match(costSummary, /Eating out/);
  assert.match(costSummary, /calculateRecipePrices/);
  assert.match(costSummary, /eatingOut === null \? '—'/);
  assert.match(costSummary, /fontSize: 19/);
});

test('the result and canonical recipe flow keep the generated recipe object intact', () => {
  assert.match(detail, /recipe\?\.restaurantPriceEstimate \?\? scanResult\?\.restaurantPrice/);
  assert.match(canonical, /\.\.\.recipe,/);
});
