export type RecipeStepTime = {
  activeMinutes: number;
  passiveMinutes: number;
  elapsedMinutes: number;
};

const durationPattern = /\b(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(\d+(?:\.\d+)?)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi;
const passivePattern = /\b(?:refrigerate|chill|chilling|rest|rise|proof|proofing|marinate|marinating|soak|soaking|stand|standing|cool|cooling|let\s+(?:it|them|the\s+\w+)\s+\w+|between)\b/i;
const unattendedCookingPattern = /\b(?:bake|baking|roast|roasting|preheat|preheating|simmer|simmering)\b/i;
const supervisedCookingPattern = /\b(?:rotat(?:e|ing)|turn(?:ing)?|stir(?:ring)?|bast(?:e|ing)|brush(?:ing)?|check(?:ing)?)\b/i;
const repeatPattern = /\brepeat(?:ing)?\s+(?:(?:this\s+process|for)\s+)?(twice|thrice|once|one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?:\s+more)?(?:\s+times?)?(?:\s+total\s+rounds?)?\b/i;

const repeatNumbers: Record<string, number> = {
  once: 1, one: 1, twice: 2, two: 2, thrice: 3, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export function hasUnspecifiedPassiveWait(text: string): boolean {
  const match = text.match(/\b(?:chill(?:ing)?|refrigerat(?:e|ing)|rest|rise|proof(?:ing)?|marinat(?:e|ing)|soak(?:ing)?|stand|cool(?:ing)?)\b[^.;]*/i);
  if (!match || !/\b(?:between|fold|repeat)\b/i.test(match[0])) return false;
  durationPattern.lastIndex = 0;
  return !durationPattern.test(match[0]);
}

function getRepeatCount(text: string): number {
  const match = text.match(repeatPattern);
  if (!match) return 1;
  const occurrences = repeatNumbers[match[1].toLowerCase()] ?? Number(match[1]);
  return /\s+more\b/i.test(match[0]) ? occurrences + 1 : occurrences;
}

function toMinutes(value: number, unit: string): number {
  if (unit.startsWith('hour') || unit.startsWith('hr')) return value * 60;
  if (unit.startsWith('second') || unit.startsWith('sec')) return value / 60;
  return value;
}

function roundedDuration(first: string, second: string | undefined, unit: string): number {
  const value = second ? (Number(first) + Number(second)) / 2 : Number(first);
  return Math.max(1, Math.round(toMinutes(value, unit.toLowerCase())));
}

export function deriveRecipeStepTime(text: string, providedMinutes?: number): RecipeStepTime {
  const unattendedCooking = unattendedCookingPattern.test(text);
  const supervisedCooking = supervisedCookingPattern.test(text);
  const matches = [...text.matchAll(durationPattern)].map((match) => ({
    minutes: roundedDuration(match[1], match[2], match[3]) * (/\bper\s+side\b/i.test(text) ? 2 : 1),
    passive: passivePattern.test(text.slice(Math.max(0, (match.index ?? 0) - 55), (match.index ?? 0) + match[0].length)) || unattendedCooking,
  }));
  const repeatCount = getRepeatCount(text);
  const passiveBase = matches.filter((match) => match.passive).reduce((total, match) => total + match.minutes, 0);
  const passiveMinutes = passiveBase > 0 ? passiveBase * repeatCount : 0;
  const explicitActiveMinutes = matches.filter((match) => !match.passive).reduce((total, match) => total + match.minutes, 0) ||
    (unattendedCooking && supervisedCooking && passiveMinutes > 0 ? Math.min(2, passiveMinutes) : 0);
  const adjustedPassiveMinutes = unattendedCooking && supervisedCooking
    ? Math.max(0, passiveMinutes - explicitActiveMinutes)
    : passiveMinutes;
  const activeMinutes = explicitActiveMinutes > 0
    ? explicitActiveMinutes
    : adjustedPassiveMinutes > 0
      ? 0
      : Number.isFinite(providedMinutes) && (providedMinutes ?? 0) > 0
        ? Math.round(providedMinutes as number)
        : 1;
  const elapsedMinutes = adjustedPassiveMinutes > 0 && activeMinutes === 0
    ? adjustedPassiveMinutes
    : activeMinutes + adjustedPassiveMinutes;
  return { activeMinutes, passiveMinutes: adjustedPassiveMinutes, elapsedMinutes: Math.max(1, elapsedMinutes) };
}

export function deriveRecipeTimeline(steps: Array<{ text: string; estimatedMinutes?: number; activeMinutes?: number; passiveMinutes?: number; elapsedMinutes?: number }>) {
  const times = steps.map((step) => {
    const derived = deriveRecipeStepTime(step.text, step.estimatedMinutes);
    const hasStructuredTiming = Number.isFinite(step.activeMinutes) || Number.isFinite(step.passiveMinutes);
    if (!hasStructuredTiming) return derived;
    const activeMinutes = Math.max(0, Math.round(step.activeMinutes ?? derived.activeMinutes));
    const passiveMinutes = Math.max(0, Math.round(step.passiveMinutes ?? derived.passiveMinutes));
    const elapsedMinutes = Math.max(
      1,
      Math.round(step.elapsedMinutes ?? derived.elapsedMinutes),
      activeMinutes + passiveMinutes,
    );
    return { activeMinutes, passiveMinutes, elapsedMinutes };
  });
  return {
    times,
    activeMinutes: times.reduce((total, time) => total + time.activeMinutes, 0),
    passiveMinutes: times.reduce((total, time) => total + time.passiveMinutes, 0),
    elapsedMinutes: times.reduce((total, time) => total + time.elapsedMinutes, 0),
  };
}
