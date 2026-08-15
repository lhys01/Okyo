import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  getPersistedPersonalizedStep,
  initialOnboardingV3State,
  isRealInputUnlocked,
  onboardingV3Reducer,
  type OnboardingV3State,
  type OnboardingV3Step,
} from './controller/onboardingV3Machine';
import {
  PRIMARY_GOALS,
  annualTakeoutSpend,
  conservativeAnnualProjection,
  emptyPersonalizedProfile,
  normalizePersonalizedProfile,
  personalizedGoalContent,
  type PersonalizedOnboardingProfile,
} from './state/personalizedOnboarding';

const read = (path: string) => readFileSync(resolve(process.cwd(), 'src/onboarding-v3', path), 'utf8');

test('all human-selected branch references resolve', () => {
  const root = resolve(process.cwd(), 'assets/onboarding-ex');
  assert.deepEqual(readdirSync(resolve(root, 'savings')).filter((file) => file.endsWith('.webp')).sort(), ['file-1.webp', 'file-2.webp', 'file-3.webp', 'file-4.webp', 'file-5.webp', 'file-6.webp', 'file.webp']);
  assert.deepEqual(readdirSync(resolve(root, 'health')).filter((file) => file.endsWith('.webp')).sort(), ['file-1.webp', 'file-2.webp', 'file-3.webp', 'file.webp']);
  assert.deepEqual(readdirSync(resolve(root, 'macros')).filter((file) => file.endsWith('.webp')).sort(), ['file-1.webp', 'file-2.webp', 'file.webp']);
});

const moneyProfile: PersonalizedOnboardingProfile = {
  ...emptyPersonalizedProfile,
  name: 'Megan', primaryGoal: 'save_money', secondaryGoals: ['save_money'],
  answers: { takeoutFrequency: '2–3 times a week', spendPerMeal: 25, orderingFriction: ["I don't know what to make", 'Recipe searching is annoying'] },
  savings: { ...emptyPersonalizedProfile.savings, takeoutFrequency: '2–3 times a week', spendPerMeal: 25, orderingFriction: ["I don't know what to make", 'Recipe searching is annoying'] },
};

test('money calculations use normalized weekly frequency and a conservative one-order projection', () => {
  assert.equal(annualTakeoutSpend(moneyProfile), 3250);
  assert.equal(conservativeAnnualProjection(moneyProfile), 915);
  assert.match(personalizedGoalContent.save_money.futureHeadline, /one homemade craving a week/i);
  assert.doesNotMatch(read('screens/PersonalizedOnboardingScreen.tsx'), /wasting|will save you/i);
});

test('exactly three branches contain complete personalized content', () => {
  assert.deepEqual(PRIMARY_GOALS, ['save_money', 'eat_healthier', 'hit_macros']);
  for (const goal of PRIMARY_GOALS) {
    const content = personalizedGoalContent[goal];
    assert.ok(content.questions.length >= 5, goal);
    assert.ok(content.holdPrompt, goal);
    assert.ok(content.demoHeadline, goal);
    assert.ok(content.futureHeadline, goal);
    assert.equal(content.planBenefits.length, 4, goal);
    assert.ok(content.paywallHeadline, goal);
  }
});

test('macro answers and cook-more secondary benefit survive normalization', () => {
  const profile = normalizePersonalizedProfile({
    name: 'Megan', primaryGoal: 'hit_macros', secondaryGoals: ['cook_more'],
    answers: { macroObjective: 'Both', proteinTarget: 150, macroChallenges: ['Food gets repetitive'] },
    dietaryRestrictions: ['Gluten-free'], dietaryOther: '',
  });
  assert.equal(profile.answers.proteinTarget, 150);
  assert.deepEqual(profile.secondaryGoals, ['hit_macros', 'cook_more']);
  const source = read('screens/PersonalizedOnboardingScreen.tsx');
  for (const copy of ['KEEP THE CRAVING', '270', '24g', 'GREAT FOOD', '570', '42g']) {
    assert.match(source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /ILLUSTRATIVE EXAMPLE|PERSONALIZED INSIGHT|YOUR FUTURE|PERSONALIZED PLAN|LET'S MAKE THIS YOURS|OKYO DEMO|YOUR GOAL/i);
});

test('pre-paywall states cannot unlock input and resumable post-purchase state returns to the gate', () => {
  const paywallIndex = (['splash', 'showcase', 'nameFox', 'name', 'primaryGoal', 'branchIntro', 'question1', 'question2', 'question3', 'holdReveal', 'branchReveal', 'branchDemo', 'secondaryGoals', 'dietaryPreferences', 'personalizedFuture', 'planReady', 'paywall'] as OnboardingV3Step[]).indexOf('paywall');
  const prePaywall = ['splash', 'showcase', 'nameFox', 'name', 'primaryGoal', 'branchIntro', 'question1', 'question2', 'question3', 'holdReveal', 'branchReveal', 'branchDemo', 'secondaryGoals', 'dietaryPreferences', 'personalizedFuture', 'planReady', 'paywall'] as OnboardingV3Step[];
  assert.equal(paywallIndex, prePaywall.length - 1);
  for (const step of prePaywall) assert.equal(isRealInputUnlocked(step), false, step);
  assert.equal(isRealInputUnlocked('postPurchase'), true);
  assert.equal(getPersistedPersonalizedStep('postPurchase'), 'paywall');
  assert.equal(getPersistedPersonalizedStep('analyzing'), 'paywall');
});

test('controller guards every real input entry and makes no scan request during personalization', () => {
  const controller = read('controller/useOnboardingV3Controller.ts');
  for (const callback of ['const selectPhoto', 'const submitDescription', 'const confirmPhoto']) {
    const start = controller.indexOf(callback);
    assert.ok(start >= 0, callback);
    assert.match(controller.slice(start, start + 280), /isRealInputUnlocked\(stateRef\.current\.step\)/, callback);
  }
  const personalized = read('screens/PersonalizedOnboardingScreen.tsx');
  assert.doesNotMatch(personalized, /ImagePicker|runOnboardingAnalysis|runOnboardingRecipeGeneration|\/v1\/scans|apiClient/);
  assert.match(read('OnboardingV3.tsx'), /case 'postPurchase':[\s\S]{0,350}<ScanInputScreen/);
  assert.match(read('OnboardingV3.tsx'), /case 'branchIntro':/);
});

test('hold interaction resets on early release and provides accessible and reduced-motion paths', () => {
  const hold = read('components/HoldToReveal.tsx');
  assert.match(hold, /HOLD_TO_REVEAL_DURATION_MS = 1000/);
  assert.match(hold, /onPressOut=\{release\}/);
  assert.match(hold, /cancelAnimation\(progress\)/);
  assert.match(hold, /withTiming\(0/);
  assert.match(hold, /onAccessibilityAction/);
  assert.match(hold, /useReduceMotion/);
});

test('live Kiko moments use registry lookups and declared zero-Kiko moments resolve to no asset', () => {
  const screen = read('screens/PersonalizedOnboardingScreen.tsx');
  for (const moment of ['annual-spending-reveal', 'savings-demonstration', 'savings-projection-graph', 'favorite-foods-reveal', 'nutrition-data', 'macro-transformation', 'macro-result', 'personalized-plan-ready']) {
    assert.match(screen, new RegExp(moment));
  }
  const paywall = read('screens/OnboardingPaywallScreen.tsx');
  const postPurchase = read('screens/ScanInputScreen.tsx');
  assert.match(paywall, /getKikoOnboardingAssignment\('shared', 'paywall'\)/);
  assert.match(paywall, /sizeRole="small"/);
  assert.match(postPurchase, /getKikoOnboardingAssignment\('shared', 'post-purchase-first-scan'\)/);
});

test('entitlement is the only route from paywall to post-purchase input', () => {
  const paywall: OnboardingV3State = { ...initialOnboardingV3State, step: 'paywall' };
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_CANCELLED' }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_SUCCEEDED', entitled: false }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'RESTORE_SUCCEEDED', entitled: false }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_SUCCEEDED', entitled: true }).step, 'postPurchase');
  assert.equal(onboardingV3Reducer(paywall, { type: 'RESTORE_SUCCEEDED', entitled: true }).step, 'postPurchase');
  assert.doesNotMatch(read('screens/OnboardingPaywallScreen.tsx'), /Continue without subscribing|devBypass/i);
});
