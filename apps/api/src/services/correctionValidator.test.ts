import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../types.js';
import { parseCorrectionRequirements } from './correctionIntent.js';
import {
  deriveRecipeChanges,
  reconcileRemovedCorrectionMetadata,
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

test('removal plus nutrition verification inspects actual recipe content and macros', () => {
  const source = makeRecipe({
    title: 'Cookie Yogurt Dessert',
    description: 'A cookie dessert with a creamy base.',
    ingredients: [
      { name: 'Oreo cookies', quantity: '1 cup' },
      { name: 'plain yogurt', quantity: '1 cup' },
    ],
    steps: ['Crush the Oreo cookies.', 'Fold the Oreo cookies into the plain yogurt.'],
    structuredSteps: [
      { title: 'Crush', text: 'Crush the Oreo cookies.', ingredientsUsed: ['Oreo cookies'], toolsUsed: ['bowl'] },
      { title: 'Fold', text: 'Fold the Oreo cookies into the plain yogurt.', ingredientsUsed: ['Oreo cookies', 'plain yogurt'], toolsUsed: ['spoon'] },
    ],
    spicePairings: ['Crushed Oreo cookie finish'],
    nutritionEstimate: { calories: 300, proteinGrams: 10, carbohydratesGrams: 40, fatGrams: 11 },
  });
  const candidate = makeRecipe({
    ...source,
    title: 'High-Protein Yogurt Dessert',
    description: 'A creamy high-protein yogurt dessert.',
    ingredients: [
      { name: 'plain yogurt', quantity: '1 cup' },
      { name: 'vanilla protein powder', quantity: '1/2 cup' },
    ],
    steps: ['Whisk the plain yogurt with vanilla protein powder until smooth.'],
    structuredSteps: [{
      title: 'Whisk',
      text: 'Whisk the plain yogurt with vanilla protein powder until smooth.',
      ingredientsUsed: ['plain yogurt', 'vanilla protein powder'],
      toolsUsed: ['whisk', 'bowl'],
    }],
    spicePairings: [],
    nutritionEstimate: { calories: 350, proteinGrams: 18, carbohydratesGrams: 42, fatGrams: 12 },
  });
  const requirements = parseCorrectionRequirements('No Oreo and more protein').requirements;
  assert.equal(validateCorrectionCandidate(source, candidate, requirements).accepted, true);

  const stale = { ...candidate, spicePairings: ['Finish with crushed Oreo cookies'] };
  assert.ok(validateCorrectionCandidate(source, stale, requirements).blockingIssues
    .some((issue) => issue.code === 'removed_concept_still_present'));
});

test('removed concepts are stripped from derived flavor metadata without changing unrelated metadata', () => {
  const recipe = makeRecipe({
    substitutions: ['Use crushed Oreo cookies as a topping.', 'Use fresh berries if preferred.'],
    spicePairings: ['Oreo cookie crumble', 'vanilla'],
    pantryNote: 'Keep extra Oreo cookies nearby.',
    storageAndReheating: 'Store the dessert chilled overnight.',
  });
  const reconciled = reconcileRemovedCorrectionMetadata(
    recipe,
    parseCorrectionRequirements('No Oreo').requirements,
  );
  assert.deepEqual(reconciled.substitutions, ['Use fresh berries if preferred.']);
  assert.deepEqual(reconciled.spicePairings, ['vanilla']);
  assert.equal(reconciled.pantryNote, '');
  assert.equal(reconciled.storageAndReheating, 'Store the dessert chilled overnight.');
});

test('arbitrary replacements and additions are verified without a known-ingredient list', () => {
  const source = makeRecipe({
    ingredients: [
      { name: 'chickpeas', quantity: '2 cups' },
      { name: 'tahini', quantity: '1/2 cup' },
    ],
    steps: ['Blend the chickpeas with tahini until smooth.'],
    structuredSteps: [{
      title: 'Blend', text: 'Blend the chickpeas with tahini until smooth.',
      ingredientsUsed: ['chickpeas', 'tahini'], toolsUsed: ['blender'],
    }],
  });
  const replacement = makeRecipe({
    ...source,
    ingredients: [
      { name: 'chickpeas', quantity: '2 cups' },
      { name: 'sunflower-seed butter', quantity: '1/2 cup' },
    ],
    steps: ['Blend the chickpeas with sunflower-seed butter until smooth.'],
    structuredSteps: [{
      title: 'Blend', text: 'Blend the chickpeas with sunflower-seed butter until smooth.',
      ingredientsUsed: ['chickpeas', 'sunflower-seed butter'], toolsUsed: ['blender'],
    }],
  });
  assert.equal(validateCorrectionCandidate(
    source,
    replacement,
    parseCorrectionRequirements('Replace tahini with sunflower-seed butter').requirements,
  ).accepted, true);

  const unfamiliar = makeRecipe({
    ...source,
    ingredients: [...source.ingredients, { name: 'veluntra seed cream', quantity: '2 tbsp' }],
    steps: ['Blend the chickpeas, tahini, and veluntra seed cream until smooth.'],
    structuredSteps: [{
      title: 'Blend', text: 'Blend the chickpeas, tahini, and veluntra seed cream until smooth.',
      ingredientsUsed: ['chickpeas', 'tahini', 'veluntra seed cream'], toolsUsed: ['blender'],
    }],
  });
  assert.equal(validateCorrectionCandidate(
    source,
    unfamiliar,
    parseCorrectionRequirements('Add veluntra seed cream').requirements,
  ).accepted, true);
});

test('servings, time, numeric nutrition, and subjective style constraints validate final fields', () => {
  const source = makeRecipe({
    servings: 2,
    ingredients: [{ name: 'component', quantity: '1 cup' }],
    totalTimeMinutes: 40,
    nutritionEstimate: { calories: 600, proteinGrams: 20, carbohydratesGrams: 75, fatGrams: 25 },
  });
  const doubled = makeRecipe({
    ...source,
    servings: 4,
    ingredients: [{ name: 'component', quantity: '2 cups' }],
  });
  assert.equal(validateCorrectionCandidate(
    source,
    doubled,
    parseCorrectionRequirements('Double the servings').requirements,
  ).accepted, true);

  const constrained = makeRecipe({
    ...source,
    description: 'A faster Mediterranean-style recipe with fresh herbs.',
    totalTimeMinutes: 24,
    ingredients: [{ name: 'component', quantity: '3/4 cup' }, { name: 'fresh herbs', quantity: '1/4 cup' }],
    steps: ['Cook the component quickly, then fold in the fresh herbs.'],
    structuredSteps: [{
      title: 'Cook', text: 'Cook the component quickly, then fold in the fresh herbs.',
      ingredientsUsed: ['component', 'fresh herbs'], toolsUsed: ['pan'],
    }],
    nutritionEstimate: { calories: 480, proteinGrams: 20, carbohydratesGrams: 60, fatGrams: 18 },
  });
  assert.equal(validateCorrectionCandidate(
    source,
    constrained,
    parseCorrectionRequirements('Make it take under 25 minutes').requirements,
  ).accepted, true);
  assert.equal(validateCorrectionCandidate(
    source,
    constrained,
    parseCorrectionRequirements('under 500 calories').requirements,
  ).accepted, true);
  assert.equal(validateCorrectionCandidate(
    source,
    constrained,
    parseCorrectionRequirements('Make it taste more Mediterranean').requirements,
  ).accepted, true);
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
