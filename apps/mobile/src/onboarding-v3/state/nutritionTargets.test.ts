import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateNutritionTargets, NUTRITION_CALCULATION_VERSION, type NutritionProfile } from './nutritionTargets';
import { emptyPersonalizedProfile, normalizePersonalizedProfile, setPersonalizedAnswer } from './personalizedOnboarding';

const baseProfile: NutritionProfile = {
  ageYears: 30,
  biologicalSex: 'male',
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'active',
  trainingDaysPerWeek: 4,
  goal: 'maintain',
  desiredRatePerWeek: null,
  proteinPreference: 'estimate',
  manualProteinTargetGrams: null,
};

test('Mifflin-St Jeor targets are deterministic, rounded, and labeled as estimates', () => {
  const first = calculateNutritionTargets(baseProfile, '2026-08-08T00:00:00.000Z');
  const second = calculateNutritionTargets(baseProfile, '2026-08-08T00:00:00.000Z');
  assert.deepEqual(first, second);
  assert.ok(first);
  assert.equal(first.source, 'estimated');
  assert.equal(first.calculationVersion, NUTRITION_CALCULATION_VERSION);
  assert.equal(first.calories % 25, 0);
  assert.equal(first.proteinGrams % 5, 0);
  assert.equal(first.carbsGrams % 5, 0);
  assert.equal(first.fatGrams % 5, 0);
});

test('goal adjustments remain conservative for fat loss and muscle gain', () => {
  const maintain = calculateNutritionTargets(baseProfile)!;
  const fatLoss = calculateNutritionTargets({ ...baseProfile, goal: 'lose_fat', desiredRatePerWeek: 'moderate' })!;
  const muscleGain = calculateNutritionTargets({ ...baseProfile, goal: 'build_muscle', desiredRatePerWeek: 'moderate' })!;
  assert.ok(fatLoss.calories < maintain.calories);
  assert.ok(muscleGain.calories > maintain.calories);
  assert.ok(fatLoss.calories >= 1500);
  assert.ok(muscleGain.calories <= 4200);
});

test('manual protein overrides the estimate without using an unsafe value', () => {
  const manual = calculateNutritionTargets({ ...baseProfile, proteinPreference: 'manual', manualProteinTargetGrams: 175 })!;
  assert.equal(manual.proteinGrams, 175);
  assert.equal(manual.source, 'manual_protein');
  const rejectedManualValue = calculateNutritionTargets({ ...baseProfile, proteinPreference: 'manual', manualProteinTargetGrams: 900 });
  assert.ok(rejectedManualValue);
  assert.equal(rejectedManualValue?.source, 'estimated');
});

test('missing and unreasonable inputs fail safely rather than creating a target', () => {
  assert.equal(calculateNutritionTargets({ ...baseProfile, ageYears: null }), null);
  assert.equal(calculateNutritionTargets({ ...baseProfile, heightCm: 90 }), null);
  assert.equal(calculateNutritionTargets({ ...baseProfile, weightKg: 500 }), null);
  assert.equal(calculateNutritionTargets({ ...baseProfile, activityLevel: null }), null);
  const unspecifiedSex = calculateNutritionTargets({ ...baseProfile, biologicalSex: 'prefer_not_to_say' });
  assert.ok(unspecifiedSex);
  assert.ok(unspecifiedSex!.calories >= 1200);
});

test('onboarding answers persist typed nutrition inputs and recalculate targets', () => {
  let profile = { ...emptyPersonalizedProfile, nutritionProfile: { ...emptyPersonalizedProfile.nutritionProfile } };
  for (const [key, value] of Object.entries({ macroGoal: 'Build muscle', ageYears: 28, heightCm: 178, weightKg: 75, biologicalSex: 'Male', activityLevel: 'Active', trainingDaysPerWeek: 4, desiredRatePerWeek: 'Slow' })) {
    profile = setPersonalizedAnswer(profile, key, value);
  }
  profile = setPersonalizedAnswer(profile, 'proteinTarget', 160);
  assert.equal(profile.nutritionProfile.goal, 'build_muscle');
  assert.equal(profile.nutritionProfile.trainingDaysPerWeek, 4);
  assert.equal(profile.nutritionTargets?.proteinGrams, 160);
  assert.equal(profile.nutritionTargets?.source, 'manual_protein');
});

test('legacy profiles safely migrate to the typed target model', () => {
  const profile = normalizePersonalizedProfile({
    name: 'Megan', primaryGoal: 'hit_macros', answers: { macroGoal: 'Maintain', ageYears: 32, heightCm: 168, weightKg: 64, biologicalSex: 'Female', activityLevel: 'Lightly active', trainingDaysPerWeek: 2, proteinTarget: 120 },
    dietaryRestrictions: ['Gluten-free'], dietaryOther: 'Olives',
  });
  assert.equal(profile.nutritionProfile.goal, 'maintain');
  assert.equal(profile.nutritionTargets?.proteinGrams, 120);
  assert.deepEqual(profile.dietaryPreferences.restrictions, ['Gluten-free']);
  assert.deepEqual(profile.dietaryPreferences.dislikes, ['Olives']);
});

test('a user-edited full target set survives resume without being recalculated', () => {
  const profile = normalizePersonalizedProfile({
    primaryGoal: 'hit_macros',
    answers: {
      macroGoal: 'Build muscle', ageYears: 28, heightCm: 178, weightKg: 75,
      biologicalSex: 'Male', activityLevel: 'Active', trainingDaysPerWeek: 4,
    },
    nutritionTargets: {
      calories: 2875, proteinGrams: 170, carbsGrams: 330, fatGrams: 85,
      source: 'manual', calculationVersion: NUTRITION_CALCULATION_VERSION,
      calculatedAt: '2026-08-08T00:00:00.000Z',
    },
  });

  assert.deepEqual(profile.nutritionTargets, {
    calories: 2875, proteinGrams: 170, carbsGrams: 330, fatGrams: 85,
    source: 'manual', calculationVersion: NUTRITION_CALCULATION_VERSION,
    calculatedAt: '2026-08-08T00:00:00.000Z',
  });
});
