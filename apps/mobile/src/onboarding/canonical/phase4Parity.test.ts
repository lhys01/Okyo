import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { getBranchProgress } from '../../onboarding-v3/branch-ui/branchProgress';
import { getPersistedPersonalizedStep, initialOnboardingV3State, onboardingV3Reducer } from '../../onboarding-v3/controller/onboardingV3Machine';
import type { FoodPreferences } from '../../state/foodPreferences';
import { HEALTH_PROGRESS_QUESTION_INDEX, HEALTH_STEPS, healthReducer, initialHealthDraft } from '../../onboarding-v3/state/healthBranch';
import { HEALTH_BRANCH_STORAGE_KEY } from '../../onboarding-v3/state/healthBranchPersistence';
import { MACROS_STEPS, initialMacrosDraft, macrosReducer } from '../../onboarding-v3/state/macrosBranch';
import { MACROS_BRANCH_STORAGE_KEY } from '../../onboarding-v3/state/macrosBranchPersistence';
import {
  ATTRIBUTION_STORAGE_KEY,
  DIETARY_STORAGE_KEY,
  MASCOT_NAME_STORAGE_KEY,
  PERSONALIZED_PROFILE_STORAGE_KEY,
  PERSONALIZED_PROGRESS_STORAGE_KEY,
} from '../../onboarding-v3/state/onboardingV3Persistence';
import { emptyPersonalizedProfile } from '../../onboarding-v3/state/personalizedOnboarding';
import { SAVE_MONEY_STEPS, initialSaveMoneyDraft, saveMoneyReducer } from '../../onboarding-v3/state/saveMoneyBranch';
import { SAVE_MONEY_BRANCH_STORAGE_KEY } from '../../onboarding-v3/state/saveMoneyBranchPersistence';
import { canonicalOnboardingConfig } from './config';
import { getCanonicalBranch, resolveCanonicalPreviewBranch } from './branchRegistry';
import { commitCanonicalOnboardingCompletion } from './completion';
import { createCanonicalHydrationResult, createCanonicalProfileSnapshotRequest } from './lifecycle';
import { resolveCanonicalPreviewNavigation } from './navigation';
import { CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, createCanonicalOnboardingPersistence } from './persistence';
import { resolveCanonicalProgressSnapshot } from './progress';

function memoryStorage(values = new Map<string, string>()) {
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

function hydrate(snapshot: Awaited<ReturnType<ReturnType<typeof createCanonicalOnboardingPersistence>['readSnapshot']>>, dietaryPreferences: FoodPreferences = { allergies: [], restrictions: [], avoidances: [], dislikes: [] }) {
  const handoff = createCanonicalHydrationResult({ snapshot, dietaryPreferences, mascotName: 'Mochi', attribution: 'friends_family' });
  return onboardingV3Reducer(initialOnboardingV3State, { type: 'HYDRATE', ...handoff });
}

test('hydration parity fixtures preserve clean, recoverable, malformed, and dietary-mirror V3 behavior', async () => {
  const clean = createCanonicalOnboardingPersistence(memoryStorage());
  const cleanState = hydrate(await clean.readSnapshot());
  assert.equal(cleanState.step, 'splash');
  assert.equal(cleanState.resumeStep, null);
  assert.equal(onboardingV3Reducer(cleanState, { type: 'SPLASH_FINISHED', elapsedMs: 1100, fontsLoaded: false }).step, 'showcase');

  const savedStorage = memoryStorage(new Map([
    [PERSONALIZED_PROFILE_STORAGE_KEY, JSON.stringify({ name: 'Ari', primaryGoal: 'save_money', secondaryGoals: ['save_money'] })],
    [PERSONALIZED_PROGRESS_STORAGE_KEY, 'branchDemo'],
  ]));
  const saved = await createCanonicalOnboardingPersistence(savedStorage).readSnapshot();
  const savedState = hydrate(saved, { allergies: ['Wheat'], restrictions: ['Vegan'], avoidances: ['Pork'], dislikes: ['Olives'] });
  assert.equal(savedState.profile.name, 'Ari');
  assert.deepEqual(savedState.profile.dietaryPreferences.allergies, ['Wheat']);
  assert.deepEqual(savedState.dietaryRestrictions, ['Wheat', 'Vegan']);
  assert.deepEqual(savedState.dietaryDislikes, ['Pork', 'Olives']);
  assert.equal(onboardingV3Reducer(savedState, { type: 'SPLASH_FINISHED', elapsedMs: 1100, fontsLoaded: false }).step, 'branchDemo');

  const malformed = createCanonicalOnboardingPersistence(memoryStorage(new Map([
    [PERSONALIZED_PROFILE_STORAGE_KEY, '{invalid'],
    [PERSONALIZED_PROGRESS_STORAGE_KEY, 'stale-route'],
  ])));
  const malformedState = hydrate(await malformed.readSnapshot());
  assert.equal(malformedState.profile.name, '');
  assert.equal(malformedState.resumeStep, null);
  assert.equal(onboardingV3Reducer(malformedState, { type: 'SPLASH_FINISHED', elapsedMs: 1100, fontsLoaded: false }).step, 'showcase');
});

test('resume and profile-snapshot fixtures retain V3 route policy without canonical interpretation', () => {
  const profile = { ...emptyPersonalizedProfile, name: 'Ari', primaryGoal: 'eat_healthier' as const, secondaryGoals: ['eat_healthier' as const] };
  const valid = hydrate({ schemaVersion: 1, profile, resumeStep: 'branchDemo' });
  assert.equal(onboardingV3Reducer(valid, { type: 'SPLASH_FINISHED', elapsedMs: 1100, fontsLoaded: false }).step, 'branchDemo');

  const legacy = hydrate({ schemaVersion: 1, profile, resumeStep: 'personalizedFuture' });
  assert.equal(onboardingV3Reducer(legacy, { type: 'SPLASH_FINISHED', elapsedMs: 1100, fontsLoaded: false }).step, 'planReady');

  for (const [route, expected] of [['branchDemo', 'branchDemo'], ['personalizedFuture', 'planReady'], ['recipe', 'paywall']] as const) {
    const request = createCanonicalProfileSnapshotRequest({ profile, currentRoute: route, resolveResumeRoute: (value) => getPersistedPersonalizedStep(value as Parameters<typeof getPersistedPersonalizedStep>[0]) });
    assert.equal(request.resumeStep, expected);
  }
});

test('preview parity fixtures preserve goal predicates and intro-only host exit', () => {
  const savingsEnabled = getCanonicalBranch('save_money')?.previewEnabled === true;
  const healthEnabled = getCanonicalBranch('eat_healthier')?.previewEnabled === true;
  const macrosEnabled = getCanonicalBranch('hit_macros')?.previewEnabled === true;
  assert.equal(resolveCanonicalPreviewBranch('branchIntro', 'save_money'), savingsEnabled ? 'save_money' : null);
  assert.equal(resolveCanonicalPreviewBranch('branchIntro', 'eat_healthier'), healthEnabled ? 'eat_healthier' : null);
  assert.equal(resolveCanonicalPreviewBranch('question1', 'save_money'), null);
  assert.equal(resolveCanonicalPreviewBranch('question1', 'eat_healthier'), null);
  assert.equal(resolveCanonicalPreviewBranch('question1', 'hit_macros'), macrosEnabled ? 'hit_macros' : null);
  assert.equal(canonicalOnboardingConfig.previews.hit_macros, macrosEnabled);

  for (const [label, reducer, initial] of [
    ['Savings', saveMoneyReducer, initialSaveMoneyDraft],
    ['Health', healthReducer, initialHealthDraft],
    ['Macros', macrosReducer, initialMacrosDraft],
  ] as const) {
    assert.deepEqual(resolveCanonicalPreviewNavigation({ currentRoute: 'intro', entryRoute: 'intro' }), { shouldExitHost: true }, `${label} intro exits host`);
    assert.deepEqual(resolveCanonicalPreviewNavigation({ currentRoute: 'question1', entryRoute: 'intro' }), { shouldExitHost: false }, `${label} non-intro stays reducer-owned`);
    assert.equal(reducer({ ...initial, currentStep: 'intro' } as never, { type: 'BACK_PRESSED' } as never).currentStep, 'intro');
  }
});

test('completion fixtures retain ordered canonical completion and V3 terminal timing', async () => {
  const calls: string[] = [];
  let release!: () => void;
  const persisted = new Promise<void>((resolve) => { release = resolve; });
  const completion = commitCanonicalOnboardingCompletion({
    writeCompletion: () => { calls.push('persist'); return persisted; },
    activateApp: () => { calls.push('activate'); },
  });
  assert.deepEqual(calls, ['persist']);
  release();
  assert.deepEqual(await completion, { completed: true });
  assert.deepEqual(calls, ['persist', 'activate']);

  assert.equal(onboardingV3Reducer({ ...initialOnboardingV3State, step: 'branchIntro' }, { type: 'BRANCH_PLAN_READY' }).step, 'branchPlan');
  assert.equal(onboardingV3Reducer({ ...initialOnboardingV3State, step: 'paywall' }, { type: 'DEV_BYPASS_COMPLETED' }).step, 'complete');
  assert.equal(onboardingV3Reducer({ ...initialOnboardingV3State, step: 'paywall' }, { type: 'PURCHASE_SUCCEEDED', entitled: true }).step, 'postPurchase');
});

test('reset fixture removes all active V3 onboarding lifecycle keys and leaves unrelated data', async () => {
  const storage = memoryStorage(new Map([
    [MASCOT_NAME_STORAGE_KEY, 'Kiko'],
    [ATTRIBUTION_STORAGE_KEY, 'friends_family'],
    [DIETARY_STORAGE_KEY, '{}'],
    [PERSONALIZED_PROFILE_STORAGE_KEY, '{}'],
    [PERSONALIZED_PROGRESS_STORAGE_KEY, 'branchDemo'],
    [CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, '{}'],
    [HEALTH_BRANCH_STORAGE_KEY, '{}'],
    [SAVE_MONEY_BRANCH_STORAGE_KEY, '{}'],
    [MACROS_BRANCH_STORAGE_KEY, '{}'],
    ['unrelated', 'keep'],
  ]));
  await createCanonicalOnboardingPersistence(storage).reset();
  for (const key of [MASCOT_NAME_STORAGE_KEY, ATTRIBUTION_STORAGE_KEY, DIETARY_STORAGE_KEY, PERSONALIZED_PROFILE_STORAGE_KEY, PERSONALIZED_PROGRESS_STORAGE_KEY, CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY]) assert.equal(storage.values.has(key), false);
  for (const key of [HEALTH_BRANCH_STORAGE_KEY, SAVE_MONEY_BRANCH_STORAGE_KEY, MACROS_BRANCH_STORAGE_KEY]) assert.equal(storage.values.has(key), false);
  assert.equal(storage.values.has('unrelated'), true);
});

test('branch progress fixtures match the V3 compatibility wrapper at representative routes', () => {
  // The compatibility helper still works for any route order. Health's UI now
  // uses its own question ordinal rather than this legacy screen-position value.
  assert.equal(HEALTH_PROGRESS_QUESTION_INDEX.meaning, 4);
  assert.equal(HEALTH_PROGRESS_QUESTION_INDEX.problemDiagnosis, 3);
  assert.equal(HEALTH_PROGRESS_QUESTION_INDEX.reveal, 7);
  const fixtures = [
    { branch: 'Savings', order: SAVE_MONEY_STEPS, routes: [['weeklySnapshot', { answered: 0, total: 4 }], ['reveal', { answered: 3, total: 4 }], ['complete', { answered: 4, total: 4 }]] },
    // Health Revision 3 keeps only the plan-relevant questions and skips the
    // retired acknowledgement, diagnosis, and cooking-frequency routes.
    { branch: 'Health', order: HEALTH_STEPS, routes: [['meaning', { answered: 3, total: 10 }], ['reveal', { answered: 9, total: 10 }], ['complete', { answered: 10, total: 10 }]] },
    // The active food-first Macros route has ten ordered screens; hiding its
    // intro leaves eight progress intervals in the compatibility helper.
    { branch: 'Macros', order: MACROS_STEPS, routes: [['problem', { answered: 0, total: 8 }], ['reveal', { answered: 7, total: 8 }], ['complete', { answered: 8, total: 8 }]] },
  ] as const;
  for (const fixture of fixtures) {
    for (const [route, expected] of fixture.routes) {
      const canonical = resolveCanonicalProgressSnapshot({ routeOrder: fixture.order, currentRoute: route, hiddenRoutes: ['intro'] });
      assert.deepEqual(canonical, expected, `${fixture.branch} ${route} fixture`);
      assert.deepEqual(getBranchProgress(fixture.order, route), canonical, `${fixture.branch} V3 wrapper parity at ${route}`);
    }
  }
});

test('V3 controller remains a thin caller of the canonical lifecycle contracts', () => {
  const controller = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/controller/useOnboardingV3Controller.ts'), 'utf8');
  assert.match(controller, /createCanonicalLifecycleCoordinator\(\{/);
  assert.match(controller, /if \(hydratedRef\.current\) return undefined;/);
  assert.match(controller, /runCanonicalHydrationEffect\(\{/);
  assert.match(controller, /isMounted: \(\) => mounted/);
  assert.match(controller, /markHydrated: \(\) => \{\s*hydratedRef\.current = true;/);
  assert.match(controller, /canonicalLifecycleCoordinator\.hydrate\(\)/);
  assert.match(controller, /canRunCanonicalProfilePersistence\(\{ hydrated: hydratedRef\.current, currentRoute: state\.step \}\)/);
  assert.match(controller, /runCanonicalProfilePersistenceEffect\(\{/);
  assert.match(controller, /persistProfileSnapshot: \(\) => canonicalLifecycleCoordinator\.persistProfileSnapshot\(\{/);
  assert.match(controller, /canonicalLifecycleCoordinator\.persistProfileSnapshot\(\{[\s\S]*?currentRoute: state\.step,[\s\S]*?resolveResumeRoute: \(route\) => getPersistedPersonalizedStep\(route as OnboardingV3Step\)/);
  assert.match(controller, /commitCanonicalCompletionTransaction\(\{/);
  assert.match(controller, /createCanonicalDietaryHandoff\(preferences\)/);
  assert.match(controller, /getPersistedPersonalizedStep\(route as OnboardingV3Step\)/);
});
