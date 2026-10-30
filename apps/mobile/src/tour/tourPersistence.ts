import AsyncStorage from '@react-native-async-storage/async-storage';

// Dedicated key for the post-onboarding feature tour. Deliberately separate
// from ONBOARDING_COMPLETED_STORAGE_KEY (src/state/onboardingPersistence.ts)
// so resetting or reading one never touches the other.
export const APP_FEATURE_TOUR_STORAGE_KEY = 'okyo:app-feature-tour-completed:v1';

export type TourPersistedStatus = 'not_started' | 'completed' | 'skipped';

export function shouldStartTour({ authReady, homeReady, hydrated, pendingStart, status }: {
  authReady: boolean;
  homeReady: boolean;
  hydrated: boolean;
  pendingStart: boolean;
  status: TourPersistedStatus;
}): boolean {
  return authReady && homeReady && hydrated && !pendingStart && status === 'not_started';
}

type TourStorage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

export function createTourPersistence(storage: TourStorage) {
  return {
    async readStatus(): Promise<TourPersistedStatus> {
      const raw = await storage.getItem(APP_FEATURE_TOUR_STORAGE_KEY);
      return raw === 'completed' || raw === 'skipped' ? raw : 'not_started';
    },
    async writeStatus(status: 'completed' | 'skipped') {
      await storage.setItem(APP_FEATURE_TOUR_STORAGE_KEY, status);
    },
    /** Dev-only: lets a hidden test control re-run the tour on next Home mount. */
    async resetStatus() {
      await storage.removeItem(APP_FEATURE_TOUR_STORAGE_KEY);
    },
  };
}

export const tourPersistence = createTourPersistence(AsyncStorage);
