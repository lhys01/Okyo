import { macroFocusToGoal } from './branchContracts';
import { calculateNutritionTargets } from './nutritionTargets';
import {
  emptyPersonalizedProfile,
  setDietaryPreferences,
  type PersonalizedOnboardingProfile,
} from './personalizedOnboarding';
import type { OnboardingV4Draft } from './onboardingV4Draft';

/**
 * Merges a resolved V4 draft (onboardingV4Draft.ts) into the app's one
 * canonical `PersonalizedOnboardingProfile` (personalizedOnboarding.ts,
 * Step 04's read-only reference) — this is the bridge that keeps the two
 * from becoming competing sources of truth. Pure function; the caller is
 * responsible for persisting the result via the existing
 * `onboardingV3Persistence.writePersonalizedProfile` (not this step's job —
 * see onboardingV4Draft.ts's completion-lifecycle TODO).
 *
 * Guarantees:
 * - Returns `canonical` completely unchanged if `resolvedPrimaryGoal` is
 *   still null (an unresolved `not_sure` draft is never merged).
 * - Only overwrites the specific sub-object keyed to the resolved branch
 *   (`savings` for save_money, `health` for eat_healthier, `nutritionProfile`/
 *   `nutritionTargets` for hit_macros) — every other field on `canonical`
 *   (name, the other two branch sub-objects, etc.) passes through untouched.
 * - Dietary (Step 06) merges independently of the branch, and only when
 *   `dietaryAnswers.completed` is true — an in-progress or never-reached
 *   dietary screen leaves `canonical.dietaryPreferences` exactly as it was.
 *   When completed with `noneOfThese`, the canonical groups are
 *   intentionally set to empty (not skipped) — reused via the existing
 *   `setDietaryPreferences`, which also keeps the legacy
 *   `dietaryRestrictions`/`dietaryOther` mirror fields in sync the same way
 *   V3's own dietary step already does. `avoidances` (a V3-only group V4
 *   doesn't collect) is preserved from canonical either way.
 */
export function mergeOnboardingV4DraftIntoCanonicalProfile(
  canonical: PersonalizedOnboardingProfile,
  draft: OnboardingV4Draft,
): PersonalizedOnboardingProfile {
  const goal = draft.resolvedPrimaryGoal;
  let merged: PersonalizedOnboardingProfile = goal
    ? { ...canonical, primaryGoal: goal, secondaryGoals: [...new Set([goal, ...canonical.secondaryGoals])] }
    : canonical;

  if (goal === 'save_money') {
    merged = {
      ...merged,
      savings: {
        ...merged.savings,
        takeoutFrequency: draft.savingsAnswers.takeoutFrequency ?? merged.savings.takeoutFrequency,
        spendPerMeal: draft.savingsAnswers.spendPerMealDollars ?? merged.savings.spendPerMeal,
      },
    };
  } else if (goal === 'eat_healthier') {
    const healthGoals = draft.healthAnswers.healthierDefinition
      ? [...new Set([...merged.health.healthGoals, draft.healthAnswers.healthierDefinition])]
      : merged.health.healthGoals;
    const healthChallenges = draft.healthAnswers.healthBarrier
      ? [...new Set([...merged.health.healthChallenges, draft.healthAnswers.healthBarrier])]
      : merged.health.healthChallenges;
    merged = { ...merged, health: { ...merged.health, healthGoals, healthChallenges } };
  } else if (goal === 'hit_macros') {
    const inputs = draft.macroAnswers.calculatorInputs;
    const nutritionProfile = {
      ...merged.nutritionProfile,
      ageYears: inputs.ageYears ?? merged.nutritionProfile.ageYears,
      heightCm: inputs.heightCm ?? merged.nutritionProfile.heightCm,
      weightKg: inputs.weightKg ?? merged.nutritionProfile.weightKg,
      biologicalSex: inputs.biologicalSex ?? merged.nutritionProfile.biologicalSex,
      activityLevel: inputs.activityLevel ?? merged.nutritionProfile.activityLevel,
      trainingDaysPerWeek: inputs.trainingDaysPerWeek ?? merged.nutritionProfile.trainingDaysPerWeek,
      goal: merged.nutritionProfile.goal ?? macroFocusToGoal(draft.macroAnswers.macroFocus),
      proteinPreference: merged.nutritionProfile.proteinPreference ?? 'estimate',
      isMinor: inputs.ageYears !== null && inputs.ageYears < 18,
    };
    merged = { ...merged, nutritionProfile, nutritionTargets: calculateNutritionTargets(nutritionProfile) ?? merged.nutritionTargets };
  }

  if (draft.dietaryAnswers.completed) {
    merged = setDietaryPreferences(merged, {
      allergies: draft.dietaryAnswers.allergies,
      restrictions: draft.dietaryAnswers.restrictions,
      avoidances: merged.dietaryPreferences.avoidances,
      dislikes: draft.dietaryAnswers.dislikes,
    });
  }

  return merged;
}

/** Convenience default for callers building a first-time canonical profile from a V4-only draft (e.g. tests). */
export function mergeOnboardingV4DraftIntoEmptyCanonicalProfile(draft: OnboardingV4Draft): PersonalizedOnboardingProfile {
  return mergeOnboardingV4DraftIntoCanonicalProfile({ ...emptyPersonalizedProfile }, draft);
}
