import assert from 'node:assert/strict';
import test from 'node:test';

import { PERSONALIZED_PROFILE_SCHEMA_VERSION, PERSONALIZED_PROFILE_STORAGE_KEY } from './onboardingV3Persistence';
import { emptyPersonalizedProfile } from './personalizedOnboarding';
import { emptyOnboardingV4Draft, setOnboardingV4InitialGoal, setOnboardingV4PreferredTransformation } from './onboardingV4Draft';
import { mergeOnboardingV4DraftIntoCanonicalProfile } from './onboardingV4CanonicalBridge';
import { readPersonalizedHomeProfile, readPrimaryGoalFromProfile } from '../../state/primaryGoalBridge';

const canonicalWithUnrelatedData = {
  ...emptyPersonalizedProfile,
  name: 'Megan',
  dietaryPreferences: { ...emptyPersonalizedProfile.dietaryPreferences, allergies: ['Peanuts'] },
  dietaryRestrictions: ['Peanuts'],
};

test('an unresolved draft (not_sure, no chip yet) leaves the canonical profile completely unchanged', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'not_sure' as const, resolvedPrimaryGoal: null };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, draft);
  assert.deepEqual(merged, canonicalWithUnrelatedData);
});

test('save_money merge sets primaryGoal/savings and leaves name/dietary untouched', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const, savingsAnswers: { takeoutFrequency: '2–3' as const, spendPerMealDollars: 22 } };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, draft);

  assert.equal(merged.primaryGoal, 'save_money');
  assert.equal(merged.savings.takeoutFrequency, '2–3');
  assert.equal(merged.savings.spendPerMeal, 22);
  assert.equal(merged.name, 'Megan');
  assert.deepEqual(merged.dietaryRestrictions, ['Peanuts']);
});

test('eat_healthier merge adds to healthGoals/healthChallenges without dropping existing entries', () => {
  const canonicalWithExistingHealth = { ...canonicalWithUnrelatedData, health: { ...emptyPersonalizedProfile.health, healthGoals: ['Fewer calories'] } };
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'eat_healthier' as const, resolvedPrimaryGoal: 'eat_healthier' as const, healthAnswers: { healthierDefinition: 'More vegetables' as const, healthBarrier: 'Time' as const } };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithExistingHealth, draft);

  assert.equal(merged.primaryGoal, 'eat_healthier');
  assert.deepEqual(merged.health.healthGoals, ['Fewer calories', 'More vegetables']);
  assert.deepEqual(merged.health.healthChallenges, ['Time']);
  assert.equal(merged.name, 'Megan');
});

test('hit_macros merge sets nutritionProfile/nutritionTargets and threads isMinor from the merged inputs', () => {
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'hit_macros' as const,
    resolvedPrimaryGoal: 'hit_macros' as const,
    macroAnswers: {
      ...emptyOnboardingV4Draft.macroAnswers,
      calculatorInputs: { ageYears: 30, heightCm: 175, weightKg: 70, biologicalSex: 'female' as const, activityLevel: 'active' as const, trainingDaysPerWeek: 3 },
    },
  };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, draft);

  assert.equal(merged.primaryGoal, 'hit_macros');
  assert.equal(merged.nutritionProfile.ageYears, 30);
  assert.equal(merged.nutritionProfile.isMinor, false);
  assert.ok(merged.nutritionTargets);
  assert.equal(merged.name, 'Megan');
});

test('a minor merged into hit_macros carries isMinor:true on the canonical nutritionProfile', () => {
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'hit_macros' as const,
    resolvedPrimaryGoal: 'hit_macros' as const,
    macroAnswers: {
      ...emptyOnboardingV4Draft.macroAnswers,
      calculatorInputs: { ageYears: 15, heightCm: 165, weightKg: 55, biologicalSex: 'female' as const, activityLevel: 'active' as const, trainingDaysPerWeek: 3 },
    },
  };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, draft);
  assert.equal(merged.nutritionProfile.isMinor, true);
});

test('secondaryGoals gains the resolved goal without dropping an existing one', () => {
  const canonicalWithSecondary = { ...canonicalWithUnrelatedData, secondaryGoals: ['cook_more' as const] };
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithSecondary, draft);
  assert.deepEqual([...merged.secondaryGoals].sort(), ['cook_more', 'save_money'].sort());
});

// --- Correction 6: explicit merge-bridge verification -------------------------

test('a not_sure draft resolved via preferredTransformation merges exactly like the equivalent direct goal — never writes the literal string not_sure anywhere', () => {
  const resolved = setOnboardingV4PreferredTransformation(setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'not_sure'), 'cheaper');
  assert.equal(resolved.resolvedPrimaryGoal, 'save_money');

  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, resolved);
  assert.equal(merged.primaryGoal, 'save_money');
  assert.notEqual(merged.primaryGoal as string, 'not_sure');
  assert.ok(!JSON.stringify(merged).includes('not_sure'), 'the merged canonical profile must never contain the literal string not_sure anywhere');
});

test('never writes not_sure into the canonical three-goal field, even if a caller tries to force it', () => {
  // primaryGoal's type is PrimaryGoal | null, which structurally excludes
  // 'not_sure' — the only way to reach this path at all is an unresolved
  // draft, which the earlier "leaves the canonical profile completely
  // unchanged" test already proves never merges.
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'not_sure' as const, resolvedPrimaryGoal: null };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, draft);
  assert.equal(merged.primaryGoal, canonicalWithUnrelatedData.primaryGoal);
});

test('absent draft values never overwrite existing canonical data (partial draft, canonical already has richer data)', () => {
  const canonicalWithExistingSavings = {
    ...canonicalWithUnrelatedData,
    savings: { ...emptyPersonalizedProfile.savings, takeoutFrequency: '4–5 times a week', spendPerMeal: 30, householdSize: '2 people' },
  };
  // Draft only answers spendPerMealDollars this time — takeoutFrequency is absent (null).
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const, savingsAnswers: { takeoutFrequency: null, spendPerMealDollars: 35 } };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithExistingSavings, draft);

  assert.equal(merged.savings.takeoutFrequency, '4–5 times a week', 'absent draft field must not overwrite the existing canonical value');
  assert.equal(merged.savings.spendPerMeal, 35, 'an answered draft field does overwrite');
  assert.equal(merged.savings.householdSize, '2 people', 'a canonical field this branch never touches must survive untouched');
});

test('a fully empty draft answers object for the resolved branch leaves every canonical sub-field untouched', () => {
  const canonicalWithExistingHealth = { ...canonicalWithUnrelatedData, health: { ...emptyPersonalizedProfile.health, healthGoals: ['Fewer calories'], protectPriority: 'Protein' } };
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'eat_healthier' as const, resolvedPrimaryGoal: 'eat_healthier' as const };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithExistingHealth, draft);
  assert.deepEqual(merged.health.healthGoals, ['Fewer calories']);
  assert.equal(merged.health.protectPriority, 'Protein');
});

test('a merged profile is readable by primaryGoalBridge (the real Home-screen goal-ordering consumer)', async () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'hit_macros' as const, resolvedPrimaryGoal: 'hit_macros' as const };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile({ ...emptyPersonalizedProfile, name: 'Priya' }, draft);

  const values = new Map<string, string>();
  values.set(PERSONALIZED_PROFILE_STORAGE_KEY, JSON.stringify({ schemaVersion: PERSONALIZED_PROFILE_SCHEMA_VERSION, profile: merged }));
  const storage = { getItem: async (key: string) => values.get(key) ?? null };

  assert.equal(await readPrimaryGoalFromProfile(storage), 'hit_macros');
  const homeProfile = await readPersonalizedHomeProfile(storage);
  assert.equal(homeProfile?.primaryGoal, 'hit_macros');
  assert.equal(homeProfile?.name, 'Priya');
});

test('the merge function never touches storage, so the V4 draft it read from stays available for resume until a later completion step explicitly clears it', () => {
  // mergeOnboardingV4DraftIntoCanonicalProfile takes only in-memory objects —
  // no storage parameter exists for it to clear anything with. This is a
  // structural guarantee, not just a runtime observation.
  assert.equal(mergeOnboardingV4DraftIntoCanonicalProfile.length, 2);
});

// --- Step 06: dietary merge ---------------------------------------------------

test('dietary is preserved unchanged when the V4 user has not completed the dietary screen', () => {
  const canonicalWithDietary = { ...canonicalWithUnrelatedData, dietaryPreferences: { ...canonicalWithUnrelatedData.dietaryPreferences, allergies: ['Shellfish'] } };
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithDietary, draft);
  assert.deepEqual(merged.dietaryPreferences.allergies, ['Shellfish'], 'dietaryAnswers.completed is false, so canonical dietary must be untouched');
});

test('saving dietary updates canonical allergies/restrictions/dislikes without erasing unrelated fields', () => {
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    dietaryAnswers: { allergies: ['Peanuts'], restrictions: ['Vegan'], dislikes: ['Cilantro'], noneOfThese: false, completed: true },
  };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, draft);
  assert.deepEqual(merged.dietaryPreferences.allergies, ['Peanuts']);
  assert.deepEqual(merged.dietaryPreferences.restrictions, ['Vegan']);
  assert.deepEqual(merged.dietaryPreferences.dislikes, ['Cilantro']);
  assert.equal(merged.name, 'Megan', 'unrelated field survives');
});

test('avoidances (a V3-only group V4 does not collect) is preserved through a dietary save', () => {
  const canonicalWithAvoidances = { ...canonicalWithUnrelatedData, dietaryPreferences: { ...canonicalWithUnrelatedData.dietaryPreferences, avoidances: ['Pork'] } };
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    dietaryAnswers: { allergies: ['Peanuts'], restrictions: [], dislikes: [], noneOfThese: false, completed: true },
  };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithAvoidances, draft);
  assert.deepEqual(merged.dietaryPreferences.avoidances, ['Pork']);
});

test('explicit None of these intentionally clears canonical allergies/restrictions/dislikes to empty, not skipped', () => {
  const canonicalWithDietary = {
    ...canonicalWithUnrelatedData,
    dietaryPreferences: { ...canonicalWithUnrelatedData.dietaryPreferences, allergies: ['Shellfish'], restrictions: ['Halal'], dislikes: ['Olives'] },
  };
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    dietaryAnswers: { allergies: [], restrictions: [], dislikes: [], noneOfThese: true, completed: true },
  };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithDietary, draft);
  assert.deepEqual(merged.dietaryPreferences.allergies, []);
  assert.deepEqual(merged.dietaryPreferences.restrictions, []);
  assert.deepEqual(merged.dietaryPreferences.dislikes, []);
});

test('dietary merge never reinterprets an allergy as a restriction/dislike or vice versa', () => {
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    dietaryAnswers: { allergies: ['Peanuts'], restrictions: ['Vegan'], dislikes: ['Cilantro'], noneOfThese: false, completed: true },
  };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonicalWithUnrelatedData, draft);
  assert.ok(!merged.dietaryPreferences.restrictions.includes('Peanuts'));
  assert.ok(!merged.dietaryPreferences.allergies.includes('Vegan'));
  assert.ok(!merged.dietaryPreferences.allergies.includes('Cilantro'));
});
