import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { onboardingV3Reducer, initialOnboardingV3State, type OnboardingV3State } from '../controller/onboardingV3Machine';
import { calculateSavingsProjection, initialSaveMoneyDraft, normalizeSaveMoneyDraft, saveMoneyReducer } from '../state/saveMoneyBranch';
import { createSaveMoneyBranchPersistence, SAVE_MONEY_BRANCH_STORAGE_KEY } from '../state/saveMoneyBranchPersistence';
import { resolveSavingsPlan } from '../state/saveMoneyBranchPlan';

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
}

function validSavingsDraft() {
  return normalizeSaveMoneyDraft({
    ...initialSaveMoneyDraft,
    currentStep: 'reveal',
    weeklyEatingOutCount: 3,
    eatingOutCostCents: 2_500,
    weeklyReplacementTarget: 2,
    orderingFriction: 'time',
    mealTypesToReplace: ['dinner'],
    recipePriorities: ['lower_cost', 'quick_easy'],
    householdSize: 2,
  });
}

test('fresh and resumed Savings answers enter the same personalized plan-render path', async () => {
  const storage = memoryStorage();
  const persistence = createSaveMoneyBranchPersistence(storage);
  const draft = validSavingsDraft();
  assert.equal((await persistence.write(draft))?.currentStep, 'reveal');
  const firstRead = await persistence.readDetailed();
  assert.equal(firstRead.status, 'ready');
  if (firstRead.status !== 'ready') return;

  const rendered = resolveSavingsPlan(firstRead.draft);
  assert.equal(rendered.issue, null);
  assert.equal(rendered.plan?.branch, 'save_money');
  if (rendered.plan?.branch !== 'save_money') return;
  const projection = calculateSavingsProjection({
    weeklyEatingOutCount: rendered.plan.draft.weeklyEatingOutCount,
    eatingOutCostCents: rendered.plan.draft.eatingOutCostCents,
    weeklyReplacementTarget: rendered.plan.draft.weeklyReplacementTarget,
  });
  assert.equal(projection.replacements, 2);
  assert.ok(projection.weeklyPotentialSavingsCents > 0);

  // A remount/reload goes through the same persisted record and plan renderer.
  const resumed = await createSaveMoneyBranchPersistence(storage).readDetailed();
  assert.equal(resumed.status, 'ready');
  if (resumed.status === 'ready') assert.deepEqual(resolveSavingsPlan(resumed.draft), rendered);

  // The route write can lag behind the last answer write. Complete answers
  // still render the real plan even when the saved cursor remains on setup.
  const staleCursor = normalizeSaveMoneyDraft({ ...draft, currentStep: 'planSetup' });
  const recovered = resolveSavingsPlan(staleCursor);
  assert.equal(recovered.issue, null);
  assert.equal(recovered.plan?.branch, 'save_money');
  if (recovered.plan?.branch === 'save_money') {
    assert.equal(recovered.plan.draft.householdSize, rendered.plan?.branch === 'save_money' ? rendered.plan.draft.householdSize : null);
    assert.deepEqual(recovered.plan.draft.recipePriorities, rendered.plan?.branch === 'save_money' ? rendered.plan.draft.recipePriorities : []);
  }

  const screen = readFileSync(join(__dirname, 'BranchPersonalizedPlanScreen.tsx'), 'utf8');
  const scaffold = readFileSync(join(__dirname, '../branch-ui/BranchScaffold.tsx'), 'utf8');
  const savingsScreen = readFileSync(join(__dirname, 'SaveMoneyBranchScreen.tsx'), 'utf8');
  const cta = readFileSync(join(__dirname, '../components/OnboardingCTA.tsx'), 'utf8');
  assert.match(screen, /resolveSavingsPlan\(result\.draft\)/);
  assert.match(screen, /<SavingsFinalPlan state=\{draft\} projection=\{projection\} \/>/);
  assert.match(screen, /<PlanContents plan=\{plan\} variant=\{variant\} onEditTargets=/);
  assert.match(screen, /calculateSavingsProjection\(\{/);
  assert.match(screen, /progress=\{getFinalBranchPlanProgress\(branch, variant\)\}/);
  assert.match(screen, /if \(inFlight\.current \|\| !plan \|\| error\) return/);
  assert.match(screen, /onContinue\(\)/);
  assert.match(screen, /onPress=\{plan && !error \? continueToSignature/);
  assert.match(scaffold, /<ScrollView[\s\S]*?contentContainerStyle=\{styles\.content\}[\s\S]*?showsVerticalScrollIndicator/);
  assert.match(scaffold, /content: \{ flexGrow: 1, paddingBottom: 20/);
  assert.match(scaffold, /<ScrollView[\s\S]*?\n        \{footer \? <View style=\{styles\.footer\}>\{footer\}<\/View> : null\}/);
  assert.doesNotMatch(scaffold, /footer: \{[^}]*position: 'absolute'/);
  assert.match(savingsScreen, /finalSavingsStage: \{[^}]*minHeight: 238/);
  assert.match(savingsScreen, /finalSavingsOrb: \{[^}]*minHeight: 228/);
  assert.match(savingsScreen, /<Text accessibilityLiveRegion="polite"[^>]*style=\{styles\.finalOrbValue\}>/);
  assert.doesNotMatch(savingsScreen, /allowFontScaling=\{false\} style=\{styles\.finalOrbValue\}/);
  assert.match(savingsScreen, /const largeText = fontScale >= 1\.4/);
  assert.match(savingsScreen, /largeText \? <Text accessibilityRole="text" style=\{styles\.largeTextScrollHint\}>Scroll for your full plan/);
  assert.match(savingsScreen, /largeText && styles\.finalDetailsStack/);
  const savingsComponents = readFileSync(join(__dirname, '../branch-ui/SavingsPlanComponents.tsx'), 'utf8');
  assert.match(savingsComponents, /largeText && styles\.statsColumn/);
  assert.match(savingsComponents, /largeText \? 2 : 1\.2/);
  assert.doesNotMatch(savingsComponents, /allowFontScaling=\{false\} style=\{styles\.statValue\}/);
  assert.match(savingsScreen, /finalMessageText: \{[^}]*fontSize: 13/);
  assert.match(cta, /maxFontSizeMultiplier\?: number/);
  assert.match(screen, /maxFontSizeMultiplier=\{2\}/);
});

test('Retry, Back, and forward preserve Savings choices and do not duplicate the route transition', async () => {
  const draft = validSavingsDraft();
  const initialLoad = resolveSavingsPlan(draft);
  const retryLoad = resolveSavingsPlan(draft);
  assert.deepEqual(retryLoad, initialLoad);

  const review = saveMoneyReducer(draft, { type: 'BACK_PRESSED' });
  assert.equal(review.currentStep, 'planSetup');
  assert.deepEqual(review.recipePriorities, draft.recipePriorities);
  assert.equal(review.householdSize, draft.householdSize);
  const forward = saveMoneyReducer(review, { type: 'NEXT_PRESSED' });
  assert.equal(resolveSavingsPlan(forward).issue, null);
  assert.equal(forward.weeklyEatingOutCount, draft.weeklyEatingOutCount);
  assert.deepEqual(forward.mealTypesToReplace, draft.mealTypesToReplace);

  let route: OnboardingV3State = { ...initialOnboardingV3State, step: 'branchPlan', profile: { ...initialOnboardingV3State.profile, primaryGoal: 'save_money' } };
  route = onboardingV3Reducer(route, { type: 'CONTINUE' });
  assert.equal(route.step, 'branchSignature');
  route = onboardingV3Reducer(route, { type: 'BRANCH_SIGNATURE_COMPLETED' });
  assert.equal(route.step, 'branchAccount');
  assert.equal(onboardingV3Reducer(route, { type: 'BRANCH_SIGNATURE_COMPLETED' }).step, 'branchAccount');
  route = onboardingV3Reducer(route, { type: 'BRANCH_ACCOUNT_COMPLETED' });
  assert.equal(route.step, 'complete');
  assert.equal(onboardingV3Reducer(route, { type: 'BRANCH_ACCOUNT_COMPLETED' }), route);
});

test('a missing required Savings answer routes back to its question instead of rendering a default plan', () => {
  const incomplete = normalizeSaveMoneyDraft({ ...validSavingsDraft(), householdSize: null });
  const result = resolveSavingsPlan(incomplete);
  assert.equal(result.plan, null);
  assert.equal(result.issue, 'answers_incomplete');
  assert.equal(result.recoveryStep, 'planSetup');
  assert.equal(incomplete.currentStep, 'planSetup');
  assert.equal(SAVE_MONEY_BRANCH_STORAGE_KEY, 'okyo:onboarding-v3-save-money-branch:v1');
});
