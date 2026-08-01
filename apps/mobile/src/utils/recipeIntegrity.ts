import type { Recipe, RecipeStep } from '../mocks';
import { normalizeNutritionEstimate } from './nutrition';

const MAX_RECIPE_MINUTES = 720;
const COOKING_PATTERN = /\b(bake|boil|broil|cook|fry|grill|heat|roast|sauté|saute|sear|simmer|steam|toast)\b/i;
const NO_COOK_PATTERN = /\b(no[- ]cook|smoothie|fruit bowl|yogurt bowl|snack plate)\b/i;
const PIZZA_PATTERN = /\bpizza\b/i;
const passivePattern = /\b(refrigerate|chill|chilling|rest|rise|proof|proofing|marinate|marinating|soak|soaking|stand|standing|cool|cooling|let\s+(?:it|them|the\s+\w+)\s+\w+|between)\b/i;
const unattendedCookingPattern = /\b(?:bake|baking|roast|roasting|preheat|preheating|simmer|simmering)\b/i;
const supervisedCookingPattern = /\b(?:rotat(?:e|ing)|turn(?:ing)?|stir(?:ring)?|bast(?:e|ing)|brush(?:ing)|check(?:ing)?)\b/i;

export function normalizeRecipeForCanonicalStorage<T extends Recipe>(recipe: T): T | null {
  if (!isPositiveFinite(recipe.servings) || recipe.servings > 50) {
    return null;
  }

  const nutritionEstimate = normalizeNutritionEstimate(recipe.nutritionEstimate);
  if (!nutritionEstimate) {
    return null;
  }

  return {
    ...recipe,
    ...normalizeRecipeTime(recipe),
    nutritionEstimate,
  };
}

export function normalizeRecipeTime(
  recipe: Pick<
    Recipe,
    | 'title'
    | 'ingredients'
    | 'steps'
    | 'structuredSteps'
    | 'equipment'
    | 'prepTimeMinutes'
    | 'cookTimeMinutes'
    | 'totalTimeMinutes'
  >,
) {
  const recipeText = [
    recipe.title,
    ...(recipe.steps ?? []),
    ...(recipe.equipment ?? []),
  ].join(' ');
  const reportedPrep = getBoundedNonnegative(recipe.prepTimeMinutes);
  const reportedCook = getBoundedNonnegative(recipe.cookTimeMinutes);
  const reportedTotal = getBoundedPositive(recipe.totalTimeMinutes);
  const stepMinutes = getGuidedStepMinutes(recipe);
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  const stepCount = Array.isArray(recipe.steps) ? recipe.steps.length : 0;
  const explicitlyNoCook = NO_COOK_PATTERN.test(recipeText);
  const cookingSearchText = explicitlyNoCook ? recipeText.replace(NO_COOK_PATTERN, '') : recipeText;
  const hasCooking = COOKING_PATTERN.test(cookingSearchText) || (reportedCook ?? 0) > 0;
  const isGenuinelyNoCook = !hasCooking && explicitlyNoCook;

  if (hasCooking) {
    const minimumCook = PIZZA_PATTERN.test(recipeText) ? 12 : 5;
    const prepTimeMinutes = reportedPrep ??
      Math.max(3, Math.min(15, Math.ceil(Math.max(ingredientCount, 1) / 2)));
    const cookTimeMinutes = Math.max(reportedCook ?? 0, minimumCook);
    const totalTimeMinutes = Math.min(
      MAX_RECIPE_MINUTES,
      Math.max(reportedTotal ?? 0, prepTimeMinutes + cookTimeMinutes, stepMinutes),
    );

    return { prepTimeMinutes, cookTimeMinutes, totalTimeMinutes };
  }

  if (isGenuinelyNoCook) {
    const prepTimeMinutes = reportedPrep ??
      reportedTotal ??
      Math.max(1, Math.ceil(Math.max(ingredientCount, 1) / 3));
    const totalTimeMinutes = Math.min(
      MAX_RECIPE_MINUTES,
      Math.max(1, reportedTotal ?? 0, prepTimeMinutes, stepMinutes),
    );
    return { prepTimeMinutes, cookTimeMinutes: 0, totalTimeMinutes };
  }

  const prepTimeMinutes = reportedPrep ??
    reportedTotal ??
    Math.max(3, Math.min(30, Math.max(Math.ceil(ingredientCount / 2), stepCount * 2)));
  const totalTimeMinutes = Math.min(
    MAX_RECIPE_MINUTES,
    Math.max(1, reportedTotal ?? 0, prepTimeMinutes, stepMinutes),
  );
  return { prepTimeMinutes, cookTimeMinutes: reportedCook ?? 0, totalTimeMinutes };
}

function getGuidedStepMinutes(recipe: Pick<Recipe, 'steps' | 'structuredSteps'>) {
  const structuredMinutes = (recipe.structuredSteps ?? []).reduce((total, step) => {
    const parsedMinutes = getStepElapsedMinutes(step.text, step.estimatedMinutes, step.timeEstimate) ?? 0;
    const minutes = Math.max(getBoundedPositive(step.elapsedMinutes) ?? 0, parsedMinutes);
    return total + (minutes ?? 0);
  }, 0);
  if (structuredMinutes > 0) {
    return Math.min(MAX_RECIPE_MINUTES, structuredMinutes);
  }

  return Math.min(
    MAX_RECIPE_MINUTES,
    (recipe.steps ?? []).reduce((total, step) => total + (parseMinuteEstimate(step) ?? 0), 0),
  );
}

export function getStepElapsedMinutes(text: string, estimatedMinutes?: number, timeEstimate?: string): number | null {
  return getRecipeStepTiming({ text, estimatedMinutes, timeEstimate }).elapsedMinutes || null;
}

export type RecipeStepTiming = {
  activeMinutes: number;
  passiveMinutes: number;
  elapsedMinutes: number;
  handsOnMinutes: number;
};

export type RecipeTimingSummary = {
  handsOnMinutes: number;
  waitingMinutes: number;
  totalMinutes: number;
};

export type RecipeStepTimingInput = Pick<RecipeStep, 'text' | 'activeMinutes' | 'passiveMinutes' | 'elapsedMinutes' | 'estimatedMinutes' | 'timeEstimate'>;

export function getRecipeStepTiming(step: RecipeStepTimingInput): RecipeStepTiming {
  const parsed = parseRecipeStepTiming(step.text, step.estimatedMinutes, step.timeEstimate);
  const hasStructuredTiming = Number.isFinite(step.activeMinutes) || Number.isFinite(step.passiveMinutes);
  const semanticallyUnattended = unattendedCookingPattern.test(step.text);
  const activeMinutes = semanticallyUnattended
    ? parsed.activeMinutes
    : hasStructuredTiming
    ? Math.max(0, Math.round(step.activeMinutes ?? parsed.activeMinutes))
    : parsed.activeMinutes;
  const passiveMinutes = semanticallyUnattended
    ? parsed.passiveMinutes
    : hasStructuredTiming
    ? Math.max(0, Math.round(step.passiveMinutes ?? parsed.passiveMinutes))
    : parsed.passiveMinutes;
  const combinedElapsed = passiveMinutes > 0 && activeMinutes <= 1
    ? passiveMinutes
    : activeMinutes + passiveMinutes;
  const elapsedMinutes = Math.max(1, Math.round(step.elapsedMinutes ?? parsed.elapsedMinutes), combinedElapsed);
  return {
    activeMinutes,
    passiveMinutes,
    elapsedMinutes,
    // A one-minute setup estimate on a waiting step is not meaningful hands-on work.
    handsOnMinutes: passiveMinutes > 0 && activeMinutes <= 1 ? 0 : activeMinutes,
  };
}

export function getRecipeTiming(recipe: Pick<Recipe, 'prepTimeMinutes' | 'cookTimeMinutes' | 'totalTimeMinutes' | 'steps' | 'structuredSteps'>): RecipeTimingSummary {
  const steps = Array.isArray(recipe.structuredSteps) && recipe.structuredSteps.length > 0
    ? recipe.structuredSteps
    : (recipe.steps ?? []).map((text) => ({ text }));
  const timings = steps.map((step) => getRecipeStepTiming(step));
  const handsOnMinutes = timings.reduce((sum, timing) => sum + timing.handsOnMinutes, 0);
  const waitingMinutes = timings.reduce((sum, timing) => sum + timing.passiveMinutes, 0);
  const sequentialTotal = timings.reduce((sum, timing) => sum + timing.elapsedMinutes, 0);
  const reportedTotal = Number.isFinite(recipe.totalTimeMinutes) ? recipe.totalTimeMinutes ?? 0 : 0;
  return {
    handsOnMinutes,
    waitingMinutes,
    totalMinutes: Math.max(1, reportedTotal, sequentialTotal, handsOnMinutes + waitingMinutes),
  };
}

export type RecipeStepTimingKind = 'hands-on' | 'waiting' | 'mixed';

export function classifyRecipeStepTiming(timing: RecipeStepTiming): RecipeStepTimingKind {
  if (timing.passiveMinutes > 0 && timing.handsOnMinutes > 0) return 'mixed';
  if (timing.passiveMinutes > 0) return 'waiting';
  return 'hands-on';
}

export function formatRecipeStepTiming(timing: RecipeStepTiming): string {
  const kind = classifyRecipeStepTiming(timing);
  if (kind === 'waiting') return `Waiting · ~${formatRecipeDuration(timing.elapsedMinutes)}`;
  if (kind === 'mixed') {
    return `Hands-on · ~${formatRecipeDuration(timing.handsOnMinutes)} · Waiting · ~${formatRecipeDuration(timing.passiveMinutes)}`;
  }
  return `Hands-on · ~${formatRecipeDuration(timing.handsOnMinutes || timing.elapsedMinutes)}`;
}

export function formatRecipeStepTimingLines(timing: RecipeStepTiming): string[] {
  const lines: string[] = [];
  if (timing.handsOnMinutes > 0) {
    lines.push(timing.passiveMinutes > 0
      ? `${formatRecipeDuration(timing.handsOnMinutes)} hands-on`
      : `About ${formatRecipeDuration(timing.handsOnMinutes)}`);
  }
  if (timing.passiveMinutes > 0) {
    lines.push(timing.handsOnMinutes > 0
      ? `${formatRecipeDuration(timing.passiveMinutes)} waiting`
      : `About ${formatRecipeDuration(timing.passiveMinutes)}`);
  }
  return lines.length > 0 ? lines : [`About ${formatRecipeDuration(timing.elapsedMinutes)}`];
}

function parseRecipeStepTiming(text: string, estimatedMinutes?: number, timeEstimate?: string): RecipeStepTiming {
  const sourceText = /\b\d+(?:\.\d+)?\s*(?:-|–|to)?\s*(?:\d+(?:\.\d+)?)?\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i.test(text)
    ? text
    : timeEstimate ?? '';
  const unattendedCooking = unattendedCookingPattern.test(sourceText);
  const supervisedCooking = supervisedCookingPattern.test(sourceText);
  const durations = [...sourceText.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(\d+(?:\.\d+)?)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi)]
    .map((match) => {
      const value = match[2] ? (Number(match[1]) + Number(match[2])) / 2 : Number(match[1]);
      const unit = match[3].toLowerCase();
      const clauseStart = Math.max(
        sourceText.lastIndexOf(',', match.index ?? 0),
        sourceText.lastIndexOf(';', match.index ?? 0),
        sourceText.lastIndexOf('\n', match.index ?? 0),
      ) + 1;
      const clause = sourceText.slice(clauseStart, (match.index ?? 0) + match[0].length);
      return {
        minutes: (unit.startsWith('hour') || unit.startsWith('hr')
          ? Math.round(value * 60)
          : unit.startsWith('second') || unit.startsWith('sec')
            ? Math.max(1, Math.round(value / 60))
            : Math.round(value)) * (/\bper\s+side\b/i.test(sourceText) ? 2 : 1),
        passive: passivePattern.test(clause) || unattendedCooking,
      };
    });
  if (durations.length === 0) {
    const fallback = getBoundedPositive(estimatedMinutes) ?? 1;
    return { activeMinutes: fallback, passiveMinutes: 0, elapsedMinutes: fallback, handsOnMinutes: fallback };
  }
  const lower = sourceText.toLowerCase();
  const repeatMatch = lower.match(/\brepeat(?:ing)?\s+(?:(?:this\s+process|for)\s+)?(twice|thrice|once|one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?:\s+more)?(?:\s+times?)?(?:\s+total\s+rounds?)?\b/i);
  const repeatValues: Record<string, number> = { once: 1, one: 1, twice: 2, two: 2, thrice: 3, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const repeat = repeatMatch
    ? (repeatValues[repeatMatch[1]] ?? Number(repeatMatch[1])) + (/\s+more\b/i.test(repeatMatch[0]) ? 1 : 0)
    : 1;
  const activeBase = durations.filter((duration) => !duration.passive).reduce((sum, duration) => sum + duration.minutes, 0);
  const passiveBase = durations.filter((duration) => duration.passive).reduce((sum, duration) => sum + duration.minutes, 0) * repeat;
  const activeMinutes = activeBase || (unattendedCooking && supervisedCooking && passiveBase > 0 ? Math.min(2, passiveBase) : 0);
  const passiveMinutes = unattendedCooking && supervisedCooking ? Math.max(0, passiveBase - activeMinutes) : passiveBase;
  const elapsedMinutes = passiveMinutes > 0 && activeMinutes === 0 ? passiveMinutes : activeMinutes + passiveMinutes;
  return {
    activeMinutes,
    passiveMinutes,
    elapsedMinutes: Math.min(MAX_RECIPE_MINUTES, Math.max(1, elapsedMinutes)),
    handsOnMinutes: passiveMinutes > 0 && activeMinutes <= 1 ? 0 : activeMinutes,
  };
}

export function formatRecipeDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours} hr` : `${hours} hr ${remaining} min`;
}

function parseMinuteEstimate(value: string | undefined) {
  const match = value?.match(/\b(\d{1,3})(?:\s*(?:-|–|to)\s*(\d{1,3}))?\s*(?:min|mins|minute|minutes)\b/i);
  if (!match) {
    return null;
  }

  const first = Number(match[1]);
  const second = match[2] ? Number(match[2]) : first;
  return getBoundedPositive(Math.round((first + second) / 2));
}

function getBoundedPositive(value: number | undefined) {
  return isPositiveFinite(value) && value <= MAX_RECIPE_MINUTES ? value : null;
}

function getBoundedNonnegative(value: number | undefined) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_RECIPE_MINUTES
    ? value
    : null;
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
