import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGoalContext } from './goalContext';
import { createOnboardingV4DraftPersistence, emptyOnboardingV4Draft, ONBOARDING_V4_DRAFT_STORAGE_KEY } from './onboardingV4Draft';
import { initialOnboardingV4State, onboardingV4Reducer, resumeOnboardingV4Step } from './onboardingV4Reducer';
import { mergeOnboardingV4DraftIntoEmptyCanonicalProfile } from './onboardingV4CanonicalBridge';
import { buildOnboardingReveal } from '../screens-v4/onboardingRevealContent';

function priorityState() {
  const selected = onboardingV4Reducer({ ...initialOnboardingV4State, step: 'primaryGoal' }, { type: 'GOAL_SELECTED', goal: 'save_money' });
  return onboardingV4Reducer(selected, { type: 'SAVINGS_PRIORITY_ANSWERED', value: 'Quick & easy' });
}

test('money priority reaches the real API goal context, not just reveal copy', () => {
  const state = priorityState();
  const canonical = mergeOnboardingV4DraftIntoEmptyCanonicalProfile(state.draft);
  assert.equal(buildGoalContext(canonical).cookingPriority, 'Quick & easy');
  assert.equal(state.draft.savingsAnswers.spendPerMealDollars, null);
  assert.equal(onboardingV4Reducer(state, { type: 'CONTINUE' }).step, 'branchQ2');
});

test('optional comparison skip persists as skipped without invented cost or frequency', async () => {
  const question = onboardingV4Reducer(priorityState(), { type: 'CONTINUE' });
  const skipped = onboardingV4Reducer(question, { type: 'SAVINGS_COMPARISON_SKIPPED' });
  assert.equal(skipped.step, 'personalInsight');
  assert.equal(skipped.draft.savingsAnswers.comparisonStatus, 'skipped');
  assert.equal(skipped.draft.savingsAnswers.spendPerMealDollars, null);
  assert.equal(skipped.draft.savingsAnswers.takeoutFrequency, null);
  let saved: string | null = null;
  const persistence = createOnboardingV4DraftPersistence({ getItem: async () => saved, setItem: async (_key, value) => { saved = value; } });
  await persistence.writeDraft(skipped.draft);
  const restored = await persistence.readDraft();
  assert.equal(restored.savingsAnswers.comparisonStatus, 'skipped');
  assert.equal(resumeOnboardingV4Step(restored), 'personalInsight');
  assert.equal(restored.savingsAnswers.replacementsPerWeek, undefined);
});

test('confirmed comparison is explicit, bounded, and distinct from eating-out frequency', () => {
  const question = onboardingV4Reducer(priorityState(), { type: 'CONTINUE' });
  const confirmed = onboardingV4Reducer(question, { type: 'SAVINGS_COMPARISON_CONFIRMED', cost: 18, replacementsPerWeek: 2 });
  assert.equal(confirmed.step, 'personalInsight');
  assert.equal(confirmed.draft.savingsAnswers.takeoutFrequency, null);
  assert.equal(confirmed.draft.savingsAnswers.spendPerMealDollars, 18);
  const content = buildOnboardingReveal(confirmed.draft);
  assert.equal(content.kind, 'money');
  if (content.kind === 'money') assert.equal(content.replacementNote, '2 meals/week to compare');
  for (const cost of [NaN, Infinity, -1, 0, 201]) {
    assert.equal(onboardingV4Reducer(question, { type: 'SAVINGS_COMPARISON_CONFIRMED', cost, replacementsPerWeek: 1 }), question);
  }
  for (const replacementsPerWeek of [0, -1, 1.5, 15, Infinity]) {
    assert.equal(onboardingV4Reducer(question, { type: 'SAVINGS_COMPARISON_CONFIRMED', cost: 18, replacementsPerWeek }), question);
  }
});

test('a version-five answered draft resumes without inventing the new priority', async () => {
  const raw = JSON.stringify({ schemaVersion: 5, draft: { ...emptyOnboardingV4Draft, initialGoal: 'save_money', resolvedPrimaryGoal: 'save_money', savingsAnswers: { takeoutFrequency: '2–3', spendPerMealDollars: 20 } } });
  const persistence = createOnboardingV4DraftPersistence({ getItem: async (key) => key === ONBOARDING_V4_DRAFT_STORAGE_KEY ? raw : null, setItem: async () => undefined });
  const draft = await persistence.readDraft();
  assert.equal(draft.savingsAnswers.cookingPriority, undefined);
  assert.equal(draft.savingsAnswers.replacementsPerWeek, undefined);
  assert.equal(draft.savingsAnswers.spendPerMealDollars, 20);
  assert.equal(resumeOnboardingV4Step(draft), 'personalInsight');
});
