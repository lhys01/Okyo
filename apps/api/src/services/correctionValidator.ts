import type { Recipe, RecipeIngredient, RecipeStep } from '../types.js';
import {
  getNutritionRequirementTargets,
  type CorrectionValidationIssue,
  type CorrectionIntent,
  type NutritionRequirementTarget,
} from './correctionIntent.js';

export type ValidationIssue = CorrectionValidationIssue;

export type RecipeChange = {
  kind: 'added' | 'removed' | 'substituted' | 'quantity_changed' | 'formulation_changed';
  before?: RecipeIngredient;
  after?: RecipeIngredient;
  substantive: boolean;
};

export type CorrectionValidationResult = {
  accepted: boolean;
  blockingIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  derivedChanges: RecipeChange[];
};

export function reconcileRemovedCorrectionMetadata(
  recipe: Recipe,
  intents: CorrectionIntent[],
): Recipe {
  const removedTargets = intents.flatMap((intent) => {
    if (intent.type === 'remove_ingredient') return [intent.ingredient];
    if (intent.type === 'replace_ingredient' || intent.type === 'correct_dish_identity') {
      return [intent.removeIngredient];
    }
    return [];
  });
  if (removedTargets.length === 0) return recipe;
  const containsRemovedTarget = (value: string | undefined) => Boolean(
    value && removedTargets.some((target) => containsConcept(value, target)),
  );
  const keepText = (value: string | undefined) => containsRemovedTarget(value) ? '' : value;
  return {
    ...recipe,
    ingredientGroups: recipe.ingredientGroups?.map((group) => ({
      ...group,
      items: group.items.filter((ingredient) => !containsRemovedTarget(ingredient.name)),
    })),
    substitutions: recipe.substitutions?.filter((value) => !containsRemovedTarget(value)),
    spicePairings: recipe.spicePairings?.filter((value) => !containsRemovedTarget(value)),
    groceryItems: recipe.groceryItems?.filter((item) =>
      !containsRemovedTarget(`${item.name} ${item.sourceIngredient ?? ''} ${item.shoppingNote ?? ''}`)),
    pantryNote: keepText(recipe.pantryNote) ?? '',
    avoidMistake: keepText(recipe.avoidMistake),
    mistakeWarning: keepText(recipe.mistakeWarning),
    storageAndReheating: keepText(recipe.storageAndReheating),
    storage: keepText(recipe.storage),
    mainIngredientsSummary: keepText(recipe.mainIngredientsSummary),
  };
}

type CanonicalIngredient = RecipeIngredient & {
  base: string;
  amount: string;
  preparation: string;
};

const PREPARATION_WORDS = new Set([
  'chopped', 'cooked', 'crushed', 'cubed', 'diced', 'divided', 'fresh',
  'grated', 'ground', 'halved', 'minced', 'optional', 'raw', 'roasted',
  'shredded', 'sliced', 'small', 'large', 'medium', 'thinly', 'thickly', 'finely',
]);

const UNIT_ALIASES: Record<string, string> = {
  cups: 'cup', tablespoons: 'tbsp', tablespoon: 'tbsp', tbsp: 'tbsp',
  teaspoons: 'tsp', teaspoon: 'tsp', tsp: 'tsp', grams: 'g', gram: 'g',
  kilograms: 'kg', kilogram: 'kg', ounces: 'oz', ounce: 'oz', oz: 'oz',
  pounds: 'lb', pound: 'lb', lbs: 'lb', lb: 'lb', milliliters: 'ml',
  milliliter: 'ml', ml: 'ml',
};

export function validateCorrectionCandidate(
  source: Recipe,
  candidate: Recipe,
  requirements: CorrectionIntent[],
): CorrectionValidationResult {
  const blockingIssues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const derivedChanges = deriveRecipeChanges(source, candidate);
  const sourceIngredients = source.ingredients.map(canonicalizeIngredient);
  const candidateIngredients = candidate.ingredients.map(canonicalizeIngredient);
  const candidateIngredientText = candidateIngredients.map((ingredient) => ingredient.base).join(' ');
  const candidateStepText = getStepText(candidate);
  const candidateSearchText = getRecipeSearchText(candidate);

  blockingIssues.push(...validateRecipeStructure(candidate));
  blockingIssues.push(...validateNutrition(candidate));

  const nutritionTargets = getNutritionRequirementTargets(source, requirements);
  const substantiveChanges = derivedChanges.filter((change) => change.substantive);
  const nutritionTargetsPass = nutritionTargets.every((target) =>
    meetsNutritionTarget(candidate, target));

  requirements.forEach((requirement, index) => {
    const requirementIndex = index + 1;
    switch (requirement.type) {
      case 'nutrition_goal':
        if (!meetsNutritionTarget(candidate, nutritionTargets.find((target) =>
          target.requirementIndex === requirementIndex))) {
          blockingIssues.push({
            code: 'nutrition_target_not_met',
            message: `The requested ${requirement.direction} ${requirement.nutrient} target was not met.`,
            requirementIndex,
          });
        }
        break;
      case 'nutrition_constraint': {
        const value = getNutritionConstraintValue(candidate, requirement.nutrient);
        if (value === null ||
            (requirement.targetMinimum !== undefined && value < requirement.targetMinimum) ||
            (requirement.targetMaximum !== undefined && value > requirement.targetMaximum)) {
          blockingIssues.push({
            code: 'nutrition_constraint_not_met',
            message: `The corrected recipe does not meet the requested ${requirement.nutrient} target.`,
            requirementIndex,
          });
        }
        if (substantiveChanges.length === 0) {
          blockingIssues.push({
            code: 'nutrition_ingredient_change_missing',
            message: 'Nutrition changed without a substantive ingredient or formulation change.',
            requirementIndex,
          });
        }
        break;
      }
      case 'servings_adjustment':
        if (candidate.servings !== requirement.servings) {
          blockingIssues.push({
            code: 'servings_target_not_met',
            message: `The corrected recipe does not yield ${requirement.servings} servings.`,
            requirementIndex,
          });
        }
        break;
      case 'add_ingredient':
        if (!containsConcept(candidateIngredientText, requirement.ingredient)) {
          blockingIssues.push({ code: 'ingredient_add_not_applied', message: `${requirement.ingredient} is missing from ingredients.`, requirementIndex });
        }
        if (!containsConcept(candidateStepText, requirement.ingredient)) {
          blockingIssues.push({ code: 'ingredient_add_not_used', message: `${requirement.ingredient} is not used in the cooking instructions.`, requirementIndex });
        }
        break;
      case 'remove_ingredient':
        if (containsConcept(candidateSearchText, requirement.ingredient)) {
          blockingIssues.push({ code: 'removed_concept_still_present', message: `${requirement.ingredient} is still present in user-visible recipe content.`, requirementIndex });
        }
        break;
      case 'replace_ingredient':
      case 'correct_dish_identity':
        if (!containsConcept(candidateIngredientText, requirement.addIngredient) ||
            !containsConcept(candidateStepText, requirement.addIngredient) ||
            containsConcept(candidateSearchText, requirement.removeIngredient)) {
          blockingIssues.push({ code: 'ingredient_substitution_not_applied', message: `The requested ingredient substitution was not applied.`, requirementIndex });
        }
        break;
      case 'dietary_restriction':
        if (!containsConcept(`${candidate.title} ${candidate.description}`, requirement.restriction) ||
            substantiveChanges.length === 0 || !hasInstructionChange(source, candidate)) {
          blockingIssues.push({ code: 'dietary_constraint_not_met', message: `The corrected recipe does not demonstrate the requested ${requirement.restriction} constraint.`, requirementIndex });
        }
        break;
      case 'sensory_adjustment':
        if (!hasMeaningfulCandidateChange(source, candidate) ||
            !containsConcept(candidateSearchText, requirement.adjustment)) {
          blockingIssues.push({ code: 'sensory_constraint_not_met', message: `The corrected recipe does not demonstrate ${requirement.adjustment}.`, requirementIndex });
        }
        break;
      case 'cooking_method_adjustment':
        if (!hasInstructionChange(source, candidate) ||
            !containsConcept(`${candidateStepText} ${(candidate.equipment ?? []).join(' ')}`, requirement.method)) {
          blockingIssues.push({ code: 'method_constraint_not_met', message: `The corrected recipe does not use ${requirement.method}.`, requirementIndex });
        }
        break;
      case 'servings_scale': {
        const targetServings = Math.max(1, Math.round(source.servings * requirement.multiplier));
        if (candidate.servings !== targetServings || !quantitiesScaleCoherently(source, candidate, requirement.multiplier)) {
          blockingIssues.push({ code: 'servings_scale_not_met', message: `Servings or measurable ingredient quantities were not scaled by ${requirement.multiplier}.`, requirementIndex });
        }
        break;
      }
      case 'time_constraint':
        if (!Number.isFinite(candidate.totalTimeMinutes) || (candidate.totalTimeMinutes ?? Infinity) > requirement.targetMaximumMinutes) {
          blockingIssues.push({ code: 'time_constraint_not_met', message: `The corrected recipe exceeds ${requirement.targetMaximumMinutes} minutes.`, requirementIndex });
        }
        break;
      case 'cost_adjustment':
        if (requirement.direction === 'cheaper'
          ? candidate.estimatedHomemadeCost >= source.estimatedHomemadeCost
          : candidate.estimatedHomemadeCost <= source.estimatedHomemadeCost) {
          blockingIssues.push({ code: 'cost_constraint_not_met', message: `The requested cost adjustment was not applied.`, requirementIndex });
        }
        break;
      case 'cuisine_or_style':
        if (!hasMeaningfulCandidateChange(source, candidate) || !containsConcept(candidateSearchText, requirement.target)) {
          blockingIssues.push({ code: 'style_constraint_not_met', message: `The corrected recipe does not demonstrate ${requirement.target}.`, requirementIndex });
        }
        break;
      case 'equipment_constraint':
        if (!containsConcept(`${(candidate.equipment ?? []).join(' ')} ${candidateStepText}`, requirement.target.replace(/^one\s+/, ''))) {
          blockingIssues.push({ code: 'equipment_constraint_not_met', message: `The corrected recipe does not respect ${requirement.target}.`, requirementIndex });
        }
        break;
      case 'general':
        if (!hasMeaningfulCandidateChange(source, candidate)) {
          blockingIssues.push({ code: 'correction_no_op', message: 'The general correction did not meaningfully change the recipe.', requirementIndex });
        }
        break;
      default:
        break;
    }
  });

  const hasNutritionCorrection = requirements.some((requirement) =>
    requirement.type === 'nutrition_goal' || requirement.type === 'nutrition_constraint');
  if (hasNutritionCorrection && (!nutritionTargetsPass || substantiveChanges.length === 0)) {
    if (substantiveChanges.length === 0) {
      blockingIssues.push({
        code: 'nutrition_ingredient_change_missing',
        message: 'Nutrition changed without a substantive ingredient or formulation change.',
      });
    }
  }

  if (requirements.some((requirement) => requirement.type === 'abstract_ingredient_addition') &&
      substantiveChanges.length === 0) {
    blockingIssues.push({
      code: 'no_substantive_recipe_change',
      message: 'The requested ingredient addition did not change the recipe.',
    });
  }

  if (!requirements.some((requirement) => requirement.type === 'servings_adjustment' || requirement.type === 'servings_scale') &&
      candidate.servings !== source.servings) {
    blockingIssues.push({
      code: 'servings_changed',
      message: 'Servings changed even though the correction did not request it.',
    });
  }

  blockingIssues.push(...validateStepConsistency(
    sourceIngredients,
    candidateIngredients,
    derivedChanges,
    source,
    candidate,
  ));
  blockingIssues.push(...validateRemovedIngredientMetadata(derivedChanges, candidate));

  blockingIssues.push(...validateRecipeContinuity(
    source,
    candidate,
    requirements,
    derivedChanges,
  ));

  // Provider manifests, operation attribution, and optional AI coaching fields
  // are intentionally not read here. The server derives all requirement support.
  return {
    accepted: blockingIssues.length === 0,
    blockingIssues: uniqueIssues(blockingIssues),
    warnings,
    derivedChanges,
  };
}

function validateRecipeContinuity(
  source: Recipe,
  candidate: Recipe,
  requirements: CorrectionIntent[],
  changes: RecipeChange[],
): ValidationIssue[] {
  if (requirements.some((requirement) => requirement.type === 'correct_dish_identity')) {
    return [];
  }

  const sourceIngredients = source.ingredients.map(canonicalizeIngredient);
  const candidateIngredients = candidate.ingredients.map(canonicalizeIngredient);
  const preservedIngredient = sourceIngredients.some((sourceIngredient) =>
    candidateIngredients.some((candidateIngredient) =>
      candidateIngredient.base === sourceIngredient.base));
  const preservedStep = hasSharedStepConcept(source, candidate);
  const hasRemoval = changes.some((change) => change.kind === 'removed');
  const hasSubstitution = changes.some((change) => change.kind === 'substituted');
  const isNutritionCorrection = requirements.some((requirement) =>
    requirement.type === 'nutrition_goal' || requirement.type === 'nutrition_constraint');

  // A nutrition correction may legitimately change many ingredients, including
  // a complete formulation substitution. It becomes destructive only when it
  // also loses the recipe's semantic continuity: no source ingredient remains
  // and no source cooking concept survives in the candidate instructions.
  // This deliberately avoids using a change-count threshold.
  if (isNutritionCorrection && hasRemoval && !preservedIngredient && !preservedStep) {
    return [{
      code: 'destructive_unrelated_rewrite',
      message: 'The correction removed the source recipe content without preserving its essential recipe structure.',
    }];
  }

  if (!isNutritionCorrection && hasRemoval && !preservedIngredient && !preservedStep && !hasSubstitution) {
    return [{
      code: 'destructive_unrelated_rewrite',
      message: 'The correction removed the source recipe content without preserving its essential recipe structure.',
    }];
  }

  return [];
}

function hasSharedStepConcept(source: Recipe, candidate: Recipe): boolean {
  const sourceSteps = getStepText(source).split(/[.!?]+/).map(normalizeStepConcept).filter(Boolean);
  const candidateSteps = getStepText(candidate).split(/[.!?]+/).map(normalizeStepConcept).filter(Boolean);
  return sourceSteps.some((sourceStep) => candidateSteps.some((candidateStep) => {
    const sourceTerms = new Set(sourceStep.split(' '));
    const sharedTerms = candidateStep.split(' ').filter((term) => sourceTerms.has(term));
    return sharedTerms.length >= Math.min(2, sourceTerms.size);
  }));
}

function hasInstructionChange(source: Recipe, candidate: Recipe): boolean {
  return JSON.stringify({ steps: source.steps, structuredSteps: source.structuredSteps }) !==
    JSON.stringify({ steps: candidate.steps, structuredSteps: candidate.structuredSteps });
}

function hasMeaningfulCandidateChange(source: Recipe, candidate: Recipe): boolean {
  return JSON.stringify({
    title: source.title,
    description: source.description,
    ingredients: source.ingredients,
    steps: source.steps,
    equipment: source.equipment,
    servings: source.servings,
    totalTimeMinutes: source.totalTimeMinutes,
    estimatedHomemadeCost: source.estimatedHomemadeCost,
  }) !== JSON.stringify({
    title: candidate.title,
    description: candidate.description,
    ingredients: candidate.ingredients,
    steps: candidate.steps,
    equipment: candidate.equipment,
    servings: candidate.servings,
    totalTimeMinutes: candidate.totalTimeMinutes,
    estimatedHomemadeCost: candidate.estimatedHomemadeCost,
  });
}

function getRecipeSearchText(recipe: Recipe): string {
  return [
    recipe.title,
    recipe.description,
    ...recipe.ingredients.flatMap((ingredient) => [ingredient.name, ingredient.quantity]),
    ...(recipe.ingredientGroups ?? []).flatMap((group) => [
      group.component,
      ...group.items.flatMap((ingredient) => [ingredient.name, ingredient.quantity]),
    ]),
    ...recipe.steps,
    ...(recipe.structuredSteps ?? []).flatMap((step) => [
      step.title ?? '',
      step.text,
      ...(step.ingredientsUsed ?? []),
      step.flavorBoost ?? '',
      step.chefTip ?? '',
      step.doneWhen ?? '',
    ]),
    ...(recipe.substitutions ?? []),
    ...(recipe.spicePairings ?? []),
    ...(recipe.equipment ?? []),
    recipe.pantryNote,
    recipe.avoidMistake ?? '',
    recipe.mistakeWarning ?? '',
    recipe.storageAndReheating ?? '',
    recipe.storage ?? '',
    recipe.mainIngredientsSummary ?? '',
    ...(recipe.groceryItems ?? []).flatMap((item) => [item.name, item.sourceIngredient ?? '', item.shoppingNote ?? '']),
  ].join(' ');
}

function validateRemovedIngredientMetadata(changes: RecipeChange[], candidate: Recipe): ValidationIssue[] {
  const metadataText = [
    candidate.title,
    candidate.description,
    ...(candidate.substitutions ?? []),
    ...(candidate.spicePairings ?? []),
    candidate.pantryNote,
    candidate.avoidMistake ?? '',
    candidate.mistakeWarning ?? '',
    candidate.storageAndReheating ?? '',
    candidate.storage ?? '',
    candidate.mainIngredientsSummary ?? '',
  ].join(' ');
  return changes.flatMap((change) => {
    if ((change.kind !== 'removed' && change.kind !== 'substituted') || !change.before) return [];
    const removedName = canonicalizeIngredient(change.before).base;
    return containsConcept(metadataText, removedName)
      ? [{ code: 'stale_removed_metadata_reference', message: `Removed ingredient ${removedName} remains in recipe metadata.` }]
      : [];
  });
}

function quantitiesScaleCoherently(source: Recipe, candidate: Recipe, multiplier: number): boolean {
  const candidateByBase = new Map(candidate.ingredients.map((ingredient) => {
    const canonical = canonicalizeIngredient(ingredient);
    return [canonical.base, canonical] as const;
  }));
  let measurableCount = 0;
  for (const sourceIngredient of source.ingredients.map(canonicalizeIngredient)) {
    const candidateIngredient = candidateByBase.get(sourceIngredient.base);
    if (!candidateIngredient) continue;
    const before = parseQuantityNumber(sourceIngredient.amount);
    const after = parseQuantityNumber(candidateIngredient.amount);
    if (before === null || after === null) continue;
    measurableCount += 1;
    const expected = before * multiplier;
    if (Math.abs(after - expected) > Math.max(0.02, expected * 0.02)) return false;
  }
  return measurableCount > 0;
}

function parseQuantityNumber(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+)\s+)?(\d+\/\d+|\d+(?:\.\d+)?)/);
  if (!match) return null;
  const whole = Number(match[1] ?? 0);
  const part = match[2].includes('/')
    ? (() => {
        const [numerator, denominator] = match[2].split('/').map(Number);
        return denominator ? numerator / denominator : NaN;
      })()
    : Number(match[2]);
  return Number.isFinite(whole + part) ? whole + part : null;
}

function normalizeStepConcept(value: string): string {
  return normalizeWords(value)
    .filter((word) => word.length > 2)
    .filter((word) => !new Set(['the', 'and', 'with', 'into', 'until', 'then', 'from', 'over', 'for']).has(word))
    .join(' ');
}

export function reconcileCorrectionNutrition(candidate: Recipe): Recipe {
  const nutrition = candidate.nutritionEstimate;
  if (!nutrition || !hasFiniteNutrition(nutrition)) return candidate;
  const macroCalories = nutrition.proteinGrams * 4 +
    nutrition.carbohydratesGrams * 4 + nutrition.fatGrams * 9;
  const tolerance = Math.max(20, macroCalories * 0.1);
  if (Math.abs(nutrition.calories - macroCalories) <= tolerance) return candidate;
  return {
    ...candidate,
    nutritionEstimate: {
      ...nutrition,
      calories: Math.max(0, Math.round(macroCalories / 5) * 5),
    },
  };
}

export function deriveRecipeChanges(source: Recipe, candidate: Recipe): RecipeChange[] {
  const before = source.ingredients.map(canonicalizeIngredient);
  const after = candidate.ingredients.map(canonicalizeIngredient);
  const unmatchedBefore = new Set(before.map((_, index) => index));
  const unmatchedAfter = new Set(after.map((_, index) => index));
  const changes: RecipeChange[] = [];

  for (const beforeIndex of [...unmatchedBefore]) {
    const match = [...unmatchedAfter].find((afterIndex) => after[afterIndex].base === before[beforeIndex].base);
    if (match === undefined) continue;
    unmatchedBefore.delete(beforeIndex);
    unmatchedAfter.delete(match);
    const oldIngredient = before[beforeIndex];
    const newIngredient = after[match];
    if (oldIngredient.amount !== newIngredient.amount) {
      changes.push({ kind: 'quantity_changed', before: oldIngredient, after: newIngredient, substantive: true });
    } else if (oldIngredient.preparation !== newIngredient.preparation) {
      changes.push({ kind: 'formulation_changed', before: oldIngredient, after: newIngredient, substantive: false });
    }
  }

  if (unmatchedBefore.size === 1 && unmatchedAfter.size === 1) {
    const beforeIngredient = before[[...unmatchedBefore][0]];
    const afterIngredient = after[[...unmatchedAfter][0]];
    changes.push({ kind: 'substituted', before: beforeIngredient, after: afterIngredient, substantive: true });
    unmatchedBefore.clear();
    unmatchedAfter.clear();
  }

  for (const index of unmatchedBefore) {
    changes.push({ kind: 'removed', before: before[index], substantive: true });
  }
  for (const index of unmatchedAfter) {
    changes.push({ kind: 'added', after: after[index], substantive: true });
  }
  return changes;
}

function validateStepConsistency(
  sourceIngredients: CanonicalIngredient[],
  candidateIngredients: CanonicalIngredient[],
  changes: RecipeChange[],
  source: Recipe,
  candidate: Recipe,
): ValidationIssue[] {
  const sourceSteps = getStepTexts(source);
  const candidateSteps = getStepTexts(candidate);
  const sourceStepEvidence = getStepText(source);
  const candidateStepEvidence = getStepText(candidate);
  const issues: ValidationIssue[] = [];
  for (const change of changes) {
    const beforeName = change.before ? canonicalizeIngredient(change.before).base : '';
    const afterName = change.after ? canonicalizeIngredient(change.after).base : '';
    if (change.kind === 'added' && !containsConcept(candidateStepEvidence, afterName)) {
      issues.push({ code: 'added_ingredient_unused', message: 'An added ingredient is not used in any instruction.' });
    }
    if ((change.kind === 'removed' || change.kind === 'substituted') &&
        containsConcept(candidateStepEvidence, beforeName) && containsConcept(sourceStepEvidence, beforeName)) {
      const stepIndex = findStepIndex(candidateSteps, beforeName);
      issues.push({
        code: change.kind === 'removed' ? 'removed_ingredient_referenced' : 'stale_substitution_reference',
        message: 'An explicit old ingredient reference remains in the cooking instructions.',
        ...(stepIndex === undefined ? {} : { stepIndex }),
        details: { ingredient: beforeName },
      });
    }
    if (change.kind === 'quantity_changed' && change.before &&
        containsConcept(candidateStepEvidence, beforeName)) {
      const oldAmount = canonicalizeIngredient(change.before).amount;
      const stepIndex = candidateSteps.findIndex((step) =>
        containsConcept(step, beforeName) && containsAmount(step, oldAmount)) + 1;
      if (stepIndex > 0) {
        issues.push({
          code: 'stale_quantity_reference',
          message: 'A cooking instruction still uses the old ingredient quantity.',
          stepIndex,
          details: {
            ingredient: beforeName,
            oldQuantity: oldAmount,
            newQuantity: change.after ? canonicalizeIngredient(change.after).amount : null,
          },
        });
      }
    }
  }
  void sourceIngredients;
  void candidateIngredients;
  return issues;
}

function validateRecipeStructure(recipe: Recipe): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!recipe.title.trim() || !recipe.description.trim() || !recipe.ingredients.length || !recipe.steps.length) {
    issues.push({ code: 'recipe_structure_invalid', message: 'The corrected recipe is missing required recipe content.' });
  }
  if (recipe.ingredients.some((ingredient) => !ingredient.name.trim() || !ingredient.quantity.trim())) {
    issues.push({ code: 'ingredient_structure_invalid', message: 'The corrected recipe contains an invalid ingredient.' });
  }
  if (recipe.structuredSteps?.some((step) => !step.text.trim())) {
    issues.push({ code: 'step_structure_invalid', message: 'The corrected recipe contains an invalid cooking step.' });
  }
  return issues;
}

function validateNutrition(recipe: Recipe): ValidationIssue[] {
  const nutrition = recipe.nutritionEstimate;
  if (!nutrition || !hasFiniteNutrition(nutrition)) {
    return [{ code: 'nutrition_invalid', message: 'The corrected recipe has invalid nutrition values.' }];
  }
  const macroCalories = nutrition.proteinGrams * 4 + nutrition.carbohydratesGrams * 4 + nutrition.fatGrams * 9;
  if (Math.abs(nutrition.calories - macroCalories) > Math.max(20, macroCalories * 0.1)) {
    return [{ code: 'nutrition_calorie_conflict', message: 'Calories substantially conflict with the displayed macronutrients.' }];
  }
  return [];
}

function meetsNutritionTarget(recipe: Recipe, target: NutritionRequirementTarget | undefined): boolean {
  if (!target || !recipe.nutritionEstimate) return false;
  const value = getNutritionValue(recipe, target.nutrient);
  return target.direction === 'more'
    ? value >= (target.targetMinimum ?? target.targetValue)
    : value <= (target.targetMaximum ?? target.targetValue);
}

function getNutritionValue(recipe: Recipe, nutrient: NutritionRequirementTarget['nutrient']): number {
  const nutrition = recipe.nutritionEstimate!;
  switch (nutrient) {
    case 'protein': return nutrition.proteinGrams;
    case 'fat': return nutrition.fatGrams;
    case 'carbohydrate': return nutrition.carbohydratesGrams;
    case 'fiber': return nutrition.fiberGrams ?? 0;
    case 'calorie': return nutrition.calories;
  }
}

function getNutritionConstraintValue(recipe: Recipe, nutrient: string): number | null {
  const normalized = normalizeWords(nutrient).join(' ');
  const nutrition = recipe.nutritionEstimate;
  if (!nutrition) return null;
  if (normalized === 'calorie' || normalized === 'kcal') return nutrition.calories;
  if (normalized === 'protein') return nutrition.proteinGrams;
  if (normalized === 'fiber') return nutrition.fiberGrams ?? 0;
  if (normalized === 'fat') return nutrition.fatGrams;
  if (normalized === 'carbohydrate' || normalized === 'carb') return nutrition.carbohydratesGrams;
  return null;
}

function hasFiniteNutrition(nutrition: NonNullable<Recipe['nutritionEstimate']>): boolean {
  return [nutrition.calories, nutrition.proteinGrams, nutrition.carbohydratesGrams, nutrition.fatGrams, nutrition.fiberGrams]
    .filter((value): value is number => value !== undefined)
    .every((value) => Number.isFinite(value) && value >= 0);
}

function canonicalizeIngredient(ingredient: RecipeIngredient): CanonicalIngredient {
  let name = ingredient.name.trim();
  let amount = normalizeAmount(ingredient.quantity);
  const embedded = extractAmount(name);
  if (embedded && !looksLikeAmount(amount)) {
    amount = normalizeAmount(embedded.amount);
    name = embedded.name;
  }
  if (!name && amount) {
    const fromAmount = extractAmount(ingredient.quantity);
    if (fromAmount) {
      name = fromAmount.name;
      amount = normalizeAmount(fromAmount.amount);
    }
  }
  const terms = normalizeWords(name).filter((term) => !PREPARATION_WORDS.has(term) && !isUnit(term));
  const preparation = normalizeWords(name).filter((term) => PREPARATION_WORDS.has(term)).sort().join(' ');
  return { ...ingredient, name, quantity: amount, base: terms.join(' '), amount, preparation };
}

function extractAmount(value: string): { amount: string; name: string } | null {
  const match = value.match(/^((?:\d+(?:\.\d+)?|\d+\/\d+)(?:\s*(?:-|–)\s*\d+(?:\.\d+)?)?\s*[a-z]+|to\s+taste)\s+(.+)$/i);
  return match ? { amount: match[1], name: match[2].replace(/,\s*/g, ', ').trim() } : null;
}

function normalizeAmount(value: string): string {
  const normalized = normalizeWords(value).map((word) => UNIT_ALIASES[word] ?? word);
  if (normalized.join(' ') === 'salt to taste' || normalized.join(' ') === 'to taste salt') return 'to taste';
  return normalized.join(' ');
}

function looksLikeAmount(value: string): boolean {
  return /^(?:\d|to taste|a pinch|pinch|as needed)/i.test(value.trim());
}

function isUnit(value: string): boolean {
  return Boolean(UNIT_ALIASES[value]);
}

function normalizeWords(value: string): string[] {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9/\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean).map((word) => {
    if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  });
}

function containsConcept(text: string, concept: string): boolean {
  const valueTerms = new Set(normalizeWords(text));
  const conceptTerms = normalizeWords(concept);
  return conceptTerms.length > 0 && conceptTerms.every((term) => valueTerms.has(term));
}

function containsAmount(text: string, amount: string): boolean {
  const normalizedText = normalizeWords(text).join(' ');
  const normalizedAmount = normalizeWords(amount).join(' ');
  return Boolean(normalizedAmount && normalizedText.includes(normalizedAmount));
}

function getStepText(recipe: Recipe): string {
  return [
    ...recipe.steps,
    ...(recipe.structuredSteps ?? []).flatMap((step: RecipeStep) => [step.title ?? '', step.text, ...(step.ingredientsUsed ?? [])]),
  ].join(' ');
}

function getStepTexts(recipe: Recipe): string[] {
  if (recipe.structuredSteps?.length) {
    return recipe.structuredSteps.map((step: RecipeStep) =>
      [step.title ?? '', step.text, ...(step.ingredientsUsed ?? [])].join(' '));
  }
  return [...recipe.steps];
}

function findStepIndex(steps: string[], concept: string): number | undefined {
  const index = steps.findIndex((step) => containsConcept(step, concept));
  return index >= 0 ? index + 1 : undefined;
}

function uniqueIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.requirementIndex ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
