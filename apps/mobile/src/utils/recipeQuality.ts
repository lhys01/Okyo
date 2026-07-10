import type {
  FoodIdeaSourceType,
  Recipe,
  RecipeIngredient,
  RecipeQualityReport,
  SavedFoodIdea,
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
const maxStoredIdeaTextLength = 6000;

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

export function createFoodIdeaRecipe(input: {
  rawText: string;
  sourceType: FoodIdeaSourceType;
  sourceUrl?: string;
}): Recipe {
  const rawText = normalizeIdeaText(input.rawText);
  const title = inferTitle(rawText, input.sourceUrl);
  const ingredients = inferIngredients(rawText);
  const steps = inferSteps(rawText, title);
  const totalTime = inferTotalTime(rawText, ingredients.length);
  const pantryStaples = ingredients.filter((ingredient) => ingredient.pantryItem);
  const stableId = `food-idea-${slugify(title)}-${hashIdeaKey(`${input.sourceType}|${input.sourceUrl ?? ''}|${rawText}`)}`;

  return {
    id: stableId,
    scanResultId: 'food-idea',
    title,
    mode: 'Restaurant Copy',
    description: input.sourceUrl
      ? 'Saved from a link. Okyo needs pasted visible recipe text for a more complete check.'
      : 'Saved from your note. Okyo made a cautious cookable draft from the details you pasted.',
    prepTimeMinutes: Math.max(6, Math.round(totalTime * 0.35)),
    cookTimeMinutes: Math.max(8, Math.round(totalTime * 0.65)),
    totalTimeMinutes: totalTime,
    servings: 2,
    skillLevel: ingredients.length > 8 ? 'Medium' : 'Easy',
    difficulty: ingredients.length > 8 ? 'Medium' : 'Easy',
    estimatedHomemadeCost: estimateCost(ingredients),
    estimatedSavings: 0,
    ingredients,
    steps,
    structuredSteps: steps.map((step, index) => ({
      text: step,
      title: getStepTitle(step, index),
      estimatedMinutes: Math.max(2, Math.round(totalTime / Math.max(steps.length, 1))),
      visualCue: index === steps.length - 1 ? 'Everything looks hot, glossy, and ready to serve.' : 'Ingredients look combined and evenly heated.',
      commonMistake: index === 0 ? 'Starting before ingredients are measured makes the rest feel rushed.' : undefined,
      why: index === 0 ? 'A short setup step makes the recipe easier to trust.' : undefined,
      toolsUsed: index === 0 ? ['cutting board', 'pan'] : ['pan'],
      ingredientsUsed: ingredients.slice(0, 4).map((ingredient) => ingredient.name),
    })),
    substitutions: [
      'Use what you already have for similar vegetables or herbs.',
      'Swap in a cheaper protein if the flavor direction still fits.',
    ],
    pantryNote: pantryStaples.length > 0
      ? `Probably already have: ${pantryStaples.map((ingredient) => ingredient.name).join(', ')}.`
      : 'Check basic pantry staples before shopping.',
    confidenceNote: 'Mock Recipe Check based only on pasted text. Edit anything that looks off before cooking.',
    equipment: ['large pan', 'cutting board', 'mixing bowl'],
    avoidMistake: 'Do not trust vague timing alone. Look for the visual cues in each step.',
    groceryItems: ingredients.map((ingredient) => ({
      category: ingredient.pantryItem ? 'Pantry' : inferCategory(ingredient.name),
      name: ingredient.name,
      quantity: ingredient.quantity,
      pantryItem: ingredient.pantryItem,
      pantryStaple: ingredient.pantryItem,
      sourceIngredient: `${ingredient.quantity} ${ingredient.name}`.trim(),
    })),
  };
}

export function createSavedFoodIdea(input: {
  rawText: string;
  sourceType: FoodIdeaSourceType;
  sourceUrl?: string;
}): SavedFoodIdea {
  const normalizedText = normalizeIdeaText(input.rawText);
  const extractedRecipe = createFoodIdeaRecipe({ ...input, rawText: normalizedText });
  return {
    id: extractedRecipe.id,
    sourceType: input.sourceType,
    title: extractedRecipe.title,
    rawText: normalizedText,
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
    extractedRecipe,
    qualityReport: buildRecipeQualityReport(extractedRecipe),
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

function inferTitle(rawText: string, sourceUrl?: string) {
  const firstLine = rawText.split(/\n+/).map((line) => line.trim()).find(Boolean);
  if (firstLine && firstLine.length <= 64 && !firstLine.includes('http')) {
    return cleanText(firstLine.replace(/^recipe\s*:\s*/i, ''));
  }
  const oneLineDishName = inferOneLineDishName(firstLine);
  if (oneLineDishName) {
    return oneLineDishName;
  }
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      const label = url.hostname.replace(/^www\./, '').split('.')[0];
      return `${capitalize(label)} food idea`;
    } catch {
      return 'Saved food idea';
    }
  }
  const match = rawText.match(/(?:make|cook|try|recipe for)\s+([^.,\n]+)/i);
  return cleanText(trimInferredTitle(match?.[1]) ?? 'Saved food idea');
}

function inferOneLineDishName(firstLine: string | undefined) {
  if (!firstLine || firstLine.includes('http')) {
    return null;
  }

  const beforeAmount = firstLine
    .split(/\b(?:\d+|one|two|three|four|half|quarter)\s*(?:cups?|tbsp|tsp|teaspoons?|tablespoons?|oz|ounces?|lb|pounds?|cloves?)?\b/i)[0]
    ?.trim();
  return trimInferredTitle(beforeAmount);
}

function trimInferredTitle(value: string | undefined) {
  const candidate = value
    ?.replace(/^recipe\s*:\s*/i, '')
    .split(/\b(?:cook|mix|stir|serve|until|with|add|heat|simmer|bake)\b/i)[0]
    ?.trim();

  if (!candidate || candidate.length < 4) {
    return null;
  }

  return cleanText(candidate.split(/\s+/).slice(0, 8).join(' '));
}

function inferIngredients(rawText: string): RecipeIngredient[] {
  const lines = rawText
    .split(/\n|,|;/)
    .map((line) => cleanText(line.replace(/^[-*•]\s*/, '')))
    .filter((line) => line.length > 1);
  const likelyIngredients = lines.filter((line) =>
    line.length <= 96 &&
    (
      amountPattern.test(line) ||
      pantryStapleNames.some((name) => line.toLowerCase().includes(name)) ||
      /\b(chicken|beef|tofu|rice|pasta|tomato|cheese|egg|onion|garlic|sauce|beans|greens|cream)\b/i.test(line)
    ),
  );
  const ingredients = uniqueIngredients([
    ...likelyIngredients.slice(0, 10).map(parseIngredientLine),
    ...inferCompactIngredients(rawText),
  ]);

  if (ingredients.length >= 4) {
    return ingredients;
  }

  return uniqueIngredients([
    ...ingredients,
    { name: 'main protein or vegetables', quantity: '2 cups', pantryItem: false },
    { name: 'sauce or seasoning', quantity: '2 tbsp', pantryItem: false },
    { name: 'olive oil', quantity: '1 tbsp', pantryItem: true },
    { name: 'salt and black pepper', quantity: 'pantry check', pantryItem: true },
  ]);
}

function inferCompactIngredients(rawText: string): RecipeIngredient[] {
  const text = rawText.toLowerCase();
  const ingredients: RecipeIngredient[] = [];
  addCompactIngredient(ingredients, text, /\b(\d+(?:\.\d+)?|one|two|three|four)\s+cups?\s+rice\b/i, 'rice');
  addCompactIngredient(ingredients, text, /\b(\d+(?:\.\d+)?|one|two|three|four)\s+chicken thighs?\b/i, 'chicken thighs');
  addCompactIngredient(ingredients, text, /\b(\d+(?:\.\d+)?|one|two|three|four)\s+chicken breasts?\b/i, 'chicken breast');
  addCompactIngredient(ingredients, text, /\bcucumber\b/i, 'cucumber');
  addCompactIngredient(ingredients, text, /\bsoy sauce\b/i, 'soy sauce');
  addCompactIngredient(ingredients, text, /\bhoney\b/i, 'honey');
  addCompactIngredient(ingredients, text, /\bgarlic\b/i, 'garlic');
  addCompactIngredient(ingredients, text, /\bspicy mayo\b/i, 'spicy mayo');
  return ingredients;
}

function addCompactIngredient(
  ingredients: RecipeIngredient[],
  text: string,
  pattern: RegExp,
  name: string,
) {
  const match = text.match(pattern);
  if (!match) {
    return;
  }
  ingredients.push({
    name,
    quantity: match[1] ? match[1] : 'to check',
    pantryItem: pantryStapleNames.some((staple) => name.includes(staple)) || name === 'soy sauce' || name === 'honey' || name === 'garlic',
  });
}

function parseIngredientLine(line: string): RecipeIngredient {
  const cleaned = cleanText(line.replace(/^ingredients?:?/i, ''));
  const amount = cleaned.match(/^((?:\d+\/\d+|\d+(?:\.\d+)?|one|two|three|half|quarter)\s*(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|cloves?)?)/i);
  const quantity = amount?.[1]?.trim() ?? (pantryStapleNames.some((name) => cleaned.toLowerCase().includes(name)) ? 'pantry check' : 'to check');
  const name = amount ? cleaned.slice(amount[0].length).trim() : cleaned;
  return {
    name: cleanText(name || cleaned),
    quantity,
    pantryItem: pantryStapleNames.some((staple) => cleaned.toLowerCase().includes(staple)),
  };
}

function inferSteps(rawText: string, title: string) {
  const stepLines = rawText
    .split(/\n+/)
    .map((line) => cleanText(line.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '')))
    .filter((line) => /\b(cook|mix|stir|bake|blend|heat|simmer|serve|chop|slice|add|toss)\b/i.test(line));

  if (stepLines.length >= 3) {
    return stepLines.slice(0, 8);
  }

  return [
    `Set out the ingredients for ${title} and measure anything with a clear amount.`,
    'Prep the vegetables, protein, sauce, and pantry staples before the pan gets hot.',
    'Cook the main ingredients over medium heat until hot and visibly browned or softened.',
    'Add sauce, seasoning, or finishing ingredients in small amounts, then taste and adjust.',
    'Serve while hot and note what you would change next time.',
  ];
}

function inferTotalTime(rawText: string, ingredientCount: number) {
  const timeMatch = rawText.match(/(\d{1,3})\s*(?:min|mins|minutes)/i);
  if (timeMatch) {
    return clamp(Number(timeMatch[1]), 12, 95);
  }
  return clamp(18 + ingredientCount * 2, 20, 55);
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

function estimateCost(ingredients: RecipeIngredient[]) {
  const nonPantryCount = ingredients.filter((ingredient) => !ingredient.pantryItem).length;
  return Math.max(4.5, Math.round((3.25 + nonPantryCount * 1.35) * 100) / 100);
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

function inferCategory(name: string): NonNullable<Recipe['groceryItems']>[number]['category'] {
  const lower = name.toLowerCase();
  if (/\b(chicken|beef|tofu|pork|shrimp|egg)\b/.test(lower)) return 'Protein';
  if (/\b(tomato|onion|garlic|greens|pepper|lemon|lime|herb)\b/.test(lower)) return 'Produce';
  if (/\b(cheese|cream|milk|butter|yogurt)\b/.test(lower)) return 'Dairy';
  if (/\b(rice|pasta|noodle|grain)\b/.test(lower)) return 'Noodles / Grains';
  if (/\b(sauce|oil|vinegar|mayo|mustard)\b/.test(lower)) return 'Sauces / Condiments';
  return 'Pantry';
}

function getStepTitle(step: string, index: number) {
  if (index === 0) return 'Set up';
  if (/\bserve|finish|top\b/i.test(step)) return 'Finish';
  if (/\bcook|heat|simmer|bake\b/i.test(step)) return 'Cook';
  return 'Build flavor';
}

function uniqueIngredients(ingredients: RecipeIngredient[]) {
  const seen = new Set<string>();
  return ingredients.filter((ingredient) => {
    const key = ingredient.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function normalizeIdeaText(value: string) {
  return value.trim().slice(0, maxStoredIdeaTextLength);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'idea';
}

function hashIdeaKey(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
