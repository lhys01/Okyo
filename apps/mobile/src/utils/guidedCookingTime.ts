export function getRemainingGuidedCookingMinutes(
  stepMinutes: readonly (number | null | undefined)[],
  activeStepIndex: number,
  totalRecipeMinutes: number | null | undefined,
): number | null {
  const knownStepMinutes = stepMinutes.map(toKnownMinutes);
  const totalMinutes = toKnownMinutes(totalRecipeMinutes);
  if (totalMinutes === null && knownStepMinutes.every((minutes) => minutes === null)) {
    return null;
  }

  const safeIndex = Math.max(0, activeStepIndex);
  const completedMinutes = knownStepMinutes
    .slice(0, safeIndex)
    .reduce<number>((total, minutes) => total + (minutes ?? 0), 0);
  const remainingStepMinutes = knownStepMinutes
    .slice(safeIndex)
    .reduce<number>((total, minutes) => total + (minutes ?? 0), 0);
  const totalRemaining = totalMinutes === null ? 0 : Math.max(0, totalMinutes - completedMinutes);

  const remaining = Math.max(remainingStepMinutes, totalRemaining);
  return remaining > 0 ? remaining : null;
}

export function formatFinishByTime(now: number, remainingMinutes: number | null) {
  if (!Number.isFinite(now) || remainingMinutes === null || !Number.isFinite(remainingMinutes) || remainingMinutes < 0) {
    return 'Finish time unavailable';
  }

  const finishAt = new Date(now + Math.ceil(remainingMinutes) * 60_000);
  if (!Number.isFinite(finishAt.getTime())) {
    return 'Finish time unavailable';
  }
  const hours = finishAt.getHours() % 12 || 12;
  const minutes = String(finishAt.getMinutes()).padStart(2, '0');
  return `Finish by ${hours}:${minutes}`;
}

export function hasUsableRecipeTimingData(recipe: RecipeTimingData | null) {
  if (!recipe) return false;
  if ([recipe.totalTimeMinutes, recipe.prepTimeMinutes, recipe.cookTimeMinutes].some(isPositiveFinite)) return true;

  const steps = recipe.structuredSteps?.length
    ? recipe.structuredSteps
    : (recipe.steps ?? []).map((text) => typeof text === 'string' ? { text } : text);
  return steps.some((step) => (
    [step.estimatedMinutes, step.elapsedMinutes, step.activeMinutes, step.passiveMinutes].some(isPositiveFinite)
    || /\b\d+(?:\.\d+)?\s*(?:-|–|to)?\s*\d*(?:\.\d+)?\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i.test(`${step.text ?? ''} ${step.timeEstimate ?? ''}`)
  ));
}

type RecipeTimingStepData = {
  text?: string;
  estimatedMinutes?: number | null;
  elapsedMinutes?: number | null;
  activeMinutes?: number | null;
  passiveMinutes?: number | null;
  timeEstimate?: string | null;
};

type RecipeTimingData = {
  totalTimeMinutes?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  steps?: readonly (string | RecipeTimingStepData)[];
  structuredSteps?: readonly RecipeTimingStepData[];
};

function toKnownMinutes(value: number | null | undefined) {
  return isPositiveFinite(value) ? Math.ceil(value) : null;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
