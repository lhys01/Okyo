import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyOnboardingV4Draft, setOnboardingV4InitialGoal } from './onboardingV4Draft';
import { createOnboardingV4SetupCommitter } from './onboardingV4SetupCommit';
import { initialOnboardingV4State, onboardingV4Reducer, resumeOnboardingV4Step } from './onboardingV4Reducer';

const neutral = {
  ...emptyOnboardingV4Draft,
  initialGoal: 'not_sure' as const,
  dietaryAnswers: { ...emptyOnboardingV4Draft.dietaryAnswers, allergies: ['Peanuts'] },
};

test('setup writes dietary authority before profile and preserves a neutral goal', async () => {
  const order: string[] = [];
  const commit = createOnboardingV4SetupCommitter({
    saveDietary: async (answers) => {
      order.push('dietary');
      assert.deepEqual(answers.allergies, ['Peanuts']);
      return { status: 'success' };
    },
    commitProfile: async (draft) => {
      order.push('profile');
      assert.equal(draft.resolvedPrimaryGoal, null);
      assert.equal(draft.dietaryAnswers.completed, true);
      assert.deepEqual(draft.dietaryAnswers.allergies, ['Peanuts']);
    },
  });
  assert.deepEqual(await commit(neutral), { status: 'success' });
  assert.deepEqual(order, ['dietary', 'profile']);
  assert.equal(neutral.dietaryAnswers.completed, false, 'submitted draft is immutable');
});

test('unanswered safety cannot write either authority', async () => {
  const unexpected = async (): Promise<never> => { throw new Error('writer must not run'); };
  const commit = createOnboardingV4SetupCommitter({ saveDietary: unexpected, commitProfile: unexpected });
  const result = await commit({ ...neutral, dietaryAnswers: emptyOnboardingV4Draft.dietaryAnswers });
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.match(result.message, /Confirm/);
});

test('dietary failure never commits the profile', async () => {
  let profileWrites = 0;
  const error = { status: 'error' as const, recoverable: true, message: 'Please retry.' };
  const commit = createOnboardingV4SetupCommitter({
    saveDietary: async () => error,
    commitProfile: async () => { profileWrites += 1; },
  });
  assert.deepEqual(await commit(neutral), error);
  assert.equal(profileWrites, 0);
});

test('partial profile failure leaves the draft intact and can be retried', async () => {
  let attempts = 0;
  const commit = createOnboardingV4SetupCommitter({
    saveDietary: async () => ({ status: 'success' }),
    commitProfile: async () => { if (++attempts === 1) throw new Error('storage unavailable'); },
  });
  assert.equal((await commit(neutral)).status, 'error');
  assert.equal((await commit(neutral)).status, 'success');
  assert.deepEqual(neutral.dietaryAnswers.allergies, ['Peanuts']);
});

test('successful setup goes straight to input, including after resume', () => {
  for (const step of ['dietarySafety', 'plan'] as const) {
    const state = { ...initialOnboardingV4State, step, draft: neutral };
    const next = onboardingV4Reducer(state, { type: 'SETUP_COMMITTED', submittedDraft: neutral });
    assert.equal(next.step, 'scanEntry');
    assert.equal(next.draft.planCommitted, true);
    assert.equal(next.draft.dietaryAnswers.completed, true);
    assert.equal(resumeOnboardingV4Step(next.draft), 'scanEntry');
  }
});

test('late setup completion cannot advance changed answers or a departed screen', () => {
  const state = { ...initialOnboardingV4State, step: 'dietarySafety' as const, draft: neutral };
  assert.equal(onboardingV4Reducer(state, { type: 'SETUP_COMMITTED', submittedDraft: { ...neutral } }), state);
  const departed = { ...state, step: 'primaryGoal' as const };
  assert.equal(onboardingV4Reducer(departed, { type: 'SETUP_COMMITTED', submittedDraft: neutral }), departed);
});

test('quick start skips goal questions but never dietary safety', () => {
  const state = onboardingV4Reducer({ ...initialOnboardingV4State, step: 'promise' }, { type: 'QUICK_START' });
  assert.equal(state.step, 'dietarySafety');
  assert.equal(state.draft.initialGoal, 'not_sure');
  assert.equal(state.draft.resolvedPrimaryGoal, null);
  assert.equal(state.draft.dietaryAnswers.completed, false);
});

test('a historical recap resume supports editing allergies through the safety setters', () => {
  const state = { ...initialOnboardingV4State, step: 'plan' as const, draft: neutral };
  const next = onboardingV4Reducer(state, { type: 'DIETARY_ALLERGY_TOGGLED', value: 'Milk' });
  assert.equal(next.step, 'dietarySafety');
  assert.deepEqual(next.draft.dietaryAnswers.allergies, ['Peanuts', 'Milk']);
});

test('switching goals clears incompatible answers and setup status, not dietary safety', () => {
  const previous = {
    ...neutral,
    initialGoal: 'save_money' as const,
    resolvedPrimaryGoal: 'save_money' as const,
    savingsAnswers: { takeoutFrequency: '2–3' as const, spendPerMealDollars: 25 },
    planCommitted: true,
    insightViewed: true,
  };
  assert.equal(setOnboardingV4InitialGoal(previous, 'save_money'), previous, 'revisiting the same branch keeps its answers');
  const changed = setOnboardingV4InitialGoal(previous, 'eat_healthier');
  assert.equal(changed.savingsAnswers.spendPerMealDollars, null);
  assert.equal(changed.planCommitted, false);
  assert.equal(changed.insightViewed, false);
  assert.equal(changed.dietaryAnswers, previous.dietaryAnswers);
});
