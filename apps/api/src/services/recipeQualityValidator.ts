import type { Recipe, RecipeIngredientGroup, RecipeStep } from '../types.js';
import { deriveDishAnatomy, deriveDishContract, findDishContractIssues, type DishAnatomy, type DishContract } from './dishAnatomy.js';
import { findFlavorPlanIssues, type FlavorPlan } from './flavorPlan.js';
import { validateRecipeSignature } from './recipeSignatureProfiles.js';
import { deriveRecipeStepTime, hasUnspecifiedPassiveWait } from './recipeTime.js';

export type RecipeValidationInput = {
  title: string;
  description?: string;
  ingredients: string[];
  ingredientGroups?: Array<{ component?: string; items?: string[] }>;
  steps: Array<string | { title?: string; step?: string; instruction?: string; text?: string; ingredients?: string[]; ingredientsUsed?: string[] }>;
};

type AnalysisLike = Parameters<typeof deriveDishContract>[0] & { anatomy?: DishAnatomy };

function stepText(step: RecipeValidationInput['steps'][number]): string {
  return typeof step === 'string' ? step : [step.title, step.step, step.instruction, step.text, ...(step.ingredients ?? []), ...(step.ingredientsUsed ?? [])].filter(Boolean).join(' ');
}

function leafNames(groups: RecipeValidationInput['ingredientGroups'] = []): string[] {
  return groups.flatMap((group) => group.items ?? []);
}

function hasAmount(value: string): boolean { return /\d|\b(?:a|an|one|two|half|pinch|dash|to taste)\b/i.test(value); }

function ingredientName(value: string): string {
  return value.replace(/^\s*(?:\d+(?:\.\d+)?(?:\/\d+)?|[¼½¾⅓⅔⅛⅜⅝]|a|an|one|two|three|half|pinch|dash)\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|pounds?|cloves?|sprigs?|pieces?|cans?)?\s*/i, '').trim().toLowerCase();
}

function ingredientMentioned(name: string, text: string): boolean {
  const terms = ingredientName(name).split(/\s+/).filter((term) => term.length > 2);
  return terms.length > 0 && terms.some((term) => text.includes(term));
}

export type LaminatedCroissantProofDiagnostics = {
  shapingIndex: number;
  proofIndex: number;
  eggWashIndex: number;
  bakeIndex: number;
};

export function getLaminatedCroissantProofDiagnostics(steps: string[]): LaminatedCroissantProofDiagnostics {
  const finalShapingPattern = /\b(?:shape\b[^.;]{0,80}\b(?:croissants?|crescents?)\b(?!\s+dough\b)|cut\s+into\s+triangles?\s+and\s+roll|roll\s+each\s+triangle\s+from\s+base\s+to\s+tip|form\s+into\s+crescents?)\b/i;
  const shapingIndex = steps.findIndex((step) => finalShapingPattern.test(step));
  const proofIndex = steps.findIndex((step, index) => index > shapingIndex && /\b(?:proof|final proof|rise|rising|let .* rise|leave .* rise|rest .* puffy|allow .* expand)\b/i.test(step));
  const eggWashIndex = steps.findIndex((step, index) => index > shapingIndex && /\begg\s+wash\b/i.test(step));
  const bakeIndex = steps.findIndex((step, index) => index > shapingIndex && /\b(?:bake|baking|oven)\b/i.test(step));
  return { shapingIndex, proofIndex, eggWashIndex, bakeIndex };
}

function validateLaminatedCroissantProof(analysis: AnalysisLike, ingredients: string[], steps: string[]): string[] {
  const context = [
    analysis.dishName,
    analysis.broadDishCategory,
    analysis.mealDescription,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
    ...Object.values(analysis.visibleComponents),
    ...ingredients,
  ].filter(Boolean).join(' ').toLowerCase();
  if (!/\bcroissant\b/.test(context) || /\bpuff\s+pastry\b/.test(context) || !/\b(?:yeast|laminat(?:ed|ion)|laminate)\b/.test(context)) return [];

  const { shapingIndex, proofIndex, eggWashIndex, bakeIndex } = getLaminatedCroissantProofDiagnostics(steps);
  if (steps.some((step) => /\b(?:laminat(?:e|ion)|fold)\b/i.test(step) && hasUnspecifiedPassiveWait(step))) {
    return ['missing_lamination_wait_duration'];
  }
  const finalBarrier = [eggWashIndex, bakeIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
  if (shapingIndex < 0 || proofIndex < 0 || (finalBarrier >= 0 && proofIndex >= finalBarrier)) return ['missing_final_proof'];
  if (deriveRecipeStepTime(steps[proofIndex]).elapsedMinutes < 30) return ['invalid_final_proof_duration'];
  return [];
}

export function validateRecipeQuality(input: RecipeValidationInput, analysis: AnalysisLike, flavorPlan?: FlavorPlan, contract?: DishContract): string[] {
  const steps = input.steps.map(stepText).filter(Boolean);
  const allIngredients = [...input.ingredients, ...leafNames(input.ingredientGroups)];
  const issues: string[] = [];
  const effectiveContract = contract;
  const hasFlavorPlan = Boolean(flavorPlan && [flavorPlan.aromatics, flavorPlan.coreSeasonings, flavorPlan.balancingElements, flavorPlan.finishingElements].some((items) => items.length > 0));
  if (effectiveContract) issues.push(...findDishContractIssues(effectiveContract, {
    title: input.title,
    ingredients: allIngredients.map((name) => ({ name, quantity: '' })),
    ingredientGroups: (input.ingredientGroups ?? []).map((group) => ({ component: group.component ?? '', items: (group.items ?? []).map((name) => ({ name, quantity: '' })) })),
    steps: steps,
    structuredSteps: [],
  }));
  const ingredientText = allIngredients.join(' ').toLowerCase();
  const stepTextValue = steps.join(' ').toLowerCase();
  issues.push(...validateLaminatedCroissantProof(analysis, allIngredients, steps));
  if (effectiveContract || hasFlavorPlan) {
    for (const ingredient of input.ingredients) {
      const name = ingredientName(ingredient);
      if (name && !ingredientMentioned(name, stepTextValue)) issues.push(`ingredient_unused:${name}`);
      if (!hasAmount(ingredient)) issues.push('ingredient_missing_quantity');
    }
    for (const step of input.steps) {
      const rawIngredients = typeof step === 'string' ? [] : [...(step.ingredients ?? []), ...(step.ingredientsUsed ?? [])];
      for (const referenced of rawIngredients) if (referenced && !ingredientText.includes(referenced.toLowerCase())) issues.push(`step_unknown_ingredient:${referenced}`);
    }
  }
  issues.push(...validateRecipeSignature(input.title, input.description ?? '', allIngredients, steps, effectiveContract?.signatureKey));
  if (hasFlavorPlan && flavorPlan) issues.push(...findFlavorPlanIssues(flavorPlan, allIngredients, steps));
  if (input.title.toLowerCase().includes('filled') || (effectiveContract?.requiredTitleTerms.length ?? 0) > 0) {
    const titlePromisesFilling = /filled|stuffed|with\s+/i.test(input.title);
    if (titlePromisesFilling && !/filling|fill|stuffed|fruit|cream|jam|custard/i.test(`${ingredientText} ${stepTextValue}`)) issues.push('title_promises_missing_filling');
  }
  return [...new Set(issues)];
}

export function validateCanonicalRecipeQuality(recipe: Recipe, analysis: AnalysisLike, flavorPlan?: FlavorPlan): string[] {
  const anatomy = analysis.anatomy ?? deriveDishAnatomy(analysis);
  const derivedContract = anatomy && (anatomy.dishFamily === 'filled_pastry' || deriveDishContract(analysis, anatomy).signatureKey)
    ? deriveDishContract(analysis, anatomy)
    : undefined;
  return validateRecipeQuality({
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients.map((ingredient) => `${ingredient.quantity} ${ingredient.name}`),
    ingredientGroups: recipe.ingredientGroups?.map((group) => ({ component: group.component, items: group.items.map((item) => `${item.quantity} ${item.name}`) })),
    steps: recipe.structuredSteps?.length ? recipe.structuredSteps.map((step) => ({ text: step.text, ingredientsUsed: step.ingredientsUsed })) : recipe.steps,
  }, analysis, flavorPlan, derivedContract);
}
