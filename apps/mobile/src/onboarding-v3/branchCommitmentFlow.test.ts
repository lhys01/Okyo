import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { initialOnboardingV3State, onboardingV3Reducer } from './controller/onboardingV3Machine';
import { usesFoodFirstMacros } from './state/macrosFoodFirst';

const root = __dirname;
const signature = readFileSync(join(root, 'screens', 'BranchSignatureCommitmentScreen.tsx'), 'utf8');
const account = readFileSync(join(root, 'screens', 'BranchAccountScreen.tsx'), 'utf8');
const route = readFileSync(join(root, 'OnboardingV3.tsx'), 'utf8');
const savings = readFileSync(join(root, 'screens', 'SaveMoneyBranchScreen.tsx'), 'utf8');

test('new Health and Macros entrants use the same plan route after their questions', () => {
  for (const goal of ['eat_healthier', 'hit_macros'] as const) {
    let state = onboardingV3Reducer({ ...initialOnboardingV3State, step: 'primaryGoal' }, { type: 'PRIMARY_GOAL_SELECTED', goal });
    assert.equal(usesFoodFirstMacros(state.profile), goal === 'hit_macros');
    assert.equal(state.step, 'branchIntro');
    state = { ...state, step: 'branchIntro' };
    if (goal === 'hit_macros') {
      for (const [key, value] of Object.entries({ macrosFocus: 'Protein', macrosObstacle: 'Boring meals', macrosTargetMode: 'known', macrosOwnTargets: 'yes', macrosDailyProtein: 120, macrosDailyCalories: 2200 })) {
        state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key, value });
      }
    }
    const profile = state.profile;
    state = onboardingV3Reducer(state, { type: 'BRANCH_PLAN_READY' });
    assert.equal(state.step, 'branchPlan', `${goal} must accept the shared plan event`);
    assert.equal(state.profile, profile);
    // A repeated branch completion cannot skip the plan.
    assert.equal(onboardingV3Reducer(state, { type: 'BRANCH_PLAN_READY' }), state);
    state = onboardingV3Reducer(state, { type: 'CONTINUE' });
    assert.equal(state.step, 'branchSignature');
    state = onboardingV3Reducer(state, { type: 'BRANCH_SIGNATURE_COMPLETED' });
    assert.equal(state.step, 'branchAccount');
    state = onboardingV3Reducer(state, { type: 'BACK' });
    assert.equal(state.step, 'branchSignature');
    state = onboardingV3Reducer(state, { type: 'BACK' });
    assert.equal(state.step, 'branchPlan');
    state = onboardingV3Reducer(state, { type: 'BACK' });
    assert.equal(state.step, 'branchIntro');
    state = onboardingV3Reducer(state, { type: 'BRANCH_PLAN_READY' });
    assert.equal(state.step, 'branchPlan');
    assert.equal(state.profile, profile);
  }
});

test('a restored food-first Macros plan still accepts the signature handoff', () => {
  const selected = onboardingV3Reducer({ ...initialOnboardingV3State, step: 'primaryGoal' }, { type: 'PRIMARY_GOAL_SELECTED', goal: 'hit_macros' });
  let state = onboardingV3Reducer(initialOnboardingV3State, { type: 'HYDRATE', profile: selected.profile, resumeStep: 'branchIntro', mascotName: 'Kiko', attribution: null });
  state = onboardingV3Reducer(state, { type: 'SPLASH_FINISHED', elapsedMs: 1200, fontsLoaded: true });
  assert.equal(state.step, 'branchIntro');
  const planStep = onboardingV3Reducer(state, { type: 'BRANCH_PLAN_READY' });
  assert.equal(planStep.step, 'branchPlan');
  assert.equal(onboardingV3Reducer(planStep, { type: 'CONTINUE' }).step, 'branchSignature');
  assert.equal(onboardingV3Reducer({ ...state, step: 'question1' }, { type: 'BRANCH_PLAN_READY' }).step, 'question1');
});

test('each branch routes final plan to signature, account, then the app terminal state', () => {
  for (const primaryGoal of ['eat_healthier', 'save_money', 'hit_macros'] as const) {
    const profile = { ...initialOnboardingV3State.profile, name: 'Megan', age: 32, primaryGoal, secondaryGoals: [primaryGoal], answers: { commitment: 'signed' } };
    const base = { ...initialOnboardingV3State, step: 'branchIntro' as const, profile };
    const planStep = onboardingV3Reducer(base, { type: 'BRANCH_PLAN_READY' });
    assert.equal(planStep.step, 'branchPlan');
    const signatureStep = onboardingV3Reducer(planStep, { type: 'CONTINUE' });
    assert.equal(signatureStep.step, 'branchSignature');
    assert.equal(onboardingV3Reducer(signatureStep, { type: 'BACK' }).step, 'branchPlan');
    assert.equal(onboardingV3Reducer(planStep, { type: 'BACK' }).step, 'branchIntro');
    const postSignature = onboardingV3Reducer(signatureStep, { type: 'BRANCH_SIGNATURE_COMPLETED' });
    assert.equal(postSignature.step, 'branchAccount');
    const accountStep = postSignature;
    assert.equal(accountStep.step, 'branchAccount');
    assert.equal(onboardingV3Reducer(accountStep, { type: 'BACK' }).step, 'branchSignature');
    const completed = onboardingV3Reducer(accountStep, { type: 'BRANCH_ACCOUNT_COMPLETED' });
    assert.equal(completed.step, 'complete');
    assert.deepEqual(completed.profile, profile);
  }
});

test('signature is branch-aware, uses the account CTA for Health, and unavailable providers do not get demo controls', () => {
  assert.doesNotMatch(signature, /eat_healthier:\s*\{[^}]*label:/);
  for (const copy of ['Draw your signature here', 'Clear signature', 'Create an account', 'Continue to your account', 'NavArrowLeft']) assert.match(signature, new RegExp(copy));
  const signIn = readFileSync(join(root, '..', 'auth', 'SignInScreen.tsx'), 'utf8');
  assert.match(signIn, /<NavArrowLeft color=\{colors\.ink\} height=\{25\} strokeWidth=\{2\.35\} width=\{25\} \/>/);
  assert.doesNotMatch(signIn, /backText|marginTop: -6/);
  assert.match(signIn, /back: \{[^}]*alignItems: 'center'[^}]*justifyContent: 'center'/);
  assert.doesNotMatch(signature, /Macros Made|Health Made|Savings Made|details\.label|label:/);
  assert.match(signature, /isValidSignature/);
  assert.match(signature, /branchCommitmentPersistence/);
  assert.match(account, /if \(!clerkAvailable\) onDone\(\)/);
  assert.doesNotMatch(account, /continueWithDemoSignIn|Continue with Apple|Continue with Google|Continue with Email/);
  assert.match(account, /SignInScreen/);
});

test('real account creation only mounts the configured Clerk sign-in flow', () => {
  assert.match(account, /if \(!clerkAvailable\) onDone\(\)/);
  assert.match(account, /allowSkip=\{false\}/);
  assert.match(account, /isClerkAvailable/);
  assert.match(account, /<SignInScreen/);
});

test('the final Savings plan precedes a clean signature screen without an automatic completion replay', () => {
  assert.match(savings, /assignedDraft\.branchCompleted \? \{ \.\.\.assignedDraft, branchCompleted: false, currentStep: 'reveal' \} : assignedDraft/);
  assert.doesNotMatch(savings, /state\.branchCompleted && state\.currentStep === 'complete'/);
  assert.match(signature, /fox-sleeping\.png/);
  assert.doesNotMatch(signature, /Sign below to make your savings plan personal/);
});

test('signature responders copy touch coordinates before state updates and guard an incomplete route', () => {
  assert.match(signature, /const point = pointFromTouchEvent\(event, canvasRef\.current\);/);
  assert.doesNotMatch(signature, /setDrawing\(\(current\) => .*event\.nativeEvent/);
  assert.match(signature, /onPanResponderRelease: \(\) => undefined/);
  assert.match(signature, /resizeSignatureCanvas\(current, height \/ width\)/);
  assert.match(signature, /pointerEvents="none"/);
  assert.match(route, /isCommitmentBranch\(state\.profile\?\.primaryGoal\)/);
  assert.match(route, /<BranchRouteFallback \/>/);
});
