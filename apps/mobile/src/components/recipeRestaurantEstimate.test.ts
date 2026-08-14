import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const costSummary = readFileSync(resolve(process.cwd(), 'src/components/RecipeAssistantOverview.tsx'), 'utf8');
const detail = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');
const canonical = readFileSync(resolve(process.cwd(), 'src/state/canonicalRecipes.ts'), 'utf8');

test('recipe pricing prefers the persisted restaurant estimate and preserves a safe unavailable state', () => {
  assert.match(costSummary, /isKnownPrice\(recipe\.restaurantPriceEstimate\)/);
  assert.match(costSummary, /Eating out/);
  assert.match(costSummary, /scaledRestaurantEstimate === null \? '—'/);
  assert.match(costSummary, /fontSize: 19/);
});

test('the result and canonical recipe flow keep the generated recipe object intact', () => {
  assert.match(detail, /recipe\?\.restaurantPriceEstimate \?\? scanResult\?\.restaurantPrice/);
  assert.match(canonical, /\.\.\.recipe,/);
});
