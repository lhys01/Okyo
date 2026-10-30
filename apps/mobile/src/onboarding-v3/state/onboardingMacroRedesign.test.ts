import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildGoalContext } from './goalContext';
import { macroPreferenceRequestContext, normalizeOwnDailyReferences } from './macroPreferences';
import { emptyPersonalizedProfile, normalizePersonalizedProfile } from './personalizedOnboarding';
import { createOnboardingV4DraftPersistence } from './onboardingV4Draft';
import { initialOnboardingV4State, onboardingV4Reducer, resumeOnboardingV4Step } from './onboardingV4Reducer';
import { mergeOnboardingV4DraftIntoCanonicalProfile } from './onboardingV4CanonicalBridge';

function question() {
  let state = onboardingV4Reducer({ ...initialOnboardingV4State, step: 'primaryGoal' }, { type: 'GOAL_SELECTED', goal: 'hit_macros' });
  state = onboardingV4Reducer(state, { type: 'MACRO_FOCUS_ANSWERED', value: 'Protein' });
  return onboardingV4Reducer(state, { type: 'CONTINUE' });
}

test('simple and full detail reach the reveal without body data or another screen', () => {
  for (const value of ['simple', 'all'] as const) {
    const selected = onboardingV4Reducer(question(), { type: 'MACRO_DETAIL_SELECTED', value });
    const next = onboardingV4Reducer(selected, { type: 'CONTINUE' });
    assert.equal(next.step, 'personalInsight');
    assert.equal(next.draft.macroAnswers.calculatorInputs.ageYears, null);
    assert.equal(onboardingV4Reducer(next, { type: 'BACK' }).step, 'branchQ2');
    assert.equal(resumeOnboardingV4Step(next.draft), 'personalInsight');
  }
});

test('own targets expand in the same step and require protein, not calories', () => {
  const own = onboardingV4Reducer(question(), { type: 'MACRO_DETAIL_SELECTED', value: 'own' });
  assert.equal(onboardingV4Reducer(own, { type: 'CONTINUE' }), own);
  const entered = onboardingV4Reducer(own, { type: 'MACRO_KNOWN_TARGETS_ANSWERED', value: { proteinGrams: 120 } });
  assert.equal(entered.step, 'branchQ2');
  assert.equal(onboardingV4Reducer(entered, { type: 'CONTINUE' }).step, 'personalInsight');
  const switched = onboardingV4Reducer(entered, { type: 'MACRO_DETAIL_SELECTED', value: 'simple' });
  assert.deepEqual(switched.draft.macroAnswers.knownTargets, {});
});

test('entered references persist without synthesizing missing targets or body measurements', async () => {
  const own = onboardingV4Reducer(question(), { type: 'MACRO_DETAIL_SELECTED', value: 'own' });
  const entered = onboardingV4Reducer(own, { type: 'MACRO_KNOWN_TARGETS_ANSWERED', value: { proteinGrams: 120, calories: 2200 } });
  let raw: string | null = null;
  const store = createOnboardingV4DraftPersistence({ getItem: async () => raw, setItem: async (_key, value) => { raw = value; } });
  await store.writeDraft(entered.draft);
  const restored = await store.readDraft();
  assert.equal(restored.macroAnswers.detailPreference, 'own');
  assert.deepEqual(restored.macroAnswers.knownTargets, { proteinGrams: 120, calories: 2200 });
  const merged = normalizePersonalizedProfile(mergeOnboardingV4DraftIntoCanonicalProfile(emptyPersonalizedProfile, restored));
  assert.equal(merged.nutritionTargets, null);
  assert.equal(merged.nutritionProfile.ageYears, null);
  assert.deepEqual(merged.macroPreferences?.ownDailyReferences, { proteinGrams: 120, calories: 2200 });
  const context = buildGoalContext(merged);
  assert.match(context.trackingPreference!, /user-entered daily reference: 120g protein\/day, 2200 calories\/day/);
  assert.match(context.trackingPreference!, /not a per-meal target/);
  assert.equal(context.nutritionTargets, undefined);
  assert.ok(context.trackingPreference!.length <= 320);
});

test('reference validation rejects nonfinite and invalid values without replacing them with defaults', () => {
  for (const value of [-1, 0, NaN, Infinity, 401]) assert.deepEqual(normalizeOwnDailyReferences({ proteinGrams: value }), {});
  assert.deepEqual(normalizeOwnDailyReferences({ proteinGrams: 120, calories: 0 }), { proteinGrams: 120 });
  assert.deepEqual(normalizeOwnDailyReferences({ proteinGrams: 120, calories: 2200 }), { proteinGrams: 120, calories: 2200 });
});

test('switching a legacy own-target draft to the inline form retains its entered references', () => {
  const state = question();
  const legacy = { ...state, draft: { ...state.draft, macroAnswers: { ...state.draft.macroAnswers, targetPath: 'known' as const, knownTargets: { proteinGrams: 130, calories: 2300 } } } };
  const next = onboardingV4Reducer(legacy, { type: 'MACRO_DETAIL_SELECTED', value: 'own' });
  assert.deepEqual(next.draft.macroAnswers.knownTargets, { proteinGrams: 130, calories: 2300 });
});

test('own-reference setup does not replace existing Settings nutrition targets', () => {
  const own = onboardingV4Reducer(question(), { type: 'MACRO_DETAIL_SELECTED', value: 'own' });
  const entered = onboardingV4Reducer(own, { type: 'MACRO_KNOWN_TARGETS_ANSWERED', value: { proteinGrams: 120 } });
  const existing = { ...emptyPersonalizedProfile, nutritionTargets: { calories: 2500, proteinGrams: 160, carbsGrams: 280, fatGrams: 70, source: 'manual' as const, calculationVersion: 1 as const, calculatedAt: '2026-09-01T00:00:00.000Z' } };
  const merged = mergeOnboardingV4DraftIntoCanonicalProfile(existing, entered.draft);
  assert.equal(merged.nutritionTargets, existing.nutritionTargets);
  assert.deepEqual(normalizePersonalizedProfile(merged).nutritionTargets, existing.nutritionTargets);
  assert.equal(buildGoalContext(merged).nutritionTargets, undefined, 'generation must not receive conflicting old targets alongside explicit references');
});

test('the optional form is inline, keyboard-safe, and has no calculator or demographic fields', () => {
  const source = readFileSync(join(__dirname, '../screens-v4/MacroDetailScreen.tsx'), 'utf8');
  assert.match(source, /KeyboardAvoidingView/);
  assert.match(source, /<ScrollView/);
  assert.match(source, /own \? <View/);
  assert.match(source, /Okyo is not recommending targets/);
  assert.match(source, /reduceMotion \? 0 : 240/);
  assert.doesNotMatch(source, /calculateNutritionTargets|accessibilityLabel="(Height|Weight|Age|Sex)|maxFontSizeMultiplier/);
});

test('API nutrition-detail limits accept the full reference context on all generation entry points', () => {
  const api = readFileSync(join(__dirname, '../../../../api/src/server.ts'), 'utf8');
  assert.equal((api.match(/trackingPreference: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(320\)/g) ?? []).length, 3);
  const context = macroPreferenceRequestContext({ detail: 'own', focus: 'Performance/fueling', ownDailyReferences: { proteinGrams: 400, calories: 6000 } });
  assert.ok(context.length <= 320);
});
