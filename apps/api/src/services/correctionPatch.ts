import type {
  Recipe,
  RecipeIngredient,
  RecipeStep,
} from '../types.js';
import type {
  CorrectionAppliedChangeManifest,
  CorrectionIngredientOperation,
  CorrectionRecipePatch,
  CorrectionStepOperation,
} from './correctionIntent.js';

export type CorrectionRecipeReferences = {
  ingredientIds: string[];
  stepIds: string[];
  ingredientMap: Record<string, string>;
  stepMap: Record<string, string>;
};

export type CorrectionPatchApplication = {
  recipe: Recipe;
  manifest: CorrectionAppliedChangeManifest[];
  references: CorrectionRecipeReferences;
  rejectedOperationReasons: string[];
  appliedOperationCount: number;
};

type IngredientRecord = RecipeIngredient & { id: string; active: boolean };
type StepRecord = RecipeStep & { id: string; active: boolean };

export function createCorrectionRecipeReferences(recipe: Recipe): CorrectionRecipeReferences {
  const ingredientIds = recipe.ingredients.map((_, index) => `ingredient-${index + 1}`);
  const steps = getRecipeSteps(recipe);
  const stepIds = steps.map((_, index) => `step-${index + 1}`);
  return {
    ingredientIds,
    stepIds,
    ingredientMap: Object.fromEntries(
      recipe.ingredients.map((ingredient, index) => [ingredientIds[index], ingredient.name]),
    ),
    stepMap: Object.fromEntries(
      steps.map((step, index) => [stepIds[index], step.text]),
    ),
  };
}

export function formatCorrectionRecipeReferences(recipe: Recipe): string[] {
  const references = createCorrectionRecipeReferences(recipe);
  return [
    'Temporary correction references (internal only; use these IDs in the patch):',
    'Ingredients:',
    ...recipe.ingredients.map((ingredient, index) =>
      `- ${references.ingredientIds[index]}: ${ingredient.quantity} ${ingredient.name}`),
    'Steps:',
    ...getRecipeSteps(recipe).map((step, index) =>
      `- ${references.stepIds[index]}: ${step.title ?? ''} — ${step.text}`),
  ];
}

export function applyCorrectionPatch(
  original: Recipe,
  patch: CorrectionRecipePatch,
): CorrectionPatchApplication {
  const rejectedOperationReasons: string[] = [];
  const ingredientRecords: IngredientRecord[] = original.ingredients.map((ingredient, index) => ({
    ...ingredient,
    id: `ingredient-${index + 1}`,
    active: true,
  }));
  const stepRecords: StepRecord[] = getRecipeSteps(original).map((step, index) => ({
    ...step,
    id: `step-${index + 1}`,
    active: true,
  }));
  const ingredientById = new Map(ingredientRecords.map((ingredient) => [ingredient.id, ingredient]));
  const stepById = new Map(stepRecords.map((step) => [step.id, step]));
  const touchedIngredientIds = new Set<string>();
  const touchedStepIds = new Set<string>();
  let addedIngredientCount = 0;
  let addedStepCount = 0;
  let appliedOperationCount = 0;

  for (const operation of patch.ingredientOperations ?? []) {
    const source = operation.sourceIngredientId
      ? ingredientById.get(operation.sourceIngredientId)
      : undefined;
    if (operation.operation !== 'add' && (!source || !source.active)) {
      rejectedOperationReasons.push(`ingredient_unknown_id:${operation.sourceIngredientId ?? '(missing)'}`);
      continue;
    }
    if (source && touchedIngredientIds.has(source.id)) {
      rejectedOperationReasons.push(`ingredient_duplicate_operation:${source.id}`);
      continue;
    }
    const result = operation.result;
    if (operation.operation === 'add') {
      if (operation.sourceIngredientId || !result?.name?.trim() || !result.quantity?.trim()) {
        rejectedOperationReasons.push('ingredient_add_invalid_result');
        continue;
      }
      const id = result.id?.trim() || `added-ingredient-${++addedIngredientCount}`;
      if (ingredientById.has(id)) {
        rejectedOperationReasons.push(`ingredient_result_duplicate_id:${id}`);
        continue;
      }
      const added: IngredientRecord = {
        name: result.name.trim(),
        quantity: result.quantity.trim(),
        ...(result.pantryItem === undefined ? {} : { pantryItem: result.pantryItem }),
        id,
        active: true,
      };
      result.id = id;
      ingredientRecords.push(added);
      ingredientById.set(id, added);
      touchedIngredientIds.add(id);
      appliedOperationCount += 1;
      continue;
    }
    if (!source || (operation.operation !== 'remove' && !result)) {
      rejectedOperationReasons.push(`ingredient_result_missing:${source?.id ?? '(missing)'}`);
      continue;
    }
    if (operation.operation === 'remove') {
      if (result && (result.name || result.quantity)) {
        rejectedOperationReasons.push(`ingredient_remove_has_result:${source.id}`);
        continue;
      }
      source.active = false;
    } else if (!result) {
      rejectedOperationReasons.push(`ingredient_result_missing:${source.id}`);
      continue;
    } else if (operation.operation === 'change_quantity') {
      if (!result.quantity?.trim() || normalizeQuantity(result.quantity) === normalizeQuantity(source.quantity)) {
        rejectedOperationReasons.push(`ingredient_quantity_unchanged:${source.id}`);
        continue;
      }
      source.quantity = result.quantity.trim();
    } else {
      if (!result.name?.trim() || (operation.operation !== 'change_descriptor' && !result.quantity?.trim())) {
        rejectedOperationReasons.push(`ingredient_result_invalid:${source.id}`);
        continue;
      }
      const changedName = normalizeIngredientName(result.name) !== normalizeIngredientName(source.name);
      const nextQuantity = result.quantity?.trim() || source.quantity;
      const changedQuantity = normalizeQuantity(nextQuantity) !== normalizeQuantity(source.quantity);
      if (!changedName && !changedQuantity) {
        rejectedOperationReasons.push(`ingredient_result_unchanged:${source.id}`);
        continue;
      }
      if (operation.operation === 'change_descriptor' && !changedName) {
        rejectedOperationReasons.push(`ingredient_descriptor_unchanged:${source.id}`);
        continue;
      }
      source.name = result.name.trim();
      source.quantity = nextQuantity;
      if (result.pantryItem !== undefined) source.pantryItem = result.pantryItem;
    }
    touchedIngredientIds.add(source.id);
    appliedOperationCount += 1;
  }

  for (const operation of patch.stepOperations ?? []) {
    const source = operation.sourceStepId ? stepById.get(operation.sourceStepId) : undefined;
    if (operation.operation !== 'add' && (!source || !source.active)) {
      rejectedOperationReasons.push(`step_unknown_id:${operation.sourceStepId ?? '(missing)'}`);
      continue;
    }
    if (source && touchedStepIds.has(source.id)) {
      rejectedOperationReasons.push(`step_duplicate_operation:${source.id}`);
      continue;
    }
    const result = operation.result ?? {
      title: operation.title,
      text: operation.text,
      ingredientReferences: operation.ingredientReferences,
    };
    if (operation.operation === 'remove') {
      if (!source || result.text || result.ingredientReferences?.length) {
        rejectedOperationReasons.push(`step_remove_invalid:${source?.id ?? '(missing)'}`);
        continue;
      }
      source.active = false;
      touchedStepIds.add(source.id);
      appliedOperationCount += 1;
      continue;
    }
    if (!result.text?.trim() || !result.ingredientReferences?.length) {
      rejectedOperationReasons.push('step_result_missing_text_or_references');
      continue;
    }
    const referencedIngredients = result.ingredientReferences.map((id) => ingredientById.get(id));
    if (referencedIngredients.some((ingredient) => !ingredient || !ingredient.active)) {
      rejectedOperationReasons.push('step_unknown_ingredient_reference');
      continue;
    }
    if (referencedIngredients.some((ingredient) => !ingredientTextMatches(result.text!, ingredient!))) {
      rejectedOperationReasons.push('step_ingredient_not_used_in_text');
      continue;
    }
    const step: StepRecord = source ?? {
      id: result.id?.trim() || `added-step-${++addedStepCount}`,
      title: result.title?.trim() || `Step ${stepRecords.length + 1}`,
      text: result.text.trim(),
      ingredientsUsed: [],
      toolsUsed: [],
      active: true,
    };
    if (!source && stepById.has(step.id)) {
      rejectedOperationReasons.push(`step_result_duplicate_id:${step.id}`);
      continue;
    }
    step.title = result.title?.trim() || step.title;
    step.text = result.text.trim();
    step.ingredientsUsed = referencedIngredients.map((ingredient) => ingredient!.name);
    stepById.set(step.id, step);
    if (!source) stepRecords.push(step);
    touchedStepIds.add(step.id);
    appliedOperationCount += 1;
  }

  const activeIngredients = ingredientRecords.filter((ingredient) => ingredient.active);
  const activeSteps = stepRecords.filter((step) => step.active);
  const activeIngredientIds = new Set(activeIngredients.map((ingredient) => ingredient.id));
  for (const step of activeSteps) {
    const refs = step.ingredientsUsed ?? [];
    if (refs.some((reference) => ![...activeIngredientIds].some((id) =>
      ingredientTextMatches(reference, ingredientById.get(id)!)))) {
      rejectedOperationReasons.push(`step_final_reference_unresolved:${step.id}`);
    }
  }
  for (const id of touchedIngredientIds) {
    const ingredient = ingredientById.get(id);
    if (!ingredient) continue;
    const oldName = original.ingredients[Number(id.split('-')[1]) - 1]?.name;
    if (!ingredient.active && oldName && activeSteps.some((step) => ingredientTextMatches(step.text, { name: oldName } as RecipeIngredient))) {
      rejectedOperationReasons.push(`removed_ingredient_remains_in_steps:${id}`);
    }
  }

  const structuredSteps = activeSteps.map((step, index) => ({
    ...step,
    id: undefined,
    active: undefined,
    stepNumber: index + 1,
  })) as RecipeStep[];
  const metadata = patch.metadataPatch ?? {};
  const recipe: Recipe = {
    ...original,
    ...(metadata.title ? { title: metadata.title.trim() } : {}),
    ...(metadata.description ? { description: metadata.description.trim() } : {}),
    ...(metadata.prepTimeMinutes !== null && metadata.prepTimeMinutes !== undefined ? { prepTimeMinutes: metadata.prepTimeMinutes } : {}),
    ...(metadata.cookTimeMinutes !== null && metadata.cookTimeMinutes !== undefined ? { cookTimeMinutes: metadata.cookTimeMinutes } : {}),
    ...(metadata.totalTimeMinutes !== null && metadata.totalTimeMinutes !== undefined ? { totalTimeMinutes: metadata.totalTimeMinutes } : {}),
    ...(metadata.servings !== null && metadata.servings !== undefined ? { servings: metadata.servings } : {}),
    ...(metadata.difficulty ? { difficulty: metadata.difficulty, skillLevel: metadata.difficulty } : {}),
    ...(metadata.estimatedHomemadeCost !== null && metadata.estimatedHomemadeCost !== undefined ? { estimatedHomemadeCost: metadata.estimatedHomemadeCost } : {}),
    ...(metadata.equipment ? { equipment: metadata.equipment } : {}),
    ...(metadata.substitutions ? { substitutions: metadata.substitutions } : {}),
    ...(metadata.spicePairings ? { spicePairings: metadata.spicePairings } : {}),
    ...(metadata.pantryNote !== null && metadata.pantryNote !== undefined ? { pantryNote: metadata.pantryNote } : {}),
    ...(metadata.storageAndReheating !== null && metadata.storageAndReheating !== undefined ? { storageAndReheating: metadata.storageAndReheating } : {}),
    ingredients: activeIngredients.map(({ id: _id, active: _active, ...ingredient }) => ingredient),
    structuredSteps,
    steps: structuredSteps.map((step) => step.text),
    ...(patch.nutritionEstimate ? { nutritionEstimate: patch.nutritionEstimate } : {}),
  };
  const manifest = buildPatchManifest(original, patch, ingredientRecords, stepRecords, touchedIngredientIds);
  return {
    recipe,
    manifest,
    references: createCorrectionRecipeReferences(original),
    rejectedOperationReasons,
    appliedOperationCount,
  };
}

function buildPatchManifest(
  original: Recipe,
  patch: CorrectionRecipePatch,
  ingredients: IngredientRecord[],
  steps: StepRecord[],
  touchedIngredientIds: Set<string>,
): CorrectionAppliedChangeManifest[] {
  return patch.ingredientOperations.flatMap((operation) => {
    const id = operation.sourceIngredientId ?? operation.result?.id;
    const after = id ? ingredients.find((ingredient) => ingredient.id === id) : undefined;
    const beforeIndex = operation.sourceIngredientId
      ? Number(operation.sourceIngredientId.replace('ingredient-', '')) - 1
      : -1;
    const before = beforeIndex >= 0 ? original.ingredients[beforeIndex] : undefined;
    const affectedStepIndexes = steps
      .map((step, index) => ({ step, index: index + 1 }))
      .filter(({ step }) => (step.ingredientsUsed ?? []).some((reference) =>
        after && ingredientTextMatches(reference, after)))
      .map(({ index }) => index);
    if (!touchedIngredientIds.has(id ?? '')) return [];
    return [{
      ...(before ? { beforeIngredient: before.name } : {}),
      ...(after?.active ? { afterIngredient: after.name } : {}),
      reason: 'Provider structured recipe patch operation.',
      supportsRequirementIndexes: operation.supportsRequirementIndexes,
      affectedStepIndexes,
    }];
  });
}

function getRecipeSteps(recipe: Recipe): RecipeStep[] {
  if (recipe.structuredSteps?.length) return recipe.structuredSteps;
  return recipe.steps.map((text, index) => ({
    stepNumber: index + 1,
    title: `Step ${index + 1}`,
    text,
    ingredientsUsed: [],
    toolsUsed: [],
  }));
}

function normalizeIngredientName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeQuantity(value: string): string {
  return value.toLowerCase().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
}

function ingredientTextMatches(text: string, ingredient: RecipeIngredient): boolean {
  const terms = normalizeIngredientTerms(ingredient.name);
  const valueTerms = new Set(normalizeIngredientTerms(text));
  if (terms.length === 0 || valueTerms.size === 0) return false;
  if (terms.every((term) => valueTerms.has(term))) return true;
  // Steps often shorten a formulation name (for example, retaining the base
  // ingredient while omitting a preparation adjective). Require at least two
  // meaningful shared terms for multi-word names so one generic word cannot
  // satisfy the evidence contract by itself.
  const overlap = terms.filter((term) => valueTerms.has(term)).length;
  const minimumOverlap = Math.min(2, terms.length);
  return overlap >= minimumOverlap && overlap / terms.length >= 0.5;
}

function normalizeIngredientTerms(value: string): string[] {
  return normalizeIngredientName(value)
    .split(' ')
    .filter(Boolean)
    .map((term) => {
      if (term.length > 4 && term.endsWith('ies')) return `${term.slice(0, -3)}y`;
      if (term.length > 4 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1);
      return term;
    });
}
