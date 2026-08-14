import AsyncStorage from '@react-native-async-storage/async-storage';

import { ONBOARDING_V4_DRAFT_STORAGE_KEY } from '../onboarding-v3/state/onboardingV4Draft';
import { ONBOARDING_V4_EXPERIMENT_STORAGE_KEY } from '../onboarding-v3/state/onboardingV4Experiment';
import { ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY } from '../onboarding-v3/state/onboardingV4PremiumAction';
import { ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY, ONBOARDING_V4_IN_FLIGHT_SCAN_KEY } from '../onboarding-v3/state/onboardingV4ScanPersistence';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { ONBOARDING_COMPLETED_STORAGE_KEY } from './onboardingPersistence';
import { NOTIFICATION_PREFERENCES_KEY } from './notificationPreferences';
import { foodPreferencesPersistence } from './foodPreferences';

type ClearableStore = { reset?: () => Promise<void>; clear?: () => Promise<void> };
type MultiRemoveStorage = { multiRemove: (keys: string[]) => Promise<void> };

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
    storage?: MultiRemoveStorage;
  } = {},
): Promise<void> {
  const profileStore = deps.profileStore ?? onboardingV3Persistence;
  const dietaryMirror = deps.dietaryMirror ?? foodPreferencesPersistence;
  const storage = deps.storage ?? AsyncStorage;

  clearSavedData();
  await Promise.all([
    profileStore.reset?.(),
    dietaryMirror.clear?.(),
    storage.multiRemove([
      NOTIFICATION_PREFERENCES_KEY,
      'okyo:home-start-date:v1',
      'okyo:home-first-seen-at:v1',
      ONBOARDING_V4_DRAFT_STORAGE_KEY,
      ONBOARDING_V4_EXPERIMENT_STORAGE_KEY,
      ONBOARDING_V4_IN_FLIGHT_SCAN_KEY,
      ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY,
      ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY,
      ONBOARDING_COMPLETED_STORAGE_KEY,
    ]),
  ]);
}
