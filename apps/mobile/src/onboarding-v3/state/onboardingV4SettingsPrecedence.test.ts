import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createOnboardingV3Persistence } from './onboardingV3Persistence';
import { createFoodPreferencesPersistence, toApiFoodPreferences } from '../../state/foodPreferences';
import { createDietaryPreferencesAuthority } from '../../state/dietaryPreferencesAuthority';
import { createOnboardingV4CanonicalCommitter } from './onboardingV4CanonicalCommit';
import { emptyOnboardingV4Draft, setOnboardingV4InitialGoal } from './onboardingV4Draft';
import { emptyPersonalizedProfile } from './personalizedOnboarding';

/**
 * Settings synchronization proof (Step 06 final repair, required item 2).
 *
 * `DietaryPreferencesScreen.tsx` (Settings) calls
 * `saveAuthoritativeDietaryPreferences` — the exact same function this
 * module's factory wraps, and the exact same function V4's dietary screen
 * calls via `saveAuthoritativeDietaryPreferencesPreservingAvoidances`. There
 * is only one save path; "Settings synchronization" is therefore the same
 * property already proven for V4 saves in dietaryPreferencesAuthority.test.ts
 * and onboardingV4DietaryPropagation.test.ts, exercised here from the
 * Settings-screen entry point's perspective (a full-replace save with no V4
 * draft involved at all) plus the specific "later scan reads it" and
 * "V4 draft can never overwrite it after the fact" claims.
 */
function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('a Settings-style save updates the authoritative store and the mirror stays in agreement', async () => {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  const mirrorPersistence = createFoodPreferencesPersistence(createMemoryStorage());
  const authority = createDietaryPreferencesAuthority(profilePersistence, mirrorPersistence);

  // Settings screen always sends the full FoodPreferences shape (all four
  // groups), unlike V4's preserving-avoidances helper — exercised directly here.
  await authority.save({ allergies: ['Shellfish'], restrictions: ['Halal'], avoidances: ['Cilantro'], dislikes: ['Olives'] });

  const profile = await profilePersistence.readPersonalizedProfile();
  const mirror = await mirrorPersistence.read();
  assert.deepEqual(profile.dietaryPreferences, mirror);
});

test('a later scan (reading the authoritative profile, exactly as useOnboardingV3Controller does) receives the Settings-edited values', async () => {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  const mirrorPersistence = createFoodPreferencesPersistence(createMemoryStorage());
  const authority = createDietaryPreferencesAuthority(profilePersistence, mirrorPersistence);

  await authority.save({ allergies: ['Peanuts'], restrictions: [], avoidances: [], dislikes: [] });
  // A Settings edit made after onboarding, before the next scan.
  await authority.save({ allergies: ['Peanuts', 'Tree nuts'], restrictions: ['Vegan'], avoidances: [], dislikes: [] });

  // What useOnboardingV3Controller.generateRecipe actually reads at scan time.
  const profileAtScanTime = await profilePersistence.readPersonalizedProfile();
  const requestPayload = toApiFoodPreferences(profileAtScanTime.dietaryPreferences);
  assert.deepEqual(requestPayload.dietaryAllergies, ['Peanuts', 'Tree nuts']);
  assert.deepEqual(requestPayload.dietaryRestrictions, ['Vegan']);
});

// --- Precedence: V4 draft data can never overwrite dietary or newer --------
// --- unrelated Settings edits, even through the one reviewed commit call ---

/**
 * `mergeOnboardingV4DraftIntoCanonicalProfile` (onboardingV4CanonicalBridge.ts)
 * is a pure function with no storage access of its own. Step 07 deliberately
 * wires up exactly ONE runtime call site — `onboardingV4CanonicalCommit.ts`'s
 * `commitOnboardingV4PlanToCanonicalProfile` — reviewed and permitted here.
 * This source-graph scan now allows that one file (and the bridge module
 * itself, and tests) while still failing if a second, unreviewed call site
 * ever appears — a future step wiring the merge in from somewhere else would
 * fail this test rather than silently reintroducing the overwrite risk.
 */
const thisDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(thisDir, '..', '..'); // apps/mobile/src
const REVIEWED_MERGE_BRIDGE_CALLERS = new Set(['onboardingV4CanonicalCommit.ts']);

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      files.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('onboardingV4CanonicalBridge.ts') && !REVIEWED_MERGE_BRIDGE_CALLERS.has(entry)) {
      files.push(full);
    }
  }
  return files;
}

const IMPORTS_MERGE_BRIDGE = /import\s*\{[^}]*\bmergeOnboardingV4DraftIntoCanonicalProfile\b[^}]*\}\s*from/;

test('no source file outside the one reviewed commit call site imports mergeOnboardingV4DraftIntoCanonicalProfile', () => {
  // A prose mention (e.g. onboardingV4Draft.ts's completion-lifecycle TODO
  // comment) is not a runtime call site — only a real `import { ... }`
  // statement counts as "wired up."
  const offenders = listSourceFiles(srcRoot).filter((file) => IMPORTS_MERGE_BRIDGE.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, [], 'if this fails, a new unreviewed runtime call site was added that can overwrite Settings edits with stale onboarding-draft data — it must clear/invalidate the draft on completion, and this test must be updated deliberately, not silently');
});

function createCommitHarness() {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  const commit = createOnboardingV4CanonicalCommitter(profilePersistence);
  return { profilePersistence, commit };
}

test('the reviewed plan commit never rewrites dietary preferences — Step 06 authority values pass through untouched', async () => {
  const { profilePersistence, commit } = createCommitHarness();
  await profilePersistence.writePersonalizedProfile({
    ...emptyPersonalizedProfile,
    dietaryPreferences: { allergies: ['Peanuts'], restrictions: ['Vegan'], avoidances: [], dislikes: [] },
  });

  const draft = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'save_money');
  const committed = await commit({
    ...draft,
    savingsAnswers: { takeoutFrequency: '2–3', spendPerMealDollars: 20 },
  });

  assert.deepEqual(committed.dietaryPreferences.allergies, ['Peanuts'], 'the commit must not touch dietary data at all');
  assert.deepEqual(committed.dietaryPreferences.restrictions, ['Vegan']);
});

test('the reviewed plan commit preserves a newer unrelated Settings edit made after the draft was captured', async () => {
  const { profilePersistence, commit } = createCommitHarness();
  const draft = setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'save_money');

  // A Settings edit to an unrelated field (mascot name) lands between the
  // draft being filled out and the commit actually running.
  await profilePersistence.writePersonalizedProfile({ ...emptyPersonalizedProfile, name: 'Set in Settings' });

  const committed = await commit({ ...draft, savingsAnswers: { takeoutFrequency: '1', spendPerMealDollars: 15 } });
  assert.equal(committed.name, 'Set in Settings', 'an unrelated canonical field must never be clobbered by the commit');
});

test('the reviewed plan commit never writes the literal "not_sure" primary goal', async () => {
  const { commit } = createCommitHarness();
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'not_sure' as const, resolvedPrimaryGoal: null };
  const committed = await commit(draft);
  assert.notEqual(committed.primaryGoal as unknown, 'not_sure');
});

test('the reviewed plan commit is idempotent — committing the same draft twice yields the same profile', async () => {
  const { commit } = createCommitHarness();
  const draft = { ...setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'save_money'), savingsAnswers: { takeoutFrequency: '2–3' as const, spendPerMealDollars: 20 } };
  const first = await commit(draft);
  const second = await commit(draft);
  assert.deepEqual(first, second);
});

test('a commit failure leaves the canonical profile untouched, and retrying afterward succeeds', async () => {
  const profilePersistence = createOnboardingV3Persistence(createMemoryStorage());
  let shouldFail = true;
  const flakyStore = {
    readPersonalizedProfile: profilePersistence.readPersonalizedProfile,
    writePersonalizedProfile: async (profile: Awaited<ReturnType<typeof profilePersistence.readPersonalizedProfile>>) => {
      if (shouldFail) throw new Error('write failed');
      return profilePersistence.writePersonalizedProfile(profile);
    },
  };
  const commit = createOnboardingV4CanonicalCommitter(flakyStore);
  const draft = { ...setOnboardingV4InitialGoal(emptyOnboardingV4Draft, 'save_money'), savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 } };

  await assert.rejects(commit(draft));
  const afterFailure = await profilePersistence.readPersonalizedProfile();
  assert.equal(afterFailure.primaryGoal, null, 'a failed commit must leave the canonical profile exactly as it was');

  shouldFail = false;
  const committed = await commit(draft); // retry
  assert.equal(committed.primaryGoal, 'save_money');
});
