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
 */
export function calculateNutritionTargets(profile: NutritionProfile, calculatedAt = new Date().toISOString()): NutritionTargets | null {
  if (!validProfile(profile)) return null;

  const sexAdjustment = profile.biologicalSex === 'male' ? 5 : profile.biologicalSex === 'female' ? -161 : -78;
  const bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.ageYears) + sexAdjustment;
  const tdee = bmr * activityMultipliers[profile.activityLevel];
  const goalAdjustment = profile.goal === 'lose_fat'
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
