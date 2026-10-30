import AsyncStorage from '@react-native-async-storage/async-storage';

import { ONBOARDING_V4_DRAFT_STORAGE_KEY } from '../onboarding-v3/state/onboardingV4Draft';
import { ONBOARDING_V4_EXPERIMENT_STORAGE_KEY } from '../onboarding-v3/state/onboardingV4Experiment';
import { ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY } from '../onboarding-v3/state/onboardingV4PremiumAction';
import { ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY, ONBOARDING_V4_IN_FLIGHT_SCAN_KEY } from '../onboarding-v3/state/onboardingV4ScanPersistence';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { ONBOARDING_COMPLETED_STORAGE_KEY } from './onboardingPersistence';
import { NOTIFICATION_PREFERENCES_KEY } from './notificationPreferences';
import { foodPreferencesPersistence } from './foodPreferences';
import { ANON_ID_STORAGE_KEY, resetAnonymousIdCache } from '../analytics/identity';
import { AUTH_PROMPT_SEEN_STORAGE_KEY } from '../auth/authPromptPersistence';
import { CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY } from '../onboarding/canonical/persistence';
import { BRANCH_COMMITMENT_STORAGE_KEY } from '../onboarding-v3/state/branchCommitmentPersistence';
import { HEALTH_BRANCH_STORAGE_KEY } from '../onboarding-v3/state/healthBranchPersistence';
import { MACROS_BRANCH_STORAGE_KEY } from '../onboarding-v3/state/macrosBranchPersistence';
import { SAVE_MONEY_BRANCH_STORAGE_KEY } from '../onboarding-v3/state/saveMoneyBranchPersistence';
import { CONSENT_LEDGER_STORAGE_KEY } from '../privacy/consentLedger';
import { SCAN_FAB_INTRO_STORAGE_KEY } from './scanFabIntroPersistence';
import { APP_FEATURE_TOUR_STORAGE_KEY } from '../tour/tourPersistence';

type ClearableStore = { reset?: () => Promise<void>; clear?: () => Promise<void> };
type MultiRemoveStorage = {
  getAllKeys?: () => Promise<string[]>;
  multiRemove: (keys: string[]) => Promise<void>;
};

const EXPLICIT_PERSONAL_STORAGE_KEYS = [
  ANON_ID_STORAGE_KEY,
  AUTH_PROMPT_SEEN_STORAGE_KEY,
  APP_FEATURE_TOUR_STORAGE_KEY,
  BRANCH_COMMITMENT_STORAGE_KEY,
  CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY,
  CONSENT_LEDGER_STORAGE_KEY,
  HEALTH_BRANCH_STORAGE_KEY,
  MACROS_BRANCH_STORAGE_KEY,
  SAVE_MONEY_BRANCH_STORAGE_KEY,
  SCAN_FAB_INTRO_STORAGE_KEY,
  'okyo:grocery-checked-items:v1',
  'okyo-local-state',
];

/**
 * The exact "delete all my data" operation `PrivacyDataScreen.tsx` triggers,
 * extracted so it is runtime-testable without rendering a React Native
 * screen. Clears every personal-data copy this repair introduces or touches:
 * the authoritative canonical profile (dietary preferences live inside it),
 * the dietary compatibility mirror, and the V4 in-progress draft (which also
 * holds an uncommitted copy of dietary answers until Save). Does not touch
 * bundled app assets (Kiko artwork, onboarding images) — those are
 * `require()`d into the JS bundle at build time and have no runtime storage
 * key to clear; see `dietaryDeletion.test.ts` for the import-graph proof.
 */
export async function clearAllPersonalOkyoData(
  clearSavedData: () => void,
  deps: {
    profileStore?: ClearableStore;
  dietaryMirror?: ClearableStore;
    removeScanImages?: () => Promise<void>;
    storage?: MultiRemoveStorage;
    clearReminder?: () => Promise<void>;
  } = {},
): Promise<void> {
  const profileStore = deps.profileStore ?? onboardingV3Persistence;
  const dietaryMirror = deps.dietaryMirror ?? foodPreferencesPersistence;
  const storage = deps.storage ?? AsyncStorage;
  const failures: unknown[] = [];

  // These stores are independent. Run every cleanup even when one layer is
  // unavailable so a transient file-system or reminder failure cannot leave
  // persisted profile/recipe keys behind. We still reject at the end so the
  // caller never reports a complete deletion when any layer failed.
  try { clearSavedData(); } catch (error) { failures.push(error); }
  const independentCleanup = await Promise.allSettled([
    profileStore.reset?.(),
    dietaryMirror.clear?.(),
    deps.removeScanImages?.() ?? removeLocalScanImages(),
    deps.clearReminder?.(),
  ]);
  for (const outcome of independentCleanup) {
    if (outcome.status === 'rejected') failures.push(outcome.reason);
  }
  // Remove persisted Zustand and profile writes last. `clearSavedData()` and
  // the profile reset can enqueue AsyncStorage writes; deleting before those
  // settle could let a just-cleared state snapshot be written back afterward.
  let discoveredOkyoKeys: string[] = [];
  try {
    discoveredOkyoKeys = storage.getAllKeys
      ? (await storage.getAllKeys()).filter((key) => key.startsWith('okyo:') || key === 'okyo-local-state')
      : [];
  } catch (error) {
    // Still remove every known key if enumeration fails, but report that an
    // unknown persisted key may remain instead of claiming complete cleanup.
    failures.push(error);
  }
  try {
    await storage.multiRemove([
      ...EXPLICIT_PERSONAL_STORAGE_KEYS,
      NOTIFICATION_PREFERENCES_KEY,
      'okyo:home-start-date:v1',
      'okyo:home-first-seen-at:v1',
      ONBOARDING_V4_DRAFT_STORAGE_KEY,
      ONBOARDING_V4_EXPERIMENT_STORAGE_KEY,
      ONBOARDING_V4_IN_FLIGHT_SCAN_KEY,
      ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY,
      ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY,
      ONBOARDING_COMPLETED_STORAGE_KEY,
      ...discoveredOkyoKeys,
    ]);
  } catch (error) {
    failures.push(error);
  }
  resetAnonymousIdCache();
  if (failures.length > 0) throw new Error('Local user data cleanup did not fully complete.');
}

/** Kept lazy so the plain Node unit tests never load the React Native runtime. */
async function removeLocalScanImages(): Promise<void> {
  // Do not load Expo's native file module under the plain Node unit runner.
  // React Native's process shim does not expose a Node runtime version.
  if (typeof process !== 'undefined' && process.versions?.node) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  if (!fileSystem.documentDirectory) return;
  await fileSystem.deleteAsync(`${fileSystem.documentDirectory}okyo-scan-images/`, { idempotent: true });
}
