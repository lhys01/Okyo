import type { Recipe, RecipeIngredient, RecipeStep } from '../types.js';
import type { RecipeCheckRequest, RecipeQualityIssue, RecipeQualityReport, RecipeQualityStatus } from '../types/recipeQuality.js';
import { validateIngredientClosure } from './recipeIngredientValidation.js';

const vagueIngredientPatterns = [
  /\bsome\b/i,
  /\ba bit\b/i,
  /\bto taste\b/i,
  /\bas needed\b/i,
  /\bhandful\b/i,
  /\bfew\b/i,
];
const vagueIngredientNames = /^(the\s+)?(main ingredients?|protein|proteins|vegetables?|veggies|sauce|sauces|seasoning|seasonings|spice|spices|toppings?|ingredients|filling|stuff)$/i;
const amountPattern = /\b(\d+|one|two|three|four|half|quarter|cup|cups|tbsp|tsp|teaspoon|tablespoon|oz|ounce|lb|pound|pinch|dash|handful|clove|cloves|slice|slices|can|cans|packet|packets)\b/i;
const vagueStepPatterns = [
  /\bcook until done\b/i,
  /\bprepare(?: the)?(?: ingredients?)?\.?$/i,
  /\bmix everything\b/i,
  /\bseason(?: to taste)?\.?$/i,
  /\bheat\.?$/i,
  /\bserve\.?$/i,
  /\bcombine\.?$/i,
  /\bmake (?:the )?sauce\b/i,
  /\badd spices\b/i,
];
const pantryStaplePatterns = [
  /\bsalt\b/i,
  /\bpepper\b/i,
  /\boil\b/i,
  /\bolive oil\b/i,
  /\bbutter\b/i,
  /\bflour\b/i,
  /\bsugar\b/i,
  /\bgarlic powder\b/i,
  /\bonion powder\b/i,
  /\bpaprika\b/i,
  /\bchili flakes\b/i,
  /\bred pepper flakes\b/i,
  /\bvinegar\b/i,
  /\bsoy sauce\b/i,
  /\bdried herbs?\b/i,
  /\boregano\b/i,
  /\bbasil\b/i,
  /\bthyme\b/i,
  /\bcumin\b/i,
  /\bketchup\b/i,
  /\bmustard\b/i,
  /\bmayo\b/i,
  /\bmayonnaise\b/i,
  /\bhoney\b/i,
  /\bcornstarch\b/i,
  /\bbaking powder\b/i,
  /\bbaking soda\b/i,
];
const expensiveProteinPattern = /\b(chicken|beef|steak|salmon|shrimp|lamb|pork)\b/i;
const creamyRichPattern = /\b(cream|butter|cheese|mayo|mayonnaise|sour cream)\b/i;
const rawProteinPattern = /\b(raw )?(chicken|turkey|pork|fish|salmon|shrimp)\b/i;
const donenessCuePattern = /\b(165|145|opaque|no pink|golden|browned|firm|flakes?|internal temp|thermometer|crisp|tender)\b/i;

type NormalizedIngredient = {
  name: string;
  quantity: string;
  pantryItem?: boolean;
};

type NormalizedStep = {
  text: string;
  title?: string;
  doneWhen?: string;
  lookFor?: string;
  visualCue?: string;
  toolsUsed?: string[];
  ingredientsUsed?: string[];
};

export function buildRecipeQualityReport(
  recipe: Recipe,
  context?: RecipeCheckRequest['context'],
): RecipeQualityReport {
  const title = cleanText(readString((recipe as { title?: unknown }).title)) || 'This recipe';
  const ingredients = normalizeIngredients((recipe as { ingredients?: unknown }).ingredients);
  const plainSteps = normalizeTextList((recipe as { steps?: unknown }).steps);
  const structuredSteps = normalizeStructuredSteps((recipe as { structuredSteps?: unknown }).structuredSteps);
  const steps = mergeSteps(plainSteps, structuredSteps);
  const equipment = normalizeTextList((recipe as { equipment?: unknown }).equipment);
  const totalTime = readFiniteNumber((recipe as { totalTimeMinutes?: unknown }).totalTimeMinutes) ??
    sumNumbers(
      readFiniteNumber((recipe as { prepTimeMinutes?: unknown }).prepTimeMinutes),
      readFiniteNumber((recipe as { cookTimeMinutes?: unknown }).cookTimeMinutes),
    );

  const issues: RecipeQualityIssue[] = [];
  const missingIngredients = getMissingIngredients(ingredients);
  const missingSteps = getMissingSteps(steps);
  const vagueInstructions = getVagueInstructions(steps);
  const timeRealityCheck = getTimeRealityCheck(totalTime, ingredients.length, steps.length);
  const equipmentWarnings = getEquipmentWarnings(equipment, steps);
  const pantryStaples = getPantryStaples(ingredients);
  const closureWarnings = getIngredientClosureWarnings(ingredients, structuredSteps);
  const whatCouldGoWrong = getWhatCouldGoWrong({
    equipmentWarnings,
    ingredients,
    steps,
    vagueInstructions,
  });

  for (const detail of missingIngredients) {
    issues.push(buildIssue('missing-ingredient-detail', 'Clarify an ingredient', detail, 'warning'));
  }
  for (const detail of missingSteps) {
    issues.push(buildIssue('missing-step-detail', 'Add cooking detail', detail, 'warning'));
  }
  for (const detail of vagueInstructions) {
    issues.push(buildIssue('vague-instruction', 'Make a step clearer', detail, 'warning'));
  }
  for (const detail of equipmentWarnings) {
    issues.push(buildIssue('equipment-missing', 'Check equipment', detail, 'info'));
  }
  for (const detail of closureWarnings) {
    issues.push(buildIssue('step-ingredient-check', 'Match steps to ingredients', detail, 'fix'));
  }
  if (timeRealityCheck) {
    issues.push(buildIssue('time-reality-check', 'Check the timing', timeRealityCheck, 'info'));
  }

  const budgetIdeas = getBudgetIdeas(ingredients, pantryStaples);
  const speedIdeas = getSpeedIdeas(totalTime, ingredients.length, steps.length);
  const healthIdeas = getHealthIdeas(ingredients, context);
  const fixesApplied = getFixesApplied({
    closureWarnings,
    equipmentWarnings,
    pantryStaples,
    steps,
  });
  const issueWeight = missingIngredients.length * 10 +
    missingSteps.length * 12 +
    vagueInstructions.length * 8 +
    closureWarnings.length * 8 +
    equipmentWarnings.length * 4 +
    (timeRealityCheck ? 6 : 0);
  const score = clamp(Math.round(92 - issueWeight + Math.min(fixesApplied.length, 3) * 2), 0, 100);
  const status = getStatus(score);

  return {
    version: 1,
    status,
    score,
    confidence: getConfidence(recipe, ingredients, steps),
    summary: getSummary(status, title),
    issues: issues.slice(0, 8),
    fixesApplied,
    missingIngredients,
    missingSteps,
    vagueInstructions,
    ...(timeRealityCheck ? { timeRealityCheck } : {}),
    ...(context?.skillLevel ? { difficultyNote: getDifficultyNote(context.skillLevel, status) } : {}),
    pantryStaples,
    budgetIdeas,
    speedIdeas,
    healthIdeas,
    whatCouldGoWrong,
  };
}

function getMissingIngredients(ingredients: NormalizedIngredient[]): string[] {
  if (ingredients.length === 0) {
    return ['Add the core ingredients before cooking.'];
  }
  const missing = ingredients
    .filter((ingredient) => {
      const combined = `${ingredient.quantity} ${ingredient.name}`.trim();
      return !amountPattern.test(combined) || vagueIngredientPatterns.some((pattern) => pattern.test(combined)) || vagueIngredientNames.test(ingredient.name);
    })
    .map((ingredient) => `${ingredient.name || 'An ingredient'} needs a clearer amount.`)
    .slice(0, 4);
  if (ingredients.length < 4) {
    return ['A few core ingredients may be missing.', ...missing].slice(0, 4);
  }
  return missing;
}

function getMissingSteps(steps: NormalizedStep[]): string[] {
  if (steps.length === 0) {
    return ['Add step-by-step cooking instructions before relying on this recipe.'];
  }
  if (steps.length < 4) {
    return ['The method needs a little more step-by-step detail.'];
  }
  return [];
}

function getVagueInstructions(steps: NormalizedStep[]): string[] {
  return steps
    .filter((step) => {
      const text = step.text.trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      return vagueStepPatterns.some((pattern) => pattern.test(text)) || wordCount <= 3;
    })
    .map((step) => step.text)
    .slice(0, 4);
}

function getTimeRealityCheck(totalTime: number | null, ingredientCount: number, stepCount: number): string | undefined {
  if (!totalTime || totalTime <= 0) {
    return 'Timing is not called out clearly yet.';
  }
  const minimumLikelyTime = Math.max(12, ingredientCount * 2, stepCount * 3);
  if (totalTime < minimumLikelyTime) {
    return 'The timing looks optimistic for the amount of prep and cooking.';
  }
  return undefined;
}

function getEquipmentWarnings(equipment: string[], steps: NormalizedStep[]): string[] {
  const stepTools = steps.flatMap((step) => step.toolsUsed ?? []);
  if (equipment.length === 0 && stepTools.length === 0 && steps.length > 0) {
    return ['Equipment is not fully called out yet.'];
  }
  return [];
}

function getPantryStaples(ingredients: NormalizedIngredient[]): string[] {
  return unique(
    ingredients
      .filter((ingredient) => ingredient.pantryItem || pantryStaplePatterns.some((pattern) => pattern.test(`${ingredient.name} ${ingredient.quantity}`)))
      .map((ingredient) => ingredient.name),
  ).slice(0, 6);
}

function getIngredientClosureWarnings(
  ingredients: NormalizedIngredient[],
  structuredSteps: NormalizedStep[],
): string[] {
  if (ingredients.length === 0 || structuredSteps.length === 0) {
    return [];
  }

  const report = validateIngredientClosure({
    ingredients: ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      pantryItem: ingredient.pantryItem,
    })),
    structuredSteps: structuredSteps.map((step) => ({
      text: step.text,
      ingredientsUsed: step.ingredientsUsed,
      toolsUsed: step.toolsUsed,
    })),
    groceryItems: [],
  });

  return report.unknownStepIngredients
    .map((name) => `${name} is used in a step but is not clearly listed as an ingredient.`)
    .slice(0, 4);
}

function getBudgetIdeas(ingredients: NormalizedIngredient[], pantryStaples: string[]): string[] {
  const ideas = ['Check pantry staples before buying duplicates.'];
  if (ingredients.some((ingredient) => expensiveProteinPattern.test(ingredient.name))) {
    ideas.push('Use eggs, beans, tofu, or a smaller amount of protein to make it cheaper.');
  }
  if (pantryStaples.length > 0) {
    ideas.push(`You may already have ${pantryStaples.slice(0, 3).join(', ')}.`);
  }
  return unique(ideas).slice(0, 3);
}

function getSpeedIdeas(totalTime: number | null, ingredientCount: number, stepCount: number): string[] {
  const ideas: string[] = [];
  if ((totalTime ?? 0) > 30) {
    ideas.push('Use pre-chopped vegetables or a prepared sauce to save time.');
  }
  if (ingredientCount > 7 || stepCount > 6) {
    ideas.push('Group ingredients by step before turning on the heat.');
  }
  return (ideas.length > 0 ? ideas : ['Measure sauces and seasonings first so cooking moves quickly.']).slice(0, 3);
}

function getHealthIdeas(ingredients: NormalizedIngredient[], context?: RecipeCheckRequest['context']): string[] {
  const ideas = ['Add an easy vegetable or fresh herb if you want it more balanced.'];
  if (ingredients.some((ingredient) => creamyRichPattern.test(ingredient.name))) {
    ideas.push('Use a little less creamy ingredient and brighten with lemon or vinegar.');
  }
  if (context?.userGoal && /\bprotein|filling|full\b/i.test(context.userGoal)) {
    ideas.push('Add beans, eggs, tofu, or yogurt to make it more filling.');
  }
  return unique(ideas).slice(0, 3);
}

function getWhatCouldGoWrong(input: {
  equipmentWarnings: string[];
  ingredients: NormalizedIngredient[];
  steps: NormalizedStep[];
  vagueInstructions: string[];
}): string[] {
  const risks: string[] = [];
  if (input.vagueInstructions.length > 0) {
    risks.push('A vague step could leave you guessing mid-cook.');
  }
  if (input.equipmentWarnings.length > 0) {
    risks.push('You may need a pan, bowl, knife, or baking tray that is not listed.');
  }
  const hasRawProtein = input.ingredients.some((ingredient) => rawProteinPattern.test(ingredient.name));
  const hasDonenessCue = input.steps.some((step) => donenessCuePattern.test(`${step.text} ${step.doneWhen ?? ''} ${step.lookFor ?? ''} ${step.visualCue ?? ''}`));
  if (hasRawProtein && !hasDonenessCue) {
    risks.push('Raw protein needs a clear doneness cue before serving.');
  }
  return (risks.length > 0 ? risks : ['Biggest risk is over-seasoning at the end. Add small amounts and taste.']).slice(0, 4);
}

function getFixesApplied(input: {
  closureWarnings: string[];
  equipmentWarnings: string[];
  pantryStaples: string[];
  steps: NormalizedStep[];
}): string[] {
  const fixes = ['Separated likely pantry basics from shopping checks.'];
  if (input.steps.length > 0) {
    fixes.push('Checked the recipe for cookable step detail.');
  }
  if (input.pantryStaples.length > 0) {
    fixes.push('Flagged basic pantry staples.');
  }
  if (input.closureWarnings.length > 0 || input.equipmentWarnings.length > 0) {
    fixes.push('Marked unclear details to review before cooking.');
  }
  return unique(fixes).slice(0, 4);
}

function getDifficultyNote(skillLevel: string, status: RecipeQualityStatus): string {
  if (/beginner|easy/i.test(skillLevel) && (status === 'needs_attention' || status === 'risky')) {
    return 'Beginner cooks should fix the unclear details before starting.';
  }
  return 'Check the notes before cooking so the recipe matches your comfort level.';
}

function getStatus(score: number): RecipeQualityStatus {
  if (score >= 90) return 'great';
  if (score >= 78) return 'good';
  if (score >= 60) return 'needs_attention';
  return 'risky';
}

function getConfidence(recipe: Recipe, ingredients: NormalizedIngredient[], steps: NormalizedStep[]): RecipeQualityReport['confidence'] {
  if ((recipe as { isCompactRecipe?: unknown }).isCompactRecipe || ingredients.length < 4 || steps.length < 4) {
    return 'low';
  }
  if (ingredients.length >= 6 && steps.length >= 5) {
    return 'high';
  }
  return 'medium';
}

function getSummary(status: RecipeQualityStatus, title: string): string {
  switch (status) {
    case 'great':
      return `${title} looks cookable and well detailed.`;
    case 'good':
      return 'Looks cookable, with a few details to watch.';
    case 'needs_attention':
      return 'Okyo found a few gaps before cooking.';
    case 'risky':
      return 'This needs more detail before it is reliable.';
  }
}

function buildIssue(
  id: string,
  label: string,
  detail: string,
  severity: RecipeQualityIssue['severity'],
): RecipeQualityIssue {
  return {
    id,
    label,
    detail: cleanText(detail).slice(0, 220),
    severity,
  };
}

function normalizeIngredients(value: unknown): NormalizedIngredient[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((ingredient): NormalizedIngredient | null => {
      if (!ingredient || typeof ingredient !== 'object') return null;
      const record = ingredient as Record<string, unknown>;
      const name = cleanText(readString(record.name));
      if (!name) return null;
      const quantityParts = [
        readString(record.quantity),
        readString(record.amount),
        readString(record.unit),
      ].filter(Boolean);
      return {
        name,
        quantity: cleanText(quantityParts.join(' ')),
        pantryItem: typeof record.pantryItem === 'boolean' ? record.pantryItem : undefined,
      };
    })
    .filter((ingredient): ingredient is NormalizedIngredient => Boolean(ingredient));
}

function normalizeStructuredSteps(value: unknown): NormalizedStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step): NormalizedStep | null => {
      if (!step || typeof step !== 'object') return null;
      const record = step as Record<string, unknown>;
      const text = cleanText(readString(record.text) || readString(record.step) || readString(record.instruction));
      if (!text) return null;
      return {
        text,
        title: cleanText(readString(record.title)) || undefined,
        doneWhen: cleanText(readString(record.doneWhen)) || undefined,
        lookFor: cleanText(readString(record.lookFor)) || undefined,
        visualCue: cleanText(readString(record.visualCue)) || undefined,
        toolsUsed: normalizeTextList(record.toolsUsed ?? record.tools),
        ingredientsUsed: normalizeTextList(record.ingredientsUsed ?? record.ingredients),
      };
    })
    .filter((step): step is NormalizedStep => Boolean(step));
}

function mergeSteps(plainSteps: string[], structuredSteps: NormalizedStep[]): NormalizedStep[] {
  if (structuredSteps.length > 0) return structuredSteps;
  return plainSteps.map((text) => ({ text }));
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(readString).map(cleanText).filter(Boolean);
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sumNumbers(...values: Array<number | null>): number | null {
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return total > 0 ? total : null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
