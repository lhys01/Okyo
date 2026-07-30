import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../types.js';
import { assessAndReconcileCorrectionCandidate, parseCorrectionRequirements } from './correctionIntent.js';
import {
  applyCorrectionPatch,
  createCorrectionRecipeReferences,
} from './correctionPatch.js';

function recipe(): Recipe {
  const structuredSteps = [
    { title: 'Prepare', text: 'Prepare the grain base with the savory component.', ingredientsUsed: ['grain base', 'savory component'], toolsUsed: ['pan'] },
    { title: 'Finish', text: 'Fold in the vegetable layer and serve.', ingredientsUsed: ['vegetable layer'], toolsUsed: ['spoon'] },
  ];
  return {
    id: 'source-1', scanResultId: 'scan-1', title: 'Savory Grain Plate', mode: 'Normal',
    description: 'A simple savory grain plate.', prepTimeMinutes: 10, cookTimeMinutes: 15,
    totalTimeMinutes: 25, servings: 2, difficulty: 'Easy', estimatedHomemadeCost: 5,
    estimatedSavings: 7, ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'savory component', quantity: '1 cup' },
      { name: 'vegetable layer', quantity: '1 cup' },
    ], steps: structuredSteps.map((step) => step.text), structuredSteps,
    substitutions: [], pantryNote: '', confidenceNote: 'Estimated.', equipment: ['pan', 'spoon'],
    nutritionEstimate: { calories: 350, proteinGrams: 25, carbohydratesGrams: 30, fatGrams: 15, fiberGrams: 5 },
  };
}

test('correction references are stable and expose sanitized maps', () => {
  const refs = createCorrectionRecipeReferences(recipe());
  assert.deepEqual(refs.ingredientIds, ['ingredient-1', 'ingredient-2', 'ingredient-3']);
  assert.equal(refs.ingredientMap['ingredient-2'], 'savory component');
  assert.equal(refs.stepMap['step-1'], 'Prepare the grain base with the savory component.');
});

test('same-count descriptor replacement supports compound nutrition requirements', () => {
  const original = recipe();
  const intents = parseCorrectionRequirements('more protein and less fat').requirements;
  const applied = applyCorrectionPatch(original, {
    ingredientOperations: [{
      operation: 'replace', sourceIngredientId: 'ingredient-2',
      result: { name: 'higher-protein savory component', quantity: '1 cup' },
      supportsRequirementIndexes: [1, 2],
    }],
    stepOperations: [{
      operation: 'replace', sourceStepId: 'step-1',
      result: {
        title: 'Prepare',
        text: 'Prepare the grain base with the higher-protein savory component.',
        ingredientReferences: ['ingredient-1', 'ingredient-2'],
      },
    }],
    nutritionEstimate: { calories: 350, proteinGrams: 30, carbohydratesGrams: 30, fatGrams: 12, fiberGrams: 5 },
  });
  assert.deepEqual(applied.rejectedOperationReasons, []);
  const assessment = assessAndReconcileCorrectionCandidate(original, applied.recipe, intents, applied.manifest);
  assert.deepEqual(assessment.issues, []);
  assert.equal(assessment.ingredientChangeAnalysis.changes[0]?.kind, 'descriptor_changed');
});

test('quantity changes, additions, removals, and replacements use exact references', () => {
  const original = recipe();
  const quantity = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'change_quantity', sourceIngredientId: 'ingredient-1', result: { quantity: '3 cups' }, supportsRequirementIndexes: [1] }],
    stepOperations: [{ operation: 'replace', sourceStepId: 'step-1', result: { text: 'Prepare 3 cups of the grain base with the savory component.', ingredientReferences: ['ingredient-1', 'ingredient-2'] } }],
  });
  assert.equal(quantity.recipe.ingredients[0]?.quantity, '3 cups');

  const added = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'add', result: { name: 'fresh topping', quantity: '1/4 cup', id: 'added-ingredient-1' }, supportsRequirementIndexes: [1] }],
    stepOperations: [{ operation: 'add', result: { id: 'added-step-1', text: 'Top with the fresh topping before serving.', ingredientReferences: ['added-ingredient-1'] } }],
  });
  assert.equal(added.recipe.ingredients.at(-1)?.name, 'fresh topping');
  assert.match(added.recipe.steps.at(-1) ?? '', /fresh topping/);

  const removed = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'remove', sourceIngredientId: 'ingredient-3', supportsRequirementIndexes: [1] }],
    stepOperations: [{ operation: 'replace', sourceStepId: 'step-2', result: { text: 'Fold in the grain base and serve.', ingredientReferences: ['ingredient-1'] } }],
  });
  assert.equal(removed.recipe.ingredients.some((item) => item.name === 'vegetable layer'), false);

  const replaced = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'replace', sourceIngredientId: 'ingredient-3', result: { name: 'fresh greens', quantity: '1 cup' }, supportsRequirementIndexes: [1] }],
    stepOperations: [{ operation: 'replace', sourceStepId: 'step-2', result: { text: 'Fold in the fresh greens and serve.', ingredientReferences: ['ingredient-3'] } }],
  });
  assert.equal(replaced.recipe.ingredients[2]?.name, 'fresh greens');
  assert.equal(replaced.recipe.steps[1], 'Fold in the fresh greens and serve.');
});

test('invalid ingredient or step references and missing step integration are rejected', () => {
  const original = recipe();
  const invalid = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'replace', sourceIngredientId: 'ingredient-99', result: { name: 'new form', quantity: '1 cup' }, supportsRequirementIndexes: [1] }],
    stepOperations: [{ operation: 'replace', sourceStepId: 'step-99', result: { text: 'Use the new form.', ingredientReferences: ['ingredient-1'] } }],
  });
  assert.ok(invalid.rejectedOperationReasons.some((reason) => reason.startsWith('ingredient_unknown_id')));
  assert.ok(invalid.rejectedOperationReasons.some((reason) => reason.startsWith('step_unknown_id')));

  const missingStep = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'replace', sourceIngredientId: 'ingredient-2', result: { name: 'new formulation', quantity: '1 cup' }, supportsRequirementIndexes: [1] }],
    stepOperations: [],
  });
  assert.equal(missingStep.appliedOperationCount, 1);
  const assessment = assessAndReconcileCorrectionCandidate(
    original,
    { ...missingStep.recipe, nutritionEstimate: { calories: 350, proteinGrams: 30, carbohydratesGrams: 30, fatGrams: 12 } },
    parseCorrectionRequirements('more protein').requirements,
    missingStep.manifest,
  );
  assert.ok(assessment.issues.some((issue) => issue.includes('cooking instructions')));
});

test('reordering or preparation wording alone is not a patch operation', () => {
  const original = recipe();
  const noOp = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'change_descriptor', sourceIngredientId: 'ingredient-1', result: { name: 'grain base', quantity: '2 cups' }, supportsRequirementIndexes: [1] }],
    stepOperations: [],
  });
  assert.ok(noOp.rejectedOperationReasons.includes('ingredient_result_unchanged:ingredient-1'));
});

test('step evidence accepts a shortened reference while rejecting one-word coincidence', () => {
  const original = recipe();
  const shortened = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'replace', sourceIngredientId: 'ingredient-2', result: { name: 'higher-protein savory component', quantity: '1 cup' }, supportsRequirementIndexes: [1] }],
    stepOperations: [{ operation: 'replace', sourceStepId: 'step-1', result: { text: 'Prepare the grain base with the savory component.', ingredientReferences: ['ingredient-1', 'ingredient-2'] } }],
  });
  assert.deepEqual(shortened.rejectedOperationReasons, []);
  const unrelated = applyCorrectionPatch(original, {
    ingredientOperations: [{ operation: 'replace', sourceIngredientId: 'ingredient-2', result: { name: 'higher-protein savory component', quantity: '1 cup' }, supportsRequirementIndexes: [1] }],
    stepOperations: [{ operation: 'replace', sourceStepId: 'step-1', result: { text: 'Prepare the component.', ingredientReferences: ['ingredient-2'] } }],
  });
  assert.ok(unrelated.rejectedOperationReasons.includes('step_ingredient_not_used_in_text'));
});
