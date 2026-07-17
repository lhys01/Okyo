import type {
  Recipe,
  RecipeIngredient,
  RecipeQualityReport,
} from '../mocks';

const vagueInstructionPatterns = [
  'cook until done',
  'season to taste',
  'mix everything',
  'prepare ingredients',
  'add spices',
  'cook it',
  'make sauce',
];

const pantryStapleNames = [
  'salt',
  'black pepper',
  'olive oil',
  'neutral oil',
  'garlic powder',
  'red pepper flakes',
  'sugar',
  'flour',
];

const amountPattern = /\b(\d+|one|two|three|four|half|quarter|cup|cups|tbsp|tsp|teaspoon|tablespoon|oz|ounce|lb|pound|pinch)\b/i;

export function buildRecipeQualityReport(recipe: Recipe): RecipeQualityReport {
  const ingredients = getSafeIngredients(recipe.ingredients);
  const steps = getSafeTextList(recipe.steps);
  const structuredSteps = getSafeStructuredSteps(recipe.structuredSteps);
  const equipment = getSafeTextList(recipe.equipment);
  const missingIngredients = ingredients.length < 4
    ? ['A few core ingredients may be missing.']
    : ingredients
      .filter((ingredient) => !amountPattern.test(`${ingredient.quantity} ${ingredient.name}`))
      .slice(0, 3)
      .map((ingredient) => `${cleanText(ingredient.name)} needs a clearer amount.`);
  const missingSteps = steps.length < 4 ? ['The method needs more step-by-step detail before cooking.'] : [];
  const vagueInstructions = steps
    .filter((step) => vagueInstructionPatterns.some((pattern) => step.toLowerCase().includes(pattern)))
    .slice(0, 3)
    .map(cleanText);
  const totalTime = getRecipeTotalTime(recipe);
  const timeWarnings = totalTime > 0 && totalTime < Math.max(12, ingredients.length * 2)
    ? ['The timing looks optimistic for the amount of prep.']
    : [];
  const equipmentWarnings = equipment.length === 0 && structuredSteps.some((step) => getSafeTextList(step.toolsUsed).length > 0)
    ? []
    : equipment.length === 0
      ? ['Equipment is not fully called out yet.']
      : [];
  const pantryStaples = getPantryStaples(ingredients);
  const budgetOpportunities = getBudgetOpportunities(ingredients);
  const speedOpportunities = getSpeedOpportunities(recipe, totalTime);
  const healthOpportunities = getHealthOpportunities(ingredients);
  const whatCouldGoWrong = getWhatCouldGoWrong(recipe, vagueInstructions, structuredSteps);
  const fixesApplied = getFixesApplied(recipe, pantryStaples, vagueInstructions, missingIngredients);
  const issueCount = missingIngredients.length + missingSteps.length + vagueInstructions.length + timeWarnings.length + equipmentWarnings.length;
  const score = clamp(92 - issueCount * 10 + fixesApplied.length * 2, 48, 96);
  const cookabilityStatus = score >= 82
    ? 'cookable'
    : score >= 62
      ? 'needs_quick_fix'
      : 'too_vague_to_trust';

  return {
    score,
    confidence: recipe.isCompactRecipe ? 0.72 : 0.84,
    cookabilityStatus,
    missingIngredients,
    missingSteps,
    vagueInstructions,
    timeWarnings,
    equipmentWarnings,
    pantryStaples,
    budgetOpportunities,
    speedOpportunities,
    healthOpportunities,
    whatCouldGoWrong,
    fixesApplied,
    userFacingSummary: getSummary(cookabilityStatus, issueCount, recipe),
  };
}

export function getRecipeQualityStatusLabel(status: RecipeQualityReport['cookabilityStatus']) {
  switch (status) {
    case 'cookable':
      return 'Cookable';
    case 'needs_quick_fix':
      return 'Needs a quick fix';
    case 'too_vague_to_trust':
      return 'Too vague to trust';
  }
}

function getRecipeTotalTime(recipe: Recipe) {
  const explicitTotal = typeof recipe.totalTimeMinutes === 'number' && Number.isFinite(recipe.totalTimeMinutes)
    ? recipe.totalTimeMinutes
    : null;
  if (explicitTotal !== null) {
    return explicitTotal;
  }
  const prep = typeof recipe.prepTimeMinutes === 'number' && Number.isFinite(recipe.prepTimeMinutes)
    ? recipe.prepTimeMinutes
    : 0;
  const cook = typeof recipe.cookTimeMinutes === 'number' && Number.isFinite(recipe.cookTimeMinutes)
    ? recipe.cookTimeMinutes
    : 0;
  return prep + cook;
}

function getPantryStaples(ingredients: RecipeIngredient[]) {
  return ingredients
    .filter((ingredient) => ingredient.pantryItem || pantryStapleNames.some((name) => ingredient.name.toLowerCase().includes(name)))
    .map((ingredient) => cleanText(ingredient.name))
    .slice(0, 5);
}

function getBudgetOpportunities(ingredients: RecipeIngredient[]) {
  const names = ingredients.map((ingredient) => ingredient.name.toLowerCase()).join(' ');
  const opportunities = ['Check pantry staples before buying duplicates.'];
  if (/\b(chicken|beef|shrimp|salmon|steak)\b/.test(names)) {
    opportunities.push('Use tofu, eggs, beans, or a smaller amount of protein to make it cheaper.');
  }
  if (/\b(parmesan|cream|cheese)\b/.test(names)) {
    opportunities.push('Buy the smallest dairy size you need or use what is already open.');
  }
  return opportunities.slice(0, 3);
}

function getSpeedOpportunities(recipe: Recipe, totalTime: number) {
  const opportunities = [];
  if (totalTime > 30) {
    opportunities.push('Use pre-chopped vegetables or a prepared sauce to save time.');
  }
  if (getSafeIngredients(recipe.ingredients).length > 7) {
    opportunities.push('Group ingredients by step before cooking so the recipe feels calmer.');
  }
  return opportunities.length > 0 ? opportunities : ['Measure the sauce first so cooking moves quickly.'];
}

function getHealthOpportunities(ingredients: RecipeIngredient[]) {
  const names = ingredients.map((ingredient) => ingredient.name.toLowerCase()).join(' ');
  const opportunities = ['Add an easy vegetable or fresh herb if you want it more balanced.'];
  if (/\b(cream|butter|cheese|mayo)\b/.test(names)) {
    opportunities.push('Use a little less creamy ingredient and brighten with lemon or vinegar.');
  }
  return opportunities.slice(0, 2);
}

function getWhatCouldGoWrong(recipe: Recipe, vagueInstructions: string[], structuredSteps: NonNullable<Recipe['structuredSteps']>) {
  const risks = [];
  if (vagueInstructions.length > 0) {
    risks.push('A vague step could leave you guessing mid-cook.');
  }
  if (getSafeTextList(recipe.equipment).length === 0) {
    risks.push('You may need a pan, bowl, or blender that the original idea did not mention.');
  }
  if (!structuredSteps.some((step) => step.doneWhen || step.visualCue || step.lookFor)) {
    risks.push('The recipe needs stronger visual cues for doneness.');
  }
  return risks.length > 0 ? risks.slice(0, 3) : ['Biggest risk is over-seasoning at the end. Add small amounts and taste.'];
}

function getFixesApplied(
  recipe: Recipe,
  pantryStaples: string[],
  vagueInstructions: string[],
  missingIngredients: string[],
) {
  const fixes = ['Separated likely pantry checks from shopping items.'];
  if (getSafeStructuredSteps(recipe.structuredSteps).length > 0) {
    fixes.push('Turned the idea into guided cooking steps.');
  }
  if (pantryStaples.length > 0) {
    fixes.push('Flagged basic pantry staples.');
  }
  if (vagueInstructions.length > 0 || missingIngredients.length > 0) {
    fixes.push('Marked unclear details to review before cooking.');
  }
  return fixes.slice(0, 4);
}

function getSummary(status: RecipeQualityReport['cookabilityStatus'], issueCount: number, recipe: Recipe) {
  if (status === 'cookable') {
    return `${cleanText(recipe.title)} looks cookable. Okyo found a few easy checks before you start.`;
  }
  if (status === 'needs_quick_fix') {
    return `${cleanText(recipe.title)} is close, but Okyo found ${issueCount} detail${issueCount === 1 ? '' : 's'} to fix first.`;
  }
  return 'This idea is too vague to trust as-is. Add ingredients, amounts, or steps before cooking.';
}

function getSafeIngredients(value: Recipe['ingredients'] | undefined): RecipeIngredient[] {
  return Array.isArray(value)
    ? value.filter((ingredient) => (
      typeof ingredient?.name === 'string' &&
      ingredient.name.trim().length > 0 &&
      typeof ingredient.quantity === 'string'
    ))
    : [];
}

function getSafeStructuredSteps(value: Recipe['structuredSteps'] | undefined): NonNullable<Recipe['structuredSteps']> {
  return Array.isArray(value)
    ? value.filter((step) => typeof step?.text === 'string' && step.text.trim().length > 0)
    : [];
}

function getSafeTextList(value: string[] | undefined) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim().length > 0) : [];
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
