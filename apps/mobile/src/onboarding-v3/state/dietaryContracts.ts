/**
 * Typed contracts for Step 06's dietary safety screen (Okyo_Onboarding_V4_Implementation_Plan.md).
 * Deliberately its own module, separate from the app's existing
 * `state/foodPreferences.ts` (which stays the canonical, four-group
 * allergies/restrictions/avoidances/dislikes shape and the reusable
 * `findFoodPreferenceConflicts`/allergen-matching engine — reused, not
 * rebuilt, for warnings). V4's own grouped screen only asks for the plan's
 * three groups (no "avoidances" group in V4); `onboardingV4CanonicalBridge.ts`
 * maps them onto the canonical shape without touching `avoidances`.
 */

export const DIETARY_ALLERGY_OPTIONS = [
  'Peanuts', 'Tree nuts', 'Shellfish', 'Fish', 'Milk', 'Egg', 'Wheat', 'Soy', 'Sesame',
] as const;
export type DietaryAllergyOption = (typeof DIETARY_ALLERGY_OPTIONS)[number];

export const DIETARY_RESTRICTION_OPTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Halal', 'Kosher',
] as const;
export type DietaryRestrictionOption = (typeof DIETARY_RESTRICTION_OPTIONS)[number];

/** Both groups support a free-text "Other" entry, validated the same way custom dislikes are. */
export const DIETARY_OTHER_OPTION = 'Other' as const;

export const DIETARY_CUSTOM_ENTRY_MAX_LENGTH = 40;
export const DIETARY_CUSTOM_ENTRY_MAX_COUNT = 15;

/**
 * Trims, collapses whitespace, drops empties, deduplicates case-insensitively,
 * and caps both entry length and list length. Applied to every custom
 * "Other" allergy/restriction entry and every dislike — the only free-text
 * surface this screen has.
 */
export function normalizeCustomDietaryEntries(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, DIETARY_CUSTOM_ENTRY_MAX_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= DIETARY_CUSTOM_ENTRY_MAX_COUNT) break;
  }
  return result;
}

export type DietarySafetyAnswers = {
  allergies: string[];
  restrictions: string[];
  dislikes: string[];
  /**
   * The one explicit global option. Mutually exclusive with every group —
   * enforced by the setter functions below, not left to callers to keep
   * consistent by convention.
   */
  noneOfThese: boolean;
  /**
   * Distinguishes "unanswered" from "answered none" (decision requirement).
   * Empty arrays alone are ambiguous — a fresh draft also has empty arrays.
   * Only an explicit Save sets this true.
   */
  completed: boolean;
};

export const emptyDietarySafetyAnswers: DietarySafetyAnswers = Object.freeze({
  allergies: [], restrictions: [], dislikes: [], noneOfThese: false, completed: false,
});

/**
 * Trims, collapses whitespace, and length-caps a single entry — the same
 * treatment `normalizeCustomDietaryEntries` gives dislikes, applied here to
 * one value at a time so canonical-option toggling (which calls these with
 * an exact `DIETARY_ALLERGY_OPTIONS`/`DIETARY_RESTRICTION_OPTIONS` string)
 * stays a harmless no-op while a typed custom "Other" entry gets the same
 * normalization dislikes already had. Dedup is case-insensitive against the
 * existing list so a custom "peanuts" can never sit alongside the canonical
 * "Peanuts" chip as two silently-different entries.
 */
function normalizeSingleDietaryEntry(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, DIETARY_CUSTOM_ENTRY_MAX_LENGTH);
}

/** Adding to any group clears `noneOfThese` — selecting a real restriction is incompatible with declaring none. */
export function addDietaryAllergy(answers: DietarySafetyAnswers, rawValue: string): DietarySafetyAnswers {
  const value = normalizeSingleDietaryEntry(rawValue);
  if (!value || answers.allergies.some((item) => item.toLowerCase() === value.toLowerCase())) return answers;
  if (answers.allergies.length >= DIETARY_CUSTOM_ENTRY_MAX_COUNT) return answers;
  return { ...answers, allergies: [...answers.allergies, value], noneOfThese: false };
}
export function removeDietaryAllergy(answers: DietarySafetyAnswers, value: string): DietarySafetyAnswers {
  return { ...answers, allergies: answers.allergies.filter((item) => item !== value) };
}
export function addDietaryRestriction(answers: DietarySafetyAnswers, rawValue: string): DietarySafetyAnswers {
  const value = normalizeSingleDietaryEntry(rawValue);
  if (!value || answers.restrictions.some((item) => item.toLowerCase() === value.toLowerCase())) return answers;
  if (answers.restrictions.length >= DIETARY_CUSTOM_ENTRY_MAX_COUNT) return answers;
  return { ...answers, restrictions: [...answers.restrictions, value], noneOfThese: false };
}
export function removeDietaryRestriction(answers: DietarySafetyAnswers, value: string): DietarySafetyAnswers {
  return { ...answers, restrictions: answers.restrictions.filter((item) => item !== value) };
}
export function setDietaryDislikes(answers: DietarySafetyAnswers, values: readonly string[]): DietarySafetyAnswers {
  const normalized = normalizeCustomDietaryEntries(values);
  return { ...answers, dislikes: normalized, noneOfThese: normalized.length > 0 ? false : answers.noneOfThese };
}

/**
 * Selecting "None of these" clears every group deterministically (a real
 * state transition, not a UI-only visual toggle) — this is what makes
 * `noneOfThese` and non-empty groups mutually exclusive by construction
 * rather than by convention.
 */
export function selectNoneOfTheseDietary(answers: DietarySafetyAnswers): DietarySafetyAnswers {
  return { ...emptyDietarySafetyAnswers, noneOfThese: true, completed: answers.completed };
}
export function deselectNoneOfTheseDietary(answers: DietarySafetyAnswers): DietarySafetyAnswers {
  return { ...answers, noneOfThese: false };
}

/** The explicit Save action — the only place `completed` becomes true. */
export function completeDietarySafety(answers: DietarySafetyAnswers): DietarySafetyAnswers {
  return { ...answers, completed: true };
}

export function isDietarySafetyAnswered(answers: DietarySafetyAnswers): boolean {
  return answers.noneOfThese || answers.allergies.length > 0 || answers.restrictions.length > 0 || answers.dislikes.length > 0;
}
