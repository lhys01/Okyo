export const NUTRITION_CALCULATION_VERSION = 1 as const;

export type BiologicalSexForEstimate = 'female' | 'male' | 'prefer_not_to_say';
export type ActivityLevel = 'mostly_sitting' | 'lightly_active' | 'active' | 'very_active';
export type MacroGoal = 'lose_fat' | 'maintain' | 'build_muscle' | 'improve_performance' | 'hit_protein';
export type GoalRate = 'slow' | 'moderate' | null;
export type ProteinPreference = 'estimate' | 'manual';

export type NutritionProfile = {
  ageYears: number | null;
  biologicalSex: BiologicalSexForEstimate | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  trainingDaysPerWeek: number | null;
  goal: MacroGoal | null;
  desiredRatePerWeek: GoalRate;
  proteinPreference: ProteinPreference | null;
  manualProteinTargetGrams: number | null;
  /**
   * Okyo_Onboarding_V4_Implementation_Plan.md decision #21 / Step 04: a user
   * under 18 must never receive an automatically generated calorie deficit or
   * weight-loss target. Optional (defaults to false when omitted) so every
   * existing `NutritionProfile` literal in this repo stays valid — the real
   * safety gate in `calculateNutritionTargets` below also independently
   * derives minor status from `ageYears < 18`, so this flag being left unset
   * can never itself cause an unsafe result; it only lets a caller mark
   * minor status explicitly ahead of having a numeric age (e.g. V4's
   * `resolveMacroGuidance` in branchContracts.ts, Step 04).
   */
  isMinor?: boolean;
};

export type NutritionTargets = {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  source: 'estimated' | 'manual_protein' | 'manual';
  calculationVersion: typeof NUTRITION_CALCULATION_VERSION;
  calculatedAt: string;
};

export const emptyNutritionProfile: NutritionProfile = Object.freeze({
  ageYears: null,
  biologicalSex: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  trainingDaysPerWeek: null,
  goal: null,
  desiredRatePerWeek: null,
  proteinPreference: null,
  manualProteinTargetGrams: null,
});

const activityMultipliers: Record<ActivityLevel, number> = {
  mostly_sitting: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
};

function rounded(value: number, increment = 5): number {
  return Math.round(value / increment) * increment;
}

function validProfile(profile: NutritionProfile): profile is NutritionProfile & {
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: MacroGoal;
} {
  return Boolean(
    profile.ageYears && profile.ageYears >= 13 && profile.ageYears <= 100
    && profile.heightCm && profile.heightCm >= 120 && profile.heightCm <= 230
    && profile.weightKg && profile.weightKg >= 35 && profile.weightKg <= 300
    && profile.activityLevel && profile.goal,
  );
}

/**
 * Produces conservative starting estimates, not medical guidance. The caller
 * should let people edit every target after this calculation.
 *
 * SAFETY EXCEPTION (Okyo_Onboarding_V4_Implementation_Plan.md decision #21 /
 * Step 04): every other line of this function is unchanged V3 behavior — the
 * one deliberate change is the `isMinor` branch immediately below, added
 * specifically to close a latent gap: before this change, ANY caller
 * (including existing V3 screens, e.g. `PersonalizedOnboardingScreen.tsx`'s
 * `hit_macros` branch, whose own question flow only validates `ageYears`
 * between 13–100 with no adult-only gate) could receive a real calorie
 * deficit/surplus for a 13–17-year-old. This is a safety fix layered onto
 * existing math, not a scope change to it — never a deficit/surplus target
 * for a minor, no matter what `goal`/`desiredRatePerWeek` request. Derived
 * from `ageYears` independently of the `isMinor` flag so it can't be
 * bypassed by a caller simply leaving the flag unset. `validProfile` above
 * already guarantees `ageYears` is a finite number here.
 */
export function calculateNutritionTargets(profile: NutritionProfile, calculatedAt = new Date().toISOString()): NutritionTargets | null {
  if (!validProfile(profile)) return null;

  const isMinor = profile.isMinor === true || profile.ageYears < 18;

  const sexAdjustment = profile.biologicalSex === 'male' ? 5 : profile.biologicalSex === 'female' ? -161 : -78;
  const bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.ageYears) + sexAdjustment;
  const tdee = bmr * activityMultipliers[profile.activityLevel];
  const goalAdjustment = isMinor ? 0 : profile.goal === 'lose_fat'
    ? profile.desiredRatePerWeek === 'moderate' ? -400 : -250
    : profile.goal === 'build_muscle'
      ? profile.desiredRatePerWeek === 'moderate' ? 250 : 150
      : 0;
  const calorieFloor = profile.biologicalSex === 'male' ? 1500 : 1200;
  const calories = rounded(Math.max(calorieFloor, Math.min(4200, tdee + goalAdjustment)), 25);
  const proteinPerKg = profile.goal === 'lose_fat' ? 1.8 : profile.goal === 'maintain' ? 1.6 : 1.8;
  const estimatedProtein = rounded(Math.max(45, Math.min(profile.weightKg * 2.2, profile.weightKg * proteinPerKg)));
  const manualProtein = profile.proteinPreference === 'manual'
    && profile.manualProteinTargetGrams !== null
    && profile.manualProteinTargetGrams >= 40
    && profile.manualProteinTargetGrams <= 350
    ? profile.manualProteinTargetGrams
    : null;
  const hasValidManualProtein = manualProtein !== null;
  const proteinGrams = manualProtein !== null ? rounded(manualProtein) : estimatedProtein;
  const fatGrams = rounded(Math.max(profile.weightKg * 0.6, (calories * 0.25) / 9));
  const carbsGrams = rounded(Math.max(0, (calories - proteinGrams * 4 - fatGrams * 9) / 4));

  return {
    calories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    source: hasValidManualProtein ? 'manual_protein' : 'estimated',
    calculationVersion: NUTRITION_CALCULATION_VERSION,
    calculatedAt,
  };
}
