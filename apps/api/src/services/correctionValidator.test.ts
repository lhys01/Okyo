import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../types.js';
import { parseCorrectionRequirements } from './correctionIntent.js';
import {
  deriveRecipeChanges,
  validateCorrectionCandidate,
} from './correctionValidator.js';

test('compound nutrition goals accept one real substitution without provider attribution', () => {
  const source = makeRecipe({
    ingredients: [
      { name: 'standard component', quantity: '1 cup' },
      { name: 'grain base', quantity: '2 cups' },
    ],
    nutritionEstimate: { calories: 300, proteinGrams: 12, carbohydratesGrams: 40, fatGrams: 10 },
    steps: ['Cook the filling until tender.'],
  });
  const candidate = makeRecipe({
    ...source,
    ingredients: [
      { name: 'lean component', quantity: '1 cup' },
      { name: 'grain base', quantity: '2 cups' },
    ],
    nutritionEstimate: { calories: 300, proteinGrams: 16, carbohydratesGrams: 40, fatGrams: 7 },
  });
  const result = validateCorrectionCandidate(source, candidate, parseCorrectionRequirements('less fat and more protein').requirements);
  assert.equal(result.accepted, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.derivedChanges.filter((change) => change.substantive).length, 1);
});

test('macro-only changes fail while formatting-only changes are not substantive', () => {
  const source = makeRecipe({
    ingredients: [{ name: 'minced napa cabbage', quantity: '1 cup' }, { name: 'salt', quantity: 'to taste' }],
    steps: ['Cook the filling.'],
    nutritionEstimate: { calories: 200, proteinGrams: 10, carbohydratesGrams: 20, fatGrams: 8 },
  });
  const macroOnly = makeRecipe({
    ...source,
    nutritionEstimate: { calories: 180, proteinGrams: 10, carbohydratesGrams: 20, fatGrams: 6 },
  });
  assert.ok(validateCorrectionCandidate(source, macroOnly, parseCorrectionRequirements('less fat').requirements)
    .blockingIssues.some((issue) => issue.code === 'nutrition_ingredient_change_missing'));

  const formattingOnly = makeRecipe({
    ...macroOnly,
    ingredients: [{ name: '1 cup minced napa cabbage', quantity: 'napa cabbage, minced' }, { name: 'to taste salt', quantity: '' }],
  });
  assert.equal(deriveRecipeChanges(source, formattingOnly).filter((change) => change.substantive).length, 0);
});

test('quantity edits and substitutions may retain accurate generic steps', () => {
  const source = makeRecipe({
    ingredients: [{ name: 'standard component', quantity: '1 cup' }],
    steps: ['Cook the filling until tender.'],
    nutritionEstimate: { calories: 300, proteinGrams: 12, carbohydratesGrams: 40, fatGrams: 10 },
  });
  const quantity = makeRecipe({
    ...source,
    ingredients: [{ name: 'standard component', quantity: '1.5 cups' }],
    nutritionEstimate: { calories: 330, proteinGrams: 16, carbohydratesGrams: 44, fatGrams: 10 },
  });
  assert.equal(validateCorrectionCandidate(source, quantity, parseCorrectionRequirements('more protein').requirements).accepted, true);

  const substitution = makeRecipe({
    ...quantity,
    ingredients: [{ name: 'lean component', quantity: '1.5 cups' }],
    nutritionEstimate: { calories: 300, proteinGrams: 16, carbohydratesGrams: 40, fatGrams: 7 },
  });
  assert.equal(validateCorrectionCandidate(source, substitution, parseCorrectionRequirements('more protein').requirements).accepted, true);
});

test('explicit stale references, unused additions, and removals block', () => {
  const source = makeRecipe({
    ingredients: [{ name: 'old component', quantity: '1 cup' }],
    steps: ['Cook the old component until tender.'],
  });
  const stale = makeRecipe({
    ...source,
    ingredients: [{ name: 'new component', quantity: '1 cup' }],
    steps: ['Cook the old component until tender.'],
  });
  assert.ok(validateCorrectionCandidate(source, stale, parseCorrectionRequirements('replace old component with new component').requirements)
    .blockingIssues.some((issue) => issue.code === 'stale_substitution_reference'));

  const added = makeRecipe({
    ...source,
    ingredients: [{ name: 'old component', quantity: '1 cup' }, { name: 'new garnish', quantity: '1 tbsp' }],
  });
  assert.ok(validateCorrectionCandidate(source, added, parseCorrectionRequirements('add new garnish').requirements)
    .blockingIssues.some((issue) => issue.code === 'added_ingredient_unused'));

  assert.ok(validateCorrectionCandidate(source, makeRecipe({ ...source, ingredients: [] }), parseCorrectionRequirements('remove old component').requirements)
    .blockingIssues.some((issue) => issue.code === 'removed_ingredient_referenced'));
});

test('unexpected servings and invalid nutrition block, and validation does not mutate recipes', () => {
  const source = makeRecipe({
    servings: 2,
    ingredients: [{ name: 'component', quantity: '1 cup' }],
    nutritionEstimate: { calories: 300, proteinGrams: 12, carbohydratesGrams: 40, fatGrams: 10 },
  });
  const candidate = makeRecipe({
    ...source,
    servings: 4,
    nutritionEstimate: { calories: -1, proteinGrams: 16, carbohydratesGrams: 40, fatGrams: 7 },
  });
  const sourceBefore = structuredClone(source);
  const candidateBefore = structuredClone(candidate);
  const result = validateCorrectionCandidate(source, candidate, parseCorrectionRequirements('more protein').requirements);
  assert.equal(result.accepted, false);
  assert.ok(result.blockingIssues.some((issue) => issue.code === 'servings_changed'));
  assert.ok(result.blockingIssues.some((issue) => issue.code === 'nutrition_invalid'));
  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(candidate, candidateBefore);
});

test('optional provider manifests are not part of the validator contract', () => {
  const source = makeRecipe({
    ingredients: [{ name: 'standard component', quantity: '1 cup' }],
    steps: ['Cook the filling.'],
    nutritionEstimate: { calories: 300, proteinGrams: 12, carbohydratesGrams: 40, fatGrams: 10 },
  });
  const candidate = makeRecipe({
    ...source,
    ingredients: [{ name: 'lean component', quantity: '1 cup' }],
    nutritionEstimate: { calories: 300, proteinGrams: 16, carbohydratesGrams: 40, fatGrams: 7 },
  });
  const result = validateCorrectionCandidate(source, candidate, parseCorrectionRequirements('more protein and less fat').requirements);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.accepted, true);
});

test('destructive unrelated nutrition rewrites fail by semantic discontinuity, not change count', () => {
  const source = makeRecipe({
    ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'vegetable layer', quantity: '1 cup' },
      { name: 'salt', quantity: 'to taste' },
    ],
    steps: ['Cook the grain base.', 'Fold in the vegetable layer.', 'Season with salt.'],
  });
  const destructive = makeRecipe({
    ...source,
    ingredients: [
      { name: 'new protein', quantity: '2 cups' },
      { name: 'new sauce', quantity: '1 cup' },
    ],
    steps: ['Bake the new protein until browned.', 'Pour over the new sauce.'],
    structuredSteps: [
      { title: 'Bake', text: 'Bake the new protein until browned.', ingredientsUsed: ['new protein'], toolsUsed: ['oven'] },
      { title: 'Finish', text: 'Pour over the new sauce.', ingredientsUsed: ['new sauce'], toolsUsed: ['pan'] },
    ],
    nutritionEstimate: { calories: 280, proteinGrams: 18, carbohydratesGrams: 30, fatGrams: 5 },
  });
  const result = validateCorrectionCandidate(source, destructive, parseCorrectionRequirements('less fat and more protein').requirements);
  assert.equal(result.accepted, false);
  assert.ok(result.blockingIssues.some((issue) => issue.code === 'destructive_unrelated_rewrite'));
  assert.ok(!result.blockingIssues.some((issue) => issue.code === 'unrelated_recipe_changes'));
});

test('stale explicit quantity references expose exact actionable issue details', () => {
  const source = makeRecipe({
    ingredients: [
      { name: 'main component', quantity: '1 cup' },
      { name: 'cooking oil', quantity: '2 tbsp' },
    ],
    steps: ['Cook the filling.', 'Add 2 tbsp cooking oil and sauté the filling.'],
    structuredSteps: [],
  });
  const candidate = makeRecipe({
    ...source,
    ingredients: [
      { name: 'lean main component', quantity: '1 cup' },
      { name: 'cooking oil', quantity: '1 tbsp' },
    ],
    steps: ['Cook the filling.', 'Add 2 tbsp cooking oil and sauté the filling.'],
    nutritionEstimate: { calories: 300, proteinGrams: 16, carbohydratesGrams: 40, fatGrams: 7 },
  });
  const result = validateCorrectionCandidate(source, candidate, parseCorrectionRequirements('less fat and more protein').requirements);
  const issue = result.blockingIssues.find((item) => item.code === 'stale_quantity_reference');
  assert.deepEqual(issue, {
    code: 'stale_quantity_reference',
    message: 'A cooking instruction still uses the old ingredient quantity.',
    stepIndex: 2,
    details: { ingredient: 'cooking oil', oldQuantity: '2 tbsp', newQuantity: '1 tbsp' },
  });
});

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-source',
    scanResultId: 'scan-source',
    title: 'Generic Recipe',
    mode: 'Normal',
    description: 'A generic recipe.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 5,
    estimatedSavings: 5,
    ingredients: [{ name: 'component', quantity: '1 cup' }],
    steps: ['Cook the component.'],
    structuredSteps: [{ text: 'Cook the component.', title: 'Cook', ingredientsUsed: ['component'], toolsUsed: ['pan'] }],
    substitutions: [],
    pantryNote: '',
    confidenceNote: '',
    equipment: ['pan'],
    nutritionEstimate: { calories: 300, proteinGrams: 12, carbohydratesGrams: 40, fatGrams: 10 },
    ...overrides,
  };
}
