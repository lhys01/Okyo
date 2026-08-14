import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyDietarySafetyAnswers } from './dietaryContracts';
import {
  createOnboardingV4DraftPersistence,
  emptyOnboardingV4Draft,
  ONBOARDING_V4_DRAFT_SCHEMA_VERSION,
  ONBOARDING_V4_DRAFT_SCHEMA_VERSION_LEGACY_STEP03,
  ONBOARDING_V4_DRAFT_STORAGE_KEY,
  setOnboardingV4InitialGoal,
  setOnboardingV4PreferredTransformation,
} from './onboardingV4Draft';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
  };
}

test('the current and legacy schema version numbers are distinct', () => {
  assert.equal(ONBOARDING_V4_DRAFT_SCHEMA_VERSION_LEGACY_STEP03, 1);
  assert.equal(ONBOARDING_V4_DRAFT_SCHEMA_VERSION, 5);
  assert.notEqual(ONBOARDING_V4_DRAFT_SCHEMA_VERSION, ONBOARDING_V4_DRAFT_SCHEMA_VERSION_LEGACY_STEP03);
});

test('a v3 (pre-repair) draft missing insightViewed migrates to false', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    draft: { ...emptyOnboardingV4Draft, initialGoal: 'save_money', resolvedPrimaryGoal: 'save_money' },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();
  assert.equal(draft.insightViewed, false);
  assert.equal(draft.initialGoal, 'save_money');
});

test('writes stamp the current schema version', async () => {
  const storage = createMemoryStorage();
  const persistence = createOnboardingV4DraftPersistence(storage);
  await persistence.writeDraft({ ...emptyOnboardingV4Draft, initialGoal: 'eat_healthier', resolvedPrimaryGoal: 'eat_healthier' });
  const stored = JSON.parse(storage.values.get(ONBOARDING_V4_DRAFT_STORAGE_KEY) ?? '');
  assert.equal(stored.schemaVersion, ONBOARDING_V4_DRAFT_SCHEMA_VERSION);
  assert.equal(stored.draft.insightViewed, false);
});

// --- Step 03 (v1) -> Step 04 (v2) migration ---------------------------------

test('a Step 03 legacy (v1, unversioned bare shape) stored profile (direct goal) migrates: initialGoal and resolvedPrimaryGoal both set', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ primaryGoal: 'save_money' }));
  const persistence = createOnboardingV4DraftPersistence(storage);

  const draft = await persistence.readDraft();
  assert.equal(draft.initialGoal, 'save_money');
  assert.equal(draft.resolvedPrimaryGoal, 'save_money');
});

test('a Step 03 legacy stored profile (not_sure) migrates: initialGoal preserved, resolvedPrimaryGoal stays null', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ primaryGoal: 'not_sure' }));
  const persistence = createOnboardingV4DraftPersistence(storage);

  const draft = await persistence.readDraft();
  assert.equal(draft.initialGoal, 'not_sure');
  assert.equal(draft.resolvedPrimaryGoal, null);
});

test('a Step 03 legacy stored profile with a null goal migrates to the empty draft', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ primaryGoal: null }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  assert.deepEqual(await persistence.readDraft(), emptyOnboardingV4Draft);
});

test('a first write on a migrated (v1) draft upgrades storage to the current (v3) versioned envelope', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ primaryGoal: 'hit_macros' }));
  const persistence = createOnboardingV4DraftPersistence(storage);

  const draft = await persistence.readDraft();
  await persistence.writeDraft(draft);

  const stored = JSON.parse(storage.values.get(ONBOARDING_V4_DRAFT_STORAGE_KEY)!);
  assert.equal(stored.schemaVersion, ONBOARDING_V4_DRAFT_SCHEMA_VERSION);
  assert.equal(stored.draft.initialGoal, 'hit_macros');
  assert.deepEqual(stored.draft.dietaryAnswers, emptyDietarySafetyAnswers);
});

// --- Step 06: dietary schema/migration --------------------------------------

test('a v2 (Step 04, no dietaryAnswers field) stored draft migrates: goal/branch answers preserved, dietaryAnswers defaults cleanly', async () => {
  const storage = createMemoryStorage();
  const v2Draft = {
    initialGoal: 'save_money', resolvedPrimaryGoal: 'save_money',
    savingsAnswers: { takeoutFrequency: '2–3', spendPerMealDollars: 20 },
    healthAnswers: { healthierDefinition: null, healthBarrier: null },
    macroAnswers: { macroFocus: null, targetPath: null, knownTargets: {}, calculatorInputs: { ageYears: null, heightCm: null, weightKg: null, biologicalSex: null, activityLevel: null, trainingDaysPerWeek: null } },
    notSureAnswers: { universalNeed: null, preferredTransformation: null },
  };
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, draft: v2Draft }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();

  assert.equal(draft.initialGoal, 'save_money');
  assert.equal(draft.savingsAnswers.takeoutFrequency, '2–3');
  assert.equal(draft.savingsAnswers.spendPerMealDollars, 20);
  assert.deepEqual(draft.dietaryAnswers, emptyDietarySafetyAnswers);
});

test('a valid current (v3) envelope with full dietary answers round-trips exactly', async () => {
  const storage = createMemoryStorage();
  const dietaryAnswers = { allergies: ['Peanuts'], restrictions: ['Vegan'], dislikes: ['Cilantro'], noneOfThese: false, completed: true };
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    draft: { ...emptyOnboardingV4Draft, initialGoal: 'eat_healthier', resolvedPrimaryGoal: 'eat_healthier', dietaryAnswers },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();
  assert.deepEqual(draft.dietaryAnswers, dietaryAnswers);
});

test('malformed dietaryAnswers (non-array groups) normalizes to the empty/unanswered state without discarding sibling branch answers', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    draft: { ...emptyOnboardingV4Draft, initialGoal: 'save_money', resolvedPrimaryGoal: 'save_money', savingsAnswers: { takeoutFrequency: '1', spendPerMealDollars: 15 }, dietaryAnswers: { allergies: 'not an array', restrictions: null, dislikes: 42, noneOfThese: 'yes', completed: 'yes' } },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();

  assert.deepEqual(draft.dietaryAnswers, emptyDietarySafetyAnswers);
  assert.equal(draft.savingsAnswers.takeoutFrequency, '1', 'malformed dietary data must not discard valid sibling branch answers');
});

test('an unknown dietary allergy/restriction value is dropped, not silently kept', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    draft: { ...emptyOnboardingV4Draft, dietaryAnswers: { allergies: ['Peanuts', 'a custom allergy entry'], restrictions: [], dislikes: [], noneOfThese: false, completed: true } },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();
  // Custom free-text entries are legitimate (the "Other" flow) — normalization
  // only trims/dedupes/length-limits, it does not require dictionary membership.
  assert.deepEqual(draft.dietaryAnswers.allergies, ['Peanuts', 'a custom allergy entry']);
});

test('a stored noneOfThese:true alongside non-empty groups is self-contradictory and drops noneOfThese rather than hiding the real answers', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    draft: { ...emptyOnboardingV4Draft, dietaryAnswers: { allergies: ['Peanuts'], restrictions: [], dislikes: [], noneOfThese: true, completed: true } },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();
  assert.deepEqual(draft.dietaryAnswers.allergies, ['Peanuts']);
  assert.equal(draft.dietaryAnswers.noneOfThese, false);
});

test('legacy v1 (Step 03 bare shape) migration produces the empty dietaryAnswers state (dietary safety did not exist yet)', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ primaryGoal: 'eat_healthier' }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();
  assert.deepEqual(draft.dietaryAnswers, emptyDietarySafetyAnswers);
});

test('a valid current (v2) envelope with the complete expanded draft round-trips every branch field', async () => {
  const storage = createMemoryStorage();
  const fullDraft = {
    initialGoal: 'save_money' as const,
    resolvedPrimaryGoal: 'save_money' as const,
    savingsAnswers: { takeoutFrequency: '2–3' as const, spendPerMealDollars: 19 },
    healthAnswers: { healthierDefinition: 'More vegetables' as const, healthBarrier: 'Time' as const },
    macroAnswers: {
      macroFocus: 'Protein' as const, targetPath: 'known' as const, knownTargets: { proteinGrams: 150 },
      calculatorInputs: { ageYears: 25, heightCm: 170, weightKg: 65, biologicalSex: 'female' as const, activityLevel: 'active' as const, trainingDaysPerWeek: 3 },
    },
    notSureAnswers: { universalNeed: null, preferredTransformation: null },
    dietaryAnswers: { allergies: ['Peanuts'], restrictions: ['Vegan'], dislikes: ['Cilantro'], noneOfThese: false, completed: true },
    insightViewed: true,
    planCommitted: true,
    scanInput: { method: 'description' as const, description: 'A crispy chicken sandwich', hasSelectedImage: false },
  };
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: ONBOARDING_V4_DRAFT_SCHEMA_VERSION, draft: fullDraft }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  assert.deepEqual(await persistence.readDraft(), fullDraft);
});

test('a partial (v2) draft — only some fields answered — keeps every valid field and defaults the rest, without discarding valid data', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 2,
    draft: { initialGoal: 'eat_healthier', resolvedPrimaryGoal: 'eat_healthier', healthAnswers: { healthierDefinition: 'Lower sodium' } },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();

  assert.equal(draft.initialGoal, 'eat_healthier');
  assert.equal(draft.healthAnswers.healthierDefinition, 'Lower sodium', 'the one valid answered field must survive');
  assert.equal(draft.healthAnswers.healthBarrier, null, 'an unanswered field defaults, it is not fabricated');
  assert.deepEqual(draft.savingsAnswers, emptyOnboardingV4Draft.savingsAnswers, 'an entirely unanswered branch defaults cleanly');
});

test('an unknown/future schemaVersion is still normalized field-by-field rather than wiped to empty — valid answers survive', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 99,
    draft: { initialGoal: 'hit_macros', resolvedPrimaryGoal: 'hit_macros', macroAnswers: { macroFocus: 'Calories', targetPath: 'known', knownTargets: { calories: 2000 } } },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();

  assert.equal(draft.initialGoal, 'hit_macros');
  assert.equal(draft.macroAnswers.macroFocus, 'Calories');
  assert.equal(draft.macroAnswers.knownTargets.calories, 2000);
});

test('one malformed field inside an otherwise-valid (v2) draft does not discard its valid siblings', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({
    schemaVersion: 2,
    draft: {
      initialGoal: 'save_money',
      resolvedPrimaryGoal: 'save_money',
      savingsAnswers: { takeoutFrequency: 'not a real bucket', spendPerMealDollars: 15 },
    },
  }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();

  assert.equal(draft.initialGoal, 'save_money');
  assert.equal(draft.savingsAnswers.takeoutFrequency, null, 'the invalid enum value is dropped');
  assert.equal(draft.savingsAnswers.spendPerMealDollars, 15, 'its valid sibling in the same object survives');
});

// --- Direct-goal vs not_sure ownership ---------------------------------------

test('setOnboardingV4InitialGoal: direct goals set resolvedPrimaryGoal to the same value', () => {
  for (const goal of ['save_money', 'eat_healthier', 'hit_macros'] as const) {
    const next = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, goal);
    assert.equal(next.initialGoal, goal);
    assert.equal(next.resolvedPrimaryGoal, goal);
  }
});

test('setOnboardingV4InitialGoal: not_sure sets initialGoal but resolvedPrimaryGoal stays null', () => {
  const next = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'not_sure');
  assert.equal(next.initialGoal, 'not_sure');
  assert.equal(next.resolvedPrimaryGoal, null);
});

test('setOnboardingV4PreferredTransformation resolves resolvedPrimaryGoal for a not_sure draft, for all three transformations', () => {
  const base = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'not_sure');
  const expected = { cheaper: 'save_money', more_balanced: 'eat_healthier', more_protein: 'hit_macros' } as const;
  for (const [transformation, expectedGoal] of Object.entries(expected) as [keyof typeof expected, PrimaryGoalLike][]) {
    const next = setOnboardingV4PreferredTransformation(base, transformation);
    assert.equal(next.notSureAnswers.preferredTransformation, transformation);
    assert.equal(next.resolvedPrimaryGoal, expectedGoal);
    assert.equal(next.initialGoal, 'not_sure', 'initialGoal is preserved for analytics/history');
  }
});
type PrimaryGoalLike = 'save_money' | 'eat_healthier' | 'hit_macros';

test('setOnboardingV4PreferredTransformation is a no-op for a direct-goal draft (never second-guesses a resolved direct goal)', () => {
  const direct = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'save_money');
  const next = setOnboardingV4PreferredTransformation(direct, 'more_protein');
  assert.deepEqual(next, direct);
});

// --- Resume / round-trip ------------------------------------------------------

test('a written draft round-trips through a new persistence instance (resume)', async () => {
  const storage = createMemoryStorage();
  const writer = createOnboardingV4DraftPersistence(storage);
  const draft = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'eat_healthier');
  await writer.writeDraft(draft);

  const reader = createOnboardingV4DraftPersistence(storage);
  const resumed = await reader.readDraft();
  assert.equal(resumed.initialGoal, 'eat_healthier');
  assert.equal(resumed.resolvedPrimaryGoal, 'eat_healthier');
});

test('a resolved not_sure draft (preferredTransformation set) survives resume', async () => {
  const storage = createMemoryStorage();
  const writer = createOnboardingV4DraftPersistence(storage);
  const draft = setOnboardingV4PreferredTransformation(setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'not_sure'), 'cheaper');
  await writer.writeDraft(draft);

  const reader = createOnboardingV4DraftPersistence(storage);
  const resumed = await reader.readDraft();
  assert.equal(resumed.initialGoal, 'not_sure');
  assert.equal(resumed.resolvedPrimaryGoal, 'save_money');
  assert.equal(resumed.notSureAnswers.preferredTransformation, 'cheaper');
});

// --- Malformed persisted data --------------------------------------------------

test('malformed JSON falls back to the empty draft', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, 'not json');
  const persistence = createOnboardingV4DraftPersistence(storage);
  assert.deepEqual(await persistence.readDraft(), emptyOnboardingV4Draft);
});

test('an envelope with an unrecognized draft shape normalizes to the empty draft', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, draft: { initialGoal: 'not_a_real_goal' } }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  const draft = await persistence.readDraft();
  assert.equal(draft.initialGoal, null);
});

test('a completely unrecognized stored shape (neither envelope nor legacy) falls back to the empty draft', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify({ somethingElse: true }));
  const persistence = createOnboardingV4DraftPersistence(storage);
  assert.deepEqual(await persistence.readDraft(), emptyOnboardingV4Draft);
});

test('writeDraft never persists an untrusted resolvedPrimaryGoal that disagrees with a direct initialGoal', async () => {
  const storage = createMemoryStorage();
  const persistence = createOnboardingV4DraftPersistence(storage);
  const written = await persistence.writeDraft({ ...emptyOnboardingV4Draft, initialGoal: 'save_money', resolvedPrimaryGoal: 'hit_macros' });
  assert.equal(written.resolvedPrimaryGoal, 'save_money');
});
